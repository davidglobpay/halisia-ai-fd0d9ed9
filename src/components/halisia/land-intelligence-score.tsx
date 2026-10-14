import { OutputTools } from "./output-tools";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWebFindings } from "@/lib/web-findings.functions";
import { ListenButton } from "@/components/halisia/listen-button";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldCheck,
  AlertTriangle,
  Info,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Flag,
  FileDown,
  Loader2,
  Clock,
  Database,
  BadgeCheck,
  CircleSlash,
  ClipboardCheck,
  ArrowLeftRight,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatDate, formatDateTime } from "@/lib/format-datetime";
import {
  runIntelligenceEngine,
  PERSONAS,
  labelForPersona,
  DOSSIER_SCOPE,
  type ModuleOutput,
} from "@/lib/intelligence-engine";
import { useUserPersona } from "@/hooks/use-user-persona";
import type { LocationIntel } from "@/lib/location-intel.functions";
import type { NarrativeOutput } from "@/lib/ai-narrative.functions";
import type { Wave4Intel } from "@/lib/wave4-intel.functions";
import {
  getFeedback,
  setRating,
  flagIssue,
  type ModuleFeedback,
} from "@/lib/feedback-store";
import { generateIntelligencePdf } from "@/lib/pdf-intelligence";
import { SpokenText } from "@/components/halisia/spoken-text";
import { classTally, EVIDENCE_LEAD } from "@/lib/evidence-class";

/**
 * The location dossier.
 *
 * This panel used to lead with a Land Intelligence Score out of 100 and a
 * verdict — Highly Recommended through Not Recommended — over ten modules,
 * seven of which had no data behind them. Restricting it to modules with data
 * behind them left a smaller dial reading "72 · Grade BBB", which was the same
 * defect in a quieter voice: the marks underneath were elevation bands and a
 * count of nearby places times 3.5, and AAA-to-C notation borrows the look of
 * a credit rating for arithmetic nobody can check.
 *
 * The dial and the grades are gone from the engine, so nothing here renders
 * them. The panel leads instead with how far each kind of answer can be
 * trusted — seen in imagery, measured by a named dataset, worked out by a
 * rule, or impossible to establish from a screen at all — and that passage
 * reads itself aloud. The module cards keep what they always had underneath:
 * the finding in words, the services read for it, what it does not prove and
 * what to check next.
 *
 * `tone()` and `NEUTRAL_TONE` were deleted with the dial. They mapped a score
 * onto Excellent / Good / Fair / Weak, and there is no score to map.
 */

function TrendIcon({ trend }: { trend: ModuleOutput["trend"] }) {
  if (trend == null) return null;
  const Icon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const cls =
    trend === "up"
      ? "text-emerald-glow"
      : trend === "down"
        ? "text-destructive"
        : "text-muted-foreground";
  return <Icon className={`h-3 w-3 ${cls}`} aria-hidden />;
}

/**
 * The badge describes how the figure was obtained, not how good it is.
 *
 * It used to read "Verified" whenever confidence cleared 75 with two or more
 * sources, and "AI-Estimated" otherwise — which called a direct elevation
 * reading an estimate and called a pair of guessed inputs verified. Now it
 * follows the module's status: measured in full, measured in part when a
 * provider did not answer, or not assessed at all.
 */
function provenanceBadge(m: ModuleOutput): { label: string; cls: string } {
  if (m.status === "projected")
    return {
      label: "Indicative projection",
      cls: "text-amber-glow border-amber-400/30 bg-amber-500/10",
    };
  if (m.status === "not-assessed")
    return {
      label: "Not assessed",
      cls: "text-muted-foreground border-white/15 bg-white/5",
    };
  if ((m.confidencePct ?? 0) >= 100)
    return {
      label: "Measured",
      cls: "text-emerald-glow border-emerald-400/30 bg-emerald-500/10",
    };
  return {
    label: "Partly measured",
    cls: "text-amber-glow border-amber-400/30 bg-amber-500/10",
  };
}

/**
 * Only the three services this engine actually calls. The map used to carry
 * links for another nine — an elevation archive, a soil database, a weather
 * archive, a crowd-mapping project, the land registry, planning offices,
 * county development plans and a community layer marked as planned — none of
 * which the dossier reads, and one of which does not exist.
 */
const SOURCE_URLS: Record<string, string> = {
  "Google Places":
    "https://developers.google.com/maps/documentation/places/web-service/overview",
  "Google Maps Elevation API":
    "https://developers.google.com/maps/documentation/elevation/overview",
  "Google Air Quality API":
    "https://developers.google.com/maps/documentation/air-quality",
};

function sourceUrl(label: string): string | null {
  return SOURCE_URLS[label] ?? null;
}

function ModuleCard({ m, freshness }: { m: ModuleOutput; freshness: string }) {
  // "Assessed" means the data behind this module arrived. It used to also
  // require a score; there are no scores now, and whether elevation came back
  // was never a question about a number.
  const assessed = m.status === "measured";
  const projected = m.status === "projected";
  const v = provenanceBadge(m);
  const [fb, setFb] = useState<ModuleFeedback | undefined>(undefined);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagText, setFlagText] = useState("");

  useEffect(() => {
    setFb(getFeedback(m.id));
    const h = () => setFb(getFeedback(m.id));
    if (typeof window !== "undefined")
      window.addEventListener("halisia:feedback", h);
    return () => {
      if (typeof window !== "undefined")
        window.removeEventListener("halisia:feedback", h);
    };
  }, [m.id]);

  const rate = (r: "up" | "down") =>
    setRating(m.id, fb?.rating === r ? null : r);
  const submitFlag = () => {
    if (!flagText.trim()) return;
    flagIssue(m.id, flagText.trim());
    setFlagText("");
    setFlagOpen(false);
  };

  return (
    <details
      data-output-card
      className={`group rounded-2xl border bg-white/[0.03] open:bg-white/[0.05] ${
        assessed ? "border-white/10" : "border-white/10 border-dashed"
      }`}
      data-testid={`module-card-${m.id}`}
      data-status={m.status}
    >
      <summary className="cursor-pointer list-none px-3 py-2.5 flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded-2xl">
        {/* The dial that stood here printed the module's mark out of 100 as a
            filled arc. What the card can honestly show at a glance is which of
            the three kinds of answer this is, so that is what it shows. */}
        {assessed ? (
          <div
            className="h-9 w-9 rounded-full grid place-items-center shrink-0 border border-emerald-400/30 bg-emerald-500/10"
            aria-hidden
          >
            <ShieldCheck className="h-4 w-4 text-emerald-glow" />
          </div>
        ) : projected ? (
          <div
            className="h-9 w-9 rounded-full grid place-items-center shrink-0 border border-amber-400/30 bg-amber-500/10"
            aria-hidden
          >
            <Info className="h-4 w-4 text-amber-glow" />
          </div>
        ) : (
          <div
            className="h-9 w-9 rounded-full grid place-items-center shrink-0 border border-dashed border-white/20"
            aria-hidden
          >
            <CircleSlash className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">{m.label}</span>
            {/* The AAA-to-C chip sat here. `m.grade` is now always null and the
                engine no longer produces a trend either, so TrendIcon renders
                nothing; it is kept only so the type stays honest if a genuinely
                measured trend is ever published. */}
            <TrendIcon trend={m.trend} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${v.cls}`}
              title="How this figure was obtained"
            >
              <BadgeCheck className="h-2.5 w-2.5" /> {v.label}
            </span>
            {assessed || projected ? (
              <>
                <span className="inline-flex items-center gap-1">
                  <Database className="h-2.5 w-2.5" />{" "}
                  {m.sources.length === 1
                    ? "1 source"
                    : `${m.sources.length} sources`}
                </span>
                <span
                  className="inline-flex items-center gap-1"
                  title={formatDateTime(freshness)}
                >
                  <Clock className="h-2.5 w-2.5" /> {formatDate(freshness)}
                </span>
                {m.confidencePct != null && (
                  <span>
                    · {projected ? "Projection confidence" : "Confidence"}{" "}
                    {m.confidencePct}%
                  </span>
                )}
              </>
            ) : (
              <span>HALISIA holds no data for this — see what to check</span>
            )}
          </div>
        </div>
        <ChevronRight
          className="h-4 w-4 text-muted-foreground transition group-open:rotate-90"
          aria-hidden
        />
      </summary>
      <OutputTools label={m.label} />
      <div className="px-3 pb-3 space-y-2.5 text-sm text-foreground/90">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-accent flex items-center gap-1">
            <Info className="h-3 w-3" />{" "}
            {assessed
              ? "Why this reading"
              : projected
                ? "Projection and evidence"
                : "Why there is no reading"}
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

        {m.sources.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Read for this reading (
              {m.sources.length})
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {m.sources.map((s) => {
                const url = sourceUrl(s);
                const base =
                  "text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 inline-flex items-center gap-1";
                return url ? (
                  <a
                    key={s}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${base} hover:border-accent/50 hover:text-accent`}
                    title={`Open source: ${s}`}
                  >
                    {s} ↗
                  </a>
                ) : (
                  <span key={s} className={base}>
                    {s}
                  </span>
                );
              })}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              Read {formatDateTime(freshness)}
            </div>
          </div>
        )}

        {m.projectionBasis?.length ? (
          <div className="rounded-lg border border-amber-400/25 bg-amber-500/[0.06] px-2.5 py-1.5">
            <div className="text-[10px] uppercase tracking-widest text-amber-glow">
              Projection basis
            </div>
            <ul className="mt-1 space-y-0.5 text-[12px] text-foreground/85">
              {m.projectionBasis.map((basis) => (
                <li key={basis}>• {basis}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {m.missing.length > 0 && (
          <div
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5"
            data-testid={`missing-${m.id}`}
          >
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Not held by HALISIA
            </div>
            <ul className="mt-1 space-y-0.5 text-[12px] text-foreground/85">
              {m.missing.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-white/25 shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <details
          className="rounded-lg border border-amber-400/25 bg-amber-500/[0.06] px-2.5 py-1.5"
          data-testid={`limits-${m.id}`}
        >
          <summary className="cursor-pointer list-none flex items-center gap-1.5 text-[11px] font-medium text-amber-glow">
            <AlertTriangle className="h-3 w-3" />
            What to verify next
          </summary>
          <div className="mt-2 space-y-1.5 text-[12px] text-foreground/85">
            {m.limitations.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  What this does not prove
                </div>
                <ul className="mt-1 space-y-0.5">
                  {m.limitations.map((l, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-400/70 shrink-0" />
                      <span>{l}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Check this next
              </div>
              <div className="mt-1">{m.nextStep}</div>
            </div>
          </div>
        </details>

        {/* Feedback widget */}
        <div
          role="group"
          aria-label={`Rate ${m.label}`}
          className="flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-2"
        >
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground mr-1">
            Helpful?
          </span>
          <button
            type="button"
            onClick={() => rate("up")}
            aria-pressed={fb?.rating === "up"}
            data-testid={`fb-up-${m.id}`}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition ${
              fb?.rating === "up"
                ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-glow"
                : "border-white/10 text-muted-foreground hover:text-foreground"
            }`}
          >
            <ThumbsUp className="h-3 w-3" /> Yes
          </button>
          <button
            type="button"
            onClick={() => rate("down")}
            aria-pressed={fb?.rating === "down"}
            data-testid={`fb-down-${m.id}`}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition ${
              fb?.rating === "down"
                ? "bg-destructive/15 border-destructive/40 text-destructive"
                : "border-white/10 text-muted-foreground hover:text-foreground"
            }`}
          >
            <ThumbsDown className="h-3 w-3" /> No
          </button>
          <button
            type="button"
            onClick={() => setFlagOpen((v) => !v)}
            aria-expanded={flagOpen}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Flag className="h-3 w-3" /> Flag issue
          </button>
          {fb?.flag && !flagOpen && (
            <span
              className="text-[10px] text-amber-glow truncate max-w-[60%]"
              title={fb.flag}
            >
              Flagged: {fb.flag}
            </span>
          )}
          {flagOpen && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitFlag();
              }}
              className="mt-1 flex w-full items-center gap-1.5"
            >
              <input
                type="text"
                value={flagText}
                onChange={(e) => setFlagText(e.target.value)}
                placeholder="What looks wrong or stale?"
                aria-label={`Flag ${m.label}`}
                className="min-w-0 flex-1 rounded-md bg-black/30 border border-white/10 px-2 py-1 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              />
              <button
                type="submit"
                className="rounded-md bg-accent text-primary-foreground px-2 py-1 text-[11px] font-medium"
              >
                Save
              </button>
            </form>
          )}
        </div>
      </div>
    </details>
  );
}

function WebFindings({ place, topics }: { place?: string; topics: string[] }) {
  const fetchFindings = useServerFn(getWebFindings);
  const key = topics.join("|");
  const { data } = useQuery({
    queryKey: ["web-findings", place, key],
    enabled: !!place && topics.length > 0,
    staleTime: 1000 * 60 * 60 * 24,
    queryFn: () => fetchFindings({ data: { place: place!, topics } }),
  });
  if (!data?.length) return null;
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2" data-testid="web-findings">
      {data.map((f) => (
        <div
          key={f.topic}
          className="rounded-2xl border border-white/10 bg-card/70 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="text-[13px] font-medium">{f.topic}</div>
            <ListenButton
              text={`${f.topic}. ${f.summary}. Source: ${f.sourceTitle}. Public web finding, not verified by HALISIA.`}
            />
          </div>
          <p className="mt-1 text-[12px] leading-snug text-foreground/85">
            {f.summary}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
            <span className="rounded-full border border-foreground/15 px-1.5 py-0.5">
              Public web finding
            </span>
            <a
              href={f.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline break-all"
            >
              {f.sourceTitle}
            </a>
            <span>· {formatDate(f.retrievedAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LandIntelligenceScore({
  intel,
  narrative,
  address,
  lat,
  lng,
  wave4,
}: {
  intel?: LocationIntel;
  narrative?: NarrativeOutput;
  address?: string;
  lat?: number;
  lng?: number;
  wave4?: Wave4Intel;
}) {
  const [persona, setPersona] = useUserPersona();
  const decision = useMemo(
    () => runIntelligenceEngine(intel, narrative, persona, wave4),
    [intel, narrative, persona, wave4],
  );
  const tally = classTally();

  const [downloading, setDownloading] = useState(false);
  const [pdfStage, setPdfStage] = useState("");
  const [pdfPct, setPdfPct] = useState(0);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const canDownload = lat != null && lng != null;
  const downloadReport = useCallback(async () => {
    if (!canDownload) return;
    setDownloading(true);
    setPdfError(null);
    try {
      await generateIntelligencePdf({
        decision,
        address: address ?? `${lat!.toFixed(5)}, ${lng!.toFixed(5)}`,
        lat: lat!,
        lng: lng!,
        shareUrl:
          typeof window !== "undefined"
            ? `${window.location.origin}/report?lat=${lat}&lng=${lng}&address=${encodeURIComponent(address ?? "")}`
            : undefined,
        onProgress: (pct, stage) => {
          setPdfPct(pct);
          setPdfStage(stage);
        },
      });
    } catch (e) {
      console.error(e);
      setPdfError("Couldn't generate the report PDF.");
    } finally {
      setDownloading(false);
      setPdfStage("");
      setPdfPct(0);
    }
  }, [address, canDownload, decision, lat, lng]);

  return (
    <section
      aria-label="Location readings"
      data-testid="land-intelligence-score"
      className="glass-strong rounded-3xl p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-accent">
          <Sparkles className="h-3 w-3" /> HALISIA AI · Location readings
        </div>
        <div
          role="tablist"
          aria-label="Weight the reading for a persona"
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

      {/* What kind of answer each thing is. This replaces the dial. */}
      <div
        className="mt-3 rounded-2xl border border-white/10 bg-black/15 p-3"
        data-testid="dossier-evidence-classes"
      >
        <div className="text-[10px] uppercase tracking-widest text-accent">
          {decision.readingLabel}
        </div>
        <SpokenText
          text={EVIDENCE_LEAD}
          label="Read this to me"
          className="mt-2"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Output catalogue counts — not findings available for this location.
          Evidence classes describe method, not a trust ranking.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {tally.map(({ meta, count }) => (
            <div
              key={meta.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5"
              title={meta.meaning}
            >
              <div className="text-lg font-semibold tabular-nums text-foreground">
                {count}
              </div>
              <div className="text-[11px] font-medium leading-tight">
                {meta.label}
              </div>
              <div className="mt-1 text-[10px] leading-snug text-muted-foreground">
                {meta.action}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-3">
        <div className="min-w-0">
          <div className="text-base sm:text-lg font-semibold">
            {decision.headline}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Ordered for {labelForPersona(persona)}
            {decision.confidencePct != null &&
              ` · Confidence ${decision.confidencePct}%`}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {decision.scopeNote}
          </p>
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

      {/* Actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={downloadReport}
          disabled={!canDownload || downloading}
          data-testid="download-intelligence-pdf"
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-3 py-1.5 text-xs font-medium shadow disabled:opacity-60"
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileDown className="h-3.5 w-3.5" />
          )}
          {downloading
            ? `${pdfPct}% · ${pdfStage || "Working…"}`
            : "Download report (PDF)"}
        </button>
        <Link
          to="/compare-locations"
          search={
            lat != null && lng != null
              ? { a: `${lat},${lng}`, aLabel: address ?? "" }
              : {}
          }
          data-testid="open-compare-locations"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-foreground/85 hover:border-accent/40"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" /> Compare two locations
        </Link>
        <span className="text-[10px] text-muted-foreground ml-auto">
          Generated {formatDateTime(decision.freshness)}
        </span>
      </div>
      {pdfError && (
        <p role="alert" className="mt-2 text-[11px] text-destructive">
          {pdfError}
        </p>
      )}

      {/* Module breakdown */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {decision.modules
          .filter((m) => m.status !== "not-assessed")
          .map((m) => (
            <ModuleCard key={m.id} m={m} freshness={decision.freshness} />
          ))}
      </div>

      <WebFindings
        place={address}
        topics={decision.modules
          .filter((m) => m.status === "not-assessed")
          .map((m) => m.label)}
      />

      {/* Professional recommendations */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="text-[10px] uppercase tracking-widest text-accent">
          Who to bring in next
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
        {DOSSIER_SCOPE} Updated {formatDateTime(decision.freshness)}.
      </p>
    </section>
  );
}
