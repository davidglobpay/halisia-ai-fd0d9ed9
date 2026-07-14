import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  TrendingUp,
  Users,
  Droplets,
  X,
  Filter,
  GitCompare,
  Check,
  Sparkles,
  FileDown,
} from "lucide-react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { generateCountyComparisonPdf } from "@/lib/pdf-county-compare";

// Kenya bounding box used to place county pins on the stylized map plane.
const BOUNDS = { north: 5.5, south: -4.8, east: 42.0, west: 33.9 };

type Confidence = "Low" | "Medium" | "High";
type Water = "Reliable" | "Intermittent" | "Scarce";
type MetricId = "livability" | "population" | "growth" | "water";

type County = {
  name: string;
  region: string;
  lat: number;
  lng: number;
  livability: number;
  population: string;
  populationN: number; // millions
  growth: string;
  growthN: number; // percent
  water: Water;
  confidence: Record<MetricId, Confidence>;
  vibe: string;
  highlights: string[];
};

const COUNTIES: County[] = [
  {
    name: "Nairobi",
    region: "Capital",
    lat: -1.286,
    lng: 36.817,
    livability: 82,
    population: "4.7M",
    populationN: 4.7,
    growth: "+9% YoY",
    growthN: 9,
    water: "Intermittent",
    confidence: { livability: "High", population: "High", growth: "High", water: "Medium" },
    vibe: "Dense urban core with strong infrastructure and diverse neighborhoods.",
    highlights: ["Fintech & HQ hub", "Best fibre coverage", "Traffic pressure"],
  },
  {
    name: "Mombasa",
    region: "Coast",
    lat: -4.043,
    lng: 39.668,
    livability: 76,
    population: "1.2M",
    populationN: 1.2,
    growth: "+11% YoY",
    growthN: 11,
    water: "Scarce",
    confidence: { livability: "High", population: "High", growth: "Medium", water: "High" },
    vibe: "Coastal port city, tourism-led, humid tropical climate.",
    highlights: ["Port & logistics", "Beachfront demand", "Salinity risk"],
  },
  {
    name: "Kisumu",
    region: "Lake",
    lat: -0.091,
    lng: 34.768,
    livability: 71,
    population: "610k",
    populationN: 0.61,
    growth: "+7% YoY",
    growthN: 7,
    water: "Reliable",
    confidence: { livability: "Medium", population: "High", growth: "Medium", water: "High" },
    vibe: "Lakeside trade hub with agricultural hinterland and rising civic investment.",
    highlights: ["Lake Victoria access", "Agri-processing", "Malaria zone"],
  },
  {
    name: "Nakuru",
    region: "Rift Valley",
    lat: -0.303,
    lng: 36.08,
    livability: 78,
    population: "570k",
    populationN: 0.57,
    growth: "+13% YoY",
    growthN: 13,
    water: "Reliable",
    confidence: { livability: "High", population: "Medium", growth: "High", water: "High" },
    vibe: "Fast-growing satellite city with cooler climate and horticulture belt.",
    highlights: ["Lake Nakuru NP", "Cheap land bank", "Volcanic soils"],
  },
  {
    name: "Eldoret",
    region: "Uasin Gishu",
    lat: 0.514,
    lng: 35.269,
    livability: 74,
    population: "475k",
    populationN: 0.475,
    growth: "+10% YoY",
    growthN: 10,
    water: "Reliable",
    confidence: { livability: "Medium", population: "Medium", growth: "Medium", water: "High" },
    vibe: "Highland grain basket and athletics capital, cool year-round.",
    highlights: ["Grain economy", "Training altitude", "Frost risk"],
  },
  {
    name: "Nyeri",
    region: "Central",
    lat: -0.437,
    lng: 36.958,
    livability: 77,
    population: "760k",
    populationN: 0.76,
    growth: "+6% YoY",
    growthN: 6,
    water: "Reliable",
    confidence: { livability: "Medium", population: "High", growth: "Medium", water: "High" },
    vibe: "Highland county at the foot of Mt Kenya — tea, coffee and quiet livability.",
    highlights: ["Coffee & tea", "Cool climate", "Mountain water"],
  },
  {
    name: "Kakamega",
    region: "Western",
    lat: 0.283,
    lng: 34.752,
    livability: 68,
    population: "1.9M",
    populationN: 1.9,
    growth: "+5% YoY",
    growthN: 5,
    water: "Reliable",
    confidence: { livability: "Medium", population: "High", growth: "Low", water: "Medium" },
    vibe: "Densely populated western county with the last equatorial rainforest.",
    highlights: ["Rainforest", "Sugarcane belt", "Land fragmentation"],
  },
  {
    name: "Machakos",
    region: "Eastern",
    lat: -1.517,
    lng: 37.267,
    livability: 72,
    population: "1.4M",
    populationN: 1.4,
    growth: "+12% YoY",
    growthN: 12,
    water: "Intermittent",
    confidence: { livability: "Medium", population: "High", growth: "Medium", water: "Medium" },
    vibe: "Nairobi commuter belt with rapid peri-urban expansion.",
    highlights: ["Konza tech city", "Dry hills", "Diaspora buyers"],
  },
  {
    name: "Kiambu",
    region: "Central",
    lat: -1.171,
    lng: 36.83,
    livability: 80,
    population: "2.4M",
    populationN: 2.4,
    growth: "+10% YoY",
    growthN: 10,
    water: "Reliable",
    confidence: { livability: "High", population: "High", growth: "High", water: "High" },
    vibe: "Green Nairobi metro extension — schools, gated estates, coffee estates converted to housing.",
    highlights: ["Gated estates", "School density", "Traffic spillover"],
  },
  {
    name: "Kilifi",
    region: "Coast",
    lat: -3.632,
    lng: 39.849,
    livability: 73,
    population: "1.5M",
    populationN: 1.5,
    growth: "+14% YoY",
    growthN: 14,
    water: "Intermittent",
    confidence: { livability: "Medium", population: "High", growth: "High", water: "Medium" },
    vibe: "Emerging coastal alternative to Mombasa — creeks, resorts, remote-work villas.",
    highlights: ["Vipingo growth", "Digital nomads", "Coastal erosion"],
  },
  {
    name: "Kajiado",
    region: "Rift Valley",
    lat: -1.852,
    lng: 36.777,
    livability: 69,
    population: "1.1M",
    populationN: 1.1,
    growth: "+15% YoY",
    growthN: 15,
    water: "Scarce",
    confidence: { livability: "Medium", population: "Medium", growth: "High", water: "High" },
    vibe: "Vast plains south of Nairobi — Maasai heartland, aggressive land subdivision.",
    highlights: ["Land-banking hotspot", "Wildlife dispersal", "Water trucking"],
  },
  {
    name: "Uasin Gishu",
    region: "North Rift",
    lat: 0.55,
    lng: 35.31,
    livability: 74,
    population: "1.2M",
    populationN: 1.2,
    growth: "+9% YoY",
    growthN: 9,
    water: "Reliable",
    confidence: { livability: "Medium", population: "High", growth: "Medium", water: "High" },
    vibe: "Wheat and maize highland, home to Eldoret metro.",
    highlights: ["Agri-industrial", "New airport routes", "Cold snaps"],
  },
];

const WATER_SCORE: Record<Water, number> = { Reliable: 90, Intermittent: 60, Scarce: 30 };

const METRICS: Array<{
  id: MetricId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  unit: string;
}> = [
  { id: "livability", label: "Livability", icon: Sparkles, unit: "/100" },
  { id: "population", label: "Population", icon: Users, unit: "M" },
  { id: "growth", label: "Growth", icon: TrendingUp, unit: "% YoY" },
  { id: "water", label: "Water", icon: Droplets, unit: "" },
];

function metricValue(c: County, m: MetricId): number {
  switch (m) {
    case "livability":
      return c.livability;
    case "population":
      return c.populationN;
    case "growth":
      return c.growthN;
    case "water":
      return WATER_SCORE[c.water];
  }
}

function metricDisplay(c: County, m: MetricId): string {
  switch (m) {
    case "livability":
      return `${c.livability}`;
    case "population":
      return c.population;
    case "growth":
      return c.growth;
    case "water":
      return c.water;
  }
}

// Scale metric value into a 0-1 range for pin size / heat color.
function metricNorm(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function pctPos(lat: number, lng: number) {
  const x = ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * 100;
  const y = ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * 100;
  return { x, y };
}

// Human-readable meaning of a confidence level for each metric.
const CONFIDENCE_MEANING: Record<MetricId, Record<Confidence, string>> = {
  livability: {
    High: "Cross-referenced against infrastructure, safety and amenity data with recent updates.",
    Medium: "Based on partial signals — some inputs are older or modelled.",
    Low: "Sparse ground data — treat the score as directional.",
  },
  population: {
    High: "Sourced from the latest KNBS census with current administrative boundaries.",
    Medium: "Interpolated between census cycles or aggregated across sub-counties.",
    Low: "Estimate only — official figures unavailable at this granularity.",
  },
  growth: {
    High: "Multi-year comparable-plot data with strong sample size.",
    Medium: "Limited comparable transactions — trend is indicative.",
    Low: "Very thin market data — growth signal is inferred, not measured.",
  },
  water: {
    High: "Direct utility coverage records and community reports agree.",
    Medium: "Utility coverage confirmed but service reliability varies by season.",
    Low: "Little verified data — expect surprises during dry spells.",
  },
};

function ConfidenceDots({ level, metric }: { level: Confidence; metric: MetricId }) {
  const n = level === "High" ? 3 : level === "Medium" ? 2 : 1;
  const label = `${METRICS.find((m) => m.id === metric)?.label} confidence: ${level}`;
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${label}. ${CONFIDENCE_MEANING[metric][level]}`}
          className="inline-flex items-center gap-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded-full p-0.5"
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-1 w-1 rounded-full ${i < n ? "bg-accent" : "bg-white/15"}`}
            />
          ))}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px] text-left">
        <div className="font-semibold">{label}</div>
        <div className="mt-1 opacity-90">{CONFIDENCE_MEANING[metric][level]}</div>
      </TooltipContent>
    </Tooltip>
  );
}

export function KenyaCounties() {
  const [active, setActive] = useState<County | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [metric, setMetric] = useState<MetricId>("livability");
  const [compareOpen, setCompareOpen] = useState(false);
  const navigate = useNavigate();
  const search = useSearch({ from: "/" });

  // Selected counties are persisted in the URL (?compare=Nairobi,Mombasa)
  // so a refresh or shared link restores the exact comparison.
  const selected = useMemo(() => {
    const raw = search.compare ?? "";
    if (!raw) return [] as string[];
    const names = new Set(COUNTIES.map((c) => c.name));
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => names.has(s))
      .slice(0, 4);
  }, [search.compare]);

  const setSelected = (updater: (prev: string[]) => string[]) => {
    const next = updater(selected).slice(0, 4);
    void navigate({
      to: "/",
      search: { compare: next.join(",") },
      replace: true,
      resetScroll: false,
    });
  };

  // If the URL arrived pre-loaded with a comparison, open the panel.
  useEffect(() => {
    if (selected.length > 0 && !compareOpen) {
      setCompareOpen(true);
    }
    // Only run on mount / when URL changes externally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focused = hovered ?? active?.name ?? null;

  const range = useMemo(() => {
    const vals = COUNTIES.map((c) => metricValue(c, metric));
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [metric]);

  const toggleSelected = (name: string) => {
    setSelected((prev) =>
      prev.includes(name)
        ? prev.filter((n) => n !== name)
        : prev.length >= 4
          ? prev
          : [...prev, name],
    );
  };

  const selectedCounties = COUNTIES.filter((c) => selected.includes(c.name));

  return (
    <TooltipProvider delayDuration={150}>
    <section id="counties" className="py-24 md:py-32 border-t border-white/5" aria-labelledby="counties-heading">
      <div className="mx-auto max-w-7xl px-4">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.25em] text-accent">County intelligence</div>
          <h2 id="counties-heading" className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight">
            Kenya, county by county — <span className="text-gradient">float, click, decide</span>.
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Switch the metric on the map, hover to sync with the cards below, and multi-select
            counties to compare their dynamics side-by-side.
          </p>
        </div>

        {/* Metric filter */}
        <div className="mt-8 flex flex-wrap items-center gap-2" role="toolbar" aria-label="County map controls">
          <div className="inline-flex items-center gap-1 glass rounded-full p-1" role="radiogroup" aria-label="Displayed metric">
            <span className="pl-3 pr-1 text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
              <Filter className="h-3 w-3 text-accent" /> Metric
            </span>
            {METRICS.map((m) => {
              const on = metric === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMetric(m.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition ${on ? "bg-white/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  data-testid={`metric-${m.id}`}
                  role="radio"
                  aria-checked={on}
                >
                  <m.icon className="h-3.5 w-3.5" /> {m.label}
                </button>
              );
            })}
          </div>

          {selected.length > 0 && (
            <button
              onClick={() => setCompareOpen(true)}
              className="glass-strong rounded-full px-3 py-1.5 text-xs inline-flex items-center gap-1.5 text-foreground"
              data-testid="open-compare"
              aria-label={`Open comparison panel with ${selected.length} selected counties`}
            >
              <GitCompare className="h-3.5 w-3.5 text-accent" /> Compare {selected.length}
            </button>
          )}
          {selected.length > 0 && (
            <button
              onClick={() => setSelected(() => [])}
              className="text-xs text-muted-foreground hover:text-foreground"
              aria-label="Clear selected counties"
            >
              Clear
            </button>
          )}
        </div>

        <div className="mt-6 grid lg:grid-cols-[1.15fr_1fr] gap-6 items-start">
          {/* Floating map plane */}
          <div
            className="relative aspect-[4/5] w-full rounded-[36px] overflow-hidden glass-strong"
            data-testid="kenya-counties-map"
          >
            <div
              className="absolute inset-0 opacity-90"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 30% 25%, oklch(0.68 0.19 249 / 0.35), transparent 55%), radial-gradient(circle at 70% 75%, oklch(0.87 0.14 208 / 0.22), transparent 55%)",
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(oklch(1 0 0 / 0.05) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.05) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
                maskImage: "radial-gradient(ellipse at center, black 45%, transparent 85%)",
              }}
            />
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full opacity-40"
              aria-hidden
            >
              <path
                d="M18,8 L82,4 L92,28 L86,58 L78,88 L44,96 L28,84 L14,60 L10,32 Z"
                fill="url(#kenyaFill)"
                stroke="oklch(0.87 0.14 208 / 0.5)"
                strokeWidth="0.4"
              />
              <defs>
                <linearGradient id="kenyaFill" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.68 0.19 249 / 0.25)" />
                  <stop offset="100%" stopColor="oklch(0.87 0.14 208 / 0.1)" />
                </linearGradient>
              </defs>
            </svg>

            {COUNTIES.map((c, i) => {
              const p = pctPos(c.lat, c.lng);
              const isFocused = focused === c.name;
              const isSelected = selected.includes(c.name);
              const n = metricNorm(metricValue(c, metric), range.min, range.max);
              const size = 10 + n * 14; // 10-24px
              const hue = 200 + n * 50; // cool → warm
              return (
                <motion.button
                  key={c.name}
                  data-testid={`county-pin-${c.name.toLowerCase()}`}
                  onClick={() => setActive(c)}
                  onDoubleClick={() => toggleSelected(c.name)}
                  onKeyDown={(e) => {
                    if (e.key === "c" || e.key === "C" || e.key === "+") {
                      e.preventDefault();
                      toggleSelected(c.name);
                    }
                  }}
                  onFocus={() => setHovered(c.name)}
                  onBlur={() => setHovered(null)}
                  onMouseEnter={() => setHovered(c.name)}
                  onMouseLeave={() => setHovered(null)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-full"
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  aria-label={`${c.name}, ${c.region}. ${METRICS.find((m) => m.id === metric)?.label} ${metricDisplay(c, metric)}. ${isSelected ? "In comparison." : ""} Press Enter to open details, C to toggle compare.`}
                  aria-pressed={isSelected}
                  initial={{ opacity: 0, scale: 0.5, y: 8 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    delay: i * 0.04,
                    type: "spring",
                    stiffness: 260,
                    damping: 18,
                  }}
                  whileHover={{ scale: 1.15, y: -3 }}
                >
                  <div
                    className="rounded-full ring-4 transition-all"
                    style={{
                      height: `${size}px`,
                      width: `${size}px`,
                      background: `oklch(0.75 0.18 ${hue})`,
                      boxShadow: isFocused
                        ? `0 0 0 3px oklch(0.87 0.14 208 / 0.6), 0 0 30px oklch(0.75 0.18 ${hue} / 0.8)`
                        : `0 0 20px oklch(0.75 0.18 ${hue} / 0.5)`,
                    }}
                  />
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-accent grid place-items-center" aria-hidden>
                      <Check className="h-2 w-2 text-background" />
                    </div>
                  )}
                  <div
                    className={`pointer-events-none absolute left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap rounded-full glass px-2 py-0.5 text-[10px] transition ${
                      isFocused
                        ? "text-foreground bg-white/15"
                        : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    {c.name} · {metricDisplay(c, metric)}
                  </div>
                </motion.button>
              );
            })}

            {/* Legend */}
            <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
              <div className="glass-strong rounded-2xl px-3 py-2 text-[10px] max-w-[220px]">
                <div className="uppercase tracking-widest text-accent mb-1.5 flex items-center justify-between">
                  <span>{METRICS.find((m) => m.id === metric)?.label} scale</span>
                </div>
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, oklch(0.75 0.18 200), oklch(0.75 0.18 225), oklch(0.75 0.18 250))",
                  }}
                />
                <div className="mt-1 flex justify-between text-muted-foreground">
                  <span>
                    {metric === "population"
                      ? `${range.min.toFixed(1)}M`
                      : metric === "growth"
                        ? `${range.min}%`
                        : metric === "water"
                          ? "Scarce"
                          : range.min}
                  </span>
                  <span>
                    {metric === "population"
                      ? `${range.max.toFixed(1)}M`
                      : metric === "growth"
                        ? `${range.max}%`
                        : metric === "water"
                          ? "Reliable"
                          : range.max}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-muted-foreground">
                  <span>Confidence</span>
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex items-center gap-0.5">
                      {confidenceDots("Low")}
                    </span>
                    <span>Low</span>
                    <span className="inline-flex items-center gap-0.5">
                      {confidenceDots("High")}
                    </span>
                    <span>High</span>
                  </span>
                </div>
                <div className="mt-1 text-[9px] text-muted-foreground/70">
                  Double-click a pin to add to compare.
                </div>
              </div>
              <div className="glass rounded-full px-3 py-1.5 text-[10px] uppercase tracking-widest text-accent">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                Live · County pulse
              </div>
            </div>
          </div>

          {/* Summary card */}
          <div className="lg:sticky lg:top-24">
            <AnimatePresence mode="wait">
              {active ? (
                <motion.div
                  key={active.name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="glass-strong rounded-3xl p-6 relative"
                  data-testid="county-summary"
                >
                  <button
                    onClick={() => setActive(null)}
                    className="absolute top-4 right-4 h-7 w-7 grid place-items-center rounded-full glass text-muted-foreground hover:text-foreground"
                    aria-label="Close county summary"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-accent">
                    {active.region}
                  </div>
                  <h3 className="mt-1 text-2xl font-semibold tracking-tight">{active.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {active.vibe}
                  </p>

                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <Stat
                      label="Livability"
                      value={`${active.livability}`}
                      suffix="/100"
                      confidence={active.confidence.livability}
                    />
                    <Stat
                      label="Population"
                      value={active.population}
                      icon={Users}
                      confidence={active.confidence.population}
                    />
                    <Stat
                      label="Growth"
                      value={active.growth}
                      icon={TrendingUp}
                      confidence={active.confidence.growth}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Stat
                      label="Water"
                      value={active.water}
                      icon={Droplets}
                      confidence={active.confidence.water}
                    />
                    <Stat
                      label="Coords"
                      value={`${active.lat.toFixed(2)}, ${active.lng.toFixed(2)}`}
                      icon={MapPin}
                    />
                  </div>

                  <div className="mt-5 space-y-1.5">
                    {active.highlights.map((h) => (
                      <div key={h} className="text-xs text-foreground/80 flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-accent" /> {h}
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex items-center gap-2">
                    <button
                      onClick={() => toggleSelected(active.name)}
                      className={`flex-1 rounded-full px-3 py-2 text-xs inline-flex items-center justify-center gap-1.5 transition ${selected.includes(active.name) ? "bg-accent/20 text-accent" : "glass text-muted-foreground hover:text-foreground"}`}
                    >
                      <GitCompare className="h-3.5 w-3.5" />
                      {selected.includes(active.name) ? "In compare" : "Add to compare"}
                    </button>
                    <button
                      onClick={() =>
                        navigate({
                          to: "/explore",
                          search: { q: `${active.name}, Kenya` },
                        })
                      }
                      className="flex-1 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-medium px-3 py-2"
                    >
                      Open workspace →
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="glass rounded-3xl p-6 text-sm text-muted-foreground"
                >
                  <div className="text-xs uppercase tracking-[0.25em] text-accent mb-2">
                    Tap a pin
                  </div>
                  Click any floating marker on the map to see that county's livability, population,
                  growth and water reliability at a glance. Double-click pins (or use the buttons
                  below) to build a comparison of up to four counties.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* County cards below map, synced with hover */}
        <div className="mt-10">
          <div className="text-xs uppercase tracking-[0.25em] text-accent mb-3">
            All counties · showing {METRICS.find((m) => m.id === metric)?.label}
          </div>
          <ul
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 list-none p-0"
            aria-label="County cards synced with the map"
          >
            {COUNTIES.map((c) => {
              const isFocused = focused === c.name;
              const isSelected = selected.includes(c.name);
              return (
                <li
                  key={c.name}
                  onMouseEnter={() => setHovered(c.name)}
                  onMouseLeave={() => setHovered(null)}
                  data-testid={`county-card-${c.name.toLowerCase()}`}
                  className={`rounded-2xl p-4 transition ${isFocused ? "glass-strong ring-1 ring-accent/40 -translate-y-0.5" : "glass hover:bg-white/10"}`}
                >
                  <button
                    type="button"
                    onClick={() => setActive(c)}
                    onFocus={() => setHovered(c.name)}
                    onBlur={() => setHovered(null)}
                    onKeyDown={(e) => {
                      if (e.key === "c" || e.key === "C" || e.key === "+") {
                        e.preventDefault();
                        toggleSelected(c.name);
                      }
                    }}
                    aria-label={`${c.name}, ${c.region}. Open details. Press C to toggle compare.`}
                    className="w-full flex items-start justify-between text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded-md"
                  >
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {c.region}
                      </div>
                      <div className="text-sm font-semibold text-foreground">{c.name}</div>
                    </div>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelected(c.name);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          e.preventDefault();
                          toggleSelected(c.name);
                        }
                      }}
                      role="checkbox"
                      aria-checked={isSelected}
                      tabIndex={0}
                      className={`h-5 w-5 grid place-items-center rounded-md transition ${isSelected ? "bg-accent text-background" : "bg-white/5 text-muted-foreground hover:bg-white/10"}`}
                      aria-label={isSelected ? "Remove from compare" : "Add to compare"}
                    >
                      {isSelected ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <span className="text-xs">+</span>
                      )}
                    </span>
                  </button>
                  <div className="mt-3 flex items-end justify-between">
                    <div className="text-lg font-semibold text-foreground">
                      {metricDisplay(c, metric)}
                    </div>
                    <ConfidenceDots level={c.confidence[metric]} metric={metric} />
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent"
                      style={{
                        width: `${metricNorm(metricValue(c, metric), range.min, range.max) * 100}%`,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Compare panel */}
      <AnimatePresence>
        {compareOpen && selectedCounties.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md p-4 md:p-10 flex items-center justify-center"
            onClick={() => setCompareOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={`County comparison: ${selectedCounties.map((c) => c.name).join(", ")}`}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-3xl p-6 w-full max-w-6xl max-h-[85vh] overflow-auto"
              data-testid="compare-panel"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-accent">
                    Side-by-side
                  </div>
                  <h3 className="mt-1 text-2xl font-semibold tracking-tight">
                    Comparing {selectedCounties.length} counties
                  </h3>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Selection is saved in the URL — copy it to share.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => generateCountyComparisonPdf(selectedCounties)}
                    className="glass rounded-full px-3 py-2 text-xs inline-flex items-center gap-1.5 hover:bg-white/10 transition"
                    data-testid="download-compare-pdf"
                    aria-label="Download comparison as PDF"
                  >
                    <FileDown className="h-3.5 w-3.5 text-accent" /> Download PDF
                  </button>
                  <button
                    onClick={() => setCompareOpen(false)}
                    className="h-8 w-8 grid place-items-center rounded-full glass text-muted-foreground hover:text-foreground"
                    aria-label="Close comparison panel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div
                className="mt-6 grid gap-3"
                style={{
                  gridTemplateColumns: `160px repeat(${selectedCounties.length}, minmax(0, 1fr))`,
                }}
              >
                <div />
                {selectedCounties.map((c) => (
                  <div key={c.name} className="glass rounded-2xl p-3">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {c.region}
                    </div>
                    <div className="text-sm font-semibold text-foreground">{c.name}</div>
                  </div>
                ))}

                {METRICS.map((m) => {
                  const vals = selectedCounties.map((c) => metricValue(c, m.id));
                  const best = Math.max(...vals);
                  return (
                    <RowFragment key={m.id}>
                      <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5 py-3">
                        <m.icon className="h-3.5 w-3.5 text-accent" /> {m.label}
                      </div>
                      {selectedCounties.map((c) => {
                        const v = metricValue(c, m.id);
                        const isBest = v === best && selectedCounties.length > 1;
                        return (
                          <div
                            key={c.name + m.id}
                            className={`rounded-xl px-3 py-3 flex items-center justify-between ${isBest ? "bg-accent/10 ring-1 ring-accent/40" : "bg-white/5"}`}
                          >
                            <span className="text-sm font-semibold text-foreground">
                              {metricDisplay(c, m.id)}
                            </span>
                            <ConfidenceDots level={c.confidence[m.id]} metric={m.id} />
                          </div>
                        );
                      })}
                    </RowFragment>
                  );
                })}

                <div className="text-xs text-muted-foreground py-3">Highlights</div>
                {selectedCounties.map((c) => (
                  <div key={c.name + "hl"} className="rounded-xl bg-white/5 px-3 py-3 space-y-1">
                    {c.highlights.map((h) => (
                      <div
                        key={h}
                        className="text-[11px] text-foreground/80 flex items-center gap-1.5"
                      >
                        <span className="h-1 w-1 rounded-full bg-accent" /> {h}
                      </div>
                    ))}
                  </div>
                ))}

                <div className="text-xs text-muted-foreground py-3">Action</div>
                {selectedCounties.map((c) => (
                  <button
                    key={c.name + "cta"}
                    onClick={() => navigate({ to: "/explore", search: { q: `${c.name}, Kenya` } })}
                    className="rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-medium px-3 py-3"
                  >
                    Open {c.name} →
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
    </TooltipProvider>
  );
}

function RowFragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Stat({
  label,
  value,
  suffix,
  icon: Icon,
  confidence,
  metric,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon?: React.ComponentType<{ className?: string }>;
  confidence?: Confidence;
  metric?: MetricId;
}) {
  return (
    <div className="glass rounded-2xl px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-between gap-1">
        <span className="inline-flex items-center gap-1">
          {Icon && <Icon className="h-3 w-3 text-accent" />} {label}
        </span>
        {confidence && metric && <ConfidenceDots level={confidence} metric={metric} />}
      </div>
      <div className="mt-1 text-sm font-semibold text-foreground">
        {value}
        {suffix && <span className="text-xs text-muted-foreground ml-0.5">{suffix}</span>}
      </div>
    </div>
  );
}
