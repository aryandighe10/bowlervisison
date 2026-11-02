import { getApiUrl } from "@/lib/analysis-store";

export const LANGUAGES = [
  { code: "en-IN", name: "English" },
  { code: "hi-IN", name: "हिन्दी" },
  { code: "mr-IN", name: "मराठी" },
  { code: "gu-IN", name: "ગુજરાતી" },
  { code: "ta-IN", name: "தமிழ்" },
  { code: "te-IN", name: "తెలుగు" },
  { code: "kn-IN", name: "ಕನ್ನಡ" },
  { code: "ml-IN", name: "മലയാളം" },
  { code: "bn-IN", name: "বাংলা" },
  { code: "pa-IN", name: "ਪੰਜਾਬੀ" },
  { code: "od-IN", name: "ଓଡ଼ିଆ" },
] as const;

const LANG_KEY = "bowlingai_language";

export function getSavedLanguage(): string {
  if (typeof window === "undefined") return "en-IN";
  const saved = window.localStorage.getItem(LANG_KEY);
  return LANGUAGES.some((l) => l.code === saved) ? (saved as string) : "en-IN";
}

export function saveLanguage(code: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(LANG_KEY, code);
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl().replace(/\/+$/, "")}${path}`, init);
  } catch {
    throw new Error("Could not reach the server. Please check your connection and try again.");
  }
  if (!response.ok) {
    let detail: string | undefined;
    try {
      const body = (await response.json()) as { detail?: string };
      detail = typeof body?.detail === "string" ? body.detail : undefined;
    } catch {
      detail = undefined;
    }
    throw new Error(detail || `Request failed with status ${response.status}.`);
  }
  return (await response.json()) as T;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function translateTexts(texts: string[], target: string): Promise<string[]> {
  const res = await request<{ translations: string[] }>(
    "/translate",
    json({ texts, target_language: target }),
  );
  return res.translations;
}

export async function synthesizeSpeech(text: string, language: string): Promise<string[]> {
  const res = await request<{ audios: string[] }>(
    "/speak",
    json({ text, language_code: language }),
  );
  return res.audios;
}

export type CoachAnswer = { transcript: string; language_code: string; answer: string };

export function askCoach(opts: {
  question?: string;
  audio?: Blob;
  language: string;
  context: unknown;
}): Promise<CoachAnswer> {
  const form = new FormData();
  form.append("language_code", opts.language);
  form.append("context", JSON.stringify(opts.context));
  if (opts.question) form.append("question", opts.question);
  if (opts.audio) form.append("audio", opts.audio, "question.webm");
  return request<CoachAnswer>("/ask", { method: "POST", body: form });
}

/**
 * Plays base64 mp3 clips one after another. `done` resolves when playback finishes or is stopped,
 * and rejects if the browser cannot play the audio.
 */
export function playAudios(audios: string[]): { stop: () => void; done: Promise<void> } {
  let stopped = false;
  let current: HTMLAudioElement | null = null;
  let release: (() => void) | null = null;

  const done = (async () => {
    for (const b64 of audios) {
      if (stopped) return;
      const el = new Audio(`data:audio/mpeg;base64,${b64}`);
      current = el;
      await new Promise<void>((resolve, reject) => {
        release = resolve;
        el.onended = () => resolve();
        el.onerror = () => reject(new Error("Audio could not be played."));
        el.play().catch(() => reject(new Error("Your browser blocked audio playback.")));
      });
    }
  })();

  return {
    stop: () => {
      stopped = true;
      current?.pause();
      release?.();
    },
    done,
  };
}
