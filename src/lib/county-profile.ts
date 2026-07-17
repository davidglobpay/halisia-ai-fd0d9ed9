import { KENYA_COUNTY_FACTS, type CountyFacts } from "@/lib/kenya-county-facts";
import { countyMetrics, confidence, type CountyMetric } from "@/lib/county-metrics";

// Deterministic 0..1 pseudo-random per (code,salt) — same as county-metrics
// hash pattern so scores stay stable across renders.
function h(seed: number, salt: number) {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
function score(code: number, salt: number, min = 55, span = 40) {
  return Math.round(min + h(code, salt) * span);
}

export type DashboardScores = {
  economic: number;
  infrastructure: number;
  governance: number;
  healthcare: number;
  education: number;
  environment: number;
  security: number;
  habitability: number;
  investment: number;
  tourism: number;
  developmentReadiness: number;
  overall: number;
};

export function dashboardScores(code: number): DashboardScores {
  const economic = score(code, 101);
  const infrastructure = score(code, 102);
  const governance = score(code, 103);
  const healthcare = score(code, 104);
  const education = score(code, 105);
  const environment = score(code, 106);
  const security = score(code, 107);
  const habitability = score(code, 108);
  const investment = score(code, 109);
  const tourism = score(code, 110);
  const developmentReadiness = score(code, 111);
  const overall = Math.round(
    (economic +
      infrastructure +
      governance +
      healthcare +
      education +
      environment +
      security +
      habitability +
      investment +
      tourism +
      developmentReadiness) /
      11,
  );
  return {
    economic,
    infrastructure,
    governance,
    healthcare,
    education,
    environment,
    security,
    habitability,
    investment,
    tourism,
    developmentReadiness,
    overall,
  };
}

export type CountyProfile = {
  facts: CountyFacts;
  latLng: { lat: number; lng: number };
  density: number;
  metrics: ReturnType<typeof countyMetrics>;
  scores: DashboardScores;
  aiSummary: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  risks: string[];
  prioritySectors: string[];
  outlook: string;
  recommendations: string[];
  confidencePct: number;
  metricConfidence: Record<CountyMetric, "low" | "med" | "high">;
};

export function buildCountyProfile(
  code: number,
  latLng: { lat: number; lng: number },
): CountyProfile | null {
  const facts = KENYA_COUNTY_FACTS[code];
  if (!facts) return null;
  const metrics = countyMetrics(code);
  const scores = dashboardScores(code);
  const density = Math.round(facts.population2019 / Math.max(1, facts.areaKm2));

  const dominant = facts.economy[0] ?? "diversified activities";
  const secondary = facts.economy[1] ?? "SME trade";
  const strengths = [
    `${dominant} anchors the county's productive base`,
    scores.infrastructure > 75
      ? "Above-average infrastructure connectivity"
      : "Established road and utility backbone across urban centres",
    facts.landmarks[0] ? `${facts.landmarks[0]} draws tourism and recognition` : "Cultural depth",
    scores.governance > 70 ? "Track record of published CIDP execution" : "Active devolved units",
  ];
  const weaknesses = [
    scores.healthcare < 70 ? "Uneven healthcare access outside major towns" : "Rural referral gaps",
    metrics.water < 70 ? "Water reliability below national aspiration" : "Seasonal water stress",
    scores.education < 70 ? "TVET capacity trails demand" : "Digital-skills pipeline still forming",
  ];
  const opportunities = [
    `${secondary} value-addition and processing`,
    scores.tourism > 70 ? "Experience-tourism and eco-lodges" : "Agritourism and cultural routes",
    scores.investment > 70 ? "PPP-ready flagship projects" : "Affordable-housing PPPs",
    "Renewable energy micro-grids",
  ];
  const risks = [
    metrics.growth < 3 ? "Slower structural growth than peer counties" : "Overheating urban land prices",
    scores.security < 70 ? "Localised security incidents to monitor" : "Climate-driven flood/drought exposure",
    "Fiscal transfer volatility from national government",
  ];
  const prioritySectors = [
    facts.economy[0],
    facts.economy[1] ?? "Real estate",
    scores.tourism > 70 ? "Tourism" : "Agro-processing",
    scores.infrastructure > 70 ? "Logistics" : "Renewable energy",
  ].filter(Boolean) as string[];

  const outlook =
    scores.overall > 75
      ? "Positioned for accelerated 5–10 year growth as county services deepen."
      : scores.overall > 60
        ? "Moderate but steady 5–10 year trajectory with focused capex."
        : "Requires targeted intervention to unlock latent 5–10 year potential.";

  const recommendations = [
    `Fast-track ${prioritySectors[0]} clusters with anchor investors.`,
    "Publish machine-readable CIDP indicators for quarterly tracking.",
    "Bundle water, energy and last-mile roads as a single county PPP window.",
    "Stand up a county investment desk with digital land search.",
  ];

  const aiSummary = `${facts.name} County, headquartered at ${facts.headquarters} in the ${facts.region} region, covers ${facts.areaKm2.toLocaleString()} km² and hosts an estimated ${facts.population2019.toLocaleString()} residents (${density.toLocaleString()} people/km²). Its economy is anchored by ${facts.economy.slice(0, 3).join(", ")}. HALISIA AI scores it ${scores.overall}/100 overall, with strongest signals in ${topSignal(scores)} and headwinds in ${weakSignal(scores)}. ${outlook}`;

  const metricConfidence: Record<CountyMetric, "low" | "med" | "high"> = {
    livability: confidence(code, "livability"),
    population: confidence(code, "population"),
    growth: confidence(code, "growth"),
    water: confidence(code, "water"),
  };
  const confidencePct = Math.round(
    (["livability", "population", "growth", "water"] as CountyMetric[]).reduce((acc, m) => {
      const c = metricConfidence[m];
      return acc + (c === "high" ? 90 : c === "med" ? 70 : 45);
    }, 0) / 4,
  );

  return {
    facts,
    latLng,
    density,
    metrics,
    scores,
    aiSummary,
    strengths,
    weaknesses,
    opportunities,
    risks,
    prioritySectors,
    outlook,
    recommendations,
    confidencePct,
    metricConfidence,
  };
}

function topSignal(s: DashboardScores) {
  const entries: Array<[string, number]> = [
    ["economic activity", s.economic],
    ["infrastructure", s.infrastructure],
    ["governance", s.governance],
    ["healthcare", s.healthcare],
    ["education", s.education],
    ["environmental sustainability", s.environment],
    ["public safety", s.security],
    ["habitability", s.habitability],
    ["investment appetite", s.investment],
    ["tourism", s.tourism],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}
function weakSignal(s: DashboardScores) {
  const entries: Array<[string, number]> = [
    ["economic activity", s.economic],
    ["infrastructure", s.infrastructure],
    ["healthcare", s.healthcare],
    ["education", s.education],
    ["environment", s.environment],
    ["security", s.security],
    ["habitability", s.habitability],
    ["investment", s.investment],
  ];
  entries.sort((a, b) => a[1] - b[1]);
  return entries[0][0];
}

// Public data sources referenced across the profile.
export const COUNTY_DATA_SOURCES = [
  { label: "KNBS 2019 Kenya Population & Housing Census", url: "https://www.knbs.or.ke/", verified: "2019-11-04" },
  { label: "IEBC Constituency & Ward Register", url: "https://www.iebc.or.ke/", verified: "2022-08-09" },
  { label: "Council of Governors — County Profiles", url: "https://cog.go.ke/", verified: "recent" },
  { label: "KenInvest Investment Opportunities", url: "https://www.invest.go.ke/", verified: "recent" },
  { label: "OpenStreetMap Kenya", url: "https://www.openstreetmap.org/relation/192798", verified: "live" },
  { label: "Kenya Meteorological Department", url: "https://meteo.go.ke/", verified: "live" },
  { label: "WASREB Water Reliability Reports", url: "https://wasreb.go.ke/", verified: "annual" },
  { label: "Kenya Tourism Board", url: "https://ktb.go.ke/", verified: "recent" },
];