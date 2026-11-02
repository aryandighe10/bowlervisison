import numpy as np
from fastapi.testclient import TestClient
from main import app, calc_angle
from pose_math import detect_bowling_side, front_leg_side, path_length, smooth, smooth_points

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_analyze_rejects_bad_extension():
    res = client.post(
        "/analyze",
        files={"video": ("notes.txt", b"not a video", "text/plain")},
    )
    assert res.status_code == 400


def test_calc_angle_right_angle():
    # a=(0,1), b=(0,0), c=(1,0) -> 90 degree angle at b
    angle = calc_angle((0, 1), (0, 0), (1, 0))
    assert 89 < angle < 91


def test_smooth_reduces_jitter_and_keeps_length():
    rng = np.random.default_rng(0)
    clean = np.linspace(0, 100, 40)
    noisy = clean + rng.normal(0, 3, size=40)
    out = smooth(noisy)
    assert len(out) == len(noisy)
    assert np.abs(out - clean).mean() < np.abs(noisy - clean).mean()


def test_smooth_preserves_a_straight_line():
    line = np.linspace(0, 10, 15)
    assert np.allclose(smooth(line)[2:-2], line[2:-2])


def test_smooth_short_series_unchanged():
    assert np.allclose(smooth([1.0, 5.0]), [1.0, 5.0])
    assert len(smooth([])) == 0


def test_smooth_points_keeps_shape():
    pts = np.column_stack([np.arange(12.0), np.arange(12.0) ** 2])
    assert smooth_points(pts).shape == (12, 2)


def test_path_length():
    assert path_length([(0, 0), (3, 4), (3, 4)]) == 5.0
    assert path_length([(1, 1)]) == 0.0


def _arc(radius, n=30):
    ang = np.linspace(0, 2 * np.pi, n)
    return np.column_stack([radius * np.cos(ang), radius * np.sin(ang)])


def test_detect_bowling_side_picks_wrist_that_moves_most():
    still = np.tile([10.0, 10.0], (30, 1))
    assert detect_bowling_side(still, _arc(50)) == "right"
    assert detect_bowling_side(_arc(50), still) == "left"


def test_detect_bowling_side_tie_defaults_right():
    still = np.tile([0.0, 0.0], (10, 1))
    assert detect_bowling_side(still, still) == "right"


def test_front_leg_is_opposite_the_bowling_arm():
    assert front_leg_side("right") == "left"
    assert front_leg_side("left") == "right"


def test_history_starts_as_list():
    res = client.get("/history")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
