import { createFileRoute, Link } from "@tanstack/react-router";
import { ScanLine, Ruler, MessageSquareText, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BowlingAI — Cricket Bowling Action Analysis" },
      {
        name: "description",
        content:
          "Upload a cricket bowling video and analyze body positioning, joint angles and basic technique indicators.",
      },
      { property: "og:title", content: "BowlingAI — Cricket Bowling Action Analysis" },
      {
        property: "og:description",
        content: "AI-powered analysis of a cricket bowler's joint angles and body positioning.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const FEATURES = [
  {
    icon: ScanLine,
    title: "Pose Detection",
    desc: "Landmarks extracted from your clip by the pose backend.",
  },
  {
    icon: Ruler,
    title: "Joint Analysis",
    desc: "Elbow, knee and trunk angles measured frame by frame.",
  },
  {
    icon: MessageSquareText,
    title: "Technique Feedback",
    desc: "Strengths, improvements and focus points from simple rules.",
  },
];

function Home() {
  return (
    <main className="min-h-screen bg-background px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <span className="eyebrow">Prototype — College Project</span>

        <h1 className="mt-8 text-6xl leading-[0.95] text-foreground sm:text-8xl">
          Bowling<span className="text-primary">AI</span>
        </h1>

        <p className="mt-5 font-display text-xl uppercase tracking-[0.14em] text-muted-foreground sm:text-2xl">
          AI-Powered Cricket Bowling Action Analysis
        </p>

        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Upload a cricket bowling video and analyze body positioning, joint angles and basic
          technique indicators.
        </p>

        <Link
          to="/upload"
          className="mt-10 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-display text-sm uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-[var(--primary-soft)]"
        >
          Upload Bowling Video
          <ArrowRight className="h-4 w-4" />
        </Link>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="panel p-5 transition-colors hover:border-primary/50">
              <f.icon className="h-5 w-5 text-primary" />
              <h2 className="mt-4 text-base tracking-[0.1em] text-foreground">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
