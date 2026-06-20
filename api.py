"""
Flask API for RIRS AI video inference.
Handles: upload video -> run inference -> serve pre/post frames + metadata.
"""
import os, sys, json, uuid, tempfile, threading, time, cv2, numpy as np, shutil
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))
from stone_detector import StoneDetector
from size_estimator import estimate_sizes_for_detections
from laser_classifier import LaserClassifier
from utils import preprocess_frame, draw_detections

app = Flask(__name__)
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024 * 1024  # 2GB max upload

JOBS = {}
UPLOAD_DIR = tempfile.mkdtemp(prefix="rirs_api_")

# Process every Nth frame for speed (5 = every 5th frame → 6x faster than every frame)
FRAME_STEP = 5

# Downscale frames before saving (reduces disk I/O massively for 1920x1080 video)
SAVE_MAX_WIDTH = 640

# JPEG quality (lower = faster write, smaller file)
JPEG_QUALITY = 50

def run_inference(video_path: str, job_id: str):
    """Run full inference on a video and store results."""
    job = JOBS[job_id]
    job_dir = os.path.join(UPLOAD_DIR, job_id)
    os.makedirs(os.path.join(job_dir, "pre"), exist_ok=True)
    os.makedirs(os.path.join(job_dir, "post"), exist_ok=True)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        job["status"] = "error"
        job["error"] = "Cannot open video"
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frames_to_process = total_frames // FRAME_STEP

    job.update({
        "status": "processing",
        "total_frames": frames_to_process,
        "fps": fps, "width": w, "height": h,
        "frame_step": FRAME_STEP,
        "start_time": time.time(),
    })

    # Optimized for CPU-only speed: imgsz=320 (2x faster than 416), conf=0.30
    detector = StoneDetector(conf_threshold=0.30, stone_score_threshold=0.35, imgsz=320)
    laser_clf = LaserClassifier()

    frame_idx = 0
    saved_idx = 0
    laser_safe = laser_not_safe = laser_uncertain = 0
    frames_with_stones = 0
    total_dets = 0
    size_dist = {"<5mm": 0, "5-10mm": 0, ">10mm": 0}
    stone_frames = []  # List of frame indices where stones were detected
    fps_proc = 0

    while True:
        if job.get("cancelled"):
            job["status"] = "cancelled"
            cap.release()
            return

        ret, frame = cap.read()
        if not ret:
            break

        # Skip frames for speed
        if frame_idx % FRAME_STEP != 0:
            frame_idx += 1
            continue

        enhanced = preprocess_frame(frame)
        detections = detector.detect(enhanced)
        sizes = estimate_sizes_for_detections(detections, frame.shape)
        laser_status, laser_tip, laser_line = laser_clf.classify(enhanced, detections)
        annotated = draw_detections(enhanced, detections, sizes, laser_status, laser_line)

        if detections:
            frames_with_stones += 1
            total_dets += len(detections)
            stone_frames.append(saved_idx)
            for d in detections:
                sz = d.get("size_label", "")
                if sz in size_dist:
                    size_dist[sz] += 1

        if laser_status == "safe_to_shoot": laser_safe += 1
        elif laser_status == "not_safe_to_shoot": laser_not_safe += 1
        else: laser_uncertain += 1

        # Downscale before saving (1920x1080 → 640x360 saves ~90% disk I/O)
        if enhanced.shape[1] > SAVE_MAX_WIDTH:
            scale = SAVE_MAX_WIDTH / enhanced.shape[1]
            new_h = int(enhanced.shape[0] * scale)
            save_pre = cv2.resize(enhanced, (SAVE_MAX_WIDTH, new_h))
            save_post = cv2.resize(annotated, (SAVE_MAX_WIDTH, new_h))
        else:
            save_pre, save_post = enhanced, annotated

        pre_path = os.path.join(job_dir, "pre", f"{saved_idx:06d}.jpg")
        post_path = os.path.join(job_dir, "post", f"{saved_idx:06d}.jpg")
        cv2.imwrite(pre_path, save_pre, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        cv2.imwrite(post_path, save_post, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])

        saved_idx += 1
        frame_idx += 1

        # Update progress with ETA
        elapsed = time.time() - job["start_time"]
        fps_proc = saved_idx / max(elapsed, 0.01)
        remaining = max(0, (frames_to_process - saved_idx) / max(fps_proc, 0.1))
        job.update({
            "processed_frames": saved_idx,
            "progress": round(saved_idx / max(frames_to_process, 1) * 100, 1),
            "fps_processing": round(fps_proc, 1),
            "eta_seconds": round(remaining),
        })

    cap.release()

    summary = {
        "total_frames": saved_idx,
        "frames_with_stones": frames_with_stones,
        "total_stone_detections": total_dets,
        "laser_safe": laser_safe,
        "laser_not_safe": laser_not_safe,
        "laser_uncertain": laser_uncertain,
        "size_distribution": size_dist,
        "stone_frames": stone_frames,  # List of frame indices with stones
        "processing_time": round(time.time() - job["start_time"], 1),
    }

    with open(os.path.join(job_dir, "summary.json"), "w") as f:
        json.dump(summary, f, indent=2)

    job.update({"status": "done", "summary": summary, "progress": 100, "eta_seconds": 0})


@app.route("/api/upload", methods=["POST"])
def upload_video():
    if "video" not in request.files:
        return jsonify({"error": "No video file provided"}), 400

    f = request.files["video"]
    if not f.filename:
        return jsonify({"error": "Empty filename"}), 400

    job_id = str(uuid.uuid4())[:8]
    job_dir = os.path.join(UPLOAD_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)

    video_path = os.path.join(job_dir, "input" + os.path.splitext(f.filename)[1])
    f.save(video_path)

    JOBS[job_id] = {
        "status": "queued",
        "video_path": video_path,
        "filename": f.filename,
        "processed_frames": 0,
        "progress": 0,
        "upload_time": time.time(),
    }

    t = threading.Thread(target=run_inference, args=(video_path, job_id), daemon=True)
    t.start()

    return jsonify({"job_id": job_id})


@app.route("/api/cancel/<job_id>", methods=["POST"])
def cancel_job(job_id):
    job = JOBS.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    job["cancelled"] = True
    job["status"] = "cancelled"
    # Clean up files
    job_dir = os.path.join(UPLOAD_DIR, job_id)
    if os.path.exists(job_dir):
        shutil.rmtree(job_dir, ignore_errors=True)
    return jsonify({"ok": True})


@app.route("/api/status/<job_id>")
def job_status(job_id):
    job = JOBS.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify({k: v for k, v in job.items() if k != "summary"})


@app.route("/api/summary/<job_id>")
def job_summary(job_id):
    job = JOBS.get(job_id)
    if not job or "summary" not in job:
        return jsonify({"error": "Summary not available"}), 404
    return jsonify(job["summary"])


@app.route("/api/frame/<job_id>/<kind>/<frame_idx>")
def get_frame(job_id, kind, frame_idx):
    if kind not in ("pre", "post"):
        return jsonify({"error": "Invalid kind"}), 400
    frame_path = os.path.join(UPLOAD_DIR, job_id, kind, f"{int(frame_idx):06d}.jpg")
    if not os.path.exists(frame_path):
        return jsonify({"error": "Frame not found"}), 404
    return send_file(frame_path, mimetype="image/jpeg")


@app.route("/api/video/<job_id>")
def get_video(job_id):
    job = JOBS.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return send_file(job["video_path"], mimetype="video/mp4")


if __name__ == "__main__":
    print(f"[RIRS API] Upload dir: {UPLOAD_DIR}")
    print(f"[RIRS API] Frame step: {FRAME_STEP} (processing every {FRAME_STEP}rd frame)")
    print(f"[RIRS API] Starting on http://localhost:8000")
    app.run(host="0.0.0.0", port=8000, debug=False, threaded=True)