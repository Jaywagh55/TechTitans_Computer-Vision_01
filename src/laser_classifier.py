"""
laser_classifier.py — Laser alignment classification for RIRS AI pipeline.

Classification outputs (three classes):
  - 'safe_to_shoot'      : laser fiber appears aligned with / aimed at the stone.
  - 'not_safe_to_shoot'  : laser is visible but aimed at tissue or away from stone.
  - 'uncertain'          : laser not detected, visibility too poor, or low confidence.

Detection strategy
------------------
Laser fibers in RIRS video appear as:
  1. A bright white / blue-white linear artifact (the fiber body).
  2. A bright glow / spot at the fiber tip.

We use two complementary detectors:

  A) Bright-region detector (HSV threshold):
     - Threshold the CLAHE-enhanced frame in HSV colorspace:
       Hue:        any (< 30 for warm glow OR > 150 for blue-white)
       Saturation: low  (laser appears nearly white/grey)
       Value:      very high (bright glow)
     - Find the largest contiguous bright region → candidate laser tip.

  B) Line detector (Hough transform on brightness gradient):
     - Apply edge detection on the brightness channel.
     - Hough probabilistic line transform → candidate laser lines.
     - Pick the longest line whose endpoint is closest to bright-region centroid.

Alignment check
---------------
Given detected stone bboxes and laser tip/line endpoint:
  - If laser tip is INSIDE any stone bbox → safe_to_shoot.
  - If laser tip is within PROXIMITY_FACTOR × bbox_diagonal of stone centroid → safe_to_shoot.
  - If a laser line is detected but aimed elsewhere → not_safe_to_shoot.
  - If no laser detected → uncertain.
"""

import cv2
import numpy as np
from typing import List, Dict, Optional, Tuple


# ──────────────────────────────────────────────
# Tunable thresholds
# ──────────────────────────────────────────────
# HSV range for laser bright glow (near-white, high brightness)
_HSV_V_MIN = 210       # minimum Value channel
_HSV_S_MAX = 80        # maximum Saturation channel (near-white / grey)
_MIN_BRIGHT_AREA = 15  # minimum pixel area of bright region to be a laser tip

# Proximity: laser tip considered "on stone" if within this fraction of bbox diagonal
_PROXIMITY_FACTOR = 0.4

# Hough line parameters
_HOUGH_THRESHOLD = 30
_HOUGH_MIN_LINE_LEN = 20
_HOUGH_MAX_LINE_GAP = 8


def _detect_laser(frame: np.ndarray) -> Tuple[Optional[Tuple[int, int]], Optional[Tuple[int, int, int, int]]]:
    """
    Detect the laser fiber in a frame.

    Returns
    -------
    tip : (x, y) or None
        Estimated laser tip position (brightest glow region centroid).
    line : (x1, y1, x2, y2) or None
        The dominant Hough line associated with the laser fiber.
    """
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    v_channel = hsv[:, :, 2]
    s_channel = hsv[:, :, 1]

    # Bright near-white mask
    bright_mask = (v_channel >= _HSV_V_MIN) & (s_channel <= _HSV_S_MAX)
    bright_mask = bright_mask.astype(np.uint8) * 255

    # Morphological clean-up
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    bright_mask = cv2.morphologyEx(bright_mask, cv2.MORPH_CLOSE, kernel, iterations=1)
    bright_mask = cv2.morphologyEx(bright_mask, cv2.MORPH_OPEN, kernel, iterations=1)

    # Find contours in bright mask
    contours, _ = cv2.findContours(bright_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None, None

    # Pick the largest contour that meets minimum area
    valid = [c for c in contours if cv2.contourArea(c) >= _MIN_BRIGHT_AREA]
    if not valid:
        return None, None

    largest = max(valid, key=cv2.contourArea)
    M = cv2.moments(largest)
    if M["m00"] == 0:
        return None, None

    tip_x = int(M["m10"] / M["m00"])
    tip_y = int(M["m01"] / M["m00"])
    tip = (tip_x, tip_y)

    # Hough line detection on edges of bright-value channel
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 80, 160)
    lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=_HOUGH_THRESHOLD,
        minLineLength=_HOUGH_MIN_LINE_LEN,
        maxLineGap=_HOUGH_MAX_LINE_GAP,
    )

    best_line = None
    if lines is not None:
        # Select the line whose endpoint is closest to the detected laser tip
        min_dist = float("inf")
        for line in lines:
            x1, y1, x2, y2 = line[0]
            # Distance from each endpoint to tip
            d1 = np.hypot(x1 - tip_x, y1 - tip_y)
            d2 = np.hypot(x2 - tip_x, y2 - tip_y)
            d = min(d1, d2)
            if d < min_dist:
                min_dist = d
                # Ensure (x2,y2) is the endpoint nearest the tip
                if d2 <= d1:
                    best_line = (x1, y1, x2, y2)
                else:
                    best_line = (x2, y2, x1, y1)

    return tip, best_line


def _point_in_bbox(point: Tuple[int, int], bbox: List[int]) -> bool:
    """Return True if point (x,y) lies within the bounding box."""
    px, py = point
    x1, y1, x2, y2 = bbox
    return x1 <= px <= x2 and y1 <= py <= y2


def _point_near_bbox(
    point: Tuple[int, int],
    bbox: List[int],
    factor: float = _PROXIMITY_FACTOR,
) -> bool:
    """
    Return True if point is within (factor × bbox_diagonal) of the bbox centroid.
    """
    px, py = point
    x1, y1, x2, y2 = bbox
    cx = (x1 + x2) / 2
    cy = (y1 + y2) / 2
    diagonal = np.hypot(x2 - x1, y2 - y1)
    dist = np.hypot(px - cx, py - cy)
    return dist <= factor * diagonal


class LaserClassifier:
    """
    Classifies laser alignment safety for each video frame.

    Parameters
    ----------
    proximity_factor : float
        Controls how close the laser tip must be to a stone bbox to count as
        "safe".  Higher = more permissive.
    min_bright_area : int
        Minimum pixel area for a bright region to be considered a laser tip.
    """

    def __init__(
        self,
        proximity_factor: float = _PROXIMITY_FACTOR,
        min_bright_area: int = _MIN_BRIGHT_AREA,
    ):
        self.proximity_factor = proximity_factor
        self.min_bright_area = min_bright_area

    def classify(
        self,
        frame: np.ndarray,
        detections: List[Dict],
    ) -> Tuple[str, Optional[Tuple[int, int]], Optional[Tuple[int, int, int, int]]]:
        """
        Classify laser alignment safety for a single frame.

        Parameters
        ----------
        frame : np.ndarray
            CLAHE-preprocessed BGR frame.
        detections : list of dict
            Stone detections (each has 'bbox' key).

        Returns
        -------
        status : str
            'safe_to_shoot', 'not_safe_to_shoot', or 'uncertain'.
        tip : (x, y) or None
            Detected laser tip coordinates.
        line : (x1, y1, x2, y2) or None
            Detected laser line segment.
        """
        tip, line = _detect_laser(frame)

        # No laser detected at all → uncertain
        if tip is None:
            return "uncertain", None, None

        # Check alignment against each detected stone
        if detections:
            for det in detections:
                bbox = det["bbox"]
                if _point_in_bbox(tip, bbox):
                    return "safe_to_shoot", tip, line
                if _point_near_bbox(tip, bbox, self.proximity_factor):
                    return "safe_to_shoot", tip, line
            # Laser detected but not near any stone
            return "not_safe_to_shoot", tip, line
        else:
            # Laser detected but no stone visible → uncertain (can't assess alignment)
            return "uncertain", tip, line
