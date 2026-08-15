import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Loader2, Settings2, Trash2, UploadCloud } from "lucide-react";
import { PipelineStepper } from "@/components/PipelineStepper";
import {
  DEFAULT_API_URL,
  getApiUrl,
  saveApiUrl,
  setAnalysis,
  type AnalysisResult,
} from "@/lib/analysis-store";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload Bowling Video — BowlingAI" },
      {
        name: "description",
        content: "Upload an mp4, mov or avi bowling clip and send it to the pose analysis backend.",
      },
      { property: "og:title", content: "Upload Bowling Video — BowlingAI" },
      {
        property: "og:description",
        content: "Send a cricket bowling clip to the BowlingAI analysis backend.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UploadPage,
});

const ALLOWED = ["mp4", "mov", "avi"];
const NETWORK_ERROR =
  "Backend not connected. Start the FastAPI service and confirm the API URL below, then try again.";

function UploadPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [apiUrl, setApiUrl] = useState(() => getApiUrl());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function acceptFile(f: File | undefined | null) {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED.includes(ext)) {
      setError("Unsupported file type. Please upload an .mp4, .mov or .avi video.");
      return;
    }
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  function removeFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function analyze() {
    if (!file) {
      setError("Please select a bowling video before analyzing.");
      return;
    }
    const base = (apiUrl || DEFAULT_API_URL).replace(/\/+$/, "");
    saveApiUrl(base);
    setError(null);
    setLoading(true);

    const form = new FormData();
    form.append("video", file);

    let response: Response;
    try {
      response = await fetch(`${base}/analyze`, { method: "POST", body: form });
    } catch {
      setLoading(false);
      setError(NETWORK_ERROR);
      return;
    }

    if (!response.ok) {
      let detail: string | undefined;
      try {
        const body = (await response.json()) as { detail?: string };
        detail = typeof body?.detail === "string" ? body.detail : undefined;
      } catch {
        detail = undefined;
      }
      const status = response.status;
      let message: string;
      if (status === 400) message = detail || "Unsupported video format or malformed upload.";
      else if (status === 404)
        message = "Bowler not detected in the video. Try a clearer, front-facing clip.";
      else if (status === 409)
        message = "Multiple people detected in frame. Upload a video with a single bowler.";
      else if (status === 422)
        message = detail || "Video quality is too low for pose detection to run reliably.";
      else if (status >= 500) message = "Video processing failed on the server. Please try again.";
      else message = detail || `Request failed with status ${status}.`;
      setLoading(false);
      setError(message);
      return;
    }

    let result: AnalysisResult;
    try {
      result = (await response.json()) as AnalysisResult;
    } catch {
      setLoading(false);
      setError("The backend returned a response that could not be read as analysis data.");
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(null);
    setAnalysis({ result, videoUrl: url, fileName: file.name });
    setLoading(false);
    navigate({ to: "/results" });
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="font-display text-lg uppercase tracking-[0.1em] text-foreground">
            Bowling<span className="text-primary">AI</span>
          </Link>
          <span className="eyebrow">Prototype — College Project</span>
        </div>

        <div className="mt-6">
          <PipelineStepper current={1} />
        </div>

        <h1 className="mt-10 text-3xl text-foreground">Upload Bowling Video</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Accepted formats: .mp4, .mov, .avi. A single bowler, front-facing, works best.
        </p>

        {/* API settings */}
        <div className="panel mt-6">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--surface-2)]"
          >
            <span className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Settings2 className="h-4 w-4 text-primary" /> API settings
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${settingsOpen ? "rotate-180" : ""}`}
            />
          </button>
          {settingsOpen && (
            <div className="border-t border-border px-4 py-4">
              <label
                htmlFor="api-url"
                className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground"
              >
                Backend API base URL
              </label>
              <input
                id="api-url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder={DEFAULT_API_URL}
                className="mt-2 w-full rounded-xl border border-border bg-[var(--surface-2)] px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary"
              />
              <p className="mt-2 font-mono text-xs text-faint">
                Requests are sent to {(apiUrl || DEFAULT_API_URL).replace(/\/+$/, "")}/analyze
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-[var(--alert)]/50 bg-[var(--alert)]/10 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--alert)]" />
            <p className="text-sm text-foreground">{error}</p>
          </div>
        )}

        {/* Dropzone / preview */}
        <div className="panel mt-6 p-5">
          <input
            ref={inputRef}
            type="file"
            accept=".mp4,.mov,.avi,video/mp4,video/quicktime,video/x-msvideo"
            className="hidden"
            onChange={(e) => acceptFile(e.target.files?.[0])}
          />

          {!file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                acceptFile(e.dataTransfer.files?.[0]);
              }}
              className="flex w-full flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-14 transition-colors hover:border-primary hover:bg-[var(--surface-2)]"
            >
              <UploadCloud className="h-7 w-7 text-primary" />
              <span className="font-display text-sm uppercase tracking-[0.18em] text-foreground">
                Drop video or click to upload
              </span>
              <span className="font-mono text-xs text-faint">.mp4 · .mov · .avi</span>
            </button>
          ) : (
            <div>
              <video
                src={previewUrl ?? undefined}
                controls
                className="w-full rounded-xl border border-border bg-black"
              />
              <div className="mt-4 flex items-center justify-between gap-4">
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {file.name}
                </span>
                <button
                  type="button"
                  onClick={removeFile}
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-[var(--alert)] hover:text-[var(--alert)]"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={analyze}
          disabled={loading}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-display text-sm uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-[var(--primary-soft)] disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Analyzing…" : "Analyze Bowling Action"}
        </button>
      </div>
    </main>
  );
}
