"""
utils.py — Preprocessing and drawing helpers for the RIRS AI pipeline.
"""

import cv2
import numpy as np
from typing import List, Dict, Optional, Tuple


# ──────────────────────────────────────────────
# Color constants (BGR)
# ──────────────────────────────────────────────
COLOR_SAFE = (0, 200, 0)        # Green  – safe to shoot
COLOR_NOT_SAFE = (0, 0, 220)    # Red    – not safe to shoot
COLOR_UNCERTAIN = (0, 200, 220) # Yellow – uncertain
COLOR_BOX = (0, 255, 255)       # Cyan   – default stone box
COLOR_TEXT_BG = (20, 20, 20)    # Dark grey text background


def preprocess_frame(frame: np.ndarray) -> np.ndarray:
    """
    Apply CLAHE contrast enhancement on the L-channel (LAB colorspace) to
    improve visibility in dark / murky endoscopic video frames.

    Parameters
    ----------
    frame : np.ndarray
        BGR image as read by OpenCV.

    Returns
    -------
    np.ndarray
        Contrast-enhanced BGR image.
    """
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    l_enhanced = clahe.apply(l_channel)

    lab_enhanced = cv2.merge([l_enhanced, a_channel, b_channel])
    enhanced = cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2BGR)
    return enhanced


def _get_laser_color(laser_status: str) -> Tuple[int, int, int]:
    """Map laser status string to BGR color."""
    if laser_status == "safe_to_shoot":
        return COLOR_SAFE
    elif laser_status == "not_safe_to_shoot":
        return COLOR_NOT_SAFE
    else:
        return COLOR_UNCERTAIN


def _draw_label(
    frame: np.ndarray,
    text: str,
    position: Tuple[int, int],
    color: Tuple[int, int, int],
    font_scale: float = 0.55,
    thickness: int = 1,
) -> None:
    """Draw a text label with a filled background rectangle."""
    font = cv2.FONT_HERSHEY_SIMPLEX
    (tw, th), baseline = cv2.getTextSize(text, font, font_scale, thickness)
    x, y = position
    # Background rectangle
    cv2.rectangle(
        frame,
        (x - 2, y - th - baseline - 2),
        (x + tw + 2, y + baseline),
        COLOR_TEXT_BG,
        cv2.FILLED,
    )
    cv2.putText(frame, text, (x, y), font, font_scale, color, thickness, cv2.LINE_AA)


def draw_detections(
    frame: np.ndarray,
    detections: List[Dict],
    size_labels: List[str],
    laser_status: str,
    laser_line: Optional[Tuple[int, int, int, int]] = None,
) -> np.ndarray:
    """
    Draw bounding boxes, size labels, and laser alignment status onto a frame.

    Parameters
    ----------
    frame : np.ndarray
        BGR image (will be drawn on in-place AND returned).
    detections : list of dict
        Each dict: {'bbox': [x1,y1,x2,y2], 'conf': float, 'class_id': int}
    size_labels : list of str
        One size label per detection.
    laser_status : str
        One of 'safe_to_shoot', 'not_safe_to_shoot', 'uncertain'.
    laser_line : tuple or None
        (x1, y1, x2, y2) of the detected laser line, or None.

    Returns
    -------
    np.ndarray
        Annotated frame.
    """
    vis = frame.copy()
    status_color = _get_laser_color(laser_status)

    # Draw laser line if detected
    if laser_line is not None:
        lx1, ly1, lx2, ly2 = laser_line
        cv2.line(vis, (lx1, ly1), (lx2, ly2), (255, 255, 0), 2)
        cv2.circle(vis, (lx2, ly2), 5, (0, 255, 255), -1)

    # Draw stone detections
    for i, det in enumerate(detections):
        x1, y1, x2, y2 = [int(v) for v in det["bbox"]]
        conf = det.get("conf", 0.0)
        size_label = size_labels[i] if i < len(size_labels) else "?"

        # Box color follows laser status
        box_color = status_color if laser_status != "uncertain" else COLOR_BOX
        cv2.rectangle(vis, (x1, y1), (x2, y2), box_color, 2)

        # Confidence + size label above the box
        label_text = f"Stone {conf:.2f} | {size_label}"
        _draw_label(vis, label_text, (x1, y1 - 4), box_color)

    # Laser alignment status badge (top-right corner)
    h, w = vis.shape[:2]
    status_map = {
        "safe_to_shoot": "LASER: SAFE TO SHOOT",
        "not_safe_to_shoot": "LASER: NOT SAFE",
        "uncertain": "LASER: UNCERTAIN",
    }
    badge_text = status_map.get(laser_status, "LASER: UNCERTAIN")
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.65
    thickness = 2
    (tw, th), _ = cv2.getTextSize(badge_text, font, font_scale, thickness)
    pad = 8
    bx = w - tw - pad * 2
    by = pad
    cv2.rectangle(vis, (bx - pad, by), (w - pad, by + th + pad * 2), COLOR_TEXT_BG, cv2.FILLED)
    cv2.putText(
        vis,
        badge_text,
        (bx, by + th + pad // 2),
        font,
        font_scale,
        status_color,
        thickness,
        cv2.LINE_AA,
    )

    # Stone count badge (top-left corner)
    count_text = f"Stones: {len(detections)}"
    _draw_label(vis, count_text, (10, 28), COLOR_BOX, font_scale=0.65, thickness=2)

    return vis


def save_frame(frame: np.ndarray, path: str) -> None:
    """Save a single frame as JPEG to the given path."""
    cv2.imwrite(path, frame, [cv2.IMWRITE_JPEG_QUALITY, 92])


def create_video_writer(
    output_path: str, fps: float, width: int, height: int
) -> cv2.VideoWriter:
    """Create an OpenCV VideoWriter for MP4 output."""
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    return cv2.VideoWriter(output_path, fourcc, fps, (width, height))
