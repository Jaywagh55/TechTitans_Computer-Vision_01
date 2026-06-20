"""
inference_video.py — Full RIRS AI pipeline: run on test videos, save annotated outputs.

Usage
-----
    python src/inference_video.py

Outputs (relative to project root):
    outputs/annotated_frames/<video_stem>/pre_frame_XXXXX.jpg   (CLAHE-enhanced)
    outputs/annotated_frames/<video_stem>/post_frame_XXXXX.jpg  (fully annotated)
    outputs/annotated_videos/<video_stem>_annotated.mp4

The pipeline per frame:
  1. Read original frame.
  2. preprocess_frame()  → CLAHE-enhanced (saved as pre_frame).
  3. StoneDetector.detect()  → stone bounding boxes + confidence.
  4. estimate_sizes_for_detections()  → size labels.
  5. LaserClassifier.classify()  → laser alignment status + tip/line.
  6. draw_detections()  → fully annotated frame (saved as post_frame + written to video).
"""

import os
import sys
import json
import time
from pathlib import Path
from typing import List

import cv2
from tqdm import tqdm

# ── Ensure project src/ is on the path when running as a script ──
_SRC_DIR = Path(__file__).resolve().parent
_ROOT_DIR = _SRC_DIR.parent
if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

from utils import preprocess_frame, draw_detections, save_frame, create_video_writer
from stone_detector import StoneDetector
from size_estimator import estimate_sizes_for_detections
from laser_classifier import LaserClassifier


# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────
VIDEO_DIR = _ROOT_DIR / "test_videos-20260620T032533Z-3-001" / "test_videos"
OUTPUT_FRAMES_DIR = _ROOT_DIR / "outputs" / "annotated_frames"
OUTPUT_VIDEOS_DIR = _ROOT_DIR / "outputs" / "annotated_videos"

# Save every Nth frame as JPEG to keep output manageable (1 = every frame)
FRAME_SAVE_EVERY = 5

# Detection settings — higher thresholds reduce false positives (hallucination)
CONF_THRESHOLD = 0.35
STONE_SCORE_THRESHOLD = 0.35


def process_video(
    video_path: Path,
    detector: StoneDetector,
    laser_clf: LaserClassifier,
) -> dict:
    """
    Process a single video file through the full RIRS pipeline.

    Returns a summary dict with frame counts and detection statistics.
    """
    video_stem = video_path.stem
    print(f"\n{'='*60}")
    print(f"Processing: {video_path.name}")
    print(f"{'='*60}")

    # Create output directories for this video
    frames_out = OUTPUT_FRAMES_DIR / video_stem
    frames_out.mkdir(parents=True, exist_ok=True)
    OUTPUT_VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"[ERROR] Cannot open video: {video_path}")
        return {}

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    print(f"  Resolution : {width}x{height}")
    print(f"  FPS        : {fps:.1f}")
    print(f"  Frames     : {total_frames}")

    # Output video writer
    out_video_path = OUTPUT_VIDEOS_DIR / f"{video_stem}_annotated.mp4"
    writer = create_video_writer(str(out_video_path), fps, width, height)

    # Statistics
    stats = {
        "video": video_path.name,
        "total_frames": total_frames,
        "frames_with_stones": 0,
        "total_stone_detections": 0,
        "laser_safe": 0,
        "laser_not_safe": 0,
        "laser_uncertain": 0,
        "size_distribution": {"<5mm": 0, "5-10mm": 0, ">10mm": 0},
        "per_frame": [],
    }

    frame_idx = 0
    t_start = time.time()

    with tqdm(total=total_frames, desc=video_stem, unit="frame") as pbar:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            # ── Step 1: Pre-processing ──────────────────────────────
            enhanced = preprocess_frame(frame)

            # ── Step 2: Stone detection ─────────────────────────────
            detections = detector.detect(enhanced)

            # ── Step 3: Size estimation ─────────────────────────────
            size_labels = estimate_sizes_for_detections(detections, frame.shape)

            # ── Step 4: Laser alignment classification ──────────────
            laser_status, laser_tip, laser_line = laser_clf.classify(enhanced, detections)

            # ── Step 5: Draw annotations ────────────────────────────
            annotated = draw_detections(
                enhanced,
                detections,
                size_labels,
                laser_status,
                laser_line,
            )

            # ── Step 6: Write annotated frame to output video ───────
            writer.write(annotated)

            # ── Step 7: Save sample frames as JPEGs ─────────────────
            if frame_idx % FRAME_SAVE_EVERY == 0:
                pre_path = frames_out / f"pre_frame_{frame_idx:05d}.jpg"
                post_path = frames_out / f"post_frame_{frame_idx:05d}.jpg"
                save_frame(enhanced, str(pre_path))
                save_frame(annotated, str(post_path))

            # ── Update statistics ────────────────────────────────────
            if detections:
                stats["frames_with_stones"] += 1
                stats["total_stone_detections"] += len(detections)

            if laser_status == "safe_to_shoot":
                stats["laser_safe"] += 1
            elif laser_status == "not_safe_to_shoot":
                stats["laser_not_safe"] += 1
            else:
                stats["laser_uncertain"] += 1

            # Count size categories
            from size_estimator import estimate_size
            for det in detections:
                sz = estimate_size(det["bbox"], frame.shape)
                cat = sz["category"]
                if cat in stats["size_distribution"]:
                    stats["size_distribution"][cat] += 1

            # Per-frame log entry (every 50 frames to keep JSON small)
            if frame_idx % 50 == 0:
                stats["per_frame"].append({
                    "frame": frame_idx,
                    "stones": len(detections),
                    "laser": laser_status,
                    "sizes": size_labels,
                })

            frame_idx += 1
            pbar.update(1)

    cap.release()
    writer.release()

    elapsed = time.time() - t_start
    stats["elapsed_seconds"] = round(elapsed, 1)
    stats["avg_fps_processed"] = round(frame_idx / elapsed, 1) if elapsed > 0 else 0

    # Save JSON summary
    summary_path = OUTPUT_FRAMES_DIR / video_stem / "summary.json"
    with open(summary_path, "w") as f:
        json.dump(stats, f, indent=2)

    print(f"\n  Done in {elapsed:.1f}s  ({stats['avg_fps_processed']} fps)")
    print(f"  Stones detected in {stats['frames_with_stones']}/{frame_idx} frames")
    print(f"  Laser  safe={stats['laser_safe']}  not_safe={stats['laser_not_safe']}  uncertain={stats['laser_uncertain']}")
    print(f"  Annotated video : {out_video_path}")
    print(f"  Frame JPEGs     : {frames_out}")
    print(f"  Summary JSON    : {summary_path}")

    return stats


def main():
    print("\n" + "=" * 60)
    print("  RIRS AI Surgery Assistant — Inference Pipeline")
    print("=" * 60)

    # Discover test videos
    if not VIDEO_DIR.exists():
        print(f"[ERROR] Video directory not found: {VIDEO_DIR}")
        sys.exit(1)

    video_paths = sorted(VIDEO_DIR.glob("*.mp4"))
    if not video_paths:
        print(f"[ERROR] No .mp4 files found in {VIDEO_DIR}")
        sys.exit(1)

    print(f"\nFound {len(video_paths)} video(s):")
    for vp in video_paths:
        print(f"  - {vp.name}")

    # Initialise models (shared across all videos)
    print("\nLoading models...")
    detector = StoneDetector(
        conf_threshold=CONF_THRESHOLD,
        stone_score_threshold=STONE_SCORE_THRESHOLD,
        use_finetuned=True,
        imgsz=416,
    )
    laser_clf = LaserClassifier()
    print("Models loaded.\n")

    # Process each video
    all_stats = []
    for vp in video_paths:
        s = process_video(vp, detector, laser_clf)
        all_stats.append(s)

    # Global summary
    print("\n" + "=" * 60)
    print("  Pipeline complete.")
    print("=" * 60)
    print(f"\nOutputs saved to:")
    print(f"  Frames  : {OUTPUT_FRAMES_DIR}")
    print(f"  Videos  : {OUTPUT_VIDEOS_DIR}")


if __name__ == "__main__":
    main()
