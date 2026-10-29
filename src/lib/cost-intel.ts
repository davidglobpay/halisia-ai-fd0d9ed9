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

/** Source types that feed the median. Index rows are cross-checks only. */
export const MEDIAN_SOURCE_TYPES = ["listing", "user_report", "agent"] as const;

export type LandPriceObservation = {
  county: string;
  sub_county: string | null;
  ward: string | null;
  plot_size_sqft: number;
  price_kes: number;
  source_type: string;
  observed_date: string;
  include_in_median?: boolean;
};

export type PlotPriceBand = {
  plot: PlotSize;
  low: number;
  median: number;
  high: number;
};

export type LandPriceScope = "ward" | "sub_county" | "county";

export type LandPriceSummary = {
  scope: LandPriceScope;
  observations: number;
  newestDate: string;
  sourceTypes: string[];
  medianPerSqft: number;
  bands: PlotPriceBand[];
  /** Median per sqft of source_type 'index' rows, shown as a cross-check. */
  indexMedianPerSqft: number | null;
  indexObservations: number;
};

export function median(values: number[]): number {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Median price per sqft from observations, expanded to the standard plot
 * sizes. Only listing / user_report / agent rows with include_in_median
 * true feed the median; index rows are returned separately as a cross-check.
 * Returns null when fewer than MIN_LAND_OBSERVATIONS qualifying rows exist —
 * the caller must show "Not enough priced data yet", never a fallback number.
 */
export function summarizeLandPrices(
  rows: LandPriceObservation[],
  scope: LandPriceScope,
): LandPriceSummary | null {
  const usable = rows.filter(
    (r) =>
      Number.isFinite(r.price_kes) &&
      Number.isFinite(r.plot_size_sqft) &&
      r.price_kes > 0 &&
      r.plot_size_sqft > 0,
  );
  const indexRows = usable.filter((r) => r.source_type === "index");
  const medianRows = usable.filter(
    (r) =>
      (MEDIAN_SOURCE_TYPES as readonly string[]).includes(r.source_type) &&
      r.include_in_median === true,
  );
  const indexMedianPerSqft = indexRows.length
    ? median(indexRows.map((r) => r.price_kes / r.plot_size_sqft))
    : null;
  if (medianRows.length < MIN_LAND_OBSERVATIONS) return null;
  const perSqft = medianRows.map((r) => r.price_kes / r.plot_size_sqft);
  const medianPerSqft = median(perSqft);
  const lowPerSqft = Math.min(...perSqft);
  const highPerSqft = Math.max(...perSqft);
  return {
    scope,
    observations: medianRows.length,
    newestDate:
      medianRows
        .map((r) => r.observed_date)
        .sort()
        .at(-1) ?? "",
    sourceTypes: [...new Set(medianRows.map((r) => r.source_type))].sort(),
    medianPerSqft,
    bands: PLOT_SIZES.map((plot) => ({
      plot,
      low: Math.round(lowPerSqft * plot.sqft),
      median: Math.round(medianPerSqft * plot.sqft),
      high: Math.round(highPerSqft * plot.sqft),
    })),
    indexMedianPerSqft,
    indexObservations: indexRows.length,
  };
}

export type BoqLine = {
  item_code: string;
  quantity: number;
  kind?: "material" | "labour";
  name?: string;
  unit?: string;
  quantity_basis?: string | null;
  price_kes?: number | null;
  price_kes_high?: number | null;
  price_source?: string | null;
  price_date?: string | null;
  /** County the price was observed in, as recorded (may be null). */
  price_county?: string | null;
};

export type BoqCosting = {
  lines: Array<BoqLine & { lineTotal: number | null; lineTotalHigh: number | null }>;
  pricedLines: number;
  totalLines: number;
  pricedShare: number;
  /** Null unless at least MIN_PRICED_SHARE of lines carry a price. */
  total: number | null;
  /** Upper end when lines carry price ranges; equals total otherwise. */
  totalHigh: number | null;
};

/**
 * Cost a bill of quantities (materials and labour lines). Lines without a
 * price stay greyed out; totals are reported only when at least 90% of lines
 * are priced. Ranged prices produce a low–high total.
 */
export function costBoq(lines: BoqLine[]): BoqCosting {
  const costed = lines.map((l) => {
    const priced = l.price_kes != null && Number.isFinite(l.price_kes) && l.price_kes > 0;
    const high =
      l.price_kes_high != null && Number.isFinite(l.price_kes_high) && l.price_kes_high > 0
        ? l.price_kes_high
        : l.price_kes;
    return {
      ...l,
      lineTotal: priced ? Math.round(l.quantity * (l.price_kes as number)) : null,
      lineTotalHigh: priced ? Math.round(l.quantity * (high as number)) : null,
    };
  });
  const pricedLines = costed.filter((l) => l.lineTotal != null).length;
  const pricedShare = lines.length ? pricedLines / lines.length : 0;
  const enough = pricedShare >= MIN_PRICED_SHARE;
  return {
    lines: costed,
    pricedLines,
    totalLines: lines.length,
    pricedShare,
    total: enough ? costed.reduce((sum, l) => sum + (l.lineTotal ?? 0), 0) : null,
    totalHigh: enough ? costed.reduce((sum, l) => sum + (l.lineTotalHigh ?? 0), 0) : null,
  };
}

export type BudgetOption = {
  ward: string;
  sub_county: string | null;
  county: string;
  scope: "ward" | "sub_county";
  landMedian: number;
  landObservations: number;
  buildTotal: number;
  combined: number;
  margin: number;
};

/**
 * Deterministic budget ranking: areas where median land (chosen plot size)
 * plus the computed build cost fit the budget, cheapest combined first.
 * No AI-generated prices; ties break alphabetically for stable output.
 */
export function rankBudgetOptions(
  wards: Array<{
    ward: string;
    sub_county: string | null;
    county: string;
    scope: "ward" | "sub_county";
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
        a.combined - b.combined || a.county.localeCompare(b.county) || a.ward.localeCompare(b.ward),
    );
}

export function kes(n: number): string {
  return `KES ${Math.round(n).toLocaleString("en-KE")}`;
}

/**
 * RFC-4180 CSV parser: quoted fields, embedded commas, escaped quotes (""),
 * and CRLF line endings. Returns rows keyed by the header line.
 */
export function parseCsvRfc4180(input: string): Array<Record<string, string>> {
  // Strip a leading UTF-8 BOM so the first header name matches its column.
  const csv = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let field = "",
    row: string[] = [],
    inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && csv[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim().length > 0));
  if (nonEmpty.length < 2) return [];
  const header = nonEmpty[0].map((h) => h.trim());
  return nonEmpty
    .slice(1)
    .map((cells) => Object.fromEntries(header.map((h, i) => [h, (cells[i] ?? "").trim()])));
}

/* ---------------- Pure decision helpers (extracted for tests) ---------------- */

export type WardLandOption = {
  ward: string;
  sub_county: string | null;
  county: string;
  scope: "ward" | "sub_county";
  landMedian: number;
  landObservations: number;
};

/**
 * Per-ward land medians for the budget planner. A ward meeting the n≥5 gate
 * uses its own median; otherwise it falls back to its sub-county median,
 * labelled scope "sub_county". Wards with neither are omitted.
 */
export function wardLandOptions(
  rows: LandPriceObservation[],
  county: string,
  plotSqft: number,
): WardLandOption[] {
  const byWard = new Map<string, LandPriceObservation[]>();
  const bySubCounty = new Map<string, LandPriceObservation[]>();
  for (const r of rows) {
    if (r.ward) {
      const list = byWard.get(r.ward) ?? [];
      list.push(r);
      byWard.set(r.ward, list);
    }
    if (r.sub_county) {
      const list = bySubCounty.get(r.sub_county) ?? [];
      list.push(r);
      bySubCounty.set(r.sub_county, list);
    }
  }
  const subCountySummary = new Map<string, LandPriceSummary>();
  for (const [sc, list] of bySubCounty) {
    const s = summarizeLandPrices(list, "sub_county");
    if (s) subCountySummary.set(sc, s);
  }
  const wardOptions = [...byWard.entries()].flatMap(([ward, list]): WardLandOption[] => {
    const wardSummary = summarizeLandPrices(list, "ward");
    const sub = list[0].sub_county;
    if (wardSummary) {
      return [
        {
          ward,
          sub_county: sub,
          county,
          scope: "ward",
          landMedian: Math.round(wardSummary.medianPerSqft * plotSqft),
          landObservations: wardSummary.observations,
        },
      ];
    }
    const sc = sub ? subCountySummary.get(sub) : undefined;
    if (!sub || !sc) return [];
    return [
      {
        ward,
        sub_county: sub,
        county,
        scope: "sub_county",
        landMedian: Math.round(sc.medianPerSqft * plotSqft),
        landObservations: sc.observations,
      },
    ];
  });
  // Sub-counties whose rows carry no ward at all are listed once at sub-county scope.
  const representedSubCounties = new Set(
    [...byWard.values()].flatMap((list) => list.map((r) => r.sub_county).filter(Boolean)),
  );
  const subCountyOnly: WardLandOption[] = [];
  for (const [sc, list] of bySubCounty) {
    if (representedSubCounties.has(sc) || list.some((r) => r.ward)) continue;
    const s = subCountySummary.get(sc);
    if (!s) continue;
    subCountyOnly.push({
      ward: sc,
      sub_county: null,
      county,
      scope: "sub_county",
      landMedian: Math.round(s.medianPerSqft * plotSqft),
      landObservations: s.observations,
    });
  }
  return [...wardOptions, ...subCountyOnly];
}

/** Columns in the parsed CSV that the target table does not have, first-seen order. */
export function droppedCsvColumns(
  rows: Array<Record<string, string>>,
  allowedColumns: readonly string[],
): string[] {
  const allowed = new Set(allowedColumns);
  return [...new Set(rows.flatMap((r) => Object.keys(r).filter((k) => !allowed.has(k))))];
}

/** Keep only allowed, non-empty columns; coerce numeric and boolean columns. */
export function cleanCsvRows(
  rows: Array<Record<string, string>>,
  allowedColumns: readonly string[],
  numericColumns: readonly string[],
  booleanColumns: readonly string[],
): Array<Record<string, unknown>> {
  const allowed = new Set(allowedColumns);
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      if (!allowed.has(k) || v.trim() === "") continue;
      if (numericColumns.includes(k)) out[k] = Number(v);
      else if (booleanColumns.includes(k)) out[k] = ["true", "yes", "1"].includes(v.toLowerCase());
      else out[k] = v;
    }
    return out;
  });
}

/** Budget planner fits conservatively against the upper priced build total. */
export function budgetBuildFigure(costing: Pick<BoqCosting, "total" | "totalHigh">): number | null {
  return costing.totalHigh ?? costing.total;
}

/** Only per-day labour rates may multiply BoQ labour days. */
export function isPerDayRate(unit: string | null | undefined): boolean {
  return unit?.trim().toLowerCase() === "day";
}

/** Ordered lookup tiers for a land price summary: ward → sub-county → county. */
export function landPriceTiers(input: {
  county: string;
  subCounty?: string;
  ward?: string;
}): { scope: LandPriceScope; filter: Record<string, string> }[] {
  const tiers: { scope: LandPriceScope; filter: Record<string, string> }[] = [];
  if (input.ward) tiers.push({ scope: "ward", filter: { county: input.county, ward: input.ward } });
  if (input.subCounty)
    tiers.push({
      scope: "sub_county",
      filter: { county: input.county, sub_county: input.subCounty },
    });
  if (input.county) tiers.push({ scope: "county", filter: { county: input.county } });
  return tiers;
}

/** First tier whose rows pass the n≥5 gate, or null. */
export async function resolveLandPriceSummary(
  input: { county: string; subCounty?: string; ward?: string },
  fetchRows: (filter: Record<string, string>) => Promise<LandPriceObservation[]>,
): Promise<LandPriceSummary | null> {
  for (const tier of landPriceTiers(input)) {
    const summary = summarizeLandPrices(await fetchRows(tier.filter), tier.scope);
    if (summary) return summary;
  }
  return null;
}

export function landScopeLabel(scope: LandPriceScope): string {
  return scope === "ward" ? "ward" : scope === "sub_county" ? "sub-county" : "county";
}

/** Provenance text: the row's county (or National when null) plus source label. */
export function provenanceLabel(county: string | null | undefined, sourceLabel: string): string {
  return `${county ? county : "National"} · ${sourceLabel}`;
}

/** Container units are fixed-size; their floor area cannot be overridden. */
export function isFixedSizeStructure(structure: string): boolean {
  return structure === "container_20ft" || structure === "container_40ft";
}

/** Default selection: the combination that has a BoQ. */
export const DEFAULT_BUILD_SELECTION = {
  typology: "3br",
  structure: "masonry_stone",
  finish: "basic",
} as const;

/** Comparison text: low–high when totalHigh exceeds total. */
export function comparisonTotalText(
  total: number,
  totalHigh: number | null | undefined,
  fmt: (n: number) => string,
): string {
  return totalHigh != null && totalHigh > total ? `${fmt(total)}–${fmt(totalHigh)}` : fmt(total);
}
