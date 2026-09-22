from fastapi.testclient import TestClient
from main import app, calc_angle

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


def test_history_starts_as_list():
    res = client.get("/history")
    assert res.status_code == 200
    assert isinstance(res.json(), list)