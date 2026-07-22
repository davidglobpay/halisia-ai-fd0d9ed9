import { useMemo } from "react";
import {
  Sparkles, TrendingUp, TrendingDown, Minus, ShieldCheck, AlertTriangle,
  Info, ChevronRight,
} from "lucide-react";
import {
  runIntelligenceEngine, PERSONAS, labelForPersona,
  type ModuleOutput,
} from "@/lib/intelligence-engine";
import { useUserPersona } from "@/hooks/use-user-persona";
import type { LocationIntel } from "@/lib/location-intel.functions";
import type { NarrativeOutput } from "@/lib/ai-narrative.functions";

function tone(score: number) {
  if (score >= 75) return { ring: "#22c55e", text: "text-emerald-glow", label: "Excellent" };
  if (score >= 60) return { ring: "#62e9ff", text: "text-cyan-glow", label: "Good" };
  if (score >= 45) return { ring: "#d4a017", text: "text-amber-glow", label: "Fair" };
  return { ring: "#ef4444", text: "text-destructive", label: "Weak" };
}

function TrendIcon({ trend }: { trend: ModuleOutput["trend"] }) {
  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const cls =
    trend === "up" ? "text-emerald-glow" : trend === "down" ? "text-destructive" : "text-muted-foreground";
  return <Icon className={`h-3 w-3 ${cls}`} aria-hidden />;
}

function ModuleCard({ m }: { m: ModuleOutput }) {
  const t = tone(m.score);
  return (
    <details className="group rounded-2xl border border-white/10 bg-white/[0.03] open:bg-white/[0.05]">
      <summary className="cursor-pointer list-none px-3 py-2.5 flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded-2xl">
        <div
          className="h-9 w-9 rounded-full grid place-items-center text-[11px] font-bold tabular-nums shrink-0"
          style={{
            background: `conic-gradient(${t.ring} ${m.score * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
          }}
        >
          <span className="h-7 w-7 rounded-full grid place-items-center bg-background/90">
            <span className={t.text}>{m.score}</span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">{m.label}</span>
            <span className="text-[10px] font-semibold text-foreground/70 px-1.5 rounded bg-white/5 border border-white/10">
              {m.grade}
            </span>
            <TrendIcon trend={m.trend} />
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {t.label} · Confidence {m.confidencePct}%
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground transition group-open:rotate-90" aria-hidden />
      </summary>
      <div className="px-3 pb-3 space-y-2.5 text-sm text-foreground/90">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-accent flex items-center gap-1">
            <Info className="h-3 w-3" /> Why this score
          </div>
          <ul className="mt-1 space-y-1">
            {m.reasons.map((r, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-snug">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent/70 shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Sources
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {m.sources.map((s) => (
                <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Limitations
            </div>
            <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground leading-snug">
              {m.limitations.map((l, i) => <li key={i}>· {l}</li>)}
            </ul>
          </div>
        </div>
        <div className="rounded-lg bg-accent/10 border border-accent/25 px-2.5 py-1.5 text-[12px]">
          <span className="text-[10px] uppercase tracking-widest text-accent">Next step</span>
          <div className="text-foreground/90">{m.nextStep}</div>
        </div>
      </div>
    </details>
  );
}

export function LandIntelligenceScore({
  intel, narrative,
}: { intel?: LocationIntel; narrative?: NarrativeOutput }) {
  const [persona, setPersona] = useUserPersona();
  const decision = useMemo(() => runIntelligenceEngine(intel, narrative, persona), [intel, narrative, persona]);
  const t = tone(decision.overall);

  return (
    <section
      aria-label="Land Intelligence Score"
      data-testid="land-intelligence-score"
      className="glass-strong rounded-3xl p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-accent">
          <Sparkles className="h-3 w-3" /> HALISIA AI · Land Intelligence Score
        </div>
        <div
          role="tablist"
          aria-label="Optimise recommendation for persona"
          className="ml-auto flex flex-wrap items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1"
        >
          {PERSONAS.map((p) => {
            const active = persona === p.id;
            return (
              <button
                key={p.id}
                role="tab"
                aria-selected={active}
                title={p.hint}
                onClick={() => setPersona(p.id)}
                className={`px-2.5 h-7 rounded-full text-[11px] font-medium transition ${
                  active
                    ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Decision head */}
      <div className="mt-3 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] items-start">
        <div
          className="h-24 w-24 rounded-full grid place-items-center shrink-0"
          style={{
            background: `conic-gradient(${t.ring} ${decision.overall * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
          }}
        >
          <div className="h-20 w-20 rounded-full grid place-items-center bg-background/90">
            <div className="text-center">
              <div className={`text-2xl font-bold tabular-nums ${t.text}`}>{decision.overall}</div>
              <div className="text-[10px] text-muted-foreground -mt-0.5">Grade {decision.grade}</div>
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-accent">Recommendation</div>
          <div className={`text-base sm:text-lg font-semibold ${t.text}`}>{decision.recommendation}</div>
          <div className="text-[11px] text-muted-foreground">
            Optimised for {labelForPersona(persona)} · Confidence {decision.confidencePct}%
          </div>
          <ul className="mt-2 space-y-1 text-[13px] leading-snug">
            {decision.reasons.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent/70 shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Module breakdown */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {decision.modules.map((m) => <ModuleCard key={m.id} m={m} />)}
      </div>

      {/* Professional recommendations */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="text-[10px] uppercase tracking-widest text-accent">
          Recommended professionals
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {decision.professionalRecs.map((r) => (
            <span
              key={r}
              className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-[11px] text-foreground/85"
            >
              {r}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground leading-relaxed">
        Predictions are estimates, not certainties. Verify title, zoning and site conditions with
        licensed professionals before any transaction. Updated{" "}
        {new Date(decision.freshness).toLocaleString()}.
      </p>
    </section>
  );
}