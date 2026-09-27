/** Top-of-passport summary: position, county, coverage. No combined score. */
export function PassportSummaryStrip({
  positionLabel,
  locationPct,
  county,
  available,
  total,
  coveragePct,
  refreshed,
}: {
  positionLabel: string;
  locationPct: number;
  county: string | null;
  available: number;
  total: number;
  coveragePct: number;
  refreshed: string;
}) {
  const cell = "rounded-2xl border border-foreground/10 bg-card/80 px-3 py-2.5";
  return (
    <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="passport-summary">
      <div className={cell}>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Position</div>
        <div className="mt-0.5 text-sm">{positionLabel}</div>
        <div className="font-mono text-[11px] text-muted-foreground">
          {locationPct}% location confidence
        </div>
      </div>
      <div className={cell}>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">County</div>
        <div className="mt-0.5 text-sm">{county ?? "No match"}</div>
      </div>
      <div className={cell}>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Data coverage
        </div>
        <div className="mt-0.5 font-mono text-sm" data-testid="passport-coverage">
          {available}/{total} facts
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10" aria-hidden>
          <div className="h-full bg-primary" style={{ width: `${coveragePct}%` }} />
        </div>
      </div>
      <div className={cell}>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Verification
        </div>
        <div className="mt-0.5 text-sm">Not verified</div>
        <div className="font-mono text-[11px] text-muted-foreground">Refreshed {refreshed}</div>
      </div>
    </section>
  );
}
