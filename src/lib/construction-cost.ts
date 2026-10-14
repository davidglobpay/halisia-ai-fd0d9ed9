/**
 * Indicative construction budget bands for early concept comparison.
 *
 * These are planning ranges, NOT quotes, bills of quantities or verified
 * supplier prices. They exist so a person can see the order of magnitude and
 * how the three walling systems compare before they hire a quantity surveyor
 * and a structural engineer.
 */

export type BuildSystem = "masonry" | "precast" | "eps";
export type UseClass = "residential" | "affordable" | "mixed" | "commercial" | "industrial";

export const SYSTEM_META: Record<BuildSystem, { label: string; pros: string[]; cons: string[] }> = {
  masonry: {
    label: "Conventional masonry (machine-cut stone / block, RC frame)",
    pros: [
      "Widely understood by Kenyan fundis, contractors and county approvers",
      "Materials available in most counties; easy to extend later",
      "Good thermal mass and durability",
    ],
    cons: [
      "Slowest build programme; most site labour and wet trades",
      "Quality varies with workmanship and supervision",
      "Higher material wastage and transport weight",
    ],
  },
  precast: {
    label: "Precast concrete panels / elements",
    pros: [
      "Factory-controlled quality and faster erection",
      "Repetition reduces cost on multi-unit and larger schemes",
      "Less wet work and site wastage",
    ],
    cons: [
      "Needs crane access, road access for delivery and a supplier within range",
      "Design changes after fabrication are expensive",
      "Economies only appear at scale; small single homes may not benefit",
    ],
  },
  eps: {
    label: "EPS sandwich panels (expanded polystyrene with sprayed concrete)",
    pros: [
      "Lightweight; lower foundation loads on weaker soils",
      "Fast to erect with good insulation",
      "Lower labour hours for walls",
    ],
    cons: [
      "Fewer experienced installers; check NCA/county acceptance for the product",
      "Fire, impact and fixing details must follow the supplier's tested system",
      "Lenders, insurers and buyers may be less familiar with it",
    ],
  },
};

/**
 * KES per m² of gross floor area, low–high, for a standard specification
 * shell + finishes, excluding land, professional fees, approvals, external
 * works, VAT and contingency. Assumed mid-2020s Kenyan market levels.
 */
const BASE_RATE: Record<BuildSystem, [number, number]> = {
  masonry: [38000, 58000],
  precast: [34000, 54000],
  eps: [30000, 48000],
};

const USE_FACTOR: Record<UseClass, number> = {
  residential: 1,
  affordable: 0.8,
  mixed: 1.1,
  commercial: 1.2,
  industrial: 0.7,
};

const STOREY_FACTOR = (storeys: number) =>
  storeys <= 1 ? 1 : storeys <= 2 ? 1.04 : storeys <= 4 ? 1.1 : 1.18;

export const COST_ASSUMPTIONS = [
  "Indicative planning ranges for mid-2020s Kenyan markets, not supplier quotes or a bill of quantities.",
  "Rates are per m² of gross floor area for a standard specification; luxury finishes can exceed the high figure.",
  "Excludes land, professional fees (typically 8–15%), approvals, external works, utilities connections, VAT and inflation.",
  "A 10% contingency is shown separately and should be confirmed with a quantity surveyor.",
  "Foundation cost depends on soil and slope; a geotechnical investigation can move totals materially.",
  "Not a preliminary engineering design. Structural adequacy of any system needs a licensed engineer.",
];

export type SystemEstimate = {
  system: BuildSystem;
  label: string;
  rateLow: number;
  rateHigh: number;
  totalLow: number;
  totalHigh: number;
  contingencyLow: number;
  contingencyHigh: number;
  pros: string[];
  cons: string[];
};

export function estimateCosts(input: {
  grossM2: number;
  storeys: number;
  use: UseClass;
  slopeAdjust?: number; // e.g. 1.05 for gentle slope, 1.12 terraced
}): SystemEstimate[] {
  const area = Math.max(0, Number.isFinite(input.grossM2) ? input.grossM2 : 0);
  const f =
    USE_FACTOR[input.use] *
    STOREY_FACTOR(Math.max(1, Math.round(input.storeys || 1))) *
    (input.slopeAdjust && input.slopeAdjust > 0 ? input.slopeAdjust : 1);
  const round = (n: number) => Math.round(n / 500) * 500;
  return (Object.keys(BASE_RATE) as BuildSystem[]).map((system) => {
    const [lo, hi] = BASE_RATE[system];
    const rateLow = round(lo * f);
    const rateHigh = round(hi * f);
    const totalLow = rateLow * area;
    const totalHigh = rateHigh * area;
    return {
      system,
      label: SYSTEM_META[system].label,
      rateLow,
      rateHigh,
      totalLow,
      totalHigh,
      contingencyLow: Math.round(totalLow * 0.1),
      contingencyHigh: Math.round(totalHigh * 0.1),
      pros: SYSTEM_META[system].pros,
      cons: SYSTEM_META[system].cons,
    };
  });
}

export const TOPOLOGY_SLOPE: Record<"level" | "gentle-slope" | "terraced", number> = {
  level: 1,
  "gentle-slope": 1.05,
  terraced: 1.12,
};

export const CONCEPT_USE: Record<string, UseClass> = {
  "residential-villa": "residential",
  "affordable-community": "affordable",
  "mixed-use-centre": "mixed",
  "commercial-plaza": "commercial",
  "employment-campus": "industrial",
};

export const kes = (n: number) => `KES ${Math.round(n).toLocaleString("en-KE")}`;
export const kesShort = (n: number) =>
  n >= 1e9 ? `KES ${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `KES ${(n / 1e6).toFixed(1)}M` : kes(n);
