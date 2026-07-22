import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  HardHat,
  ShieldCheck,
  Waves,
  Building2,
  Zap,
  Leaf,
  Sparkles,
  MapPin,
} from "lucide-react";
import type { LocationIntel } from "@/lib/location-intel.functions";
import type { NarrativeOutput } from "@/lib/ai-narrative.functions";

/* ---------- score derivations (pure, no new data calls) ---------- */

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function deriveScores(intel?: LocationIntel, narrative?: NarrativeOutput) {
  const c = intel?.categories;
  const infraCount =
    (c?.schools.length ?? 0) +
    (c?.hospitals.length ?? 0) +
    (c?.groceries.length ?? 0) +
    (c?.banks.length ?? 0);
  const accessCount = (c?.transit.length ?? 0) + (c?.restaurants.length ?? 0);
  const elev = intel?.elevation?.meters ?? null;
  const aqi = intel?.airQuality?.universalAqi ?? null;

  const investment = narrative?.businessSuitability?.score ?? clamp(40 + infraCount * 3);
  const construction = elev != null ? clamp(elev < 20 ? 45 : elev < 100 ? 65 : 80) : 60;
  const safety = aqi != null ? clamp(50 + aqi / 2) : 60;
  const flood = elev != null ? clamp(elev < 20 ? 30 : elev < 100 ? 60 : 85) : 60;
  const infrastructure = clamp(35 + infraCount * 4);
  const utilities = clamp(40 + infraCount * 3 + accessCount * 2);
  const environment = aqi != null ? clamp(aqi) : 55;
  const futureGrowth = clamp(
    ((narrative?.businessSuitability?.score ?? 60) +
      (narrative?.familySuitability?.score ?? 60)) /
      2,
  );
  const overall = narrative?.livability ?? clamp((investment + infrastructure + environment) / 3);
  return {
    overall,
    investment,
    construction,
    safety,
    flood,
    infrastructure,
    utilities,
    environment,
    futureGrowth,
  };
}

function toneFor(score: number) {
  if (score >= 75) return { ring: "#22c55e", text: "text-emerald-glow", label: "Excellent" };
  if (score >= 60) return { ring: "#62e9ff", text: "text-cyan-glow", label: "Good" };
  if (score >= 45) return { ring: "#d4a017", text: "text-amber-glow", label: "Fair" };
  return { ring: "#ef4444", text: "text-destructive", label: "Weak" };
}

function estimateValueKES(overall: number) {
  // Coarse indicative range keyed off overall score (KES / acre).
  const base = 1_500_000 + overall * 65_000;
  const low = Math.round(base * 0.75);
  const high = Math.round(base * 1.35);
  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}k`;
  return `KSh ${fmt(low)}–${fmt(high)} / acre`;
}

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
  score: number;
  size?: number;
  stroke?: number;
}) {
  const v = useCountUp(score);
  const tone = toneFor(score);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - v / 100);
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
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className={`text-sm font-semibold tabular-nums ${tone.text}`}>
          {Math.round(v)}
        </span>
      </div>
    </div>
  );
}

function GaugeTile({
  label,
  score,
  icon: Icon,
}: {
  label: string;
  score: number;
  icon: React.ElementType;
}) {
  const tone = toneFor(score);
  return (
    <div className="glass rounded-2xl p-3 flex items-center gap-3">
      <Gauge score={score} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          <Icon className="h-3 w-3 text-accent" />
          <span className="truncate">{label}</span>
        </div>
        <div className={`mt-0.5 text-xs font-medium ${tone.text}`}>{tone.label}</div>
      </div>
    </div>
  );
}

function RatingPill({ label, score }: { label: string; score: number }) {
  const tone = toneFor(score);
  return (
    <div className="glass rounded-full pl-2 pr-3 py-1 inline-flex items-center gap-1.5 text-[11px]">
      <span className={`h-1.5 w-1.5 rounded-full`} style={{ background: tone.ring }} />
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
}: {
  address: string;
  lat: number;
  lng: number;
  intel?: LocationIntel;
  narrative?: NarrativeOutput;
}) {
  const s = deriveScores(intel, narrative);
  const overallTone = toneFor(s.overall);
  const overallCount = useCountUp(s.overall, 1100);
  const summary =
    narrative?.paragraphs?.[0] ??
    narrative?.overview ??
    "HALISIA AI is compiling the executive read for this location…";

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      data-testid="hero-summary"
      className="glass-strong rounded-3xl p-4 sm:p-5 relative overflow-hidden"
      aria-label="Property AI hero summary"
    >
      <div
        className="absolute -top-24 -right-16 h-56 w-56 rounded-full blur-3xl opacity-40"
        style={{ background: `radial-gradient(circle, ${overallTone.ring}88, transparent 70%)` }}
      />

      <div className="relative grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] items-start">
        {/* Overall AI score */}
        <div className="flex items-center gap-3 sm:flex-col sm:items-start">
          <div className="relative">
            <Gauge score={s.overall} size={110} stroke={9} />
          </div>
          <div className="sm:mt-1">
            <div className="text-[10px] uppercase tracking-[0.2em] text-accent">AI Score</div>
            <div className={`text-2xl font-bold tabular-nums ${overallTone.text}`}>
              {Math.round(overallCount)}
              <span className="text-sm text-muted-foreground font-normal">/100</span>
            </div>
            <div className={`text-xs ${overallTone.text}`}>{overallTone.label}</div>
          </div>
        </div>

        {/* Address + summary */}
        <div className="min-w-0">
          <div className="flex items-start gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            <MapPin className="h-3 w-3 text-accent shrink-0" /> Property
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

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <RatingPill label="Investment" score={s.investment} />
            <RatingPill label="Livability" score={s.overall} />
            <RatingPill label="Construction" score={s.construction} />
            <RatingPill label="Risk" score={s.flood} />
            <RatingPill label="Future" score={s.futureGrowth} />
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-black/15 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-accent">
              <Sparkles className="h-3 w-3" /> One-line read
            </div>
            <p className="mt-1 text-sm leading-relaxed text-foreground/90 line-clamp-3">
              {summary}
            </p>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Indicative value</span>
              <span className="font-medium text-foreground/90">{estimateValueKES(s.overall)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gauge dashboard */}
      <div className="relative mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <GaugeTile label="Investment" score={s.investment} icon={TrendingUp} />
        <GaugeTile label="Construction" score={s.construction} icon={HardHat} />
        <GaugeTile label="Safety" score={s.safety} icon={ShieldCheck} />
        <GaugeTile label="Flood" score={s.flood} icon={Waves} />
        <GaugeTile label="Infrastructure" score={s.infrastructure} icon={Building2} />
        <GaugeTile label="Utilities" score={s.utilities} icon={Zap} />
        <GaugeTile label="Environment" score={s.environment} icon={Leaf} />
        <GaugeTile label="Future growth" score={s.futureGrowth} icon={Sparkles} />
      </div>

      <div className="relative mt-2 text-[10px] text-muted-foreground">
        Gauges animate from live intelligence signals. Confidence:{" "}
        {narrative?.confidencePct != null ? `${narrative.confidencePct}%` : "computing…"} · Values
        indicative, not appraisal.
      </div>
    </motion.section>
  );
}