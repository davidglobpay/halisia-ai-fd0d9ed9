/**
 * Public construction market references. These are NOT live prices or
 * county quotations. The January 2026 ranges below were published by
 * Goldstay Research and must not be attributed to PPRA or KNBS.
 * PPRA September 2026 guide excludes construction materials; KNBS CIPI is an INDEX,
 * not a retail price list. Never infer a 47-county quote from either.
 */
export type MaterialPrice = {
  id: string;
  label: string;
  unit: string;
  low: number | null;
  high: number | null;
  asOf: string | null;
  source: string | null;
  sourceUrl: string | null;
  coverage: "national-indicative" | "quote-required";
};

const RESEARCH = "Goldstay Research, 13 January 2026";
const RESEARCH_URL = "https://goldstay.co.ke/insights/cement-steel-finishing-prices-kenya-2026";

const BENCHMARKS: MaterialPrice[] = [
  { id: "cement", label: "Cement 50 kg", unit: "bag", low: 700, high: 850 },
  { id: "stone", label: "Machine-cut stone", unit: "piece", low: 50, high: 75 },
  { id: "steel", label: "Rebar Y12", unit: "12 m bar", low: 1400, high: 1750 },
  { id: "sand", label: "Sand (Nairobi delivered)", unit: "tonne", low: 1800, high: 2400 },
  { id: "ballast", label: "Ballast", unit: "tonne", low: 1300, high: 1800 },
  { id: "roofing", label: "Gauge 30 iron sheet", unit: "metre", low: 700, high: 950 },
].map((row) => ({
  ...row,
  asOf: "2026-01-13",
  source: RESEARCH,
  sourceUrl: RESEARCH_URL,
  coverage: "national-indicative" as const,
}));

const QUOTE_ONLY: MaterialPrice[] = [
  { id: "precast", label: "Precast concrete panels", unit: "supplier specification" },
  { id: "eps", label: "EPS wall panels", unit: "supplier specification" },
  { id: "skilled-labour", label: "Skilled labour", unit: "day" },
  { id: "unskilled-labour", label: "Unskilled labour", unit: "day" },
].map((row) => ({
  ...row,
  low: null,
  high: null,
  asOf: null,
  source: null,
  sourceUrl: null,
  coverage: "quote-required" as const,
}));

export const CONSTRUCTION_MATERIALS: readonly MaterialPrice[] = [...BENCHMARKS, ...QUOTE_ONLY];

export const MARKET_SOURCES = [
  {
    label: "PPRA September 2026 market reference guide (non-construction categories)",
    url: "https://ppra.go.ke/market-price-index/",
    note: "September survey covered cleaning, ICT, food, petroleum, pharmaceuticals and stationery, NOT construction materials; not a source for the material prices above.",
  },
  {
    label: "KNBS Construction Input Price Index, Q2 2026",
    url: "https://repository.knbs.or.ke/entities/publication/697e6ea5-3519-4554-9ed6-e94d1e976b76",
    note: "National index: +5.73% quarter-on-quarter, +5.52% year-on-year; not item prices.",
  },
  {
    label: RESEARCH,
    url: RESEARCH_URL,
    note: "Indicative market ranges, published January 2026; may be stale.",
  },
] as const;

export function formatMaterialPrice(row: MaterialPrice): string {
  if (row.low == null || row.high == null) return "Supplier quote required";
  return `KES ${row.low.toLocaleString("en-KE")}–${row.high.toLocaleString("en-KE")} / ${row.unit}`;
}

export function countyMaterialPricing(countyName: string) {
  // Do not pretend a national reference is a verified local quote.
  return {
    county: countyName,
    locality: "No verified county-specific supplier quotations in this dataset",
    items: CONSTRUCTION_MATERIALS,
    methodology: "Published national/Nairobi indicative references only. Local haulage, supplier availability, specification, tax and labour rates require county-level quotes.",
  };
}
