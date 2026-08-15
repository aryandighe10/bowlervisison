import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Landmark = { x: number; y: number; v?: number };
type Frame = { frame: number; landmarks: Landmark[] };

type Props = {
  frames: Frame[];
};

// MediaPipe Pose landmark indices (33 points) — bone connections for a
// simplified stick-figure skeleton. Index reference:
// 0 nose · 11/12 shoulders · 13/14 elbows · 15/16 wrists
// 23/24 hips · 25/26 knees · 27/28 ankles · 29/30 heels · 31/32 foot index
const CONNECTIONS: Array<[number, number]> = [
  [0, 11],
  [0, 12],
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 29],
  [27, 31],
  [29, 31],
  [28, 30],
  [28, 32],
  [30, 32],
];

// Landmarks worth drawing as a labeled joint dot (matches what the spec
// asked the backend to track).
const KEY_JOINTS = new Set([0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 31, 32]);

const SIZE = 280;
const PAD = 20;

export function SkeletonCanvas({ frames }: Props) {
  const [index, setIndex] = useState(() => Math.floor(frames.length / 2));

  const frame = frames[index];

  const { bones, joints } = useMemo(() => {
    if (!frame) return { bones: [], joints: [] };
    const lm = frame.landmarks;
    const scale = (v: number) => PAD + v * (SIZE - PAD * 2);

    const bones = CONNECTIONS.filter(([a, b]) => lm[a] && lm[b]).map(([a, b], i) => ({
      key: i,
      x1: scale(lm[a].x),
      y1: scale(lm[a].y),
      x2: scale(lm[b].x),
      y2: scale(lm[b].y),
    }));

    const joints = lm
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => p && KEY_JOINTS.has(i))
      .map(({ p, i }) => ({
        key: i,
        x: scale(p.x),
        y: scale(p.y),
        low: typeof p.v === "number" && p.v < 0.5,
      }));

    return { bones, joints };
  }, [frame]);

  if (frames.length === 0) return null;

  return (
    <div className="flex flex-col items-center">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Skeleton pose at frame ${frame?.frame ?? index}`}
        className="rounded-xl border border-border bg-black/40"
      >
        {bones.map((b) => (
          <line
            key={b.key}
            x1={b.x1}
            y1={b.y1}
            x2={b.x2}
            y2={b.y2}
            stroke="var(--color-primary)"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.85}
          />
        ))}
        {joints.map((j) => (
          <circle
            key={j.key}
            cx={j.x}
            cy={j.y}
            r={4}
            fill={j.low ? "var(--color-alert)" : "var(--foreground)"}
            stroke="var(--color-primary)"
            strokeWidth={1.5}
          />
        ))}
      </svg>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-30"
          aria-label="Previous frame"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-mono text-xs text-faint">
          Frame {index + 1} / {frames.length}
        </span>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(frames.length - 1, i + 1))}
          disabled={index === frames.length - 1}
          className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-30"
          aria-label="Next frame"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
