/**
 * Cost Intelligence, Phase 1 — pure computation only.
 *
 * HARD RULE: nothing in this module estimates, seeds or invents a price.
 * Every figure returned here is computed from rows that exist in the
 * database. Where there are too few observations the result is null and the
 * UI prints "Not enough priced data yet" — never a number.
 */

export const SQFT_PER_ACRE = 43560;

/** Standard Kenyan plot sizes, in square feet. */
export const PLOT_SIZES = [
  { key: "50x100", label: "50×100 ft", sqft: 5000 },
  { key: "eighth-acre", label: "1/8 acre", sqft: SQFT_PER_ACRE / 8 }, // 5,445
  { key: "quarter-acre", label: "1/4 acre", sqft: SQFT_PER_ACRE / 4 },
  { key: "half-acre", label: "1/2 acre", sqft: SQFT_PER_ACRE / 2 },
  { key: "acre", label: "1 acre", sqft: SQFT_PER_ACRE },
] as const;

export type PlotSize = (typeof PLOT_SIZES)[number];

export const MIN_LAND_OBSERVATIONS = 5;
export const MIN_PRICED_SHARE = 0.9;
export const LAND_OBSERVATION_WINDOW_MONTHS = 12;

export type LandPriceObservation = {
  county: string;
  sub_county: string | null;
  ward: string | null;
  plot_size_sqft: number;
  price_kes: number;
  source_type: string;
  observed_date: string;
};

export type PlotPriceBand = {
  plot: PlotSize;
  low: number;
  median: number;
  high: number;
};

export type LandPriceSummary = {
  scope: "ward" | "sub_county";
  observations: number;
  newestDate: string;
  sourceTypes: string[];
  medianPerSqft: number;
  bands: PlotPriceBand[];
};

export function median(values: number[]): number {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Median price per sqft from observations, expanded to the standard plot
 * sizes. Returns null when fewer than MIN_LAND_OBSERVATIONS rows exist — the
 * caller must show "Not enough priced data yet", never a fallback number.
 */
export function summarizeLandPrices(
  rows: LandPriceObservation[],
  scope: "ward" | "sub_county",
): LandPriceSummary | null {
  const usable = rows.filter(
    (r) =>
      Number.isFinite(r.price_kes) &&
      Number.isFinite(r.plot_size_sqft) &&
      r.price_kes > 0 &&
      r.plot_size_sqft > 0,
  );
  if (usable.length < MIN_LAND_OBSERVATIONS) return null;
  const perSqft = usable.map((r) => r.price_kes / r.plot_size_sqft);
  const medianPerSqft = median(perSqft);
  const lowPerSqft = Math.min(...perSqft);
  const highPerSqft = Math.max(...perSqft);
  return {
    scope,
    observations: usable.length,
    newestDate: usable.map((r) => r.observed_date).sort().at(-1) ?? "",
    sourceTypes: [...new Set(usable.map((r) => r.source_type))].sort(),
    medianPerSqft,
    bands: PLOT_SIZES.map((plot) => ({
      plot,
      low: Math.round(lowPerSqft * plot.sqft),
      median: Math.round(medianPerSqft * plot.sqft),
      high: Math.round(highPerSqft * plot.sqft),
    })),
  };
}

export type BoqLine = {
  item_code: string;
  quantity: number;
  name?: string;
  unit?: string;
  price_kes?: number | null;
  price_source?: string | null;
  price_date?: string | null;
};

export type BoqCosting = {
  lines: Array<BoqLine & { lineTotal: number | null }>;
  pricedLines: number;
  totalLines: number;
  pricedShare: number;
  /** Null unless at least MIN_PRICED_SHARE of lines carry a price. */
  total: number | null;
};

/**
 * Cost a bill of quantities. Lines without a price stay greyed out; the
 * total is reported only when at least 90% of lines are priced.
 */
export function costBoq(lines: BoqLine[]): BoqCosting {
  const costed = lines.map((l) => {
    const priced = l.price_kes != null && Number.isFinite(l.price_kes) && l.price_kes > 0;
    return { ...l, lineTotal: priced ? Math.round(l.quantity * (l.price_kes as number)) : null };
  });
  const pricedLines = costed.filter((l) => l.lineTotal != null).length;
  const pricedShare = lines.length ? pricedLines / lines.length : 0;
  const total =
    pricedShare >= MIN_PRICED_SHARE
      ? costed.reduce((sum, l) => sum + (l.lineTotal ?? 0), 0)
      : null;
  return { lines: costed, pricedLines, totalLines: lines.length, pricedShare, total };
}

export type BudgetOption = {
  ward: string;
  sub_county: string | null;
  county: string;
  landMedian: number;
  landObservations: number;
  buildTotal: number;
  combined: number;
  margin: number;
};

/**
 * Deterministic budget ranking: wards where median land (chosen plot size)
 * plus the computed build cost fit the budget, cheapest combined first.
 * No AI-generated prices; ties break alphabetically for stable output.
 */
export function rankBudgetOptions(
  wards: Array<{
    ward: string;
    sub_county: string | null;
    county: string;
    landMedian: number;
    landObservations: number;
  }>,
  buildTotal: number,
  budget: number,
): BudgetOption[] {
  return wards
    .map((w) => {
      const combined = w.landMedian + buildTotal;
      return { ...w, buildTotal, combined, margin: budget - combined };
    })
    .filter((o) => o.combined <= budget)
    .sort(
      (a, b) =>
        a.combined - b.combined ||
        a.county.localeCompare(b.county) ||
        a.ward.localeCompare(b.ward),
    );
}

export function kes(n: number): string {
  return `KES ${Math.round(n).toLocaleString("en-KE")}`;
}
