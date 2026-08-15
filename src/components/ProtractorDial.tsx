type Props = {
  value: number | null | undefined;
  max?: number;
  unit?: string;
  label?: string;
  size?: number;
  tone?: "gold" | "green" | "red";
};

/**
 * Semicircular protractor / goniometer dial — the signature motif.
 */
export function ProtractorDial({
  value,
  max = 180,
  unit = "°",
  label,
  size = 160,
  tone = "gold",
}: Props) {
  const w = size;
  const h = size / 2 + 14;
  const cx = w / 2;
  const cy = size / 2;
  const r = size / 2 - 10;

  const hasValue = typeof value === "number" && Number.isFinite(value);
  const pct = hasValue ? Math.min(Math.max(value / max, 0), 1) : 0;
  const angle = Math.PI * (1 - pct);
  const px = cx + r * Math.cos(angle);
  const py = cy - r * Math.sin(angle);

  const stroke =
    tone === "green"
      ? "var(--color-success)"
      : tone === "red"
        ? "var(--color-alert)"
        : "var(--color-primary)";

  const arcLen = Math.PI * r;

  const ticks = Array.from({ length: 19 }, (_, i) => i);

  return (
    <div className="flex flex-col items-center">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={6}
          strokeLinecap="round"
        />
        {ticks.map((i) => {
          const a = Math.PI * (1 - i / 18);
          const major = i % 3 === 0;
          const inner = r - (major ? 12 : 7);
          return (
            <line
              key={i}
              x1={cx + inner * Math.cos(a)}
              y1={cy - inner * Math.sin(a)}
              x2={cx + (r - 9) * Math.cos(a)}
              y2={cy - (r - 9) * Math.sin(a)}
              stroke="var(--color-border)"
              strokeWidth={major ? 1.5 : 1}
              opacity={major ? 0.9 : 0.5}
            />
          );
        })}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={stroke}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${arcLen * pct} ${arcLen}`}
        />
        {hasValue && (
          <>
            <line
              x1={cx}
              y1={cy}
              x2={px}
              y2={py}
              stroke={stroke}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <circle cx={px} cy={py} r={3.5} fill={stroke} />
          </>
        )}
        <circle cx={cx} cy={cy} r={4} fill="var(--color-border)" />
        <line
          x1={cx - r - 2}
          y1={cy}
          x2={cx + r + 2}
          y2={cy}
          stroke="var(--color-border)"
          strokeWidth={1}
        />
      </svg>
      <div className="-mt-2 text-center">
        <div className="font-mono text-2xl leading-none tracking-tight text-foreground">
          {hasValue ? `${value}${unit}` : "—"}
        </div>
        {label && (
          <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </div>
        )}
      </div>
    </div>
  );
}
