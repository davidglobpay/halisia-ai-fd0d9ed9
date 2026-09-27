import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, MapPin, CircleSlash, ChevronDown } from "lucide-react";
import type { LocationIntel } from "@/lib/location-intel.functions";
import type { NarrativeOutput } from "@/lib/ai-narrative.functions";
import type { Wave4Intel } from "@/lib/wave4-intel.functions";
import { runIntelligenceEngine, DOSSIER_SCOPE, type ModuleOutput } from "@/lib/intelligence-engine";
import { useUserPersona } from "@/hooks/use-user-persona";

/**
 * The hero read for a location.
 *
 * This component used to score the location itself, in parallel with the
 * intelligence engine and disagreeing with it. It derived eight gauges from
 * whatever was to hand: "Safety" was `50 + airQualityIndex / 2`, "Utilities"
 * was a count of shops and restaurants, "Future growth" was the mean of two
 * LLM numbers, and anything unknown fell back to 55 or 60. It then multiplied
 * the headline score by 65,000, added 1.5 million and printed the result as
 * a headline valuation in shillings per acre — a price, in front of a buyer,
 * derived from a language model's opinion of how livable a place felt.
 *
 * The price is gone and the parallel scorer with it. This now renders what
 * `runIntelligenceEngine` measured and nothing else, so one scorer governs the
 * whole app and the hero cannot contradict the dossier below it.
 */

function toneFor(score: number) {
  if (score >= 75) return { ring: "#22c55e", text: "text-emerald-glow", label: "Excellent" };
  if (score >= 60) return { ring: "#62e9ff", text: "text-cyan-glow", label: "Good" };
  if (score >= 45) return { ring: "#d4a017", text: "text-amber-glow", label: "Fair" };
  return { ring: "#ef4444", text: "text-destructive", label: "Weak" };
}

const NEUTRAL = { ring: "rgba(255,255,255,0.14)", text: "text-muted-foreground", label: "—" };

/* ---------- animated circular gauge ---------- */

function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(target * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Gauge({
  score,
  size = 72,
  stroke = 6,
}: {
  score: number | null;
  size?: number;
  stroke?: number;
}) {
  const v = useCountUp(score ?? 0);
  const tone = score != null ? toneFor(score) : NEUTRAL;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = score != null ? c * (1 - v / 100) : c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className="stroke-white/10"
          fill="none"
        />
        {score != null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            stroke={tone.ring}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={off}
            style={{ filter: `drop-shadow(0 0 6px ${tone.ring}66)` }}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className={`text-sm font-semibold tabular-nums ${tone.text}`}>
          {score != null ? Math.round(v) : "—"}
        </span>
      </div>
    </div>
  );
}

/** A tile per measured module. Modules with no data never reach this. */
function ModuleTile({ m }: { m: ModuleOutput }) {
  const tone = m.score != null ? toneFor(m.score) : NEUTRAL;
  return (
    <details className="group glass rounded-2xl">
      <summary className="flex min-h-[96px] cursor-pointer list-none items-center gap-3 rounded-2xl p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Gauge score={m.score} />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">
            {m.label}
          </div>
          <div className={`mt-0.5 text-xs font-medium ${tone.text}`}>{tone.label}</div>
          <div className="text-[10px] text-muted-foreground">
            Confidence {m.confidencePct ?? 0}%
          </div>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-foreground/10 px-3 pb-3 pt-2 text-[11px] leading-relaxed">
        <div className="font-medium text-foreground">Evidence</div>
        <div className="mt-1 text-muted-foreground">
          Sources: {m.sources.length > 0 ? m.sources.join(", ") : "No source available"}
        </div>
        <div className="text-muted-foreground">Confidence: {m.confidencePct ?? 0}%</div>
        <div className="mt-2 font-medium text-foreground">Limitations</div>
        <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
          {m.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
        <div className="mt-2 text-muted-foreground">Next: {m.nextStep}</div>
      </div>
    </details>
  );
}

function RatingPill({ label, score }: { label: string; score: number }) {
  const tone = toneFor(score);
  return (
    <div className="glass rounded-full pl-2 pr-3 py-1 inline-flex items-center gap-1.5 text-[11px]">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.ring }} />
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${tone.text}`}>{score}</span>
    </div>
  );
}

/* ---------- main component ---------- */

export function HeroSummary({
  address,
  lat,
  lng,
  intel,
  narrative,
  wave4,
}: {
  address: string;
  lat: number;
  lng: number;
  intel?: LocationIntel;
  narrative?: NarrativeOutput;
  wave4?: Wave4Intel;
}) {
  const [persona] = useUserPersona();
  const decision = runIntelligenceEngine(intel, narrative, persona, wave4);
  const reading = decision.reading;
  const tone = reading != null ? toneFor(reading) : NEUTRAL;
  const readingCount = useCountUp(reading ?? 0, 1100);

  const measured = decision.modules.filter((m) => m.score != null);
  const notAssessed = decision.modules.filter((m) => m.score == null);

  // The narrative is a written read, not a measurement. It is shown as prose
  // and never converted into a number anywhere on this surface.
  const summary =
    narrative?.paragraphs?.[0] ?? narrative?.overview ?? "HALISIA is reading this location…";

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      data-testid="hero-summary"
      className="glass-strong rounded-3xl p-4 sm:p-5 relative overflow-hidden"
      aria-label="Location hero summary"
    >
      <div
        className="absolute -top-24 -right-16 h-56 w-56 rounded-full blur-3xl opacity-40"
        style={{ background: `radial-gradient(circle, ${tone.ring}88, transparent 70%)` }}
      />

      <div className="relative grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] items-start">
        {/* The reading */}
        <div className="flex items-center gap-3 sm:flex-col sm:items-start">
          <Gauge score={reading} size={110} stroke={9} />
          <div className="sm:mt-1">
            <div className="text-[10px] uppercase tracking-[0.2em] text-accent">
              {decision.readingLabel}
            </div>
            <div className={`text-2xl font-bold tabular-nums ${tone.text}`}>
              {reading != null ? Math.round(readingCount) : "—"}
              {reading != null && (
                <span className="text-sm text-muted-foreground font-normal">/100</span>
              )}
            </div>
            <div className={`text-xs ${tone.text}`}>
              {reading != null ? tone.label : "Not enough read"}
            </div>
          </div>
        </div>

        {/* Address + written read */}
        <div className="min-w-0">
          <div className="flex items-start gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            <MapPin className="h-3 w-3 text-accent shrink-0" /> Location
          </div>
          <h2 className="mt-0.5 text-lg sm:text-xl font-semibold leading-tight line-clamp-2">
            {address}
          </h2>
          <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
            {lat.toFixed(4)}, {lng.toFixed(4)}
            {intel?.elevation?.meters != null && (
              <> · {intel.elevation.meters.toFixed(0)} m elev.</>
            )}
          </div>

          {measured.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {measured.map((m) => (
                <RatingPill key={m.id} label={m.label} score={m.score!} />
              ))}
            </div>
          )}

          <div className="mt-3 rounded-2xl border border-white/10 bg-black/15 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-accent">
              <Sparkles className="h-3 w-3" /> Written read
            </div>
            <p className="mt-1 text-sm leading-relaxed text-foreground/90 line-clamp-3">
              {summary}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              A written interpretation of the readings below. HALISIA holds no price or transaction
              data for this location and publishes no valuation.
            </p>
          </div>
        </div>
      </div>

      {/* Measured modules */}
      {measured.length > 0 && (
        <div className="relative mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {measured.map((m) => (
            <ModuleTile key={m.id} m={m} />
          ))}
        </div>
      )}

      {/* What could not be read */}
      {notAssessed.length > 0 && (
        <div
          className="relative mt-3 rounded-2xl border border-dashed border-white/12 p-3"
          data-testid="hero-not-assessed"
        >
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            <CircleSlash className="h-3 w-3" /> Not assessed — {notAssessed.length} of{" "}
            {decision.modules.length}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {notAssessed.map((m) => (
              <span
                key={m.id}
                title={m.nextStep}
                className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {m.label}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            HALISIA holds no data that answers these. The full report lists who to ask for each.
          </p>
        </div>
      )}

      <div className="relative mt-2 text-[10px] text-muted-foreground leading-relaxed">
        {decision.scopeNote} {DOSSIER_SCOPE}
      </div>
    </motion.section>
  );
}
