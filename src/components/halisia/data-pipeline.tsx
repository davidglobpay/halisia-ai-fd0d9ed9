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
  type LucideIcon,
} from "lucide-react";

type Stage = {
  title: string;
  role: string;
  detail: string;
  icon: LucideIcon;
  href?: string;
  tone: "input" | "source" | "engine" | "output";
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
  },
  {
    title: "GPS location",
    role: "Input",
    detail: "A map pin or device location fixes the parcel to real coordinates.",
    icon: Navigation,
    tone: "input",
  },
  {
    title: "OpenStreetMap",
    role: "Open data",
    detail: "Roads, amenities, schools, health facilities and transport within reach.",
    icon: MapPin,
    href: "https://www.openstreetmap.org/copyright",
    tone: "source",
  },
  {
    title: "Geoapify",
    role: "Open data",
    detail: "Geocoding, reverse geocoding and place enrichment around the pin.",
    icon: Layers,
    href: "https://www.geoapify.com/",
    tone: "source",
  },
  {
    title: "Open-Meteo",
    role: "Open data",
    detail: "Climate normals, rainfall and temperature history for the location.",
    icon: CloudSun,
    href: "https://open-meteo.com/",
    tone: "source",
  },
  {
    title: "Satellite data",
    role: "Earth observation",
    detail: "Elevation, slope, terrain modelling and soil profiles from global rasters.",
    icon: Satellite,
    href: "https://soilgrids.org/",
    tone: "source",
  },
  {
    title: "Government data",
    role: "Official records",
    detail: "County boundaries, census indicators and public administrative datasets.",
    icon: Landmark,
    href: "https://www.knbs.or.ke/",
    tone: "source",
  },
  {
    title: "AI analysis",
    role: "Reasoning",
    detail: "Signals are cross-read, weighted and turned into plain-language findings.",
    icon: Brain,
    tone: "engine",
  },
  {
    title: "HALISIA intelligence score",
    role: "Synthesis",
    detail: "Ten weighted scorers produce one defensible score with visible evidence.",
    icon: Sparkles,
    tone: "engine",
  },
  {
    title: "Marketplace listing",
    role: "Output",
    detail: "Buyers see the listing alongside its score, evidence and citations.",
    icon: ShoppingBag,
    tone: "output",
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
  return (
    <section
      id="pipeline"
      data-testid="data-pipeline"
      className="py-20 md:py-28 border-t border-white/5"
      aria-label="How HALISIA turns a listing into intelligence"
    >
      <div className="mx-auto max-w-7xl px-4">
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

        <ol
          className="mt-12 grid items-stretch gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-5"
          role="list"
        >
          {PIPELINE_STAGES.map((s, i) => {
            const tone = TONE[s.tone];
            const last = i === PIPELINE_STAGES.length - 1;
            const rowEnd = (i + 1) % 5 === 0;
            const Wrapper = s.href ? "a" : "div";
            return (
              <li
                key={s.title}
                className="relative flex flex-col items-stretch"
                data-testid="pipeline-stage"
              >
                <Wrapper
                  {...(s.href
                    ? { href: s.href, target: "_blank", rel: "noreferrer noopener" }
                    : {})}
                  className={`glass block h-full rounded-2xl border ${tone.ring} p-4 transition-colors`}
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
                  {s.href && (
                    <span className="mt-2 inline-block text-[10px] text-accent">
                      View source dataset →
                    </span>
                  )}
                </Wrapper>

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
    </section>
  );
}
