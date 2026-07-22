import { Info } from "lucide-react";

/** Confidence % with data-freshness and source count — canonical AI trust chip. */
export function ConfidenceIndicator({
  pct,
  freshness,
  sources,
  compact = false,
}: {
  pct: number;
  freshness?: string;
  sources?: number;
  compact?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const tone =
    clamped >= 75 ? "text-emerald-glow" : clamped >= 50 ? "text-accent" : "text-amber-glow";
  const ring =
    clamped >= 75
      ? "from-emerald-glow to-emerald-glow/70"
      : clamped >= 50
        ? "from-accent to-cyan-glow"
        : "from-amber-glow to-flamingo";

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] tabular-nums ${tone}`}
        title={`AI confidence ${clamped}%${sources ? ` · ${sources} sources` : ""}${freshness ? ` · ${freshness}` : ""}`}
      >
        <Info className="h-3 w-3" aria-hidden="true" />
        {clamped}%
      </span>
    );
  }

  return (
    <div className="glass rounded-2xl p-3" role="group" aria-label="AI confidence">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Info className="h-3 w-3 text-accent" aria-hidden="true" />
          Confidence
        </span>
        <span className={`font-semibold tabular-nums ${tone}`}>{clamped}%</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${ring} transition-[width] duration-700`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {(sources != null || freshness) && (
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
          {sources != null && <span>{sources} sources</span>}
          {freshness && <span>{freshness}</span>}
        </div>
      )}
    </div>
  );
}