import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  LAND_OBSERVATION_WINDOW_MONTHS,
  costBoq,
  rankBudgetOptions,
  summarizeLandPrices,
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
    .select("county, sub_county, ward, plot_size_sqft, price_kes, source_type, observed_date")
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
 * last 12 months, falling back to sub-county. Returns null when either scope
 * has fewer than 5 observations — the UI shows "Not enough priced data yet".
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

/**
 * BoQ for structure × typology × finish, costed with the latest material
 * price in the county (falling back to the latest national price) plus
 * labour rates. Lines without any price come back unpriced; the total is
 * null unless at least 90% of lines are priced.
 */
export const getBuildCost = createServerFn({ method: "GET" })
  .inputValidator(
    (input: { typology: string; structure: string; finish: string; county?: string }) => input,
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: template, error } = await sb
      .from("boq_template")
      .select("item_code, quantity, floor_area_m2")
      .eq("typology", data.typology)
      .eq("structure", data.structure)
      .eq("finish", data.finish);
    if (error) throw new Error(error.message);
    const floorArea = template?.[0]?.floor_area_m2 ?? null;
    if (!template?.length)
      return { lines: [] as BoqLine[], floorAreaM2: floorArea, costing: costBoq([]) };

    const codes = [...new Set(template.map((t) => t.item_code))];
    const { data: prices } = await sb
      .from("material_price")
      .select("item_code, name, unit, price_kes, county, source_type, observed_date")
      .in("item_code", codes)
      .order("observed_date", { ascending: false })
      .limit(2000);

    // Latest price per item: county match wins over the national fallback.
    const latest = new Map<
      string,
      { name: string; unit: string; price_kes: number; source: string; date: string }
    >();
    for (const p of prices ?? []) {
      const existing = latest.get(p.item_code);
      const countyMatch = data.county && p.county === data.county;
      if (!existing || (countyMatch && existing.source !== `county:${data.county}`)) {
        if (!existing || countyMatch || !latest.has(p.item_code))
          latest.set(p.item_code, {
            name: p.name,
            unit: p.unit,
            price_kes: p.price_kes,
            source: countyMatch ? `county:${data.county}` : "national",
            date: p.observed_date,
          });
      }
    }

    const lines: BoqLine[] = template.map((t) => {
      const price = latest.get(t.item_code);
      return {
        item_code: t.item_code,
        quantity: t.quantity,
        name: price?.name,
        unit: price?.unit,
        price_kes: price?.price_kes ?? null,
        price_source: price?.source ?? null,
        price_date: price?.date ?? null,
      };
    });
    return { lines, floorAreaM2: floorArea, costing: costBoq(lines) };
  });

/**
 * Budget planner: wards in the county whose median land price (chosen plot
 * size, last 12 months, n≥5) plus the computed build total fit the budget.
 * Deterministic ranking only; no AI-generated prices.
 */
export const getBudgetOptions = createServerFn({ method: "GET" })
  .inputValidator(
    (input: { county: string; budget: number; plotSqft: number; buildTotal: number }) => input,
  )
  .handler(async ({ data }) => {
    const rows = await fetchObservations({ county: data.county });
    const byWard = new Map<string, ObsRow[]>();
    for (const r of rows) {
      if (!r.ward) continue;
      const list = byWard.get(r.ward) ?? [];
      list.push(r);
      byWard.set(r.ward, list);
    }
    const wards = [...byWard.entries()].flatMap(([ward, list]) => {
      const summary = summarizeLandPrices(list, "ward");
      if (!summary) return [];
      const perSqft = summary.medianPerSqft;
      return [
        {
          ward,
          sub_county: list[0].sub_county,
          county: data.county,
          landMedian: Math.round(perSqft * data.plotSqft),
          landObservations: summary.observations,
        },
      ];
    });
    return rankBudgetOptions(wards, data.buildTotal, data.budget);
  });

/* ---------------- Admin CSV import ---------------- */

const CSV_TABLES = ["land_price_obs", "material_price", "boq_template", "labour_rate"] as const;
type CsvTable = (typeof CSV_TABLES)[number];

const REQUIRED_COLUMNS: Record<CsvTable, string[]> = {
  land_price_obs: ["county", "plot_size_sqft", "price_kes", "source_type", "observed_date"],
  material_price: ["item_code", "name", "unit", "price_kes", "source_type", "observed_date"],
  boq_template: ["typology", "structure", "finish", "floor_area_m2", "item_code", "quantity"],
  labour_rate: ["trade", "unit", "rate_kes", "observed_date"],
};

const SOURCE_TYPES: Record<string, string[]> = {
  land_price_obs: ["index", "listing", "user_report", "agent"],
  material_price: ["supplier_list", "quote", "receipt"],
};
const STRUCTURE_VALUES = [...STRUCTURES];
const FINISH_VALUES = [...FINISHES];

export function parseCsv(csv: string): Array<Record<string, string>> {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]));
  });
}

/** Validate one CSV row for a table; returns an error string or null. */
export function validateCsvRow(
  table: CsvTable,
  row: Record<string, string>,
): string | null {
  for (const col of REQUIRED_COLUMNS[table])
    if (!row[col]?.trim()) return `missing required column "${col}"`;
  const numeric: Record<CsvTable, string[]> = {
    land_price_obs: ["plot_size_sqft", "price_kes"],
    material_price: ["price_kes"],
    boq_template: ["floor_area_m2", "quantity"],
    labour_rate: ["rate_kes"],
  };
  for (const col of numeric[table])
    if (!(Number(row[col]) > 0)) return `"${col}" must be a positive number`;
  const allowed = SOURCE_TYPES[table];
  if (allowed && !allowed.includes(row.source_type))
    return `source_type must be one of ${allowed.join(", ")}`;
  if (table === "boq_template") {
    if (!STRUCTURE_VALUES.includes(row.structure)) return "unknown structure";
    if (!FINISH_VALUES.includes(row.finish)) return "unknown finish";
  }
  if (table !== "boq_template" && !/^\d{4}-\d{2}-\d{2}$/.test(row.observed_date))
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

    const rows = parseCsv(data.csv);
    if (!rows.length) throw new Error("No data rows found in the CSV");
    const errors: string[] = [];
    rows.forEach((row, i) => {
      const err = validateCsvRow(data.table, row);
      if (err) errors.push(`row ${i + 2}: ${err}`);
    });
    if (errors.length) return { inserted: 0, rejected: errors.length, errors: errors.slice(0, 20) };

    const cleaned = rows.map((r) =>
      Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === "" ? null : v])),
    );
    const { error } = await context.supabase.from(data.table).insert(cleaned as never);
    if (error) throw new Error(error.message);
    return { inserted: rows.length, rejected: 0, errors: [] as string[] };
  });
