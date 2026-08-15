const STEPS = ["Upload", "Detect", "Analyze", "Feedback"];

export function PipelineStepper({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card px-4 py-3">
      {STEPS.map((step, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        return (
          <div key={step} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={[
                  "flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[11px]",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : done
                      ? "border-primary/50 text-primary"
                      : "border-border text-faint",
                ].join(" ")}
              >
                {n}
              </span>
              <span
                className={[
                  "text-[11px] uppercase tracking-[0.2em]",
                  active ? "text-foreground" : "text-muted-foreground",
                ].join(" ")}
              >
                {step}
              </span>
            </div>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-border sm:w-10" />}
          </div>
        );
      })}
    </div>
  );
}
