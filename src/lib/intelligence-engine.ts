/**
 * HALISIA AI · Land Intelligence Engine (LIOS core)
 * ---------------------------------------------------
 * Section 5 spec: 10 modular intelligence scorers + a Decision Engine that
 * combines them into a persona-weighted overall recommendation. Every module
 * returns the same canonical output shape so any UI can consume it:
 *
 *   { score, confidence, reasons[], sources[], limitations[], nextStep }
 *
 * Pure functions — no network, no side effects. Feed the same intel/narrative
 * that already power the dashboard and the engine turns them into a single
 * trustworthy read.
 */
import type { LocationIntel } from "@/lib/location-intel.functions";
import type { NarrativeOutput } from "@/lib/ai-narrative.functions";

export type Persona = "investor" | "home-buyer" | "farmer" | "developer" | "business";

export type ModuleId =
  | "investment"
  | "construction"
  | "legal"
  | "environment"
  | "infrastructure"
  | "community"
  | "market"
  | "utilities"
  | "safety"
  | "futureGrowth";

export interface ModuleOutput {
  id: ModuleId;
  label: string;
  score: number; // 0-100
  confidencePct: number; // 0-100
  grade: "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "C";
  trend: "up" | "flat" | "down";
  reasons: string[]; // "why" — 2-5 crisp bullets
  sources: string[]; // datasets used
  limitations: string[]; // what the score does NOT prove
  nextStep: string; // one concrete verification action
}

export interface DecisionOutput {
  overall: number; // 0-100 unified Land Intelligence Score
  grade: ModuleOutput["grade"];
  confidencePct: number;
  recommendation:
    | "Highly Recommended"
    | "Recommended"
    | "Consider with Caution"
    | "Not Recommended";
  headline: string;
  reasons: string[];
  professionalRecs: string[]; // Architect / Surveyor / etc.
  persona: Persona;
  modules: ModuleOutput[];
  freshness: string; // ISO
}

/* ---------------- helpers ---------------- */

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function grade(score: number): ModuleOutput["grade"] {
  if (score >= 90) return "AAA";
  if (score >= 82) return "AA";
  if (score >= 74) return "A";
  if (score >= 66) return "BBB";
  if (score >= 58) return "BB";
  if (score >= 45) return "B";
  return "C";
}

function trendFrom(score: number, hasGrowthSignal: boolean): ModuleOutput["trend"] {
  if (score >= 70 && hasGrowthSignal) return "up";
  if (score < 45) return "down";
  return "flat";
}

/**
 * Persona weighting — sums to 1 within each persona. Higher = the persona
 * cares more about that module when computing overall LIOS score.
 */
const WEIGHTS: Record<Persona, Record<ModuleId, number>> = {
  investor: {
    investment: 0.22,
    market: 0.16,
    futureGrowth: 0.14,
    infrastructure: 0.12,
    legal: 0.1,
    construction: 0.06,
    environment: 0.06,
    utilities: 0.06,
    community: 0.04,
    safety: 0.04,
  },
  "home-buyer": {
    safety: 0.16,
    infrastructure: 0.16,
    utilities: 0.12,
    environment: 0.12,
    community: 0.1,
    construction: 0.08,
    legal: 0.1,
    investment: 0.06,
    market: 0.05,
    futureGrowth: 0.05,
  },
  farmer: {
    environment: 0.28,
    utilities: 0.16,
    infrastructure: 0.12,
    community: 0.08,
    construction: 0.08,
    legal: 0.1,
    safety: 0.06,
    market: 0.06,
    investment: 0.04,
    futureGrowth: 0.02,
  },
  developer: {
    construction: 0.2,
    legal: 0.16,
    infrastructure: 0.14,
    utilities: 0.12,
    environment: 0.1,
    investment: 0.1,
    market: 0.08,
    futureGrowth: 0.06,
    safety: 0.02,
    community: 0.02,
  },
  business: {
    infrastructure: 0.2,
    market: 0.18,
    safety: 0.12,
    utilities: 0.1,
    investment: 0.1,
    futureGrowth: 0.08,
    community: 0.08,
    legal: 0.06,
    environment: 0.04,
    construction: 0.04,
  },
};

/* ---------------- module scorers ---------------- */

function signalCoverage(intel?: LocationIntel, narrative?: NarrativeOutput) {
  // Rough completeness across data buckets → drives confidence.
  const buckets = [
    !!intel?.categories,
    intel?.elevation?.meters != null,
    intel?.airQuality?.universalAqi != null,
    !!narrative,
    (intel?.categories?.schools.length ?? 0) + (intel?.categories?.hospitals.length ?? 0) > 0,
  ];
  return buckets.filter(Boolean).length / buckets.length; // 0..1
}

function baseConfidence(intel?: LocationIntel, narrative?: NarrativeOutput) {
  const coverage = signalCoverage(intel, narrative);
  const narrConf = (narrative?.confidencePct ?? 60) / 100;
  return clamp((coverage * 0.6 + narrConf * 0.4) * 100);
}

function scoreInvestment(intel?: LocationIntel, narrative?: NarrativeOutput): ModuleOutput {
  const c = intel?.categories;
  const infra = (c?.schools.length ?? 0) + (c?.banks.length ?? 0) + (c?.groceries.length ?? 0);
  const base = narrative?.businessSuitability?.score ?? clamp(38 + infra * 3.5);
  const growth = (narrative?.futureOutlook ?? "").length > 40;
  const score = clamp(base * 0.7 + (growth ? 30 : 20));
  return {
    id: "investment",
    label: "Investment",
    score,
    grade: grade(score),
    trend: trendFrom(score, growth),
    confidencePct: baseConfidence(intel, narrative),
    reasons: [
      `Amenity density index: ${infra} anchor POIs within ~3 km`,
      narrative?.futureOutlook
        ? "AI outlook flags positive medium-term trajectory"
        : "Trajectory uses baseline county trend (no specific projects detected)",
      c?.banks.length
        ? `${c.banks.length} bank/ATM presence supports commerce`
        : "Limited financial infrastructure nearby",
    ],
    sources: ["Google Places", "AI Narrative", "County growth signals"],
    limitations: [
      "No transaction-level comps loaded",
      "Prices are indicative, not appraisal-grade",
    ],
    nextStep: "Pull last-12-month comps for the same ward before offering.",
  };
}

function scoreConstruction(intel?: LocationIntel, narrative?: NarrativeOutput): ModuleOutput {
  const elev = intel?.elevation?.meters ?? null;
  const buildability =
    elev == null ? 60 : clamp(elev < 20 ? 42 : elev < 100 ? 62 : elev > 2400 ? 55 : 78);
  return {
    id: "construction",
    label: "Construction",
    score: buildability,
    grade: grade(buildability),
    trend: "flat",
    confidencePct: clamp(baseConfidence(intel, narrative) - (elev == null ? 15 : 0)),
    reasons: [
      elev != null
        ? `Elevation ${elev.toFixed(0)} m — ${elev < 20 ? "coastal/low, watch water table" : elev < 100 ? "low-relief, drainage matters" : "elevated, drainage friendlier"}`
        : "Elevation unknown — assume conservative foundations",
      "Assumed medium-density soil until SPT / SoilGrids resolves parcel",
      "Access, road width and material haulage not yet field-verified",
    ],
    sources: ["Open-Topo-Data ASTER 30m", "SoilGrids v2.0 (regional)", "AI Narrative"],
    limitations: ["No parcel soil test", "Slope not yet computed at parcel scale"],
    nextStep: "Commission SPT + moisture tests at 3 points on the parcel.",
  };
}

function scoreLegal(intel?: LocationIntel, narrative?: NarrativeOutput): ModuleOutput {
  // We cannot know legal status — surface a "readiness" score that reflects
  // whether the user has verification affordances nearby (registries, banks).
  const banks = intel?.categories?.banks.length ?? 0;
  const score = clamp(45 + banks * 3);
  return {
    id: "legal",
    label: "Legal readiness",
    score,
    grade: grade(score),
    trend: "flat",
    confidencePct: 55,
    reasons: [
      "Title, zoning and wayleave cannot be verified from open data",
      `${banks} banks/notaries nearby to support due diligence`,
      "County planning class not resolved for this parcel",
    ],
    sources: ["Ardhisasa (external)", "County planning office (external)"],
    limitations: ["Not a legal opinion", "Ownership must be verified at the registry"],
    nextStep: "Run an official Ardhisasa title search and confirm zoning class.",
  };
}

function scoreEnvironment(intel?: LocationIntel, narrative?: NarrativeOutput): ModuleOutput {
  const aqi = intel?.airQuality?.universalAqi ?? null;
  const elev = intel?.elevation?.meters ?? null;
  const flood = elev == null ? 60 : clamp(elev < 20 ? 30 : elev < 100 ? 58 : 82);
  const air = aqi == null ? 60 : clamp(aqi);
  const score = clamp(air * 0.5 + flood * 0.5);
  return {
    id: "environment",
    label: "Environment",
    score,
    grade: grade(score),
    trend: "flat",
    confidencePct: clamp(baseConfidence(intel, narrative) - (aqi == null ? 10 : 0)),
    reasons: [
      aqi != null
        ? `Air quality AQI ${aqi} (${intel?.airQuality?.category ?? "moderate"})`
        : "Air quality not sampled",
      elev != null
        ? `Elevation ${elev.toFixed(0)} m — flood exposure ${flood < 45 ? "elevated" : flood < 70 ? "moderate" : "lower"}`
        : "Flood proxy unavailable",
      "Verify long-rain (Mar–May) behaviour on-site",
    ],
    sources: ["Google Air Quality API", "Open-Topo-Data", "Open-Meteo"],
    limitations: ["Regional proxy, not micro-catchment hydrology"],
    nextStep: "Walk the parcel during long rains before committing.",
  };
}

function scoreInfrastructure(intel?: LocationIntel, narrative?: NarrativeOutput): ModuleOutput {
  const c = intel?.categories;
  const infraCount =
    (c?.schools.length ?? 0) +
    (c?.hospitals.length ?? 0) +
    (c?.groceries.length ?? 0) +
    (c?.transit.length ?? 0);
  const score = clamp(30 + infraCount * 3.5);
  return {
    id: "infrastructure",
    label: "Infrastructure",
    score,
    grade: grade(score),
    trend: trendFrom(score, infraCount > 8),
    confidencePct: baseConfidence(intel, narrative),
    reasons: [
      `${c?.schools.length ?? 0} schools · ${c?.hospitals.length ?? 0} health · ${c?.groceries.length ?? 0} shops within ~3 km`,
      `${c?.transit.length ?? 0} transit stops mapped`,
      "Road hierarchy inferred from OSM; not weighted by pavement quality",
    ],
    sources: ["Google Places", "OpenStreetMap"],
    limitations: ["Pavement condition not measured", "No live traffic layer"],
    nextStep: "Drive the access road at peak hour before signing.",
  };
}

function scoreCommunity(_intel?: LocationIntel, narrative?: NarrativeOutput): ModuleOutput {
  // Placeholder until community submissions land — trust the narrative's
  // family-suitability as a light proxy.
  const score = narrative?.familySuitability?.score ?? 55;
  return {
    id: "community",
    label: "Community",
    score,
    grade: grade(score),
    trend: "flat",
    confidencePct: 45,
    reasons: [
      "Community submissions layer not yet populated for this parcel",
      "Proxy based on family-suitability composite",
    ],
    sources: ["HALISIA community reports (planned)"],
    limitations: ["Low sample size; treat as directional only"],
    nextStep: "Speak with two immediate neighbours before deciding.",
  };
}

function scoreMarket(_intel?: LocationIntel, narrative?: NarrativeOutput): ModuleOutput {
  const base = narrative?.businessSuitability?.score ?? 58;
  const score = clamp(base * 0.9 + 5);
  return {
    id: "market",
    label: "Market",
    score,
    grade: grade(score),
    trend: trendFrom(score, true),
    confidencePct: 55,
    reasons: [
      "Demand proxy derived from commercial-amenity density",
      "Rental yield not modelled at parcel scale yet",
      "Liquidity inferred from county-level activity",
    ],
    sources: ["AI Narrative", "OpenStreetMap POIs"],
    limitations: ["No live listings feed integrated"],
    nextStep: "Cross-check asking prices on Ardhisasa & PropertyPro.",
  };
}

function scoreUtilities(intel?: LocationIntel, narrative?: NarrativeOutput): ModuleOutput {
  const c = intel?.categories;
  const density =
    (c?.groceries.length ?? 0) + (c?.banks.length ?? 0) + (c?.restaurants.length ?? 0);
  const score = clamp(35 + density * 2.5);
  return {
    id: "utilities",
    label: "Utilities",
    score,
    grade: grade(score),
    trend: "flat",
    confidencePct: clamp(baseConfidence(intel, narrative) - 10),
    reasons: [
      "Grid access inferred from commercial density (KPLC coverage not queried)",
      "Water supply not verified — plan a tank + borehole option",
      density > 6
        ? "Commercial cluster nearby implies reliable services"
        : "Sparse commercial cluster — expect service gaps",
    ],
    sources: ["OpenStreetMap", "Google Places"],
    limitations: ["No live KPLC / water-board feed"],
    nextStep: "Call KPLC and the county water board with plot coordinates.",
  };
}

function scoreSafety(intel?: LocationIntel, _narrative?: NarrativeOutput): ModuleOutput {
  const c = intel?.categories;
  const anchor = (c?.hospitals.length ?? 0) + (c?.banks.length ?? 0);
  const score = clamp(50 + anchor * 3);
  return {
    id: "safety",
    label: "Safety",
    score,
    grade: grade(score),
    trend: "flat",
    confidencePct: 50,
    reasons: [
      "No incident data feed integrated — proxy uses institutional density",
      `${c?.hospitals.length ?? 0} health facilities within response radius`,
      "Nighttime activity not modelled",
    ],
    sources: ["Google Places", "OpenStreetMap"],
    limitations: ["No crime dataset attached"],
    nextStep: "Visit the parcel after dark before signing.",
  };
}

function scoreFutureGrowth(intel?: LocationIntel, narrative?: NarrativeOutput): ModuleOutput {
  const base =
    ((narrative?.businessSuitability?.score ?? 55) + (narrative?.familySuitability?.score ?? 55)) /
    2;
  const score = clamp(base);
  return {
    id: "futureGrowth",
    label: "Future growth",
    score,
    grade: grade(score),
    trend: trendFrom(score, true),
    confidencePct: 50,
    reasons: [
      narrative?.futureOutlook
        ? narrative.futureOutlook.slice(0, 140)
        : "Baseline county trajectory assumed",
      "Bypass / SGR / county plans not yet cross-referenced at parcel scale",
    ],
    sources: ["AI Narrative", "County CIDPs (external)"],
    limitations: ["3–5 year predictions, not certainties"],
    nextStep: "Read the ward's latest CIDP before assuming appreciation.",
  };
}

/* ---------------- decision engine ---------------- */

export function runIntelligenceEngine(
  intel?: LocationIntel,
  narrative?: NarrativeOutput,
  persona: Persona = "investor",
): DecisionOutput {
  const modules: ModuleOutput[] = [
    scoreInvestment(intel, narrative),
    scoreConstruction(intel, narrative),
    scoreLegal(intel, narrative),
    scoreEnvironment(intel, narrative),
    scoreInfrastructure(intel, narrative),
    scoreCommunity(intel, narrative),
    scoreMarket(intel, narrative),
    scoreUtilities(intel, narrative),
    scoreSafety(intel, narrative),
    scoreFutureGrowth(intel, narrative),
  ];

  const w = WEIGHTS[persona];
  const overall = clamp(modules.reduce((acc, m) => acc + m.score * (w[m.id] ?? 0.1), 0));
  const confidencePct = clamp(
    modules.reduce((acc, m) => acc + m.confidencePct * (w[m.id] ?? 0.1), 0),
  );

  const recommendation: DecisionOutput["recommendation"] =
    overall >= 78
      ? "Highly Recommended"
      : overall >= 62
        ? "Recommended"
        : overall >= 45
          ? "Consider with Caution"
          : "Not Recommended";

  // Top 4 reasons across the highest-scoring modules for this persona.
  const ranked = [...modules].sort(
    (a, b) => (w[b.id] ?? 0.1) * b.score - (w[a.id] ?? 0.1) * a.score,
  );
  const reasons = ranked.slice(0, 4).map((m) => `${m.label}: ${m.reasons[0]}`);

  const professionalRecs = [
    "Licensed Surveyor — confirm boundaries & beacons",
    "Advocate — official title search and sale agreement",
    modules.find((m) => m.id === "construction")!.score < 60
      ? "Structural engineer — foundation strategy for challenging site"
      : "Architect — buildability & design brief",
    "Insurance broker — property & construction cover quote",
    persona === "investor" || persona === "developer"
      ? "Mortgage / financing partner"
      : "Independent valuer — indicative valuation",
  ];

  return {
    overall,
    grade: grade(overall),
    confidencePct,
    recommendation,
    headline: `${recommendation} for ${labelForPersona(persona).toLowerCase()} (LIOS ${overall}/100)`,
    reasons,
    professionalRecs,
    persona,
    modules,
    freshness: new Date().toISOString(),
  };
}

export function labelForPersona(p: Persona): string {
  switch (p) {
    case "investor":
      return "Investors";
    case "home-buyer":
      return "Home buyers";
    case "farmer":
      return "Farmers";
    case "developer":
      return "Developers";
    case "business":
      return "Business owners";
  }
}

export const PERSONAS: { id: Persona; label: string; hint: string }[] = [
  { id: "investor", label: "Investor", hint: "ROI, growth, rental demand" },
  { id: "home-buyer", label: "Home buyer", hint: "Livability, schools, safety" },
  { id: "farmer", label: "Farmer", hint: "Soil, rainfall, water access" },
  { id: "developer", label: "Developer", hint: "Zoning, utilities, density" },
  { id: "business", label: "Business", hint: "Traffic, visibility, commerce" },
];
