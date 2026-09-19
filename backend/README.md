# BowlingAI backend

FastAPI + OpenCV + MediaPipe Pose service that powers the frontend's
"Analyze Bowling Action" button.

## 1. Set up (Python 3.9–3.11 — MediaPipe doesn't yet support 3.12+)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## 2. Run it

```bash
uvicorn main:app --reload --port 8000
```

You should see `Uvicorn running on http://127.0.0.1:8000`. Visit
`http://localhost:8000` in a browser — you should get
`{"status": "BowlingAI backend running"}`.

## 3. Point the frontend at it

In BowlingAI's upload page, open **API settings** and confirm the URL is
`http://localhost:8000` (that's already the default). Upload a video and
click **Analyze Bowling Action** — the request now goes to a real
`POST /analyze` instead of failing with "Backend not connected".

## 4. Deploy it (Render — free tier)

MediaPipe/OpenCV need system-level graphics libraries that a plain Python
buildpack won't include, so this deploys as a Docker container (the
`Dockerfile` in this folder handles that).

1. Push this `backend/` folder to a GitHub repo (a separate repo from the
   frontend, or a subfolder of the same one — either works).
2. Go to [render.com](https://render.com) → sign up / log in → **New +** →
   **Web Service**.
3. Connect your GitHub account and pick the repo. If the backend lives in
   a subfolder (e.g. `backend/`), set **Root Directory** to that path.
4. Render should auto-detect the `Dockerfile` and set **Environment** to
   `Docker`. If it offers a "Runtime" dropdown instead, choose Docker
   explicitly.
5. **Instance type**: Free is fine to start (it will spin down after
   inactivity and take ~30–60s to wake back up on the next request —
   acceptable for a class demo, worth upgrading if that's a problem for
   yours).
6. Add an environment variable:
   - `ALLOWED_ORIGINS` = `https://bowlervisison.lovable.app`
     (comma-separate multiple origins if you also test from `localhost`,
     e.g. `https://bowlervisison.lovable.app,http://localhost:3000`)
7. Click **Create Web Service**. First build takes a few minutes (it's
   installing MediaPipe + OpenCV). You'll get a URL like
   `https://bowlervision-backend.onrender.com`.
8. Test it: visit that URL directly in a browser — you should see
   `{"status": "BowlingAI backend running"}`.

### Point the frontend at it

On the live Lovable app, open **Upload → API settings** and set the URL
to your Render URL (no trailing slash, e.g.
`https://bowlervision-backend.onrender.com`). Upload a real clip and
confirm it makes it all the way to the Results page.

### Alternatives to Render

- **Railway** — same Dockerfile works unchanged; Railway auto-detects it.
  Set the same `ALLOWED_ORIGINS` env var in Railway's dashboard.
- **Fly.io** — run `fly launch` in this folder, it'll detect the
  Dockerfile; set the env var with `fly secrets set ALLOWED_ORIGINS=...`.
- **Quick local demo without deploying** — run the backend locally
  (`uvicorn main:app --port 8000`) and expose it with
  `ngrok http 8000`, then paste the `https://*.ngrok-free.app` URL into
  the frontend's API settings. Good for a live in-class demo, not for
  something you want reachable long-term.

## Notes

- First run will download MediaPipe's pose-landmark model — needs internet
  access once.
- Processing samples up to ~60 frames per video, so analysis takes a few
  seconds for a typical clip, longer for long/high-res video.
- `allow_origins=["*"]` in `main.py` is fine for local development. If you
  deploy this anywhere reachable by others, restrict it to your actual
  frontend origin.
- The `frames` field in the response carries raw landmark coordinates for
  up to 40 sampled frames — that's the hook for a future on-canvas
  skeleton overlay; the frontend currently just reports how many frames
  came back.
- Front-leg / bowling-arm identification uses simple position heuristics
  (whichever wrist is higher, whichever ankle is further from the hip
  midline) rather than a bowling-phase classifier, per the MVP scope.
