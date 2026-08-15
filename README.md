# Pitch Perfect Analysis

Build a web app called "BowlingAI" — a college-project MVP that analyzes a cricket 

bowler's body positioning from an uploaded video. This is a frontend-only build: it 

must call an external backend API over HTTP, not implement any pose-detection logic 

itself (that runs separately in Python/FastAPI/MediaPipe, outside this project).

## Design direction — "night pitch" theme

- Background: #0F1B14 (deep pitch green-black)

- Surface/cards: #16261D, secondary surface #1C2E22

- Borders: #2A3D2F (soft variant #243428)

- Text: primary #F2EFE4 (chalk cream), secondary #9DAD9F, faint #6C7D6E

- Accent gold (primary actions, score, highlights): #C9A227 (hover/soft #E4C455)

- Accent red (alerts/improvements): #D65A42

- Accent green (success/strengths): #7FB069

- Fonts: "Oswald" (condensed, uppercase) for headings/display, "IBM Plex Mono" for 

  all numeric/data readouts (angles, scores), "Inter" for body text and UI labels

- Signature visual motif: a semicircular protractor/goniometer dial (like a 

  clinical angle gauge) — used both for the overall consistency score and for 

  every individual joint-angle measurement. This ties the visual identity directly 

  to "joint angles" as the product's core concept.

- Minimal animation — hover states only, no scroll-triggered effects

- Rounded-xl cards, hairline 1px borders, no drop shadows, dark data-dashboard feel

## Pages / flow

Three views in one flow: Home → Upload → Results. Include a slim "pipeline stepper" 

(Upload → Detect → Analyze → Feedback, numbered 1-4) shown at the top of Upload and 

Results, highlighting the current step — this reflects the real processing pipeline.

### 1. Home

- Small eyebrow pill: "PROTOTYPE — COLLEGE PROJECT"

- Big uppercase condensed headline "BowlingAI" (AI in gold)

- Subhead: "AI-Powered Cricket Bowling Action Analysis"

- Description: "Upload a cricket bowling video and analyze body positioning, joint 

  angles and basic technique indicators."

- Primary gold button: "Upload Bowling Video" → goes to Upload page

- Three feature cards in a row: "Pose Detection", "Joint Analysis", "Technique 

  Feedback", each with a short one-line description and a small icon

### 2. Upload

- Collapsible "API settings" panel with a single text input for the backend API 

  base URL, defaulting to http://localhost:8000. Show the resolved endpoint 

  ("Requests are sent to {url}/analyze") as helper text.

- Dropzone/click-to-upload area accepting only .mp4, .mov, .avi

- On file select: show video preview (native <video> player), filename, and a 

  "Remove" button to clear and pick again

- Validation: if the file extension isn't mp4/mov/avi, show an inline error and 

  don't accept it

- "Analyze Bowling Action" button:

  - If no file selected, show inline error, don't submit

  - Otherwise POST the file as multipart/form-data (field name "video") to 

    `{apiUrl}/analyze`

  - Show a loading state on the button while the request is in flight

  - On network failure (fetch throws / can't connect), show this exact message 

    in an error banner: "Backend not connected. Start the FastAPI service and 

    confirm the API URL below, then try again." — DO NOT fabricate or fake any 

    analysis result under any circumstance

  - On non-2xx response, map status codes to user-facing messages:

    - 400 → use response detail, or "Unsupported video format or malformed upload."

    - 404 → "Bowler not detected in the video. Try a clearer, front-facing clip."

    - 409 → "Multiple people detected in frame. Upload a video with a single bowler."

    - 422 → use response detail, or "Video quality is too low for pose detection 

      to run reliably."

    - 500+ → "Video processing failed on the server. Please try again."

  - On success, parse the JSON body (schema below) and navigate to Results

### 3. Results

- Header card: "Overall Technique Consistency" with a big score display like 

  "78 / 100" using the gold protractor dial, and a small caption explicitly 

  labeling it "PROTOTYPE CONSISTENCY SCORE — NOT A PROFESSIONAL COACHING SCORE"

- Two-panel "Visual Analysis" row:

  - Left: original uploaded video (playable)

  - Right: "Skeleton visualization" panel — if the API response includes a 

    `frames` array, show a short note like "N frames of landmark data received"; 

    otherwise show a placeholder note that no processed skeleton frames were 

    returned (never draw a fake skeleton)

- "Body Measurements" section: four protractor-dial cards for Elbow Angle, Front 

  Knee Angle, Rear Knee Angle, Trunk Angle (each showing the numeric value from 

  the API), plus two alignment cards (Shoulder Alignment, Hip Alignment) showing 

  a colored status pill: green "Stable" / gold "Moderate variation" / red 

  "Significant variation", derived from the API's alignment strings ("stable", 

  "moderate_variation", "significant_variation")

- Three-column feedback section: "Strengths" (green check icon), "Areas to 

  Improve" (red warning icon), "Suggested Focus" (gold target icon) — each 

  rendering a bullet list from the API response; show "None detected for this 

  clip." if a list is empty

- Small disclaimer footer: "These are prototype technique indicators only, 

  generated by simple geometric rules. They are not medical advice and do not 

  diagnose injuries."

- "Analyze Another Video" button (top right, with a reset/back icon) that clears 

  state and returns to the Upload page

## API contract

POST {apiUrl}/analyze — multipart/form-data, field "video"

Expected JSON response:

{

  "joint_angles": {

    "elbow": 164,

    "front_knee": 172,

    "rear_knee": 145,

    "trunk": 14

  },

  "alignment": {

    "shoulder": "stable",

    "hip": "moderate_variation"

  },

  "score": 78,

  "strengths": ["Head position appears relatively stable."],

  "improvements": ["Front-leg positioning appears inconsistent."],

  "recommendations": ["Work on maintaining a more consistent front-leg position."],

  "frames": []  // optional array of per-frame landmark data, for future skeleton overlay

}

## Hard constraints

- Never invent, mock, or hardcode analysis results anywhere in the UI — every 

  number and message on the Results page must come from the real API response.

- The API base URL must be user-configurable in the UI (not hardcoded), since 

  the actual analysis backend (Python/FastAPI/OpenCV/MediaPipe) is deployed 

  separately from this app.

- Keep it a clean three-page MVP — no auth, no database, no extra features beyond 

  what's described above.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://bowlervisison.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/662b2ff5-c9ab-421d-9e5f-e99cda5b4a63).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
