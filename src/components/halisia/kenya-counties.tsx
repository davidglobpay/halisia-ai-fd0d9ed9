import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  TrendingUp,
  Users,
  Droplets,
  X,
  Sparkles,
  Filter,
  GitCompare,
  Check,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

// Kenya bounding box used to place county pins on the stylized map plane.
const BOUNDS = { north: 5.5, south: -4.8, east: 42.0, west: 33.9 };

type County = {
  name: string;
  region: string;
  lat: number;
  lng: number;
  livability: number;
  population: string; // human readable
  populationN: number; // numeric for scaling
  growth: string; // YoY price signal
  growthN: number; // numeric (percent)
  water: "Reliable" | "Intermittent" | "Scarce";
  confidence: {
    livability: "Low" | "Medium" | "High";
    population: "Low" | "Medium" | "High";
    growth: "Low" | "Medium" | "High";
    water: "Low" | "Medium" | "High";
  };
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
    growth: "+9% YoY",
    water: "Intermittent",
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
    growth: "+11% YoY",
    water: "Scarce",
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
    growth: "+7% YoY",
    water: "Reliable",
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
    growth: "+13% YoY",
    water: "Reliable",
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
    growth: "+10% YoY",
    water: "Reliable",
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
    growth: "+6% YoY",
    water: "Reliable",
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
    growth: "+5% YoY",
    water: "Reliable",
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
    growth: "+12% YoY",
    water: "Intermittent",
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
    growth: "+10% YoY",
    water: "Reliable",
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
    growth: "+14% YoY",
    water: "Intermittent",
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
    growth: "+15% YoY",
    water: "Scarce",
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
    growth: "+9% YoY",
    water: "Reliable",
    vibe: "Wheat and maize highland, home to Eldoret metro.",
    highlights: ["Agri-industrial", "New airport routes", "Cold snaps"],
  },
];

function pctPos(lat: number, lng: number) {
  const x = ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * 100;
  const y = ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * 100;
  return { x, y };
}

export function KenyaCounties() {
  const [active, setActive] = useState<County | null>(null);
  const navigate = useNavigate();

  return (
    <section id="counties" className="py-24 md:py-32 border-t border-white/5">
      <div className="mx-auto max-w-7xl px-4">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.25em] text-accent">County intelligence</div>
          <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight">
            Kenya, county by county — <span className="text-gradient">float, click, decide</span>.
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Every county has its own economic pulse, water story and land dynamics. Tap a marker to
            see the summary, then jump into the full location workspace.
          </p>
        </div>

        <div className="mt-12 grid lg:grid-cols-[1.15fr_1fr] gap-6 items-start">
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
            {/* stylised Kenya silhouette */}
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

            {/* Floating county pins */}
            {COUNTIES.map((c, i) => {
              const p = pctPos(c.lat, c.lng);
              const isActive = active?.name === c.name;
              return (
                <motion.button
                  key={c.name}
                  data-testid={`county-pin-${c.name.toLowerCase()}`}
                  onClick={() => setActive(c)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group"
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
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
                    className={`h-3 w-3 rounded-full ring-4 ring-primary/20 animate-pulse ${
                      isActive ? "bg-accent" : "bg-primary"
                    }`}
                  />
                  <div
                    className={`pointer-events-none absolute left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap rounded-full glass px-2 py-0.5 text-[10px] transition ${
                      isActive
                        ? "text-foreground bg-white/15"
                        : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    {c.name} · {c.livability}
                  </div>
                </motion.button>
              );
            })}

            <div className="pointer-events-none absolute bottom-3 left-3 glass rounded-full px-3 py-1.5 text-[10px] uppercase tracking-widest text-accent">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Live · County pulse
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
                    <Stat label="Livability" value={`${active.livability}`} suffix="/100" />
                    <Stat label="Population" value={active.population} icon={Users} />
                    <Stat label="Growth" value={active.growth} icon={TrendingUp} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Stat label="Water" value={active.water} icon={Droplets} />
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

                  <button
                    onClick={() =>
                      navigate({
                        to: "/explore",
                        search: { q: `${active.name}, Kenya` },
                      })
                    }
                    className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-medium px-5 py-2.5"
                  >
                    Open {active.name} workspace →
                  </button>
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
                  growth and water reliability at a glance.
                  <div className="mt-6 grid grid-cols-3 gap-2">
                    {COUNTIES.slice(0, 6).map((c) => (
                      <button
                        key={c.name}
                        onClick={() => setActive(c)}
                        className="glass rounded-2xl px-3 py-2 text-left text-xs hover:bg-white/10 transition"
                      >
                        <div className="text-foreground font-medium">{c.name}</div>
                        <div className="text-muted-foreground">Livable {c.livability}</div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  suffix,
  icon: Icon,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="glass rounded-2xl px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3 text-accent" />} {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-foreground">
        {value}
        {suffix && <span className="text-xs text-muted-foreground ml-0.5">{suffix}</span>}
      </div>
    </div>
  );
}
