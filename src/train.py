"""
train.py — Pseudo-label fine-tuning of YOLOv8 on RIRS training images.

Strategy
--------
Since no human-annotated labels are available:
  1. Run YOLOv8n (pre-trained on COCO) over all images in train/.
  2. Apply CLAHE pre-processing to each image before inference.
  3. Keep only detections that pass the stone-likelihood heuristic
     (brightness + compactness + texture score >= threshold).
  4. Save the kept detections as YOLO-format .txt label files in train_labels/.
  5. Generate data.yaml for the fine-tuning run.
  6. Fine-tune YOLOv8n for 30 epochs on the pseudo-labelled dataset.
  7. Best weights saved to models/rirs/weights/best.pt
     → also copied to models/rirs_best.pt for use by the inference pipeline.

Usage
-----
    python src/train.py [--epochs 30] [--batch 16] [--imgsz 640]

Requirements
------------
  CUDA GPU strongly recommended (inference_video.py works on CPU but training
  will be very slow without a GPU).
"""

import argparse
import os
import shutil
import sys
from pathlib import Path

import cv2
import yaml
from tqdm import tqdm
from ultralytics import YOLO

# ── Path setup ────────────────────────────────────────────────────
_SRC_DIR = Path(__file__).resolve().parent
_ROOT_DIR = _SRC_DIR.parent

if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

from utils import preprocess_frame
from stone_detector import _stone_likelihood

# ── Directories ───────────────────────────────────────────────────
TRAIN_IMAGES_DIR = _ROOT_DIR / "train"
TRAIN_LABELS_DIR = _ROOT_DIR / "train_labels"
DATA_YAML_PATH = _ROOT_DIR / "data.yaml"
MODELS_DIR = _ROOT_DIR / "models"

# ── Pseudo-labelling settings ─────────────────────────────────────
PSEUDO_CONF_THRESHOLD = 0.25     # minimum YOLO confidence
STONE_SCORE_THRESHOLD = 0.30    # minimum stone-likelihood heuristic score
# Treat ALL detections as class 0 ("stone") in the pseudo-labels
STONE_CLASS_ID = 0


def generate_pseudo_labels(model: YOLO) -> int:
    """
    Run the pre-trained model over all train images and save YOLO-format
    pseudo-label .txt files.

    Returns the number of images that received at least one label.
    """
    TRAIN_LABELS_DIR.mkdir(parents=True, exist_ok=True)

    image_paths = sorted(TRAIN_IMAGES_DIR.glob("*.jpg")) + \
                  sorted(TRAIN_IMAGES_DIR.glob("*.png"))

    if not image_paths:
        print(f"[ERROR] No images found in {TRAIN_IMAGES_DIR}")
        sys.exit(1)

    print(f"\nGenerating pseudo-labels for {len(image_paths)} images...")
    labelled_count = 0

    for img_path in tqdm(image_paths, desc="Pseudo-labelling", unit="img"):
        frame = cv2.imread(str(img_path))
        if frame is None:
            continue

        h, w = frame.shape[:2]

        # Pre-process
        enhanced = preprocess_frame(frame)

        # Run detection
        results = model(enhanced, conf=PSEUDO_CONF_THRESHOLD, verbose=False)

        lines = []
        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                conf = float(box.conf[0])
                xyxy = box.xyxy[0].cpu().numpy().astype(int).tolist()
                x1, y1, x2, y2 = xyxy

                # Stone-likelihood gate
                stone_score = _stone_likelihood(enhanced, [x1, y1, x2, y2])
                if stone_score < STONE_SCORE_THRESHOLD:
                    continue

                # Convert to YOLO normalised format: class cx cy w h
                cx = ((x1 + x2) / 2) / w
                cy = ((y1 + y2) / 2) / h
                bw = (x2 - x1) / w
                bh = (y2 - y1) / h
                lines.append(f"{STONE_CLASS_ID} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}")

        label_path = TRAIN_LABELS_DIR / (img_path.stem + ".txt")
        with open(label_path, "w") as f:
            f.write("\n".join(lines))

        if lines:
            labelled_count += 1

    print(f"  {labelled_count}/{len(image_paths)} images have at least one pseudo-label.")
    return labelled_count


def write_data_yaml() -> None:
    """Write the data.yaml file required by ultralytics YOLO training."""
    data = {
        "path": str(_ROOT_DIR),
        "train": "train",
        "val": "train",      # use training set as val (no separate val split available)
        "nc": 1,
        "names": ["stone"],
    }
    with open(DATA_YAML_PATH, "w") as f:
        yaml.dump(data, f, default_flow_style=False)
    print(f"  data.yaml written to: {DATA_YAML_PATH}")


def fine_tune(epochs: int, batch: int, imgsz: int) -> Path:
    """
    Fine-tune YOLOv8n on the pseudo-labelled RIRS dataset.

    Returns the path to the best weights file.
    """
    print(f"\nStarting fine-tuning: epochs={epochs}, batch={batch}, imgsz={imgsz}")
    model = YOLO("yolov8n.pt")

    model.train(
        data=str(DATA_YAML_PATH),
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        project=str(MODELS_DIR),
        name="rirs",
        exist_ok=True,
        patience=10,           # early stopping
        optimizer="AdamW",
        lr0=1e-3,
        lrf=0.01,
        weight_decay=5e-4,
        warmup_epochs=3,
        mosaic=0.5,            # mild augmentation
        flipud=0.5,
        fliplr=0.5,
        degrees=10.0,          # slight rotation for scope angle variation
        hsv_h=0.015,
        hsv_s=0.3,
        hsv_v=0.3,
        verbose=True,
    )

    best_weights = MODELS_DIR / "rirs" / "weights" / "best.pt"
    if best_weights.exists():
        dest = MODELS_DIR / "rirs_best.pt"
        shutil.copy(best_weights, dest)
        print(f"\nBest weights copied to: {dest}")
        return dest
    else:
        print("[WARNING] best.pt not found after training.")
        return best_weights


def main():
    parser = argparse.ArgumentParser(description="RIRS pseudo-label fine-tuning")
    parser.add_argument("--epochs", type=int, default=30, help="Training epochs")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--imgsz", type=int, default=640, help="Input image size")
    parser.add_argument(
        "--skip-pseudo",
        action="store_true",
        help="Skip pseudo-label generation (use existing train_labels/)",
    )
    args = parser.parse_args()

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    print("\n" + "=" * 60)
    print("  RIRS AI — Pseudo-Label Fine-Tuning")
    print("=" * 60)

    # Step 1: Generate pseudo-labels
    if not args.skip_pseudo:
        base_model = YOLO("yolov8n.pt")
        generate_pseudo_labels(base_model)
        del base_model  # free memory before training
    else:
        print("\n[Skipping pseudo-label generation — using existing train_labels/]")

    # Step 2: Write data.yaml
    write_data_yaml()

    # Step 3: Fine-tune
    best_path = fine_tune(args.epochs, args.batch, args.imgsz)

    print("\n" + "=" * 60)
    print(f"  Training complete.")
    print(f"  Best weights: {best_path}")
    print("=" * 60)
    print("\nRun inference with:")
    print("  python src/inference_video.py")


if __name__ == "__main__":
    main()
