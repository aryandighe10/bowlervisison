"""
Pure geometry and signal helpers for pose analysis.

Kept free of OpenCV / MediaPipe so they can be unit-tested without a video.
"""

import math

import numpy as np


def calc_angle(a, b, c):
    """Angle at point b, formed by rays b->a and b->c, in degrees."""
    a, b, c = np.array(a), np.array(b), np.array(c)
    ba, bc = a - b, c - b
    cosine = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-9)
    cosine = np.clip(cosine, -1.0, 1.0)
    return math.degrees(math.acos(cosine))


def smooth(values, window=5, order=2):
    """Savitzky-Golay smoothing of a 1-D series (edges padded with the end values).

    Falls back to returning the input unchanged when the series is too short
    for the requested window.
    """
    arr = np.asarray(values, dtype=float)
    n = len(arr)
    window |= 1  # window must be odd
    window = min(window, n if n % 2 else n - 1)
    if window <= order:
        return arr
    half = window // 2
    x = np.arange(-half, half + 1)
    design = np.vander(x, order + 1, increasing=True)
    coeffs = np.linalg.pinv(design)[0]  # row 0 = fitted value at the window centre
    padded = np.pad(arr, half, mode="edge")
    return np.convolve(padded, coeffs, mode="valid")


def smooth_points(points, window=5, order=2):
    """Smooth an (N, 2) series of x/y points column by column."""
    pts = np.asarray(points, dtype=float)
    if pts.ndim != 2 or len(pts) == 0:
        return pts
    return np.column_stack([smooth(pts[:, i], window, order) for i in range(pts.shape[1])])


def path_length(points):
    """Total distance travelled along an (N, 2) series of points."""
    pts = np.asarray(points, dtype=float)
    if len(pts) < 2:
        return 0.0
    return float(np.linalg.norm(np.diff(pts, axis=0), axis=1).sum())


def detect_bowling_side(left_wrist, right_wrist):
    """Return "left" or "right" for the bowling arm.

    The bowling arm is the one whose wrist travels furthest over the clip
    (the full arm circle is much longer than the non-bowling arm's motion).
    Ties go to "right".
    """
    return "left" if path_length(left_wrist) > path_length(right_wrist) else "right"


def front_leg_side(bowling_arm):
    """A conventional action lands on the leg opposite the bowling arm."""
    return "left" if bowling_arm == "right" else "right"
