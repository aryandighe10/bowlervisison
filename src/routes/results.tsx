import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Target, RotateCcw } from "lucide-react";
import { PipelineStepper } from "@/components/PipelineStepper";
import { ProtractorDial } from "@/components/ProtractorDial";
import { RecentAnalyses } from "@/components/RecentAnalyses";
import { SkeletonCanvas } from "@/components/SkeletonCanvas";
import { AskCoach, LanguagePicker, ListenButton } from "@/components/VoiceCoach";
import { clearAnalysis, useAnalysis, type AnalysisResult } from "@/lib/analysis-store";
import { getSavedLanguage, saveLanguage, translateTexts } from "@/lib/voice";

const SECTION_TITLES = ["Strengths", "Areas to Improve", "Suggested Focus"];

type Translated = { titles: string[]; strengths: string[]; improvements: string[]; recs: string[] };

/** Translates the section titles and feedback lines whenever the language or result changes. */
function useTranslatedFeedback(result: AnalysisResult | null, language: string) {
  const [translated, setTranslated] = useState<Translated | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (!result || language === "en-IN") {
      setTranslated(null);
      setStatus("idle");
      return;
    }
    const s = result.strengths ?? [];
    const im = result.improvements ?? [];
    const rc = result.recommendations ?? [];
    let cancelled = false;
    setStatus("loading");
    translateTexts([...SECTION_TITLES, ...s, ...im, ...rc], language)
      .then((out) => {
        if (cancelled) return;
        const a = SECTION_TITLES.length;
        setTranslated({
          titles: out.slice(0, a),
          strengths: out.slice(a, a + s.length),
          improvements: out.slice(a + s.length, a + s.length + im.length),
          recs: out.slice(a + s.length + im.length),
        });
        setStatus("idle");
      })
      .catch(() => {
        if (cancelled) return;
        setTranslated(null);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [result, language]);

  return { translated, status };
}

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Analysis Results — BowlingAI" },
      {
        name: "description",
        content:
          "Joint angles, alignment status and prototype technique feedback for your bowling clip.",
      },
      { property: "og:title", content: "Analysis Results — BowlingAI" },
      {
        property: "og:description",
        content: "Prototype joint-angle and technique indicators for a cricket bowling action.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResultsPage,
});

const ALIGNMENT_MAP: Record<string, { label: string; tone: "green" | "gold" | "red" }> = {
  stable: { label: "Stable", tone: "green" },
  moderate_variation: { label: "Moderate variation", tone: "gold" },
  significant_variation: { label: "Significant variation", tone: "red" },
};

function scoreBand(score: number) {
  if (score >= 80) return { label: "Consistent", color: "var(--success)" };
  if (score >= 60) return { label: "Developing", color: "var(--primary)" };
  return { label: "Needs work", color: "var(--alert)" };
}

function AlignmentCard({ title, value }: { title: string; value?: string | undefined }) {
  const mapped = value ? ALIGNMENT_MAP[value] : undefined;
  const label = mapped?.label ?? (value ? value.replace(/_/g, " ") : "Not reported");
  const tone = mapped?.tone ?? "gold";
  const cls =
    tone === "green"
      ? "border-[var(--success)]/50 bg-[var(--success)]/10 text-[var(--success)]"
      : tone === "red"
        ? "border-[var(--alert)]/50 bg-[var(--alert)]/10 text-[var(--alert)]"
        : "border-primary/50 bg-primary/10 text-primary";

  return (
    <div className="panel flex flex-col items-start justify-between gap-4 p-5">
      <h3 className="text-sm tracking-[0.14em] text-foreground">{title}</h3>
      <span
        className={`inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em] ${cls}`}
      >
        {label}
      </span>
    </div>
  );
}

function FeedbackColumn({
  title,
  items,
  icon: Icon,
  color,
  language,
}: {
  title: string;
  items?: string[] | undefined;
  icon: typeof CheckCircle2;
  color: string;
  language: string;
}) {
  const list = items ?? [];
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color }} />
          <h3 className="text-sm tracking-[0.14em] text-foreground">{title}</h3>
        </div>
        {list.length > 0 && (
          <ListenButton text={`${title}. ${list.join(" ")}`} language={language} />
        )}
      </div>
      {list.length === 0 ? (
        <p className="mt-4 text-sm text-faint">None detected for this clip.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {list.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
              <span style={{ color }}>—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultsPage() {
  const navigate = useNavigate();
  const { result, videoUrl, fileName } = useAnalysis();
  const [language, setLanguage] = useState("en-IN");
  const { translated, status } = useTranslatedFeedback(result, language);

  useEffect(() => {
    if (!result) navigate({ to: "/upload" });
  }, [result, navigate]);

  // Read the saved language after mount so server and client render the same HTML.
  useEffect(() => setLanguage(getSavedLanguage()), []);

  if (!result) return null;

  const feedbackLanguage = translated ? language : "en-IN";

  const angles = result.joint_angles ?? {};
  const frames = Array.isArray(result.frames) ? result.frames : null;

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link to="/" className="font-display text-lg uppercase tracking-[0.1em] text-foreground">
            Bowling<span className="text-primary">AI</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <LanguagePicker
              value={language}
              onChange={(code) => {
                setLanguage(code);
                saveLanguage(code);
              }}
            />
            <button
              type="button"
              onClick={() => {
                clearAnalysis();
                navigate({ to: "/upload" });
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Analyze Another Video
            </button>
          </div>
        </div>

        <div className="mt-6">
          <PipelineStepper current={4} />
        </div>

        {/* Score */}
        <section className="panel mt-6 flex flex-col items-center gap-6 p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl text-foreground">Overall Technique Consistency</h1>
            <p className="mt-3 font-mono text-4xl text-primary">
              {typeof result.score === "number" ? `${result.score} / 100` : "—"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {typeof result.score === "number" && (
                <span
                  className="inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em]"
                  style={{
                    color: scoreBand(result.score).color,
                    borderColor: scoreBand(result.score).color,
                  }}
                >
                  {scoreBand(result.score).label}
                </span>
              )}
              {result.bowling_arm && (
                <span className="inline-flex rounded-full border border-border px-3 py-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {result.bowling_arm}-arm bowler detected
                </span>
              )}
            </div>
            <p className="mt-4 max-w-md text-[11px] uppercase tracking-[0.16em] text-faint">
              Prototype consistency score — not a professional coaching score
            </p>
          </div>
          <ProtractorDial value={result.score ?? null} max={100} unit="" size={220} />
        </section>

        {/* Visual analysis */}
        <h2 className="mt-10 text-lg tracking-[0.14em] text-foreground">Visual Analysis</h2>
        <section className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="panel p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Original video
            </p>
            {videoUrl ? (
              <video
                src={videoUrl}
                controls
                className="mt-3 w-full rounded-xl border border-border bg-black"
              />
            ) : (
              <p className="mt-3 text-sm text-faint">Original video is no longer available.</p>
            )}
            {fileName && <p className="mt-3 font-mono text-xs text-faint">{fileName}</p>}
          </div>
          <div className="panel p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Skeleton visualization
            </p>
            {frames && frames.length > 0 ? (
              <div className="mt-3 flex justify-center">
                <SkeletonCanvas frames={frames} />
              </div>
            ) : (
              <div className="mt-3 flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-border px-4 py-8 text-center">
                <p className="font-mono text-xs text-muted-foreground">
                  No processed skeleton frames were returned by the backend.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Body measurements */}
        <h2 className="mt-10 text-lg tracking-[0.14em] text-foreground">Body Measurements</h2>
        <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Elbow Angle", value: angles.elbow },
            { label: "Front Knee Angle", value: angles.front_knee },
            { label: "Rear Knee Angle", value: angles.rear_knee },
            { label: "Trunk Angle", value: angles.trunk },
          ].map((m) => (
            <div key={m.label} className="panel p-5">
              <ProtractorDial value={m.value ?? null} max={180} label={m.label} size={150} />
            </div>
          ))}
        </section>
        <section className="mt-4 grid gap-4 sm:grid-cols-2">
          <AlignmentCard title="Shoulder Alignment" value={result.alignment?.shoulder} />
          <AlignmentCard title="Hip Alignment" value={result.alignment?.hip} />
        </section>

        {/* Feedback */}
        <section className="mt-10 grid gap-4 lg:grid-cols-3">
          <FeedbackColumn
            title={translated?.titles[0] ?? SECTION_TITLES[0]!}
            items={translated?.strengths ?? result.strengths}
            icon={CheckCircle2}
            color="var(--success)"
            language={feedbackLanguage}
          />
          <FeedbackColumn
            title={translated?.titles[1] ?? SECTION_TITLES[1]!}
            items={translated?.improvements ?? result.improvements}
            icon={AlertTriangle}
            color="var(--alert)"
            language={feedbackLanguage}
          />
          <FeedbackColumn
            title={translated?.titles[2] ?? SECTION_TITLES[2]!}
            items={translated?.recs ?? result.recommendations}
            icon={Target}
            color="var(--primary)"
            language={feedbackLanguage}
          />
        </section>
        {status === "loading" && (
          <p className="mt-3 font-mono text-xs text-faint">Translating feedback…</p>
        )}
        {status === "error" && (
          <p role="alert" className="mt-3 text-xs text-[var(--alert)]">
            Could not translate the feedback right now, so it is shown in English.
          </p>
        )}

        <AskCoach result={result} language={language} />

        <RecentAnalyses refreshKey={result} />

        <p className="mt-10 border-t border-border pt-6 text-xs leading-relaxed text-faint">
          These are prototype technique indicators only, generated by simple geometric rules. They
          are not medical advice and do not diagnose injuries.
        </p>
      </div>
    </main>
  );
}
