import { useEffect, useRef, useState } from "react";
import { Globe, Loader2, Mic, Send, Square, Volume2 } from "lucide-react";
import type { AnalysisResult } from "@/lib/analysis-store";
import { LANGUAGES, askCoach, playAudios, synthesizeSpeech, type CoachAnswer } from "@/lib/voice";

export function LanguagePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
      <Globe className="h-3.5 w-3.5 text-primary" />
      <span className="sr-only">Language</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm normal-case tracking-normal text-foreground outline-none"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} className="bg-background">
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Reads `text` aloud in `language`. Click again to stop. */
export function ListenButton({
  text,
  language,
  label = "Listen",
}: {
  text: string;
  language: string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [error, setError] = useState<string | null>(null);
  const player = useRef<ReturnType<typeof playAudios> | null>(null);

  useEffect(() => () => player.current?.stop(), []);
  // Text or language changed (e.g. a new translation): stop whatever was playing.
  useEffect(() => {
    player.current?.stop();
    setState("idle");
  }, [text, language]);

  async function toggle() {
    if (state !== "idle") {
      player.current?.stop();
      setState("idle");
      return;
    }
    setError(null);
    setState("loading");
    try {
      const audios = await synthesizeSpeech(text, language);
      const p = playAudios(audios);
      player.current = p;
      setState("playing");
      await p.done;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not play audio.");
    } finally {
      setState("idle");
    }
  }

  const Icon = state === "loading" ? Loader2 : state === "playing" ? Square : Volume2;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={!text.trim()}
        aria-label={state === "playing" ? "Stop" : `${label} (read aloud)`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
      >
        <Icon className={`h-3.5 w-3.5 ${state === "loading" ? "animate-spin" : ""}`} />
        {state === "playing" ? "Stop" : label}
      </button>
      {error && (
        <span role="alert" className="text-[11px] text-[var(--alert)]">
          {error}
        </span>
      )}
    </span>
  );
}

/** Ask a question about the analysis by typing or speaking, in any supported language. */
export function AskCoach({ result, language }: { result: AnalysisResult; language: string }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<CoachAnswer | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);

  useEffect(
    () => () => {
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  // The model only needs the numbers and feedback, not every landmark.
  const context = { ...result, frames: undefined };

  async function send(opts: { question?: string; audio?: Blob }) {
    setBusy(true);
    setError(null);
    try {
      setReply(await askCoach({ ...opts, language, context }));
      setQuestion("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access was blocked. Allow it in your browser, or type your question.");
      return;
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      void send({ audio: new Blob(chunks, { type: rec.mimeType || "audio/webm" }) });
    };
    recorder.current = rec;
    rec.start();
    setRecording(true);
  }

  const canRecord = typeof window !== "undefined" && "MediaRecorder" in window;

  return (
    <section className="panel mt-10 p-5" aria-label="Ask your coach">
      <h2 className="text-lg tracking-[0.14em] text-foreground">Ask Your Coach</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Ask about your analysis by typing or speaking in your own language. For example: “Why is my
        score low?”
      </p>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim() && !busy) void send({ question: question.trim() });
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Type your question…"
          aria-label="Your question"
          maxLength={500}
          className="min-w-0 flex-1 rounded-xl border border-border bg-[var(--surface-2)] px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        {canRecord && (
          <button
            type="button"
            onClick={toggleRecording}
            disabled={busy}
            aria-label={recording ? "Stop recording" : "Record your question"}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs uppercase tracking-[0.14em] transition-colors disabled:opacity-60 ${
              recording
                ? "border-[var(--alert)] bg-[var(--alert)]/10 text-[var(--alert)]"
                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
            }`}
          >
            {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {recording ? "Stop" : "Speak"}
          </button>
        )}
        <button
          type="submit"
          disabled={busy || recording || !question.trim()}
          aria-label="Send question"
          className="inline-flex items-center justify-center rounded-xl bg-primary px-3 py-2 text-primary-foreground transition-colors hover:bg-[var(--primary-soft)] disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>

      {recording && (
        <p className="mt-3 font-mono text-xs text-[var(--alert)]">
          Recording… press Stop when you have finished speaking.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-[var(--alert)]">
          {error}
        </p>
      )}

      {reply && (
        <div className="mt-5 space-y-3" aria-live="polite">
          <p className="text-sm text-muted-foreground">
            <span className="mr-2 text-[11px] uppercase tracking-[0.16em] text-faint">You</span>
            {reply.transcript}
          </p>
          <div className="rounded-xl border border-border bg-[var(--surface-2)] p-4">
            <p className="text-sm leading-relaxed text-foreground">{reply.answer}</p>
            <div className="mt-3">
              <ListenButton text={reply.answer} language={reply.language_code} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
