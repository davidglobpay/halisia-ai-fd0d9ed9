import { useMemo, useState } from "react";
import { Gauge, Info } from "lucide-react";
import { PIPELINE_STAGES } from "@/components/halisia/data-pipeline";
import { useReducedMotionPref } from "@/hooks/use-reduced-motion-pref";

/**
 * "Score drivers" — which pipeline stages move the HALISIA Intelligence Score
 * most, and how confident each one is. Weights are declared on the pipeline
 * stages themselves so the two sections can never drift apart.
 */
export function ScoreDrivers() {
  const [reduced] = useReducedMotionPref();
  const [openTip, setOpenTip] = useState<string | null>(null);

  const drivers = useMemo(() => [...PIPELINE_STAGES].sort((a, b) => b.weight - a.weight), []);
  const max = drivers[0]?.weight ?? 1;

  const band = (pct: number) =>
    pct >= 75
      ? { label: "High confidence", cls: "text-emerald-300", bar: "bg-emerald-400" }
      : pct >= 60
        ? { label: "Moderate confidence", cls: "text-accent", bar: "bg-accent" }
        : { label: "Treat with care", cls: "text-amber-300", bar: "bg-amber-400" };

  return (
    <section
      id="score-drivers"
      data-testid="score-drivers"
      className="py-20 md:py-28 border-t border-white/5"
      aria-label="What drives the HALISIA Intelligence Score"
      data-reduced-motion={reduced ? "true" : "false"}
    >
      <div className="mx-auto max-w-7xl px-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-accent">
            <Gauge className="h-3.5 w-3.5" aria-hidden="true" /> Score drivers
          </div>
          <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight">
            What actually moves <span className="text-gradient">your score</span>.
          </h2>
          <p className="mt-3 text-sm md:text-base text-muted-foreground leading-relaxed">
            Each pipeline stage carries a different weight in the final HALISIA Intelligence Score,
            and each arrives with its own confidence. Hover or tap a row to see why.
          </p>
        </div>

        <ul className="mt-10 grid gap-2" role="list">
          {drivers.map((s) => {
            const b = band(s.confidence);
            const open = openTip === s.title;
            return (
              <li
                key={s.title}
                data-testid="score-driver"
                className="glass relative rounded-2xl border border-white/10 p-3.5 sm:p-4"
                onMouseEnter={() => setOpenTip(s.title)}
                onMouseLeave={() => setOpenTip((v) => (v === s.title ? null : v))}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <s.icon className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                  <span className="text-sm font-medium">{s.title}</span>
                  <button
                    type="button"
                    aria-label={`Why ${s.title} matters`}
                    aria-expanded={open}
                    onClick={() => setOpenTip(open ? null : s.title)}
                    className="rounded-full p-0.5 text-muted-foreground hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    onFocus={() => setOpenTip(s.title)}
                    onBlur={() => setOpenTip((v) => (v === s.title ? null : v))}
                  >
                    <Info className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {s.weight}% of score
                  </span>
                </div>

                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r from-primary to-accent ${
                      reduced ? "" : "transition-[width] duration-700"
                    }`}
                    style={{ width: `${Math.round((s.weight / max) * 100)}%` }}
                  />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className={`inline-flex items-center gap-1 ${b.cls}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${b.bar}`} aria-hidden="true" />
                    {b.label} · {s.confidence}%
                  </span>
                  <span className="text-muted-foreground/80">Updated: {s.freshness}</span>
                </div>

                {open && (
                  <div
                    role="tooltip"
                    className="glass-strong mt-2 rounded-xl border border-accent/25 p-3 text-[12px] leading-relaxed text-foreground/90"
                  >
                    {s.youGet}
                    <span className="mt-1.5 block text-[11px] text-amber-200/90">
                      Uncertainty: {s.caveat}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-6 text-[11px] text-muted-foreground/80">
          Weights are indicative and shift with your persona — a lender, a developer and a renter do
          not value the same signals equally.
        </p>
      </div>
    </section>
  );
}
