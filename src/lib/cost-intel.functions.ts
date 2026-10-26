import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  LAND_OBSERVATION_WINDOW_MONTHS,
  cleanCsvRows,
  costBoq,
  droppedCsvColumns,
  parseCsvRfc4180,
  rankBudgetOptions,
  summarizeLandPrices,
  wardLandOptions,
  type BoqLine,
  type LandPriceObservation,
} from "@/lib/cost-intel";

/** Server publishable client for public read-only cost data (RLS: public SELECT). */
function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function windowStart(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - LAND_OBSERVATION_WINDOW_MONTHS);
  return d.toISOString().slice(0, 10);
}

type ObsRow = LandPriceObservation;

async function fetchObservations(filter: Record<string, string>): Promise<ObsRow[]> {
  let q = publicClient()
    .from("land_price_obs")
    .select(
      "county, sub_county, ward, plot_size_sqft, price_kes, source_type, observed_date, include_in_median",
    )
    .gte("observed_date", windowStart())
    .order("observed_date", { ascending: false })
    .limit(500);
  for (const [col, val] of Object.entries(filter)) q = q.eq(col, val);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ObsRow[];
}

/**
 * Land price summary for a location: ward-level median per sqft over the
 * last 12 months, falling back to sub-county. Only listing / user_report /
 * agent rows with include_in_median feed the median; index rows come back
 * separately as a cross-check. Returns null when either scope has fewer
 * than 5 qualifying observations — the UI shows "Not enough priced data yet".
 */
export const getLandPriceSummary = createServerFn({ method: "GET" })
  .inputValidator((input: { county: string; subCounty?: string; ward?: string }) => input)
  .handler(async ({ data }) => {
    if (data.ward) {
      const rows = await fetchObservations({ county: data.county, ward: data.ward });
      const summary = summarizeLandPrices(rows, "ward");
      if (summary) return summary;
    }
    if (data.subCounty) {
      const rows = await fetchObservations({ county: data.county, sub_county: data.subCounty });
      const summary = summarizeLandPrices(rows, "sub_county");
      if (summary) return summary;
    }
    return null;
  });

export const STRUCTURES = [
  "container_20ft",
  "container_40ft",
  "masonry_stone",
  "masonry_block",
  "precast",
  "eps",
] as const;
export const FINISHES = ["basic", "standard", "premium"] as const;
export const TYPOLOGIES = ["bedsitter", "1br", "2br", "3br", "4br", "5br", "6br"] as const;

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  supplier_list: "Supplier list",
  quote: "Quote",
  receipt: "Receipt",
  published_guide: "Published guide",
};

/**
 * BoQ for structure × typology × finish, costed with the latest material
 * price in the county (falling back to the latest national price) plus
 * labour (boq_labour days × latest labour rate, county then national).
 * Lines without any price come back unpriced; totals are null unless at
 * least 90% of lines are priced. Ranged prices yield low–high totals.
 */
export const getBuildCost = createServerFn({ method: "GET" })
  .inputValidator(
    (input: { typology: string; structure: string; finish: string; county?: string }) => input,
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: template, error } = await sb
      .from("boq_template")
      .select("item_code, quantity, floor_area_m2, quantity_basis")
      .eq("typology", data.typology)
      .eq("structure", data.structure)
      .eq("finish", data.finish);
    if (error) throw new Error(error.message);
    const floorArea = template?.[0]?.floor_area_m2 ?? null;

    const codes = [...new Set((template ?? []).map((t) => t.item_code))];
    const { data: prices } = codes.length
      ? await sb
          .from("material_price")
          .select(
            "item_code, name, unit, price_kes, price_kes_low, price_kes_high, county, source_type, observed_date, use_in_totals",
          )
          .in("item_code", codes)
          .order("observed_date", { ascending: false })
          .limit(2000)
      : { data: [] };

    // Latest usable price per item: county match wins over national fallback.
    const latest = new Map<
      string,
      {
        name: string;
        unit: string;
        price_kes: number;
        price_kes_high: number | null;
        source: string;
        date: string;
      }
    >();
    for (const p of prices ?? []) {
      if (p.use_in_totals === false) continue;
      const existing = latest.get(p.item_code);
      const countyMatch = data.county && p.county === data.county;
      if (!existing || (countyMatch && existing.source !== `county:${data.county}`)) {
        latest.set(p.item_code, {
          name: p.name,
          unit: p.unit,
          price_kes: p.price_kes_low ?? p.price_kes,
          price_kes_high: p.price_kes_high ?? null,
          source: countyMatch ? `county:${data.county}` : "national",
          date: p.observed_date,
        });
      }
    }

    const materialLines: BoqLine[] = (template ?? []).map((t) => {
      const price = latest.get(t.item_code);
      return {
        item_code: t.item_code,
        quantity: t.quantity,
        kind: "material",
        name: price?.name,
        unit: price?.unit,
        quantity_basis: t.quantity_basis,
        price_kes: price?.price_kes ?? null,
        price_kes_high: price?.price_kes_high ?? null,
        price_source: price?.source ?? null,
        price_date: price?.date ?? null,
      };
    });

    // Labour: boq_labour days × latest rate for the trade (county, then national).
    const { data: labourTemplate } = await sb
      .from("boq_labour")
      .select("trade, days")
      .eq("typology", data.typology)
      .eq("structure", data.structure)
      .eq("finish", data.finish);
    const trades = [...new Set((labourTemplate ?? []).map((l) => l.trade))];
    const { data: rates } = trades.length
      ? await sb
          .from("labour_rate")
          .select("trade, unit, rate_kes, rate_kes_high, county, source, observed_date")
          .in("trade", trades)
          .order("observed_date", { ascending: false })
          .limit(1000)
      : { data: [] };
    const latestRate = new Map<
      string,
      { unit: string; rate_kes: number; rate_kes_high: number | null; source: string; date: string }
    >();
    for (const r of rates ?? []) {
      const existing = latestRate.get(r.trade);
      const countyMatch = data.county && r.county === data.county;
      if (!existing || (countyMatch && existing.source !== `county:${data.county}`)) {
        latestRate.set(r.trade, {
          unit: r.unit,
          rate_kes: r.rate_kes,
          rate_kes_high: r.rate_kes_high ?? null,
          source: countyMatch ? `county:${data.county}` : "national",
          date: r.observed_date,
        });
      }
    }
    const labourLines: BoqLine[] = (labourTemplate ?? []).map((l) => {
      const rate = latestRate.get(l.trade);
      return {
        item_code: `labour:${l.trade}`,
        quantity: l.days,
        kind: "labour",
        name: `Labour — ${l.trade}`,
        unit: rate?.unit ?? "day",
        quantity_basis: "days",
        price_kes: rate?.rate_kes ?? null,
        price_kes_high: rate?.rate_kes_high ?? null,
        price_source: rate?.source ?? null,
        price_date: rate?.date ?? null,
      };
    });

    const lines = [...materialLines, ...labourLines];
    return { lines, floorAreaM2: floorArea, costing: costBoq(lines) };
  });

/**
 * Budget planner: wards in the county whose median land price (chosen plot
 * size, last 12 months, n≥5) plus the computed build total fit the budget.
 * A ward with fewer than 5 observations falls back to its sub-county median,
 * labelled by scope. Deterministic ranking only; no AI-generated prices.
 */
export const getBudgetOptions = createServerFn({ method: "GET" })
  .inputValidator(
    (input: { county: string; budget: number; plotSqft: number; buildTotal: number }) => input,
  )
  .handler(async ({ data }) => {
    const rows = await fetchObservations({ county: data.county });
    const wards = wardLandOptions(rows, data.county, data.plotSqft);
    return rankBudgetOptions(wards, data.buildTotal, data.budget);
  });

/* ---------------- Admin CSV import ---------------- */

const CSV_TABLES = [
  "land_price_obs",
  "material_price",
  "boq_template",
  "boq_labour",
  "labour_rate",
] as const;
type CsvTable = (typeof CSV_TABLES)[number];

/** Columns each table accepts; anything else in the CSV is dropped and reported. */
const TABLE_COLUMNS: Record<CsvTable, string[]> = {
  land_price_obs: [
    "county",
    "sub_county",
    "ward",
    "locality",
    "lat",
    "lng",
    "plot_size_sqft",
    "price_kes",
    "source_type",
    "source_name",
    "source_url",
    "observed_date",
    "include_in_median",
    "quality_note",
  ],
  material_price: [
    "item_code",
    "name",
    "unit",
    "category",
    "price_kes",
    "price_kes_low",
    "price_kes_high",
    "supplier",
    "county",
    "source_type",
    "source_url",
    "observed_date",
    "use_in_totals",
    "note",
  ],
  boq_template: [
    "typology",
    "structure",
    "finish",
    "floor_area_m2",
    "item_code",
    "quantity",
    "quantity_basis",
  ],
  boq_labour: ["typology", "structure", "finish", "trade", "days"],
  labour_rate: [
    "trade",
    "unit",
    "rate_kes",
    "rate_kes_high",
    "county",
    "source",
    "source_url",
    "observed_date",
    "note",
  ],
};

const REQUIRED_COLUMNS: Record<CsvTable, string[]> = {
  land_price_obs: ["county", "plot_size_sqft", "price_kes", "source_type", "observed_date"],
  material_price: ["item_code", "name", "unit", "price_kes", "source_type", "observed_date"],
  boq_template: ["typology", "structure", "finish", "floor_area_m2", "item_code", "quantity"],
  boq_labour: ["typology", "structure", "finish", "trade", "days"],
  labour_rate: ["trade", "unit", "rate_kes", "observed_date"],
};

const SOURCE_TYPES: Record<string, string[]> = {
  land_price_obs: ["index", "listing", "user_report", "agent"],
  material_price: ["supplier_list", "quote", "receipt", "published_guide"],
};
const STRUCTURE_VALUES: readonly string[] = [...STRUCTURES];
const FINISH_VALUES: readonly string[] = [...FINISHES];

const NUMERIC_COLUMNS: Record<CsvTable, string[]> = {
  land_price_obs: ["plot_size_sqft", "price_kes", "lat", "lng"],
  material_price: ["price_kes", "price_kes_low", "price_kes_high"],
  boq_template: ["floor_area_m2", "quantity"],
  boq_labour: ["days"],
  labour_rate: ["rate_kes", "rate_kes_high"],
};
const BOOLEAN_COLUMNS: Record<CsvTable, string[]> = {
  land_price_obs: ["include_in_median"],
  material_price: ["use_in_totals"],
  boq_template: [],
  boq_labour: [],
  labour_rate: [],
};

/** Validate one CSV row for a table; returns an error string or null. */
export function validateCsvRow(table: CsvTable, row: Record<string, string>): string | null {
  for (const col of REQUIRED_COLUMNS[table])
    if (!row[col]?.trim()) return `missing required column "${col}"`;
  for (const col of REQUIRED_COLUMNS[table].filter((c) => NUMERIC_COLUMNS[table].includes(c)))
    if (!(Number(row[col]) > 0)) return `"${col}" must be a positive number`;
  const allowed = SOURCE_TYPES[table];
  if (allowed && !allowed.includes(row.source_type))
    return `source_type must be one of ${allowed.join(", ")}`;
  if (table === "boq_template" || table === "boq_labour") {
    if (!STRUCTURE_VALUES.includes(row.structure)) return "unknown structure";
    if (!FINISH_VALUES.includes(row.finish)) return "unknown finish";
  }
  if (
    table !== "boq_template" &&
    table !== "boq_labour" &&
    !/^\d{4}-\d{2}-\d{2}$/.test(row.observed_date)
  )
    return "observed_date must be YYYY-MM-DD";
  return null;
}

export const importCostCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { table: CsvTable; csv: string }) => input)
  .handler(async ({ data, context }) => {
    if (!CSV_TABLES.includes(data.table)) throw new Error("Unknown cost table");
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "administrator",
    });
    if (!isAdmin) throw new Error("Forbidden: administrator role required");

    const rows = parseCsvRfc4180(data.csv);
    if (!rows.length) throw new Error("No data rows found in the CSV");
    const errors: string[] = [];
    rows.forEach((row, i) => {
      const err = validateCsvRow(data.table, row);
      if (err) errors.push(`row ${i + 2}: ${err}`);
    });
    if (errors.length)
      return {
        inserted: 0,
        rejected: errors.length,
        errors: errors.slice(0, 20),
        droppedColumns: [] as string[],
      };

    // Drop columns the table does not have, and say so in the result.
    const droppedColumns = droppedCsvColumns(rows, TABLE_COLUMNS[data.table]);
    const cleaned = cleanCsvRows(
      rows,
      TABLE_COLUMNS[data.table],
      NUMERIC_COLUMNS[data.table],
      BOOLEAN_COLUMNS[data.table],
    );
    const { error } = await context.supabase.from(data.table).insert(cleaned as never);
    if (error) throw new Error(error.message);
    return { inserted: rows.length, rejected: 0, errors: [] as string[], droppedColumns };
  });
