import { useCallback, useEffect, useRef, useState } from "react";
import {
  Brain,
  Check,
  ChevronDown,
  CloudSun,
  Landmark,
  Layers,
  MapPin,
  Navigation,
  Satellite,
  ShoppingBag,
  Sparkles,
  UploadCloud,
  ExternalLink,
  Sparkle,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfidenceIndicator } from "@/components/halisia/ds/confidence-indicator";
import { recordStageOpen, track } from "@/lib/analytics";
import { useReducedMotionPref } from "@/hooks/use-reduced-motion-pref";

import { PIPELINE_STAGES, type Stage } from "@/lib/pipeline-stages";

const TONE: Record<Stage["tone"], { ring: string; icon: string; chip: string }> = {
  input: {
    ring: "border-white/12 hover:border-white/25",
    icon: "text-foreground/80",
    chip: "text-muted-foreground",
  },
  source: {
    ring: "border-accent/25 hover:border-accent/45",
    icon: "text-accent",
    chip: "text-accent",
  },
  engine: {
    ring: "border-primary/30 hover:border-primary/50",
    icon: "text-primary",
    chip: "text-primary",
  },
  output: {
    ring: "border-emerald-400/30 hover:border-emerald-400/50",
    icon: "text-emerald-300",
    chip: "text-emerald-300",
  },
};

export function DataPipeline() {
  const [active, setActive] = useState<Stage | null>(null);
  const [open, setOpen] = useState(false);

  const [reduced, setReducedPref] = useReducedMotionPref();
  const seen = useRef<Set<string>>(new Set());

  const toggleReduced = useCallback(() => {
    setReducedPref();
    track({ name: "pipeline_motion_toggled", reduced: !reduced });
  }, [reduced, setReducedPref]);

  // One view event per stage, the first time it scrolls into view.
  const observe = useCallback((el: HTMLLIElement | null, stage: Stage, index: number) => {
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (seen.current.has(stage.title)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !seen.current.has(stage.title)) {
            seen.current.add(stage.title);
            track({ name: "pipeline_stage_view", stage: stage.title, index: index + 1 });
            io.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
  }, []);

  const openStage = (stage: Stage, index: number) => {
    track({ name: "pipeline_stage_click", stage: stage.title, index: index + 1, tone: stage.tone });
    track({ name: "pipeline_modal_open", stage: stage.title, index: index + 1 });
    recordStageOpen(stage.title);
    setActive(stage);
  };

  return (
    <section
      id="pipeline"
      data-testid="data-pipeline"
      className="py-20 md:py-28 border-t border-white/5"
      aria-label="How HALISIA turns a listing into intelligence"
      data-reduced-motion={reduced ? "true" : "false"}
    >
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-[0.25em] text-accent">The data pipeline</div>
            <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight">
              Every score is <span className="text-gradient">traceable to a source</span>.
            </h2>
            <p className="mt-3 text-sm md:text-base text-muted-foreground leading-relaxed">
              Nothing in HALISIA is invented. A listing travels through open geospatial, climate,
              satellite and government datasets before the AI reads it — and each stage stays
              visible in the final report.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleReduced}
              aria-pressed={reduced}
              className="glass focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-xs text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
            >
              <Sparkle className="h-3.5 w-3.5" aria-hidden="true" />
              {reduced ? "Animations off" : "Reduce motion"}
            </button>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="data-pipeline-panel"
              data-testid="holo-toggle"
              className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-accent/45 bg-accent/10 px-4 text-xs font-semibold text-foreground transition-colors hover:bg-accent/20"
            >
              {open ? "Collapse" : `Reveal ${PIPELINE_STAGES.length} stages`}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        <ol
          id="data-pipeline-panel"
          hidden={!open}
          data-testid="holo-panel"
          className="holo-panel scrollbar-none mt-8 flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto pb-3"
          role="list"
        >
          {PIPELINE_STAGES.map((s, i) => {
            const tone = TONE[s.tone];
            const last = i === PIPELINE_STAGES.length - 1;
            const rowEnd = (i + 1) % 5 === 0;
            return (
              <li
                key={s.title}
                className="relative flex w-[240px] shrink-0 snap-start flex-col items-stretch sm:w-[260px]"
                data-testid="pipeline-stage"
                ref={(el) => observe(el, s, i)}
              >
                <button
                  type="button"
                  onClick={() => openStage(s, i)}
                  aria-label={`${s.title} — open stage details`}
                  className={`glass block h-full w-full rounded-2xl border text-left ${tone.ring} p-4 ${
                    reduced ? "" : "transition-all duration-300 hover:-translate-y-0.5"
                  } transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5">
                      <s.icon className={`h-4 w-4 ${tone.icon}`} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[10px] uppercase tracking-[0.2em] ${tone.chip}`}>
                        {String(i + 1).padStart(2, "0")} · {s.role}
                      </span>
                      <span className="block text-sm font-semibold leading-tight">{s.title}</span>
                    </span>
                  </div>
                  <p className="mt-2.5 text-[12px] leading-relaxed text-muted-foreground">
                    {s.detail}
                  </p>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                      <span>Confidence</span>
                      <span className="font-semibold tabular-nums">{s.confidence}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${
                          s.confidence >= 75
                            ? "bg-emerald-400"
                            : s.confidence >= 60
                              ? "bg-accent"
                              : "bg-amber-400"
                        } ${reduced ? "" : "transition-[width] duration-700"}`}
                        style={{ width: `${s.confidence}%` }}
                      />
                    </div>
                  </div>
                  <span className="mt-2 inline-block text-[10px] text-accent">
                    What happens here →
                  </span>
                </button>

                {!last && !rowEnd && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute right-0 top-1/2 h-px w-3 -translate-y-1/2 translate-x-full bg-gradient-to-r from-accent/50 to-transparent"
                  />
                )}
              </li>
            );
          })}
        </ol>

        <p className="mt-8 text-[11px] text-muted-foreground/80">
          Open datasets are attributed to their publishers. Scores are indicative decision support,
          not a valuation, survey or legal opinion.
        </p>
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent
          className={`max-h-[85vh] overflow-y-auto sm:max-w-lg ${
            reduced ? "duration-0 data-[state=closed]:duration-0" : ""
          }`}
        >
          {active && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <active.icon className={`h-5 w-5 ${TONE[active.tone].icon}`} aria-hidden="true" />
                  {active.title}
                </DialogTitle>
                <DialogDescription>{active.detail}</DialogDescription>
              </DialogHeader>

              <ConfidenceIndicator
                pct={active.confidence}
                freshness={active.freshness}
                sources={active.sources.length}
              />

              <div className="rounded-xl border border-accent/25 bg-accent/10 p-3">
                <div className="text-[10px] uppercase tracking-widest text-accent">
                  What this means for you
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-foreground/90">
                  {active.youGet}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Influences roughly {active.weight}% of the HALISIA Intelligence Score.
                </p>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  What happens in this stage
                </div>
                <ul className="mt-2 grid gap-1.5">
                  {active.what.map((w) => (
                    <li key={w} className="text-[12px] leading-relaxed text-foreground/85">
                      • {w}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Data sources used in this stage
                </div>
                <ul className="mt-2 grid gap-1.5" aria-label="Checklist of data sources used">
                  {active.sources.map((src) => (
                    <li
                      key={src.label}
                      className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2 text-[12px]"
                    >
                      <Check
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300"
                        aria-hidden="true"
                      />
                      {src.url ? (
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          onClick={() =>
                            track({
                              name: "pipeline_source_click",
                              stage: active.title,
                              url: src.url!,
                            })
                          }
                          className="inline-flex items-center gap-1 text-accent hover:underline"
                        >
                          {src.label} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="text-foreground/85">{src.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-2.5 text-[11px] leading-relaxed text-amber-200">
                Where it can be uncertain: {active.caveat}
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
