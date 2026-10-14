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
 * The scores are gone — all of them, including the composite.
 *
 * Restricting them to modules with data behind them fixed the second and third
 * problems but not the first, because the numbers themselves were never
 * measurements. "Construction" was a four-step band off elevation alone: 42
 * below 20 m, 62 below 100 m, 55 above 2,400 m, 78 otherwise. "Amenity access"
 * was 30 + the count of mapped places x 3.5. "Environment" averaged the air
 * quality index, read as though an AQI were a grade out of 100, with another
 * elevation band. Those were weighted by persona into a composite and mapped
 * onto AAA through C — credit-rating notation, which lends an authority none
 * of this had earned. None of it could be checked by anyone, us included:
 * there is no answer to "78 compared to what?".
 *
 * What was actually read survives, published without the arithmetic on top:
 * the elevation in metres, the air quality index and its category, the counts
 * of schools, health facilities, shops and transit stops, and the confidence
 * derived from which providers answered. Each is checkable at its source, and
 * that is the whole of the claim being made for it.
 *
 * `score` and `grade` stay on the type and are always null, so every surface
 * that already renders the no-reading state keeps working unchanged. The
 * buy/don't-buy verdict went earlier; in its place is a due-diligence
 * checklist naming what HALISIA cannot assess and who can.
 *
 * Pure functions — no network, no side effects.
 */
import type {
  LocationIntel,
  ProviderStatus,
} from "@/lib/location-intel.functions";
import type { NarrativeOutput } from "@/lib/ai-narrative.functions";
import type { Wave4Intel, ScoreExplain } from "@/lib/wave4-intel.functions";

export type Persona =
  | "investor"
  | "home-buyer"
  | "farmer"
  | "developer"
  | "business";

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
export type ModuleStatus = "measured" | "projected" | "not-assessed";

export interface ModuleOutput {
  id: ModuleId;
  label: string;
  status: ModuleStatus;
  /**
   * Always null. Kept so the surfaces that render the no-score state need no
   * change, and so anything still reading it gets nothing rather than a
   * plausible number. Nothing in this engine computes a score any more.
   *
   * The type stays `number | null` rather than narrowing to `null`, so every
   * consumer's existing null-check compiles and behaves exactly as it did for
   * an unassessed module. Narrowing it would be the stricter guarantee, but it
   * would change the type of every already-correct `m.score != null` branch in
   * the app at the same time as the behaviour, which is two changes at once.
   */
  score: number | null;
  confidencePct: number | null;
  /** Always null. See `score`. */
  grade: Grade | null;
  trend: "up" | "flat" | "down" | null;
  /** Why the reading is what it is, or why nothing can be read. */
  reasons: string[];
  /** Datasets actually queried for this module on this run. */
  sources: string[];
  /** Exact runtime fields used when status is projected. */
  projectionBasis?: string[];
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
   * Always null. There is no composite: it was a persona-weighted mean of
   * three banded numbers, and a weighted mean of unmeasured quantities is not
   * a measurement of anything.
   */
  reading: number | null;
  /** What the surface should say instead of a number. */
  readingLabel: string;
  /** Always null. The AAA-to-C ladder is gone with the score beneath it. */
  grade: Grade | null;
  confidencePct: number | null;
  /** One sentence naming exactly which modules fed the composite. */
  scopeNote: string;
  measuredCount: number;
  projectedCount: number;
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

// grade() and trendFrom() stood here. Both read a 0-100 score and there are no
// longer any scores to read. They are deleted rather than left dormant: a
// grader still in the file is an invitation to print a grade again.

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

function providerStatus(
  intel: LocationIntel | undefined,
  key: keyof LocationIntel["providers"],
) {
  return intel?.providers?.[key]?.status;
}

/**
 * Persona weighting. These are relative importances, not shares of a whole.
 *
 * They no longer weight a score, because there is no score. What they still do
 * is renormalise the confidence figure over whichever modules were read, and
 * order the reasons so that what this persona came to find out appears first.
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
      [
        "Elevation could not be read for this point, so there is no terrain signal at all.",
      ],
      ["Ground elevation", "Parcel soil test (SPT)", "Slope at parcel scale"],
      "Commission SPT and moisture tests at three points on the parcel.",
    );
  }

  // Elevation is a coarse buildability signal and nothing more: it says
  // something about drainage and water table, not about what the ground can
  // carry. It is reported as the metres it is, and the sentence below says
  // what that height implies. It is not converted into a mark out of 100.
  return {
    id: "construction",
    label: "Construction",
    status: "measured",
    score: null,
    grade: null,
    trend: null,
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
    limitations: [
      "Elevation is a proxy for drainage, not a geotechnical assessment",
    ],
    nextStep:
      "Commission SPT and moisture tests at three points on the parcel.",
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
      [
        "Air quality index",
        "Ground elevation",
        "Catchment hydrology",
        "Rainfall record",
      ],
      "Walk the parcel during the long rains before committing.",
    );
  }

  // Only the sources that answered are named. The two readings used to be
  // averaged into a mark, which required treating an air quality index as if
  // it were a grade out of 100 — it is not; on the universal scale a higher
  // AQI is better air, and it is not a percentage of anything. Both readings
  // are now reported as themselves.
  const sources: string[] = [];
  if (aqi != null) sources.push(SRC_AIR);
  if (elev != null) sources.push(SRC_ELEVATION);

  return {
    id: "environment",
    label: "Environment",
    status: "measured",
    score: null,
    grade: null,
    trend: null,
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
    nextStep:
      "Walk the parcel during the long rains (March–May) before committing.",
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
  const total =
    counts.schools + counts.hospitals + counts.groceries + counts.transit;
  void total; // Counted for the sentence below, no longer scaled into a mark.

  return {
    id: "infrastructure",
    // Renamed: this counts amenities that are mapped nearby. It does not
    // measure roads, power, water or their condition, which is what
    // "Infrastructure" implies to a buyer.
    label: "Amenity access",
    status: "measured",
    score: null,
    grade: null,
    trend: null,
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

/* ---------------- evidence gaps and narrowly bounded projections ---------------- */

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

const WAVE4_SOURCE = "OpenStreetMap via Overpass API";

function wave4ConfidencePct(
  confidence: ScoreExplain["confidence"],
): number | null {
  if (confidence === "high") return 80;
  if (confidence === "medium") return 60;
  return null;
}

/**
 * A public-data context signal, deliberately narrower than an investment
 * return. It is published only when mapped-feature coverage is medium/high.
 * It does not use prices, rents, sales, titles or approved plans.
 */
function scoreDevelopmentContext(wave4?: Wave4Intel): ModuleOutput | null {
  const explanation = wave4?.breakdown.investment;
  if (!wave4 || !explanation) return null;
  const confidencePct = wave4ConfidencePct(explanation.confidence);
  if (confidencePct == null) return null;

  const usedSources = wave4.sources
    .filter((source) => source.used)
    .map((source) => source.label);
  const sources = usedSources.length > 0 ? usedSources : [WAVE4_SOURCE];
  return {
    id: "investment",
    label: "Development context",
    status: "measured",
    score: null,
    confidencePct,
    grade: null,
    trend: null,
    reasons: [
      "Built from mapped access, services, climate normals and settlement anchors in public open data",
      "This describes present public-data context; it does not predict price, demand, yield or appreciation",
    ],
    sources,
    missing: [
      "Comparable sales and asking prices",
      "Rents, yields and time-to-sell",
      "Approved or funded future projects",
    ],
    limitations: [
      explanation.note,
      "OpenStreetMap completeness varies by location",
      "Not a valuation, return forecast or investment recommendation",
    ],
    nextStep:
      "Use a registered valuer and current comparable transactions before committing capital.",
  };
}

function projectPublicContext(
  id: "community" | "futureGrowth",
  wave4?: Wave4Intel,
): ModuleOutput | null {
  const explanation = wave4?.breakdown.development;
  if (!wave4 || !explanation) return null;
  const confidencePct = wave4ConfidencePct(explanation.confidence);
  if (confidencePct == null) return null;

  const facilityCount = Object.values(wave4.facilities).reduce(
    (total, items) => total + items.length,
    0,
  );
  const anchors = [
    ["schools", "education"],
    ["hospitals", "healthcare"],
    ["markets", "markets"],
    ["transit", "public transport"],
    ["worship", "places of worship"],
  ]
    .map(([key, label]) => ({
      label,
      count: wave4.facilities[key]?.length ?? 0,
    }))
    .filter((item) => item.count > 0);
  const anchorSummary = anchors.length
    ? anchors.map((item) => `${item.count} ${item.label}`).join(" · ")
    : `${facilityCount} mapped facilities`;
  const sources = wave4.sources
    .filter((source) => source.used)
    .map((source) => source.label);

  if (id === "community") {
    return {
      id,
      label: "Community context",
      status: "projected",
      score: null,
      confidencePct,
      grade: null,
      trend: null,
      reasons: [
        `${anchorSummary} within the public-data search area indicate an existing settlement-service pattern.`,
        "This is an indicative mapped-facility proxy, not a measure of community quality, cohesion or resident experience.",
      ],
      sources: sources.length ? sources : [WAVE4_SOURCE],
      projectionBasis: [
        "Mapped public facilities within 3 km",
        "Development-context coverage",
      ],
      missing: [
        "Resident reports",
        "Neighbourhood association records",
        "Service quality and capacity",
      ],
      limitations: [
        "OpenStreetMap completeness varies by location",
        "Facility presence does not prove operating status, capacity or community sentiment",
      ],
      nextStep:
        "Visit at different times and speak with immediate neighbours and local service operators.",
    };
  }

  return {
    id,
    label: "Development pressure proxy",
    status: "projected",
    score: null,
    confidencePct,
    grade: null,
    trend: null,
    reasons: [
      `${anchorSummary} produce a mapped settlement-context signal for the area today.`,
      "This may indicate existing development pressure, but it does not predict growth, approvals, demand, price or returns.",
    ],
    sources: sources.length ? sources : [WAVE4_SOURCE],
    projectionBasis: [
      "Mapped public facilities within 3 km",
      "Current access and settlement anchors",
    ],
    missing: [
      "Ward-level CIDP commitments",
      "Gazetted road, rail and bypass alignments",
      "Approved development applications nearby",
    ],
    limitations: [
      explanation.note,
      "Current mapped activity is not evidence of a future public project or appreciation",
    ],
    nextStep:
      "Check the latest ward CIDP, gazetted alignments and approved applications with the county.",
  };
}

/**
 * Questions this engine cannot answer directly. Each one used to
 * carry a score built from an unrelated proxy — most often a count of nearby
 * banks. They now state the gap and name who closes it. Community and planned
 * development may later be replaced by non-scoring public-context projections.
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
      [
        "No listings feed is integrated, so supply, demand and liquidity are unknown.",
      ],
      [
        "Live listings feed",
        "Absorption and time-to-sell",
        "Price trend for the ward",
      ],
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
  wave4?: Wave4Intel,
): DecisionOutput {
  void narrative; // The narrative is an LLM reading, never an input to a score.

  const unavailable = unassessableModules();
  const developmentContext = scoreDevelopmentContext(wave4);
  const communityProjection = projectPublicContext("community", wave4);
  const growthProjection = projectPublicContext("futureGrowth", wave4);
  const modules: ModuleOutput[] = [
    scoreConstruction(intel),
    scoreEnvironment(intel),
    scoreInfrastructure(intel),
    ...unavailable.map((module) =>
      module.id === "investment" && developmentContext
        ? developmentContext
        : module.id === "community" && communityProjection
          ? communityProjection
          : module.id === "futureGrowth" && growthProjection
            ? growthProjection
            : module,
    ),
  ];

  // "Measured" now means the data behind the module arrived — which is what
  // the word meant all along. It used to also require a score, so removing the
  // scores would otherwise have emptied this list and made the scope note
  // below claim that nothing could be read, which would be false.
  const measured = modules.filter(
    (m): m is ModuleOutput & { confidencePct: number } =>
      m.status === "measured" && m.confidencePct != null,
  );
  const notAssessedList = modules.filter((m) => m.status === "not-assessed");
  const projected = modules.filter((m) => m.status === "projected");

  const w = WEIGHTS[persona];
  const weightTotal = measured.reduce((acc, m) => acc + (w[m.id] ?? 0.1), 0);

  // There is no composite reading. Confidence survives it, because confidence
  // is not a judgement of the place: it reports how much of what this module
  // needed actually arrived from the providers, which is a fact about the run.
  const confidencePct =
    measured.length > 0 && weightTotal > 0
      ? clamp(
          measured.reduce(
            (acc, m) => acc + m.confidencePct * (w[m.id] ?? 0.1),
            0,
          ) / weightTotal,
        )
      : null;

  const measuredNames = measured.map((m) => m.label.toLowerCase());
  const scopeNote = measured.length
    ? `Built from ${listPhrase(measuredNames)} — the ${measured.length} of ${modules.length} module${
        measured.length === 1 ? "" : "s"
      } with data behind ${measured.length === 1 ? "it" : "them"} at this point. ` +
      `${projected.length ? `${projected.length} proxy projection${projected.length === 1 ? " is" : "s are"} shown separately and ` : ""}` +
      `the other ${notAssessedList.length} are listed below as checks to run, not as scores.`
    : "Nothing could be read for this point — every provider returned empty.";

  const headline = measured.length
    ? `Read for this point: ${listPhrase(measuredNames)}. No score, no grade, no ranking.`
    : "Nothing could be read for this point.";

  // Ordered by what this persona came to find out, which is the only thing
  // the weights can honestly do now that there is no score to weight.
  const reasons = measured
    .slice()
    .sort((a, b) => (w[b.id] ?? 0.1) - (w[a.id] ?? 0.1))
    .map((m) => `${m.label}: ${m.reasons[0]}`);

  const dueDiligence: DueDiligenceItem[] = notAssessedList.map((m) => ({
    label: m.label,
    why: m.reasons[0] ?? "Not held by HALISIA.",
    who: m.nextStep,
  }));

  // Keyed off the elevation actually read rather than off the old construction
  // score, which no longer exists. Low ground and very high ground each raise
  // real foundation questions — water table in the first case, access and
  // curing in the second — and both are things the reading can establish.
  const elevM = intel?.elevation?.meters ?? null;
  const professionalRecs = [
    "Licensed Surveyor — confirm boundaries and beacons",
    "Advocate — official title search and sale agreement",
    elevM != null && (elevM < 100 || elevM > 2400)
      ? "Structural engineer — foundation strategy for low-lying or high-altitude ground"
      : "Architect — buildability and design brief",
    "Insurance broker — property and construction cover",
    persona === "investor" || persona === "developer"
      ? "Independent valuer — before committing capital"
      : "Independent valuer — indicative valuation",
  ];

  return {
    reading: null,
    readingLabel: "Evidence, sorted by what can be checked",
    grade: null,
    confidencePct,
    scopeNote,
    measuredCount: measured.length,
    projectedCount: projected.length,
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
  {
    id: "home-buyer",
    label: "Home buyer",
    hint: "Livability, schools, safety",
  },
  { id: "farmer", label: "Farmer", hint: "Soil, rainfall, water access" },
  { id: "developer", label: "Developer", hint: "Zoning, utilities, density" },
  { id: "business", label: "Business", hint: "Traffic, visibility, commerce" },
];

/** Stated once, wherever a dossier is shown or exported. */
export const DOSSIER_SCOPE =
  "HALISIA reads the Google Maps Elevation API, Google Air Quality API and Google Places for location readings; public-context readings list any additional runtime sources. It holds no title, transaction-price, utility-connection, crime or planning-approval data, does not assert title, boundary or ownership, and publishes no recommendation to buy or not to buy.";
