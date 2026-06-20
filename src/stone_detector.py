"""
stone_detector.py — YOLOv8 wrapper for kidney stone detection in RIRS endoscopic frames.

Strategy (no ground-truth labels available):
  - Load YOLOv8n pre-trained on COCO.
  - In a kidney-stone endoscopic context, stones typically appear as bright,
    rounded, irregular objects against a darker tissue background.
  - We use the model in a domain-adaptive way:
      1. Run full YOLOv8 inference on the CLAHE-enhanced frame.
      2. Post-filter detections by a custom stone-likelihood scoring function
         that checks shape compactness, brightness contrast, and texture.
  - If fine-tuned weights exist at models/rirs_best.pt they are used instead.
"""

import os
import math
from pathlib import Path
from typing import List, Dict, Tuple

import cv2
import numpy as np

# ultralytics import – installed via requirements.txt
from ultralytics import YOLO


# ──────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────
_BASE_DIR = Path(__file__).resolve().parent.parent
_FINETUNED_WEIGHTS = _BASE_DIR / "models" / "rirs_best.pt"
_PRETRAINED_WEIGHTS = "yolov8n.pt"  # auto-downloaded by ultralytics


# ──────────────────────────────────────────────
# Stone-likelihood heuristics
# ──────────────────────────────────────────────
def _stone_likelihood(frame: np.ndarray, bbox: List[int]) -> float:
    """
    Score how likely a detected bounding box contains a kidney stone.

    Kidney stones in RIRS video tend to:
      - Be bright (high mean luminance relative to surroundings).
      - Be roughly compact / rounded (aspect ratio close to 1).
      - Show a grainy / textured surface (higher local standard deviation).

    Returns a score in [0, 1].  Higher = more stone-like.
    """
    x1, y1, x2, y2 = bbox
    h, w = frame.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w - 1, x2), min(h - 1, y2)

    if x2 <= x1 or y2 <= y1:
        return 0.0

    roi = frame[y1:y2, x1:x2]
    gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY) if roi.ndim == 3 else roi

    # 1. Brightness score: stones are brighter than dark tissue backgrounds
    mean_bright = gray_roi.mean() / 255.0

    # 2. Compactness score: prefer roughly square (aspect ratio ~1)
    bw = x2 - x1
    bh = y2 - y1
    ar = min(bw, bh) / max(bw, bh) if max(bw, bh) > 0 else 0.0

    # 3. Texture score: kidney stones have granular surface (high std dev)
    std_val = gray_roi.std() / 128.0  # normalise to ~1
    texture_score = min(std_val, 1.0)

    # 4. Edge density: stones have sharper edges than soft tissue
    edges = cv2.Canny(gray_roi, 50, 150)
    edge_density = np.count_nonzero(edges) / max(edges.size, 1)
    edge_score = min(edge_density * 5.0, 1.0)

    # 5. Size penalty: very large detections are likely tissue, not stones
    roi_area = bw * bh
    frame_area = w * h
    area_ratio = roi_area / frame_area
    size_penalty = 1.0 if area_ratio < 0.15 else max(0.0, 1.0 - (area_ratio - 0.15) * 4)

    # Weighted combination
    score = (0.30 * mean_bright + 0.20 * ar + 0.20 * texture_score +
             0.15 * edge_score + 0.15 * size_penalty)
    return float(np.clip(score, 0.0, 1.0))


class StoneDetector:
    """
    YOLOv8-based kidney stone detector.

    Parameters
    ----------
    conf_threshold : float
        Minimum YOLO confidence to keep a detection.
    stone_score_threshold : float
        Minimum stone-likelihood score (heuristic) to keep a detection.
        Set to 0.0 to disable heuristic filtering.
    use_finetuned : bool
        If True and fine-tuned weights exist, use them; otherwise use base weights.
    """

    def __init__(
        self,
        conf_threshold: float = 0.30,
        stone_score_threshold: float = 0.30,
        use_finetuned: bool = True,
        imgsz: int = 416,
    ):
        self.conf_threshold = conf_threshold
        self.stone_score_threshold = stone_score_threshold
        self.imgsz = imgsz

        # Select weight file
        if use_finetuned and _FINETUNED_WEIGHTS.exists():
            weights = str(_FINETUNED_WEIGHTS)
            print(f"[StoneDetector] Loading fine-tuned weights: {weights}")
        else:
            weights = _PRETRAINED_WEIGHTS
            print(f"[StoneDetector] Loading pre-trained weights: {weights}")

        self.model = YOLO(weights)

    def detect(self, frame: np.ndarray) -> List[Dict]:
        """
        Run stone detection on a single BGR frame.

        Parameters
        ----------
        frame : np.ndarray
            CLAHE-preprocessed BGR image.

        Returns
        -------
        list of dict
            Each dict: {'bbox': [x1,y1,x2,y2], 'conf': float, 'class_id': int,
                        'stone_score': float}
            Sorted by confidence descending.
        """
        results = self.model(
            frame, conf=self.conf_threshold, verbose=False,
            imgsz=self.imgsz, device='cpu', half=False, augment=False,
        )
        detections: List[Dict] = []

        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                conf = float(box.conf[0])
                class_id = int(box.cls[0])
                xyxy = box.xyxy[0].cpu().numpy().astype(int).tolist()
                x1, y1, x2, y2 = xyxy

                # Compute stone-likelihood heuristic
                stone_score = _stone_likelihood(frame, [x1, y1, x2, y2])

                if stone_score < self.stone_score_threshold:
                    continue

                detections.append(
                    {
                        "bbox": [x1, y1, x2, y2],
                        "conf": conf,
                        "class_id": class_id,
                        "stone_score": stone_score,
                    }
                )

        # Sort by confidence descending
        detections.sort(key=lambda d: d["conf"], reverse=True)
        return detections

    def detect_batch(self, frames: List[np.ndarray]) -> List[List[Dict]]:
        """Run detect() over a list of frames."""
        return [self.detect(f) for f in frames]
