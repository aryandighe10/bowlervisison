from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import sarvam_api
from main import app
from sarvam_api import chunk_text, clean_reply, compact_context

client = TestClient(app)


class FakeSarvam:
    def __init__(self):
        self.text = SimpleNamespace(
            translate=lambda **kw: SimpleNamespace(translated_text=f"[{kw['target_language_code']}] {kw['input']}")
        )
        self.text_to_speech = SimpleNamespace(convert=lambda **kw: SimpleNamespace(audios=["QUJD"]))
        self.speech_to_text = SimpleNamespace(
            transcribe=lambda **kw: SimpleNamespace(transcript="मेरा स्कोर कम क्यों है?", language_code="hi-IN")
        )
        self.chat = SimpleNamespace(
            completions=lambda **kw: SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content="<think>x</think>Your knee varies."))]
            )
        )


@pytest.fixture
def fake(monkeypatch):
    monkeypatch.setattr(sarvam_api, "get_client", lambda: FakeSarvam())


def test_chunk_text_respects_limit_and_keeps_all_words():
    text = "One sentence here. " * 60
    chunks = chunk_text(text, limit=100)
    assert all(len(c) <= 100 for c in chunks)
    assert " ".join(chunks).split() == text.split()


def test_chunk_text_splits_one_very_long_sentence():
    chunks = chunk_text("word " * 200, limit=50)
    assert len(chunks) > 1 and all(len(c) <= 50 for c in chunks)


def test_chunk_text_handles_devanagari_danda():
    assert chunk_text("पहला वाक्य। दूसरा वाक्य।", limit=15) == ["पहला वाक्य।", "दूसरा वाक्य।"]


def test_compact_context_drops_frames_and_survives_bad_input():
    assert "frames" not in compact_context('{"score": 80, "frames": [1, 2, 3]}')
    assert compact_context("not json") == "{}"
    assert compact_context("[1, 2]") == "{}"
    assert len(compact_context('{"x": "' + "a" * 10000 + '"}')) <= 4000


def test_clean_reply_strips_think_blocks():
    assert clean_reply("<think>hmm</think>\nHello") == "Hello"
    assert clean_reply(None) == ""


def test_translate_uses_target_language(fake):
    res = client.post("/translate", json={"texts": ["Good", "Bad"], "target_language": "hi-IN"})
    assert res.status_code == 200
    assert res.json()["translations"] == ["[hi-IN] Good", "[hi-IN] Bad"]


def test_translate_english_is_passthrough_without_calling_sarvam():
    res = client.post("/translate", json={"texts": ["Good"], "target_language": "en-IN"})
    assert res.json()["translations"] == ["Good"]


def test_translate_rejects_unknown_language_and_oversize(fake):
    assert client.post("/translate", json={"texts": ["a"], "target_language": "xx-XX"}).status_code == 400
    assert client.post("/translate", json={"texts": ["a" * 1001], "target_language": "hi-IN"}).status_code == 400
    assert client.post("/translate", json={"texts": ["a"] * 31, "target_language": "hi-IN"}).status_code == 400


def test_speak_returns_audio(fake):
    res = client.post("/speak", json={"text": "Hello there.", "language_code": "hi-IN"})
    assert res.status_code == 200
    assert res.json() == {"audios": ["QUJD"], "format": "mp3"}


def test_speak_rejects_empty_text(fake):
    assert client.post("/speak", json={"text": "  ", "language_code": "hi-IN"}).status_code == 400


def test_ask_with_typed_question(fake):
    res = client.post("/ask", data={"question": "Why?", "language_code": "hi-IN", "context": '{"score": 70}'})
    assert res.status_code == 200
    assert res.json() == {"transcript": "Why?", "language_code": "hi-IN", "answer": "Your knee varies."}


def test_ask_with_audio_uses_detected_language(fake):
    res = client.post(
        "/ask",
        data={"language_code": "en-IN"},
        files={"audio": ("q.webm", b"fake-audio", "audio/webm")},
    )
    body = res.json()
    assert res.status_code == 200
    assert body["transcript"] == "मेरा स्कोर कम क्यों है?"
    assert body["language_code"] == "hi-IN"


def test_ask_requires_a_question(fake):
    assert client.post("/ask", data={"language_code": "hi-IN"}).status_code == 400


def test_missing_api_key_returns_503(monkeypatch):
    monkeypatch.delenv("SARVAM_API_KEY", raising=False)
    monkeypatch.setattr(sarvam_api, "_load_env_file", lambda: None)
    sarvam_api.get_client.cache_clear()
    res = client.post("/speak", json={"text": "Hello", "language_code": "hi-IN"})
    assert res.status_code == 503
    sarvam_api.get_client.cache_clear()
