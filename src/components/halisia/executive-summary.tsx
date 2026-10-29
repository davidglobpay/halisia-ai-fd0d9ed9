import { OutputTools, OutputVisual, OutputIcon } from "@/components/halisia/output-tools";
import { useMemo, useState } from "react";
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  ListChecks,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import type { NarrativeOutput } from "@/lib/ai-narrative.functions";
import type { LocationIntel } from "@/lib/location-intel.functions";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { ListenButton } from "@/components/halisia/listen-button";

type ViewMode = "simple" | "professional" | "technical";

const MODES: { id: ViewMode; label: string; hint: string }[] = [
  { id: "simple", label: "Simple", hint: "Plain language, top signals only" },
  {
    id: "professional",
    label: "Professional",
    hint: "Full read with key metrics",
  },
  {
    id: "technical",
    label: "Technical",
    hint: "Formulas, raw scores, sources",
  },
];

function Section({
  title,
  icon: Icon,
  tone = "default",
  children,
  defaultOpen = true,
  detail,
}: {
  title: string;
  icon: React.ElementType;
  tone?: "default" | "positive" | "warning" | "danger";
  children: React.ReactNode;
  defaultOpen?: boolean;
  detail?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toneRing =
    tone === "positive"
      ? "text-emerald-glow"
      : tone === "warning"
        ? "text-amber-glow"
        : tone === "danger"
          ? "text-destructive"
          : "text-accent";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03]" data-output-card>
      <OutputTools label={[title, detail].filter(Boolean).join(". ")} />
      <button
        data-output-content
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded-2xl"
      >
        <Icon className={`h-4 w-4 ${toneRing}`} aria-hidden="true" />
        <span className="text-[11px] uppercase tracking-widest text-foreground/80">{title}</span>
        {detail && (
          <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[60%]">
            {detail}
          </span>
        )}
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
        )}
      </button>
      {open && <div className="px-3 pb-3 text-sm text-foreground/90">{children}</div>}
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (!items.length)
    return <div className="text-xs text-muted-foreground">No signals in this bucket.</div>;
  return (
    <ul className="mt-1 space-y-1.5 text-sm leading-snug">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent/70 shrink-0" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function PointBullets({
  items,
  showWhy,
}: {
  items: { point: string; why: string }[];
  showWhy: boolean;
}) {
  if (!items.length) return <div className="text-xs text-muted-foreground">No items surfaced.</div>;
  return (
    <ul className="mt-1 space-y-2 text-sm leading-snug">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent/70 shrink-0" />
          <div className="min-w-0">
            <div className="font-medium text-foreground/95">{it.point}</div>
            {showWhy && it.why && (
              <div className="text-[12px] text-muted-foreground mt-0.5">{it.why}</div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ExecutiveSummary({
  narrative,
  intel,
}: {
  narrative?: NarrativeOutput;
  intel?: LocationIntel;
}) {
  const [mode, setMode] = usePersistedState<ViewMode>("halisia:aiView", "professional");

  const sources = useMemo(() => {
    const s = new Set<string>();
    narrative?.dataSources?.forEach((x) => s.add(x));
    if (intel?.categories) s.add("Google Places");
    // Only name a source that actually answered for THIS point. These four
    // were added unconditionally, so the panel credited OpenStreetMap,
    // Open-Meteo, SoilGrids and KNBS on every location whether or not they
    // were queried — and credited Open-Topo-Data for an elevation that comes
    // from the Google Elevation API.
    if (intel?.elevation) s.add("Google Maps Elevation API");
    if (intel?.airQuality) s.add("Google Air Quality API");
    return Array.from(s);
  }, [narrative, intel]);

  if (!narrative) {
    return (
      <section
        aria-label="AI Executive Summary — loading"
        className="glass-strong rounded-3xl p-4 sm:p-5"
      >
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-accent">
          <Sparkles className="h-3 w-3" /> HALISIA AI · Executive summary
        </div>
        <div className="mt-3 h-24 rounded-2xl bg-white/5 animate-pulse" />
      </section>
    );
  }

  const simple = mode === "simple";
  const technical = mode === "technical";

  const strengths = simple ? narrative.strengths.slice(0, 3) : narrative.strengths;
  const weaknesses = simple ? narrative.weaknesses.slice(0, 3) : narrative.weaknesses;
  const recs = simple ? narrative.recommendations.slice(0, 3) : narrative.recommendations;
  const warnings = [...(narrative.watchouts ?? []), ...(narrative.environmentalNotes ?? [])].slice(
    0,
    simple ? 3 : 8,
  );

  // No stand-in figure: when the summary carries no confidence, none is shown.
  const confPct = narrative.confidencePct ?? null;
  const narration = `${narrative.headline}. ${narrative.overview ?? narrative.paragraphs?.[0] ?? ""}${confPct != null ? ` Confidence ${confPct} percent, ${narrative.confidence}.` : ""} Sources: ${sources.join(", ")}. Limitations: predictions and value ranges are indicative and are not a licensed appraisal or legal opinion.`;

  return (
    <section
      aria-label="AI Executive Summary"
      data-testid="ai-executive-summary"
      className="glass-strong rounded-3xl p-4 sm:p-5"
    >
      {/* Header + view toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-accent">
          <Sparkles className="h-3 w-3" /> HALISIA AI · Executive summary
        </div>
        <ListenButton text={narration} label="Listen to summary" />
        <div
          role="tablist"
          aria-label="Summary detail level"
          className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1"
        >
          {MODES.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                role="tab"
                aria-selected={active}
                title={m.hint}
                onClick={() => setMode(m.id)}
                className={`px-2.5 h-7 rounded-full text-[11px] font-medium transition ${
                  active
                    ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Headline + confidence */}
      <h3 className="mt-2 text-base sm:text-lg font-semibold tracking-tight">
        {narrative.headline}
      </h3>

      {confPct != null && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Confidence
            </span>
            <span
              className={`text-xs font-semibold tabular-nums ${
                confPct >= 75
                  ? "text-emerald-glow"
                  : confPct >= 55
                    ? "text-cyan-glow"
                    : "text-amber-glow"
              }`}
              title="Reflects data completeness across geospatial, environmental and community signals."
            >
              {confPct}% · {narrative.confidence}
            </span>
          </div>
          <div className="h-1.5 flex-1 min-w-[100px] rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
              style={{ width: `${confPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Sections */}
      <div className="mt-4 grid gap-2.5">
        <Section title="Overview" icon={Info}>
          <p className="text-sm leading-relaxed text-foreground/90">
            {simple
              ? (narrative.paragraphs?.[0] ?? narrative.overview)
              : (narrative.overview ?? narrative.paragraphs?.[0])}
          </p>
          {!simple && narrative.paragraphs?.[1] && (
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">
              {narrative.paragraphs[1]}
            </p>
          )}
          {technical && (
            <div className="mt-2 text-[11px] text-muted-foreground">
              Livability is an amenity count, not a composite. It is{" "}
              <code className="text-foreground/90">
                min(95, 40 + 4 × (schools + health + shops + transit within 3 km))
              </code>
              . It is calibrated against nothing, and a higher number means more places were mapped
              nearby, not that anywhere is better to live.
            </div>
          )}
        </Section>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <Section
            title="Strengths"
            icon={ThumbsUp}
            tone="positive"
            detail={`${strengths.length} signals`}
          >
            <PointBullets items={strengths} showWhy={!simple} />
          </Section>
          <Section
            title="Weaknesses"
            icon={ThumbsDown}
            tone="warning"
            detail={`${weaknesses.length} signals`}
          >
            <PointBullets items={weaknesses} showWhy={!simple} />
          </Section>
        </div>

        <Section title="Recommended actions" icon={ListChecks} detail={`${recs.length} steps`}>
          <Bullets items={recs} />
          {technical && narrative.investmentAdvice.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Investment specifics
              </div>
              <Bullets items={narrative.investmentAdvice} />
            </div>
          )}
          {technical && narrative.constructionAdvice.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Construction specifics
              </div>
              <Bullets items={narrative.constructionAdvice} />
            </div>
          )}
        </Section>

        <Section
          title="Warnings"
          icon={AlertTriangle}
          tone="danger"
          detail={`${warnings.length} watch-outs`}
          defaultOpen={!simple}
        >
          <Bullets items={warnings} />
          <div className="mt-2 text-[11px] text-muted-foreground">
            Predictions and value ranges are indicative and not a licensed appraisal or legal
            opinion. Always verify title, zoning and site conditions on the ground.
          </div>
        </Section>

        <Section
          title="Sources used"
          icon={ShieldCheck}
          defaultOpen={technical}
          detail={`${sources.length} datasets`}
        >
          <div className="flex flex-wrap gap-1.5">
            {sources.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-[11px] text-foreground/85"
              >
                {s}
              </span>
            ))}
          </div>
          {technical && (
            <div className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
              Confidence here is a coverage count, not a blend: the share of three checks that
              returned anything. There is no freshness term and no cross-source agreement term. Last
              updated {new Date(narrative.lastUpdated).toLocaleString()}.
            </div>
          )}
        </Section>
      </div>
    </section>
  );
}
