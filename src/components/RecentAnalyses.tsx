import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { getApiUrl } from "@/lib/analysis-store";

type HistoryItem = {
  id: number;
  filename: string;
  timestamp: string;
  score: number;
  bowling_arm?: "left" | "right";
};

function scoreColor(score: number) {
  if (score >= 80) return "var(--success)";
  if (score >= 60) return "var(--primary)";
  return "var(--alert)";
}

/** Past analyses from GET /history, with a small score trend. Hides itself if there are none. */
export function RecentAnalyses({ refreshKey }: { refreshKey?: unknown }) {
  const [items, setItems] = useState<HistoryItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${getApiUrl().replace(/\/+$/, "")}/history`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: HistoryItem[]) => {
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (!items || items.length === 0) return null;

  const recent = items.slice(-8);

  return (
    <section className="panel mt-6 p-5" aria-label="Recent analyses">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <h2 className="text-sm tracking-[0.14em] text-foreground">Recent Analyses</h2>
      </div>

      <div className="mt-4 flex h-16 items-end gap-1.5" aria-hidden="true">
        {recent.map((it) => (
          <div
            key={it.id}
            title={`${it.filename}: ${it.score}`}
            className="flex-1 rounded-t-sm"
            style={{ height: `${Math.max(8, it.score)}%`, background: scoreColor(it.score) }}
          />
        ))}
      </div>

      <ul className="mt-4 divide-y divide-border">
        {[...recent].reverse().map((it) => (
          <li key={it.id} className="flex items-center justify-between gap-4 py-2">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs text-foreground">{it.filename}</p>
              <p className="text-[11px] text-faint">
                {new Date(it.timestamp).toLocaleString()}
                {it.bowling_arm ? ` · ${it.bowling_arm}-arm` : ""}
              </p>
            </div>
            <span className="font-mono text-sm" style={{ color: scoreColor(it.score) }}>
              {it.score}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
