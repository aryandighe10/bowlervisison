"""
BowlingAI backend — FastAPI + OpenCV + MediaPipe Pose.

Receives a bowling video at POST /analyze, runs pose detection frame by
frame, computes a handful of joint angles with plain geometry, applies a
simple rule-based analysis, and returns JSON matching the shape the
frontend already expects.
"""

import math
import os
import tempfile

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

try:
    import mediapipe as mp
except ImportError as e:  # pragma: no cover
    raise SystemExit(
        "mediapipe is not installed. Run: pip install -r requirements.txt"
    ) from e

app = FastAPI(title="BowlingAI Analysis API")

# CORS origins come from the ALLOWED_ORIGINS env var (comma-separated),
# e.g. "https://bowlervisison.lovable.app,http://localhost:3000".
# Defaults to "*" for easy local development.
_origins_env = os.environ.get("ALLOWED_ORIGINS", "*")
_allow_origins = ["*"] if _origins_env.strip() == "*" else [o.strip() for o in _origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

ACCEPTED_EXT = (".mp4", ".mov", ".avi")
MAX_SAMPLE_FRAMES = 60  # cap processed frames so the MVP stays fast


def calc_angle(a, b, c):
    """Angle at point b, formed by rays b->a and b->c, in degrees."""
    a, b, c = np.array(a), np.array(b), np.array(c)
    ba, bc = a - b, c - b
    cosine = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-9)
    cosine = np.clip(cosine, -1.0, 1.0)
    return math.degrees(math.acos(cosine))


def xy(landmarks, idx, w, h):
    p = landmarks[idx]
    return (p.x * w, p.y * h)


def variation(values):
    return float(np.std(values)) if len(values) > 1 else 0.0


def classify(var, low, high):
    if var < low:
        return "stable"
    if var < high:
        return "moderate_variation"
    return "significant_variation"


@app.get("/")
def root():
    return {"status": "BowlingAI backend running"}


@app.post("/analyze")
async def analyze(video: UploadFile = File(...)):
    if not video.filename.lower().endswith(ACCEPTED_EXT):
        raise HTTPException(
            status_code=400,
            detail="Unsupported video format. Please upload MP4, MOV or AVI.",
        )

    suffix = os.path.splitext(video.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await video.read())
        tmp_path = tmp.name

    try:
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise HTTPException(status_code=400, detail="Could not read the uploaded video file.")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames <= 0:
            raise HTTPException(status_code=422, detail="Video appears to be empty or corrupted.")

        step = max(1, total_frames // MAX_SAMPLE_FRAMES)

        elbow_angles, front_knee_angles, rear_knee_angles = [], [], []
        trunk_angles, shoulder_slopes, hip_slopes = [], [], []
        frame_landmarks = []
        detected_count = 0
        frame_idx = 0

        with mp_pose.Pose(
            static_image_mode=False, model_complexity=1, min_detection_confidence=0.5
        ) as pose:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                if frame_idx % step == 0:
                    h, w = frame.shape[:2]
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    result = pose.process(rgb)

                    if result.pose_landmarks:
                        detected_count += 1
                        lm = result.pose_landmarks.landmark

                        l_sh, r_sh = xy(lm, LM.LEFT_SHOULDER, w, h), xy(lm, LM.RIGHT_SHOULDER, w, h)
                        l_el, r_el = xy(lm, LM.LEFT_ELBOW, w, h), xy(lm, LM.RIGHT_ELBOW, w, h)
                        l_wr, r_wr = xy(lm, LM.LEFT_WRIST, w, h), xy(lm, LM.RIGHT_WRIST, w, h)
                        l_hip, r_hip = xy(lm, LM.LEFT_HIP, w, h), xy(lm, LM.RIGHT_HIP, w, h)
                        l_kn, r_kn = xy(lm, LM.LEFT_KNEE, w, h), xy(lm, LM.RIGHT_KNEE, w, h)
                        l_an, r_an = xy(lm, LM.LEFT_ANKLE, w, h), xy(lm, LM.RIGHT_ANKLE, w, h)

                        # Bowling arm heuristic: whichever wrist sits higher (smaller y) is
                        # taken as the active arm for that frame.
                        if r_wr[1] < l_wr[1]:
                            elbow_angles.append(calc_angle(r_sh, r_el, r_wr))
                        else:
                            elbow_angles.append(calc_angle(l_sh, l_el, l_wr))

                        # Front-leg heuristic: whichever ankle sits further from the hip
                        # midline horizontally is treated as the front (landing) leg.
                        hip_mid_x = (l_hip[0] + r_hip[0]) / 2
                        if abs(l_an[0] - hip_mid_x) >= abs(r_an[0] - hip_mid_x):
                            front_knee_angles.append(calc_angle(l_hip, l_kn, l_an))
                            rear_knee_angles.append(calc_angle(r_hip, r_kn, r_an))
                        else:
                            front_knee_angles.append(calc_angle(r_hip, r_kn, r_an))
                            rear_knee_angles.append(calc_angle(l_hip, l_kn, l_an))

                        # Trunk inclination: angle of the shoulder-hip midline from vertical.
                        sh_mid = ((l_sh[0] + r_sh[0]) / 2, (l_sh[1] + r_sh[1]) / 2)
                        hip_mid = (hip_mid_x, (l_hip[1] + r_hip[1]) / 2)
                        dx, dy = sh_mid[0] - hip_mid[0], sh_mid[1] - hip_mid[1]
                        trunk_angles.append(math.degrees(math.atan2(abs(dx), abs(dy) + 1e-9)))

                        shoulder_slopes.append(math.degrees(math.atan2(r_sh[1] - l_sh[1], r_sh[0] - l_sh[0])))
                        hip_slopes.append(math.degrees(math.atan2(r_hip[1] - l_hip[1], r_hip[0] - l_hip[0])))

                        if len(frame_landmarks) < 40:
                            frame_landmarks.append(
                                {
                                    "frame": frame_idx,
                                    "landmarks": [
                                        {"x": round(p.x, 4), "y": round(p.y, 4), "v": round(p.visibility, 2)}
                                        for p in lm
                                    ],
                                }
                            )

                frame_idx += 1

        cap.release()

        if detected_count == 0:
            raise HTTPException(
                status_code=404,
                detail="No bowler could be detected in this video. Try a clearer, well-lit, front-on clip.",
            )
        if detected_count < 5:
            raise HTTPException(
                status_code=422,
                detail="Too few frames had a detectable pose. Check lighting, framing and video quality.",
            )

        def avg(values):
            return sum(values) / len(values) if values else None

        front_knee_var = variation(front_knee_angles)
        trunk_var = variation(trunk_angles)
        shoulder_var = variation(shoulder_slopes)
        hip_var = variation(hip_slopes)

        shoulder_align = classify(shoulder_var, 4, 9)
        hip_align = classify(hip_var, 4, 9)

        strengths, improvements, recommendations = [], [], []

        if front_knee_var < 8:
            strengths.append("Front-leg positioning appears relatively stable during the bowling action.")
        else:
            improvements.append("Front-leg positioning appears inconsistent during the bowling action.")
            recommendations.append("Work on maintaining a more consistent front-leg position during delivery.")

        if trunk_var < 6:
            strengths.append("Trunk inclination appears relatively stable through the delivery.")
        else:
            improvements.append("Trunk movement appears relatively inconsistent during delivery.")
            recommendations.append("Focus on a more repeatable trunk lean through the delivery stride.")

        if shoulder_align == "stable":
            strengths.append("Shoulder alignment appears relatively stable.")
        else:
            improvements.append("Shoulder alignment shows some variation across the action.")
            recommendations.append("Work on keeping shoulders aligned toward the target through delivery.")

        if hip_align == "stable":
            strengths.append("Hip alignment appears relatively stable.")
        else:
            improvements.append("Hip alignment shows some variation across the action.")
            recommendations.append("Focus on consistent hip rotation timing during the delivery.")

        if not strengths:
            strengths.append("Head position appears relatively stable.")

        # Simple prototype scoring: start at 100, deduct for measured variance.
        penalty = min(60, front_knee_var * 1.2 + trunk_var * 1.5 + shoulder_var + hip_var)
        score = round(max(35, 100 - penalty))

        return {
            "joint_angles": {
                "elbow": round(avg(elbow_angles), 1) if elbow_angles else None,
                "front_knee": round(avg(front_knee_angles), 1) if front_knee_angles else None,
                "rear_knee": round(avg(rear_knee_angles), 1) if rear_knee_angles else None,
                "trunk": round(avg(trunk_angles), 1) if trunk_angles else None,
            },
            "alignment": {
                "shoulder": shoulder_align,
                "hip": hip_align,
            },
            "score": score,
            "strengths": strengths,
            "improvements": improvements,
            "recommendations": recommendations,
            "frames": frame_landmarks,
        }
    finally:
        os.unlink(tmp_path)
