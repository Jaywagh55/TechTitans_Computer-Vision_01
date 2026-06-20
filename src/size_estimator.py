"""
size_estimator.py — Kidney stone size estimation from bounding box pixel dimensions.

Method
------
We assume the standard RIRS flexible ureteroscope field-of-view (FOV):
  - At ~10 mm working distance, the FOV diameter is approximately 15 mm.
  - The shorter frame dimension maps to this FOV diameter.

Formula:
  pixel_diameter  = sqrt(bbox_width * bbox_height)   (geometric mean)
  mm_per_pixel    = FOV_MM / min(frame_width, frame_height)
  diameter_mm     = pixel_diameter * mm_per_pixel

Clinical size categories (used by urologists for treatment planning):
  < 5 mm   – small  (usually treatable in a single session)
  5–10 mm  – medium (fragmentation typically needed)
  > 10 mm  – large  (multiple sessions or alternative approach may be needed)
"""

import math
from typing import Dict, List, Tuple


# ──────────────────────────────────────────────
# Scope calibration constants
# ──────────────────────────────────────────────
# Field-of-view diameter of a typical flexible ureteroscope at 10 mm working distance.
FOV_MM: float = 15.0


def estimate_size(
    bbox: List[int],
    frame_shape: Tuple[int, int],
    fov_mm: float = FOV_MM,
) -> Dict:
    """
    Estimate the approximate physical size of a detected kidney stone.

    Parameters
    ----------
    bbox : list of int
        [x1, y1, x2, y2] bounding box coordinates (pixels).
    frame_shape : tuple of int
        (height, width) of the full video frame.
    fov_mm : float
        Assumed field-of-view diameter in millimetres.

    Returns
    -------
    dict with keys:
        'diameter_mm'   : float – estimated diameter in mm
        'area_mm2'      : float – estimated area in mm²
        'category'      : str   – '<5mm', '5-10mm', '>10mm'
        'label'         : str   – human-readable label, e.g. "~7.3 mm (medium)"
        'mm_per_pixel'  : float – calibration factor used
    """
    x1, y1, x2, y2 = bbox
    bw = max(x2 - x1, 1)
    bh = max(y2 - y1, 1)

    frame_h, frame_w = frame_shape[:2]
    # Calibration: shorter dimension = FOV diameter
    mm_per_pixel = fov_mm / min(frame_w, frame_h)

    # Geometric-mean diameter in pixels → convert to mm
    pixel_diameter = math.sqrt(bw * bh)
    diameter_mm = pixel_diameter * mm_per_pixel

    # Area: treat stone as ellipse with axes bw and bh
    area_mm2 = math.pi * (bw / 2) * (bh / 2) * (mm_per_pixel ** 2)

    # Category
    if diameter_mm < 5.0:
        category = "<5mm"
        size_desc = "small"
    elif diameter_mm <= 10.0:
        category = "5-10mm"
        size_desc = "medium"
    else:
        category = ">10mm"
        size_desc = "large"

    label = f"~{diameter_mm:.1f} mm ({size_desc})"

    return {
        "diameter_mm": round(diameter_mm, 2),
        "area_mm2": round(area_mm2, 2),
        "category": category,
        "label": label,
        "mm_per_pixel": round(mm_per_pixel, 5),
    }


def estimate_sizes_for_detections(
    detections: List[Dict],
    frame_shape: Tuple[int, int],
    fov_mm: float = FOV_MM,
) -> List[str]:
    """
    Convenience wrapper: estimate sizes for a list of detections.

    Returns a list of human-readable label strings (one per detection).
    """
    labels = []
    for det in detections:
        result = estimate_size(det["bbox"], frame_shape, fov_mm)
        labels.append(result["label"])
    return labels
