"""
Sarvam AI integration: translate the feedback, read it aloud, and answer questions
(typed or spoken) about an analysis in the user's own language.

The API key stays on the server. It is read from SARVAM_API_KEY, either from the
environment (Render) or from backend/.env (local development).
"""

import json
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

log = logging.getLogger("bowlingai.sarvam")
router = APIRouter()

# Languages supported by translation, speech-to-text and text-to-speech together.
LANGUAGES = {
    "en-IN": "English",
    "hi-IN": "Hindi",
    "mr-IN": "Marathi",
    "gu-IN": "Gujarati",
    "ta-IN": "Tamil",
    "te-IN": "Telugu",
    "kn-IN": "Kannada",
    "ml-IN": "Malayalam",
    "bn-IN": "Bengali",
    "pa-IN": "Punjabi",
    "od-IN": "Odia",
}

CHAT_MODEL = "sarvam-105b-conversations"
MAX_TRANSLATE_ITEMS = 30
MAX_TRANSLATE_CHARS = 1000
TTS_CHUNK_CHARS = 450
MAX_SPEAK_CHARS = 3000
MAX_AUDIO_BYTES = 10 * 1024 * 1024
MAX_CONTEXT_CHARS = 4000


def _load_env_file():
    env_file = Path(__file__).with_name(".env")
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            key, sep, value = line.partition("=")
            if sep and not key.strip().startswith("#"):
                os.environ.setdefault(key.strip(), value.strip())


@lru_cache(maxsize=1)
def get_client():
    _load_env_file()
    key = os.environ.get("SARVAM_API_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="Translation and voice are not configured on the server.")
    from sarvamai import SarvamAI

    return SarvamAI(api_subscription_key=key)


def _sarvam_failed(action, exc):
    log.error("Sarvam %s failed: %s", action, type(exc).__name__)
    return HTTPException(status_code=502, detail=f"The language service failed while trying to {action}.")


def _check_language(code):
    if code not in LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {code}")


def chunk_text(text, limit=TTS_CHUNK_CHARS):
    """Split text into pieces of at most `limit` characters, preferring sentence boundaries."""
    sentences = re.split(r"(?<=[.!?।])\s+", text.strip())
    chunks, current = [], ""
    for sentence in sentences:
        while len(sentence) > limit:  # a single very long sentence: cut at a space if possible
            cut = sentence.rfind(" ", 0, limit)
            cut = cut if cut > 0 else limit
            if current:
                chunks.append(current)
                current = ""
            chunks.append(sentence[:cut].strip())
            sentence = sentence[cut:].strip()
        if current and len(current) + 1 + len(sentence) > limit:
            chunks.append(current)
            current = sentence
        else:
            current = f"{current} {sentence}".strip()
    if current:
        chunks.append(current)
    return [c for c in chunks if c]


def compact_context(raw):
    """Reduce an analysis result to the parts worth giving the model (no landmark frames)."""
    try:
        data = json.loads(raw) if raw else {}
    except ValueError:
        data = {}
    if not isinstance(data, dict):
        data = {}
    data.pop("frames", None)
    return json.dumps(data, ensure_ascii=False)[:MAX_CONTEXT_CHARS]


def clean_reply(text):
    return re.sub(r"<think>.*?</think>", "", text or "", flags=re.DOTALL).strip()


class TranslateRequest(BaseModel):
    texts: List[str]
    target_language: str


class SpeakRequest(BaseModel):
    text: str
    language_code: str


@router.post("/translate")
def translate(req: TranslateRequest):
    _check_language(req.target_language)
    if len(req.texts) > MAX_TRANSLATE_ITEMS:
        raise HTTPException(status_code=400, detail="Too many texts to translate at once.")
    if any(len(t) > MAX_TRANSLATE_CHARS for t in req.texts):
        raise HTTPException(status_code=400, detail="One of the texts is too long to translate.")
    if req.target_language == "en-IN" or not req.texts:
        return {"translations": req.texts}

    client = get_client()

    def one(text):
        if not text.strip():
            return text
        return client.text.translate(
            input=text,
            source_language_code="en-IN",
            target_language_code=req.target_language,
            model="mayura:v1",
            mode="formal",
        ).translated_text

    try:
        with ThreadPoolExecutor(max_workers=5) as pool:
            return {"translations": list(pool.map(one, req.texts))}
    except HTTPException:
        raise
    except Exception as exc:
        raise _sarvam_failed("translate the text", exc)


@router.post("/speak")
def speak(req: SpeakRequest):
    _check_language(req.language_code)
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="There is no text to read aloud.")
    if len(text) > MAX_SPEAK_CHARS:
        raise HTTPException(status_code=400, detail="That text is too long to read aloud.")

    client = get_client()
    try:
        audios = []
        for chunk in chunk_text(text):
            res = client.text_to_speech.convert(
                text=chunk, language_code=req.language_code, output_audio_codec="mp3"
            )
            audios.extend(res.audios)
        return {"audios": audios, "format": "mp3"}
    except HTTPException:
        raise
    except Exception as exc:
        raise _sarvam_failed("generate speech", exc)


@router.post("/ask")
async def ask(
    audio: Optional[UploadFile] = File(None),
    question: Optional[str] = Form(None),
    language_code: str = Form("en-IN"),
    context: str = Form("{}"),
):
    """Answer a question about an analysis. The question is either typed or a spoken recording."""
    _check_language(language_code)
    client = get_client()
    transcript = (question or "").strip()
    reply_language = language_code

    if audio is not None:
        data = await audio.read()
        if not data:
            raise HTTPException(status_code=400, detail="The recording was empty.")
        if len(data) > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=413, detail="The recording is too long.")
        try:
            stt = client.speech_to_text.transcribe(
                file=(audio.filename or "question.webm", data, audio.content_type or "audio/webm"),
                mode="transcribe",
                language_code=language_code if language_code != "en-IN" else "unknown",
            )
        except Exception as exc:
            raise _sarvam_failed("understand the recording", exc)
        transcript = (stt.transcript or "").strip()
        if stt.language_code in LANGUAGES:
            reply_language = stt.language_code
        if not transcript:
            raise HTTPException(status_code=422, detail="Could not hear anything in the recording. Please try again.")

    if not transcript:
        raise HTTPException(status_code=400, detail="Please type or record a question.")
    if len(transcript) > 1000:
        raise HTTPException(status_code=400, detail="That question is too long.")

    system = (
        "You are a friendly cricket bowling coach inside the BowlingAI app. A bowler is asking about their "
        "latest video analysis, given below as JSON. Answer using only that analysis, in at most three short "
        "sentences, in plain words. If the question is unrelated to bowling or the analysis, politely say you "
        f"can only help with the analysis. Reply in {LANGUAGES[reply_language]}.\n\nAnalysis:\n"
        + compact_context(context)
    )
    try:
        res = client.chat.completions(
            model=CHAT_MODEL,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": transcript}],
            reasoning_effort="low",  # the API rejects "none" despite the SDK's type hints
            max_tokens=400,
        )
        answer = clean_reply(res.choices[0].message.content)
    except Exception as exc:
        raise _sarvam_failed("answer the question", exc)

    return {"transcript": transcript, "language_code": reply_language, "answer": answer}
