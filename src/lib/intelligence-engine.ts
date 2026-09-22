/**
 * HALISIA AI · Land Intelligence Engine
 * ---------------------------------------------------
 * Turns the location snapshot into readings a buyer can act on, and is
 * explicit about everything it cannot read.
 *
 * WHAT CHANGED, AND WHY
 *
 * This engine used to publish ten modules, each with a 0-100 score, a credit
 * grade from AAA to C, a confidence percentage and a source list, which it
 * combined into a persona-weighted "Land Intelligence Score" and a verdict of
 * Highly Recommended through Not Recommended. Three problems ran through it:
 *
 *   1. Seven of the ten modules had no input. "Legal readiness" was
 *      45 + banks × 3. "Safety" was 50 + (hospitals + banks) × 3. "Utilities"
 *      was 35 + (shops + banks + restaurants) × 2.5. Community, Market and
 *      Future growth fell back to a constant near 55 when nothing was known,
 *      so an unknown location scored the same as an average one.
 *
 *   2. Those seven declared a fixed confidence — 45, 50 or 55 — regardless of
 *      whether a single provider had answered. A location where every API had
 *      failed still reported "Legal readiness · 55% confidence".
 *
 *   3. The source lists named data this engine never reads. It calls exactly
 *      three services: the Google Maps Elevation API, the Google Air Quality
 *      API and Google Places. Alongside those it cited a global elevation
 *      archive, a soil-property database, a weather archive, a crowd-mapping
 *      project, the national land registry, county planning offices, county
 *      development plans, unnamed "growth signals", and a community-reports
 *      layer marked as planned — a dataset that does not exist. None of them
 *      is queried anywhere in this file.
 *
 * THE RULE NOW
 *
 * A module publishes a score only when the data behind it was actually
 * fetched. Otherwise its status is "not-assessed": no score, no grade, no
 * confidence, and it is excluded from the composite rather than dragging a
 * default into it. Confidence is derived from `intel.providers`, which the
 * snapshot has always carried and this engine used to ignore.
 *
 * The composite survives but is named for its inputs — terrain, air and
 * amenity access — not as a judgement on the land. The buy/don't-buy verdict
 * is gone: elevation, air quality and a count of nearby shops cannot support
 * one. In its place is a due-diligence checklist naming what HALISIA cannot
 * assess and who can.
 *
 * Pure functions — no network, no side effects.
 */
import type { LocationIntel, ProviderStatus } from "@/lib/location-intel.functions";
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

export type Grade = "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "C";

/**
 * "measured" means every figure shown for this module came from a provider
 * that answered on this run. "not-assessed" means HALISIA holds no data that
 * answers the question, and says so instead of estimating.
 */
export type ModuleStatus = "measured" | "not-assessed";

export interface ModuleOutput {
  id: ModuleId;
  label: string;
  status: ModuleStatus;
  /** 0-100. Null when not assessed — never a default standing in for data. */
  score: number | null;
  confidencePct: number | null;
  grade: Grade | null;
  trend: "up" | "flat" | "down" | null;
  /** Why the reading is what it is, or why nothing can be read. */
  reasons: string[];
  /** Datasets actually queried for this module on this run. */
  sources: string[];
  /** Named data that would answer this module, which HALISIA does not hold. */
  missing: string[];
  limitations: string[];
  nextStep: string;
}

export interface DueDiligenceItem {
  label: string;
  why: string;
  who: string;
}

export interface DecisionOutput {
  /**
   * Composite across the measured modules only, weighted by persona and
   * renormalised over those modules. Null when fewer than two were measured,
   * because a "composite" of one reading is just that reading.
   */
  reading: number | null;
  /** What the composite is a reading OF. Never "the land" in general. */
  readingLabel: string;
  grade: Grade | null;
  confidencePct: number | null;
  /** One sentence naming exactly which modules fed the composite. */
  scopeNote: string;
  measuredCount: number;
  notAssessedCount: number;
  headline: string;
  reasons: string[];
  /** What HALISIA could not assess, and who can. */
  dueDiligence: DueDiligenceItem[];
  professionalRecs: string[];
  persona: Persona;
  modules: ModuleOutput[];
  freshness: string;
}

/* ---------------- helpers ---------------- */

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function grade(score: number): Grade {
  if (score >= 90) return "AAA";
  if (score >= 82) return "AA";
  if (score >= 74) return "A";
  if (score >= 66) return "BBB";
  if (score >= 58) return "BB";
  if (score >= 45) return "B";
  return "C";
}

function trendFrom(score: number, hasGrowthSignal: boolean): "up" | "flat" | "down" {
  if (score >= 70 && hasGrowthSignal) return "up";
  if (score < 45) return "down";
  return "flat";
}

/**
 * Confidence from the inputs a module actually received.
 *
 * Every module declares the inputs it needs. An input that arrived counts
 * fully; one from a provider that reported "degraded" counts partially,
 * because a degraded provider may have returned a thin or stale answer; one
 * that never arrived counts zero. A module with no inputs at all reports no
 * confidence, not a low one.
 */
type ModuleInput = { present: boolean; provider?: ProviderStatus };

function confidenceFrom(inputs: ModuleInput[]): number | null {
  if (inputs.length === 0) return null;
  let have = 0;
  for (const input of inputs) {
    if (!input.present) continue;
    have += input.provider === "degraded" ? 0.6 : 1;
  }
  if (have === 0) return null;
  return clamp((have / inputs.length) * 100);
}

function providerStatus(intel: LocationIntel | undefined, key: keyof LocationIntel["providers"]) {
  return intel?.providers?.[key]?.status;
}

/**
 * Persona weighting. These are relative importances, not shares of a whole:
 * the composite renormalises over whichever modules were measured, so a
 * persona whose priority module could not be read does not silently get a
 * composite dominated by something it does not care about.
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

/* ---------------- the three services this engine reads ---------------- */

const SRC_ELEVATION = "Google Maps Elevation API";
const SRC_AIR = "Google Air Quality API";
const SRC_PLACES = "Google Places";

/* ---------------- measured modules ---------------- */

function scoreConstruction(intel?: LocationIntel): ModuleOutput {
  const elev = intel?.elevation?.meters ?? null;
  const confidence = confidenceFrom([
    { present: elev != null, provider: providerStatus(intel, "elevation") },
  ]);

  if (elev == null || confidence == null) {
    return notAssessed(
      "construction",
      "Construction",
      ["Elevation could not be read for this point, so there is no terrain signal at all."],
      ["Ground elevation", "Parcel soil test (SPT)", "Slope at parcel scale"],
      "Commission SPT and moisture tests at three points on the parcel.",
    );
  }

  // Elevation is a coarse buildability signal and nothing more: it says
  // something about drainage and water table, not about what the ground can
  // carry. The score is deliberately banded rather than continuous.
  const score = clamp(elev < 20 ? 42 : elev < 100 ? 62 : elev > 2400 ? 55 : 78);
  return {
    id: "construction",
    label: "Construction",
    status: "measured",
    score,
    grade: grade(score),
    trend: "flat",
    confidencePct: confidence,
    reasons: [
      `Elevation ${elev.toFixed(0)} m — ${
        elev < 20
          ? "coastal or low-lying; check the water table"
          : elev < 100
            ? "low relief, so drainage matters"
            : elev > 2400
              ? "high altitude; curing and access need planning"
              : "elevated, drainage friendlier"
      }`,
      "Reads drainage and water-table risk from height alone",
      "Says nothing about bearing capacity, soil type or slope at parcel scale",
    ],
    sources: [SRC_ELEVATION],
    missing: [
      "Parcel soil test (SPT) — HALISIA does not hold one",
      "Slope at parcel scale — not computed",
      "Road width and haulage access — not surveyed",
    ],
    limitations: ["Elevation is a proxy for drainage, not a geotechnical assessment"],
    nextStep: "Commission SPT and moisture tests at three points on the parcel.",
  };
}

function scoreEnvironment(intel?: LocationIntel): ModuleOutput {
  const aqi = intel?.airQuality?.universalAqi ?? null;
  const elev = intel?.elevation?.meters ?? null;
  const confidence = confidenceFrom([
    { present: aqi != null, provider: providerStatus(intel, "airQuality") },
    { present: elev != null, provider: providerStatus(intel, "elevation") },
  ]);

  if (confidence == null) {
    return notAssessed(
      "environment",
      "Environment",
      ["Neither air quality nor elevation could be read for this point."],
      ["Air quality index", "Ground elevation", "Catchment hydrology", "Rainfall record"],
      "Walk the parcel during the long rains before committing.",
    );
  }

  // Each half is scored only if its input arrived, then averaged over the
  // halves that exist. Absence lowers confidence; it does not invent a 60.
  const parts: number[] = [];
  const sources: string[] = [];
  if (aqi != null) {
    parts.push(clamp(aqi));
    sources.push(SRC_AIR);
  }
  if (elev != null) {
    parts.push(clamp(elev < 20 ? 30 : elev < 100 ? 58 : 82));
    sources.push(SRC_ELEVATION);
  }
  const score = clamp(parts.reduce((a, b) => a + b, 0) / parts.length);

  return {
    id: "environment",
    label: "Environment",
    status: "measured",
    score,
    grade: grade(score),
    trend: "flat",
    confidencePct: confidence,
    reasons: [
      aqi != null
        ? `Air quality index ${aqi}${intel?.airQuality?.category ? ` (${intel.airQuality.category})` : ""}, measured now`
        : "Air quality not returned for this point",
      elev != null
        ? `Elevation ${elev.toFixed(0)} m — a coarse flood proxy only`
        : "Elevation not returned, so no flood proxy",
      "Neither input describes this parcel's own drainage",
    ],
    sources,
    missing: [
      "Micro-catchment hydrology — not modelled",
      "Rainfall record for this point — not queried",
      "Historical flood extent — HALISIA holds none",
    ],
    limitations: [
      "Air quality is a reading at one moment, not an annual average",
      "Elevation stands in for flood risk; it is not a flood study",
    ],
    nextStep: "Walk the parcel during the long rains (March–May) before committing.",
  };
}

function scoreInfrastructure(intel?: LocationIntel): ModuleOutput {
  const c = intel?.categories;
  const places = providerStatus(intel, "places");
  const hasPlaces = !!c && places !== "unavailable";
  const confidence = confidenceFrom([{ present: hasPlaces, provider: places }]);

  if (!c || confidence == null) {
    return notAssessed(
      "infrastructure",
      "Amenity access",
      ["Places data did not return, so nothing nearby could be counted."],
      ["Mapped schools, health facilities, shops and transit stops"],
      "Drive the access road at peak hour before signing.",
    );
  }

  const counts = {
    schools: c.schools.length,
    hospitals: c.hospitals.length,
    groceries: c.groceries.length,
    transit: c.transit.length,
  };
  const total = counts.schools + counts.hospitals + counts.groceries + counts.transit;
  const score = clamp(30 + total * 3.5);

  return {
    id: "infrastructure",
    // Renamed: this counts amenities that are mapped nearby. It does not
    // measure roads, power, water or their condition, which is what
    // "Infrastructure" implies to a buyer.
    label: "Amenity access",
    status: "measured",
    score,
    grade: grade(score),
    trend: trendFrom(score, total > 8),
    confidencePct: confidence,
    reasons: [
      `${counts.schools} schools · ${counts.hospitals} health facilities · ${counts.groceries} shops within about 3 km`,
      `${counts.transit} transit stops mapped nearby`,
      "Counts what is listed on Google Places — not what is open, usable or in good repair",
    ],
    sources: [SRC_PLACES],
    missing: [
      "Road surface and condition — not measured",
      "Live traffic and journey times — not queried",
      "Anything unlisted on Google Places",
    ],
    limitations: [
      "A count of listings, not a measure of service quality",
      "Sparse mapping reads as sparse amenities",
    ],
    nextStep: "Drive the access road at peak hour before signing.",
  };
}

/* ---------------- modules HALISIA cannot assess ---------------- */

function notAssessed(
  id: ModuleId,
  label: string,
  reasons: string[],
  missing: string[],
  nextStep: string,
  limitations: string[] = [],
): ModuleOutput {
  return {
    id,
    label,
    status: "not-assessed",
    score: null,
    grade: null,
    trend: null,
    confidencePct: null,
    reasons,
    sources: [],
    missing,
    limitations,
    nextStep,
  };
}

/**
 * The seven questions this engine is asked but cannot answer. Each one used to
 * carry a score built from an unrelated proxy — most often a count of nearby
 * banks. They now state the gap and name who closes it.
 */
function unassessableModules(): ModuleOutput[] {
  return [
    notAssessed(
      "legal",
      "Legal status",
      [
        "Title, ownership, charges, caveats and zoning cannot be read from open data.",
        "HALISIA does not connect to Ardhisasa or any county planning office.",
      ],
      [
        "Official title search (Ardhisasa)",
        "Zoning class from the county planning office",
        "Encumbrances, caveats and wayleaves",
      ],
      "Run an official Ardhisasa title search and confirm the zoning class.",
      ["Nothing here is a legal opinion"],
    ),
    notAssessed(
      "investment",
      "Investment return",
      [
        "HALISIA holds no transaction prices, asking prices, rents or yields for this area.",
        "A count of nearby amenities is not a return.",
      ],
      [
        "Comparable sales for the ward, last 12 months",
        "Asking prices and days on market",
        "Rental yields",
      ],
      "Pull comparable sales for the same ward before making an offer.",
    ),
    notAssessed(
      "market",
      "Market depth",
      ["No listings feed is integrated, so supply, demand and liquidity are unknown."],
      ["Live listings feed", "Absorption and time-to-sell", "Price trend for the ward"],
      "Cross-check asking prices against at least two listing portals and a local agent.",
    ),
    notAssessed(
      "utilities",
      "Utilities",
      [
        "Grid, water and sewer connections are not queried.",
        "Kenya Power and the county water board hold this; HALISIA does not read either.",
      ],
      [
        "Kenya Power connection and transformer capacity",
        "County water board mains coverage",
        "Sewer or septic feasibility",
      ],
      "Call Kenya Power and the county water board with the plot coordinates.",
    ),
    notAssessed(
      "safety",
      "Safety",
      [
        "No incident or crime dataset is connected.",
        "Counting hospitals and banks nearby says nothing about whether a place is safe.",
      ],
      [
        "Incident or crime statistics",
        "Police post coverage",
        "Street lighting and night activity",
      ],
      "Visit the parcel after dark, and ask the nearest chief's office and neighbours.",
    ),
    notAssessed(
      "community",
      "Community",
      ["The community submissions layer holds nothing for this location yet."],
      ["Resident reports for this area", "Neighbourhood association contacts"],
      "Speak with two immediate neighbours before deciding.",
    ),
    notAssessed(
      "futureGrowth",
      "Planned development",
      [
        "County CIDPs, road and rail programmes are not cross-referenced at parcel scale.",
        "Any projection without them would be a guess.",
      ],
      [
        "Ward-level CIDP commitments",
        "Gazetted road, rail and bypass alignments",
        "Approved development applications nearby",
      ],
      "Read the ward's latest CIDP and check gazetted alignments near the parcel.",
      ["HALISIA publishes no appreciation forecast"],
    ),
  ];
}

/* ---------------- decision engine ---------------- */

export function runIntelligenceEngine(
  intel?: LocationIntel,
  narrative?: NarrativeOutput,
  persona: Persona = "investor",
): DecisionOutput {
  void narrative; // The narrative is an LLM reading, never an input to a score.

  const modules: ModuleOutput[] = [
    scoreConstruction(intel),
    scoreEnvironment(intel),
    scoreInfrastructure(intel),
    ...unassessableModules(),
  ];

  const measured = modules.filter(
    (m): m is ModuleOutput & { score: number; confidencePct: number } =>
      m.status === "measured" && m.score != null && m.confidencePct != null,
  );
  const notAssessedList = modules.filter((m) => m.status === "not-assessed");

  const w = WEIGHTS[persona];
  const weightTotal = measured.reduce((acc, m) => acc + (w[m.id] ?? 0.1), 0);

  // A composite of a single reading is not a composite — it is that reading
  // with a grander name, so below two measured modules there is no number.
  const hasComposite = measured.length >= 2 && weightTotal > 0;
  const reading = hasComposite
    ? clamp(measured.reduce((acc, m) => acc + m.score * (w[m.id] ?? 0.1), 0) / weightTotal)
    : null;
  const confidencePct = hasComposite
    ? clamp(measured.reduce((acc, m) => acc + m.confidencePct * (w[m.id] ?? 0.1), 0) / weightTotal)
    : null;

  const measuredNames = measured.map((m) => m.label.toLowerCase());
  const scopeNote = measured.length
    ? `Built from ${listPhrase(measuredNames)} — the ${measured.length} of ${modules.length} module${
        measured.length === 1 ? "" : "s"
      } with data behind ${measured.length === 1 ? "it" : "them"} at this point. ` +
      `The other ${notAssessedList.length} are listed below as checks to run, not as scores.`
    : "Nothing could be read for this point — every provider returned empty.";

  const headline = hasComposite
    ? `Terrain and amenity reading ${reading}/100 for ${labelForPersona(persona).toLowerCase()}`
    : measured.length === 1
      ? `One reading available: ${measured[0].label.toLowerCase()} ${measured[0].score}/100`
      : "No readings available for this point";

  const reasons = measured
    .slice()
    .sort((a, b) => (w[b.id] ?? 0.1) * b.score - (w[a.id] ?? 0.1) * a.score)
    .map((m) => `${m.label}: ${m.reasons[0]}`);

  const dueDiligence: DueDiligenceItem[] = notAssessedList.map((m) => ({
    label: m.label,
    why: m.reasons[0] ?? "Not held by HALISIA.",
    who: m.nextStep,
  }));

  const construction = modules.find((m) => m.id === "construction");
  const professionalRecs = [
    "Licensed Surveyor — confirm boundaries and beacons",
    "Advocate — official title search and sale agreement",
    construction?.score != null && construction.score < 60
      ? "Structural engineer — foundation strategy for a challenging site"
      : "Architect — buildability and design brief",
    "Insurance broker — property and construction cover",
    persona === "investor" || persona === "developer"
      ? "Independent valuer — before committing capital"
      : "Independent valuer — indicative valuation",
  ];

  return {
    reading,
    readingLabel: "Terrain and amenity reading",
    grade: reading != null ? grade(reading) : null,
    confidencePct,
    scopeNote,
    measuredCount: measured.length,
    notAssessedCount: notAssessedList.length,
    headline,
    reasons,
    dueDiligence,
    professionalRecs,
    persona,
    modules,
    freshness: new Date().toISOString(),
  };
}

/** "a, b and c" — used in the scope note so it reads as a sentence. */
function listPhrase(items: string[]): string {
  if (items.length === 0) return "nothing";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
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

/** Stated once, wherever a dossier is shown or exported. */
export const DOSSIER_SCOPE =
  "HALISIA reads three services for a location: the Google Maps Elevation API, the Google Air Quality API and Google Places. It holds no title, price, utility, crime or planning data, does not assert title, boundary or ownership, and publishes no recommendation to buy or not to buy.";
