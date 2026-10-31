import { motion } from "framer-motion";
import {
  Sparkles,
  MapPin,
  CircleSlash,
  ChevronDown,
  Eye,
  Ruler,
  Calculator,
  HelpCircle,
  Trees,
  Route,
  Building2,
  ShieldCheck,
  Landmark,
  Users,
  Store,
  PlugZap,
  HeartPulse,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { LocationIntel } from "@/lib/location-intel.functions";
import type { NarrativeOutput } from "@/lib/ai-narrative.functions";
import type { Wave4Intel } from "@/lib/wave4-intel.functions";
import { runIntelligenceEngine, DOSSIER_SCOPE, type ModuleOutput } from "@/lib/intelligence-engine";
import { useUserPersona } from "@/hooks/use-user-persona";
import { ListenButton } from "@/components/halisia/listen-button";
import { SpokenText } from "@/components/halisia/spoken-text";
import {
  classTally,
  EVIDENCE_LEAD,
  type EvidenceClass,
  type ClassMeta,
} from "@/lib/evidence-class";

/**
 * The hero read for a location.
 *
 * Two scoring layers have now been taken out of this component.
 *
 * The first was its own: eight gauges built from whatever was to hand —
 * "Safety" was `50 + airQualityIndex / 2`, "Utilities" a count of shops and
 * restaurants — multiplied by 65,000 and printed as a headline valuation in
 * shillings per acre. That went when the engine became the single scorer.
 *
 * The second is the engine's. A 0-100 dial sat at the top of this card reading
 * "72 /100 · Good", and a row of pills gave each module its own mark. Neither
 * was measured: the marks were hard-coded elevation bands and a count of
 * nearby places times 3.5, and the dial was their persona-weighted mean. A
 * buyer could not check any of it and neither could we, because "Good compared
 * to what?" had no answer.
 *
 * What stands in its place is not a smaller number — it is the shape of the
 * evidence. Every output this app produces falls into one of four classes, and
 * the card opens by saying how many fall into each: what you can see in the
 * imagery, what a named dataset measured, what a rule worked out, and what
 * nobody can tell you from a screen. Ownership, title, the legal boundary and
 * planning approval are in that last group, and saying so plainly is worth
 * more to someone about to part with money than any mark out of a hundred.
 *
 * The lead passage reads itself aloud with the spoken word highlighted, so the
 * part that matters most is the part that does not depend on reading a dense
 * screen.
 */

/* ---------- evidence classes ---------- */

const CLASS_ICONS: Record<EvidenceClass, LucideIcon> = {
  visible: Eye,
  measured: Ruler,
  inferred: Calculator,
  unprovable: HelpCircle,
};

/**
 * Colour carries rank here, so it must not be the only thing that does: the
 * count and the wording say the same thing for anyone who cannot separate the
 * greens from the ambers.
 */
const CLASS_TONE: Record<EvidenceClass, { text: string; ring: string; dot: string }> = {
  visible: {
    text: "text-emerald-glow",
    ring: "border-emerald-glow/30",
    dot: "#22c55e",
  },
  measured: {
    text: "text-cyan-glow",
    ring: "border-cyan-glow/30",
    dot: "#62e9ff",
  },
  inferred: {
    text: "text-amber-glow",
    ring: "border-amber-glow/30",
    dot: "#d4a017",
  },
  unprovable: {
    text: "text-muted-foreground",
    ring: "border-white/15",
    dot: "#8c96a8",
  },
};

function ClassRow({ meta, count }: { meta: ClassMeta; count: number }) {
  const tone = CLASS_TONE[meta.id];
  const Icon = CLASS_ICONS[meta.id];
  return (
    <details className={`group glass rounded-2xl border ${tone.ring}`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-2xl p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-foreground/10 bg-background/35"
          aria-hidden="true"
        >
          <Icon className={`h-4 w-4 ${tone.text}`} />
        </span>
        <span className={`text-lg font-semibold tabular-nums ${tone.text}`}>{count}</span>
        <span className="min-w-0 flex-1 text-xs font-medium leading-tight">{meta.label}</span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="border-t border-foreground/10 px-3 pb-3 pt-2 text-[11px] leading-relaxed text-muted-foreground">
        {meta.meaning}
        {meta.action && <div className="mt-1.5 text-foreground/80">{meta.action}</div>}
      </div>
    </details>
  );
}

/* ---------- module tiles ---------- */

/** A tile per module with data behind it, or an explicit projection. */
const MODULE_ICONS: Record<ModuleOutput["id"], LucideIcon> = {
  investment: Landmark,
  construction: Building2,
  legal: ShieldCheck,
  environment: Trees,
  infrastructure: Route,
  community: Users,
  market: Store,
  utilities: PlugZap,
  safety: HeartPulse,
  futureGrowth: TrendingUp,
};

function ModuleTile({ m }: { m: ModuleOutput }) {
  const Icon = MODULE_ICONS[m.id];
  const projected = m.status === "projected";
  // The first reason is the finding itself — the elevation in metres, the air
  // quality index, the counts within 3 km. It is what the gauge used to cover.
  const lead = m.reasons[0] ?? "";
  const narration = `${m.label}. ${projected ? "Indicative projection" : "Read from data"}. ${lead}${m.confidencePct != null ? ` ${m.confidencePct} percent of expected inputs returned.` : ""} ${m.reasons.slice(1).join(" ")} Sources: ${m.sources.join(", ") || "No source available"}. Limitations: ${m.limitations.join(" ")}. Next: ${m.nextStep}`;
  return (
    <details className="group glass rounded-2xl">
      <summary className="flex min-h-[96px] cursor-pointer list-none items-start gap-2.5 rounded-2xl p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span
          className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-foreground/10 bg-background/35"
          aria-hidden="true"
        >
          <Icon className="h-4 w-4 text-accent" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
            {m.label}
          </div>
          {/* The finding, in the words the engine published it in. No mark. */}
          <div className="mt-0.5 text-xs font-medium leading-snug text-foreground/90">{lead}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            {/* Share of this module's expected inputs that came back: coverage,
                not certainty. Nothing is shown when no input was expected. */}
            {projected ? "Indicative projection" : "Read from data"}
            {m.confidencePct != null && ` · ${m.confidencePct}% of inputs returned`}
          </div>
        </div>
        <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-foreground/10 px-3 pb-3 pt-2 text-[11px] leading-relaxed">
        {m.reasons.length > 1 && (
          <ul className="mb-2 list-disc space-y-1 pl-4 text-muted-foreground">
            {m.reasons.slice(1).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
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
        <div className="mt-2">
          <ListenButton text={narration} label={`Listen to ${m.label}`} />
        </div>
      </div>
    </details>
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
  const tally = classTally();

  const measured = decision.modules.filter((m) => m.status === "measured");
  const projected = decision.modules.filter((m) => m.status === "projected");
  const notAssessed = decision.modules.filter((m) => m.status === "not-assessed");

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
      <div className="absolute -top-24 -right-16 h-56 w-56 rounded-full bg-emerald-glow/20 blur-3xl opacity-40" />

      {/* Address first: a buyer should know what they are looking at before
          they are told anything about it. */}
      <div className="relative min-w-0">
        <div className="flex items-start gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          <MapPin className="h-3 w-3 text-accent shrink-0" /> Location
        </div>
        <h2 className="mt-0.5 text-lg sm:text-xl font-semibold leading-tight line-clamp-2">
          {address}
        </h2>
        <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
          {lat.toFixed(4)}, {lng.toFixed(4)}
          {intel?.elevation?.meters != null && <> · {intel.elevation.meters.toFixed(0)} m elev.</>}
        </div>
      </div>

      {/* What kind of thing each answer is. This replaces the reading. */}
      <div
        className="relative mt-3 rounded-2xl border border-white/10 bg-black/15 p-3"
        data-testid="hero-evidence-classes"
      >
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-widest text-accent">
          <ShieldCheck className="h-3 w-3" /> How far each answer can be trusted
        </div>
        <SpokenText text={EVIDENCE_LEAD} label="Read this to me" className="mt-2" />
        <p className="mt-2 text-xs text-muted-foreground">
          Output catalogue counts — not findings available for this location. Evidence classes
          describe method, not a trust ranking.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {tally.map(({ meta, count }) => (
            <ClassRow key={meta.id} meta={meta} count={count} />
          ))}
        </div>
      </div>

      {/* Written read */}
      <div className="relative mt-3 rounded-2xl border border-white/10 bg-black/15 p-3">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-widest text-accent">
          <Sparkles className="h-3 w-3" /> Written read
        </div>
        <SpokenText text={summary} label="Read this to me" className="mt-2" />
        <p className="mt-2 text-[11px] text-muted-foreground">
          A written interpretation of the readings below. It is worked out, not observed. HALISIA
          holds no price or transaction data for this location and publishes no valuation, score or
          grade.
        </p>
      </div>

      {/* Modules with data behind them */}
      {measured.length > 0 && (
        <div className="relative mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {measured.map((m) => (
            <ModuleTile key={m.id} m={m} />
          ))}
        </div>
      )}

      {projected.length > 0 && (
        <div className="relative mt-3">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-amber-glow">
            Worked out from mapped features · not observed on this site
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {projected.map((m) => (
              <ModuleTile key={m.id} m={m} />
            ))}
          </div>
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
