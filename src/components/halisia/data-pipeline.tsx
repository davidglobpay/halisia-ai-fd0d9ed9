import { useCallback, useEffect, useRef, useState } from "react";
import {
  Brain,
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
import { track } from "@/lib/analytics";

type Stage = {
  title: string;
  role: string;
  detail: string;
  icon: LucideIcon;
  href?: string;
  tone: "input" | "source" | "engine" | "output";
  /** How much the score can lean on this stage, 0–100. */
  confidence: number;
  freshness: string;
  /** What actually happens in this step. */
  what: string[];
  /** Named datasets / systems used. */
  sources: { label: string; url?: string }[];
  /** Where this stage can be uncertain. */
  caveat: string;
};

/**
 * The HALISIA data pipeline: every stage a listing passes through, from the
 * seller's upload to the marketplace card a buyer finally reads.
 */
export const PIPELINE_STAGES: Stage[] = [
  {
    title: "User listing",
    role: "Input",
    detail: "Title, size, price, photos and utilities captured in the guided listing wizard.",
    icon: UploadCloud,
    tone: "input",
    confidence: 55,
    freshness: "At submission",
    what: [
      "The seller completes the guided wizard: title, size, tenure, price and utilities.",
      "Photos and documents are attached and a completeness percentage is calculated.",
      "The AI listing coach flags missing or contradictory information before publishing.",
    ],
    sources: [{ label: "Seller-declared data (HALISIA listing wizard)" }],
    caveat:
      "Self-declared by the seller and not independently verified, so it carries the lowest weight in the score.",
  },
  {
    title: "GPS location",
    role: "Input",
    detail: "A map pin or device location fixes the parcel to real coordinates.",
    icon: Navigation,
    tone: "input",
    confidence: 80,
    freshness: "At submission",
    what: [
      "A map pin, device geolocation or typed coordinates anchor the parcel.",
      "Coordinates are reverse-geocoded to a ward, sub-county and county.",
      "Every downstream dataset is queried against this exact point.",
    ],
    sources: [
      { label: "Browser Geolocation API" },
      { label: "Leaflet / OpenStreetMap pin picker", url: "https://www.openstreetmap.org/" },
    ],
    caveat:
      "Pin accuracy depends on how precisely the seller placed it; a coarse pin shifts nearby-amenity results.",
  },
  {
    title: "OpenStreetMap",
    role: "Open data",
    detail: "Roads, amenities, schools, health facilities and transport within reach.",
    icon: MapPin,
    href: "https://www.openstreetmap.org/copyright",
    tone: "source",
    confidence: 78,
    freshness: "Community-updated, continuous",
    what: [
      "Overpass queries pull roads, schools, clinics, markets and transport nodes around the pin.",
      "Each amenity is distance-ranked and converted into access and livability signals.",
    ],
    sources: [
      { label: "OpenStreetMap contributors", url: "https://www.openstreetmap.org/copyright" },
      { label: "Overpass API", url: "https://overpass-api.de/" },
    ],
    caveat: "Rural coverage is thinner than urban coverage, so sparse areas can under-report amenities.",
  },
  {
    title: "Geoapify",
    role: "Open data",
    detail: "Geocoding, reverse geocoding and place enrichment around the pin.",
    icon: Layers,
    href: "https://www.geoapify.com/",
    tone: "source",
    confidence: 74,
    freshness: "Rolling refresh",
    what: [
      "Forward and reverse geocoding resolve the pin into a structured address.",
      "Place enrichment adds categorised POIs and isoline reachability around the parcel.",
    ],
    sources: [{ label: "Geoapify Places & Geocoding", url: "https://www.geoapify.com/" }],
    caveat: "Place categories are generalised globally and may not match Kenyan local naming exactly.",
  },
  {
    title: "Open-Meteo",
    role: "Open data",
    detail: "Climate normals, rainfall and temperature history for the location.",
    icon: CloudSun,
    href: "https://open-meteo.com/",
    tone: "source",
    confidence: 85,
    freshness: "Daily",
    what: [
      "Historical reanalysis gives rainfall, temperature and seasonality for the coordinates.",
      "Climate normals feed flood, drought and construction-window risk scoring.",
    ],
    sources: [{ label: "Open-Meteo archive & forecast API", url: "https://open-meteo.com/" }],
    caveat: "Reanalysis grids are coarse; micro-climates in valleys or highlands may differ locally.",
  },
  {
    title: "Satellite data",
    role: "Earth observation",
    detail: "Elevation, slope, terrain modelling and soil profiles from global rasters.",
    icon: Satellite,
    href: "https://soilgrids.org/",
    tone: "source",
    confidence: 72,
    freshness: "Per raster release",
    what: [
      "Digital elevation models produce slope, aspect and drainage direction.",
      "SoilGrids profiles estimate texture, pH and bearing behaviour by depth.",
      "Results drive the geotechnical module and foundation guidance.",
    ],
    sources: [
      { label: "ISRIC SoilGrids v2.0", url: "https://soilgrids.org/" },
      { label: "Copernicus / ASTER elevation", url: "https://www.earthdata.nasa.gov/" },
    ],
    caveat:
      "Global rasters are modelled at 30–250 m resolution — indicative only, never a substitute for a site survey.",
  },
  {
    title: "Government data",
    role: "Official records",
    detail: "County boundaries, census indicators and public administrative datasets.",
    icon: Landmark,
    href: "https://www.knbs.or.ke/",
    tone: "source",
    confidence: 68,
    freshness: "Census & gazette cycles",
    what: [
      "County and ward boundaries locate the parcel inside its administrative unit.",
      "Census and public indicators add population, services and development context.",
    ],
    sources: [
      { label: "Kenya National Bureau of Statistics", url: "https://www.knbs.or.ke/" },
      { label: "IEBC boundary datasets", url: "https://www.iebc.or.ke/" },
    ],
    caveat: "Official releases lag reality between census cycles, so fast-growing areas can look understated.",
  },
  {
    title: "AI analysis",
    role: "Reasoning",
    detail: "Signals are cross-read, weighted and turned into plain-language findings.",
    icon: Brain,
    tone: "engine",
    confidence: 70,
    freshness: "Per request",
    what: [
      "All retrieved signals are cross-read for agreement, conflict and gaps.",
      "The model writes plain-language findings and flags what it could not verify.",
      "Every claim is bound to the signal it came from for the evidence panel.",
    ],
    sources: [{ label: "HALISIA reasoning layer over the retrieved signals above" }],
    caveat: "Reasoning inherits the weakest input — thin data in means a hedged, lower-confidence narrative out.",
  },
  {
    title: "HALISIA intelligence score",
    role: "Synthesis",
    detail: "Ten weighted scorers produce one defensible score with visible evidence.",
    icon: Sparkles,
    tone: "engine",
    confidence: 76,
    freshness: "Per request",
    what: [
      "Ten modular scorers each grade one dimension: access, risk, utilities, growth and more.",
      "Weights shift with your persona — buyer, investor, developer or renter.",
      "The final score ships with a confidence percentage and its full evidence trail.",
    ],
    sources: [{ label: "HALISIA Land Intelligence Engine (10 weighted scorers)" }],
    caveat: "A score is decision support, not a valuation, survey or legal opinion.",
  },
  {
    title: "Marketplace listing",
    role: "Output",
    detail: "Buyers see the listing alongside its score, evidence and citations.",
    icon: ShoppingBag,
    tone: "output",
    confidence: 90,
    freshness: "Live",
    what: [
      "The published listing renders the score, evidence panel and source citations together.",
      "Buyers can open any citation, download the PDF dossier or compare locations.",
    ],
    sources: [{ label: "HALISIA marketplace & PDF dossier export" }],
    caveat: "Displays exactly what the pipeline produced — always read the confidence chips alongside it.",
  },
];

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
  const [reduced, setReduced] = useState(false);
  const seen = useRef<Set<string>>(new Set());

  // Seed from the OS setting, then let the local toggle override it.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("halisia:pipelineReducedMotion");
      if (stored === "1" || stored === "0") {
        setReduced(stored === "1");
        return;
      }
      setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch {
      /* storage or matchMedia unavailable */
    }
  }, []);

  const toggleReduced = useCallback(() => {
    setReduced((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("halisia:pipelineReducedMotion", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      track({ name: "pipeline_motion_toggled", reduced: next });
      return next;
    });
  }, []);

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
            satellite and government datasets before the AI reads it — and each stage stays visible
            in the final report.
          </p>
          </div>
          <button
            type="button"
            onClick={toggleReduced}
            aria-pressed={reduced}
            className="glass inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-xs text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
          >
            <Sparkle className="h-3.5 w-3.5" aria-hidden="true" />
            {reduced ? "Animations off" : "Reduce motion"}
          </button>
        </div>

        <ol
          className="mt-12 grid items-stretch gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-5"
          role="list"
        >
          {PIPELINE_STAGES.map((s, i) => {
            const tone = TONE[s.tone];
            const last = i === PIPELINE_STAGES.length - 1;
            const rowEnd = (i + 1) % 5 === 0;
            return (
              <li
                key={s.title}
                className="relative flex flex-col items-stretch"
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

                {!last && (
                  <span
                    aria-hidden="true"
                    className="mx-auto my-2 flex h-5 items-center justify-center text-muted-foreground/50 lg:hidden"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </span>
                )}
                {!last && !rowEnd && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute right-0 top-1/2 hidden h-px w-4 -translate-y-1/2 translate-x-full bg-gradient-to-r from-accent/50 to-transparent lg:block"
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
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
                  Data sources used
                </div>
                <ul className="mt-2 grid gap-1.5">
                  {active.sources.map((src) => (
                    <li key={src.label} className="text-[12px]">
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
