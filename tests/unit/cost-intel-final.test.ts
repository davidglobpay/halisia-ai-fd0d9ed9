import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  budgetBuildFigure,
  cleanCsvRows,
  isPerDayRate,
  parseCsvRfc4180,
  wardLandOptions,
  type LandPriceObservation,
} from "@/lib/cost-intel";
import { validateCsvRow } from "@/lib/cost-intel.functions";
import { adminFromGeocodeResults } from "@/lib/reverse-geocode-admin";

const o = (ward: string | null, sub: string | null, price: number): LandPriceObservation => ({
  county: "Kajiado",
  sub_county: sub,
  ward,
  plot_size_sqft: 1000,
  price_kes: price,
  source_type: "listing",
  observed_date: new Date().toISOString().slice(0, 10),
  include_in_median: true,
});

describe("1. sub-county rows without ward values", () => {
  it("lists a ward-less sub-county once at sub-county scope", () => {
    const rows = [1, 2, 3, 4, 5].map((i) => o(null, "Isinya", i * 1000));
    const out = wardLandOptions(rows, "Kajiado", 1000);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      ward: "Isinya",
      sub_county: null,
      scope: "sub_county",
      landObservations: 5,
    });
  });
  it("does not double-list a sub-county already represented by ward rows", () => {
    const rows = [
      ...[1, 2, 3, 4, 5].map((i) => o("Kitengela", "Isinya", i * 1000)),
      ...[1, 2, 3, 4, 5].map((i) => o(null, "Isinya", i * 1000)),
    ];
    const out = wardLandOptions(rows, "Kajiado", 1000);
    expect(out.map((x) => x.ward)).toEqual(["Kitengela"]);
  });
  it("omits a ward-less sub-county under 5 observations", () => {
    const rows = [1, 2, 3, 4].map((i) => o(null, "Isinya", i * 1000));
    expect(wardLandOptions(rows, "Kajiado", 1000)).toEqual([]);
  });
  it.each([false, undefined])(
    "excludes include_in_median=%s from the ward-less sub-county gate",
    (include_in_median) => {
      const rows = [1, 2, 3, 4].map((i) => o(null, "Isinya", i * 1000));
      rows.push({ ...o(null, "Isinya", 100_000), include_in_median });
      expect(wardLandOptions(rows, "Kajiado", 1000)).toEqual([]);
    },
  );
});

describe("2. budget fits against the upper build figure", () => {
  it("prefers totalHigh", () => {
    expect(budgetBuildFigure({ total: 100, totalHigh: 150 })).toBe(150);
  });
  it("falls back to total, and stays null when unpriced", () => {
    expect(budgetBuildFigure({ total: 100, totalHigh: null })).toBe(100);
    expect(budgetBuildFigure({ total: null, totalHigh: null })).toBeNull();
  });
});

describe("3. labour rates must be per day", () => {
  it("accepts day and rejects m2/point units", () => {
    expect(isPerDayRate("day")).toBe(true);
    expect(isPerDayRate("m2")).toBe(false);
    expect(isPerDayRate("point")).toBe(false);
    expect(isPerDayRate(null)).toBe(false);
  });
});

describe("4. CSV import validation", () => {
  const land = {
    county: "Kajiado",
    plot_size_sqft: "5000",
    price_kes: "1000000",
    source_type: "listing",
    observed_date: "2026-09-01",
  };
  it("strips a leading UTF-8 BOM", () => {
    const rows = parseCsvRfc4180("\uFEFFcounty,price_kes\nKajiado,100\n");
    expect(Object.keys(rows[0])).toEqual(["county", "price_kes"]);
  });
  it("rejects non-finite optional numerics", () => {
    expect(validateCsvRow("land_price_obs", { ...land, lat: "abc" })).toMatch(/finite/);
    expect(validateCsvRow("land_price_obs", { ...land, lng: "Infinity" })).toMatch(/finite/);
  });
  it("rejects unknown boolean values", () => {
    expect(validateCsvRow("land_price_obs", { ...land, include_in_median: "maybe" })).toMatch(
      /yes\/no/,
    );
    expect(validateCsvRow("land_price_obs", { ...land, include_in_median: "No" })).toBeNull();
  });
  it("rejects inverted price and rate ranges", () => {
    const mat = {
      item_code: "C1",
      name: "Cement",
      unit: "bag",
      price_kes: "800",
      source_type: "quote",
      observed_date: "2026-09-01",
    };
    expect(validateCsvRow("material_price", { ...mat, price_kes_high: "700" })).toMatch(/high/);
    expect(
      validateCsvRow("material_price", { ...mat, price_kes_low: "900", price_kes_high: "850" }),
    ).toMatch(/high/);
    const rate = { trade: "mason", unit: "day", rate_kes: "1500", observed_date: "2026-09-01" };
    expect(validateCsvRow("labour_rate", { ...rate, rate_kes_high: "1200" })).toMatch(/high/);
    expect(validateCsvRow("labour_rate", { ...rate, rate_kes_high: "1800" })).toBeNull();
  });
  it("treats whitespace-only optional numeric and boolean fields as empty", () => {
    const row = { ...land, lat: "   ", include_in_median: "   " };
    expect(validateCsvRow("land_price_obs", row)).toBeNull();
    const cleaned = cleanCsvRows(
      [row],
      [...Object.keys(row)],
      ["plot_size_sqft", "price_kes", "lat"],
      ["include_in_median"],
    );
    expect(cleaned[0]).not.toHaveProperty("lat");
    expect(cleaned[0]).not.toHaveProperty("include_in_median");
  });
  it("valid rows import exactly as before", () => {
    expect(validateCsvRow("land_price_obs", land)).toBeNull();
    const cleaned = cleanCsvRows(
      [{ ...land, include_in_median: "yes" }],
      [...Object.keys(land), "include_in_median"],
      ["plot_size_sqft", "price_kes"],
      ["include_in_median"],
    );
    expect(cleaned[0]).toEqual({
      county: "Kajiado",
      plot_size_sqft: 5000,
      price_kes: 1000000,
      source_type: "listing",
      observed_date: "2026-09-01",
      include_in_median: true,
    });
  });
});

describe("5. one sub-county source (-1.560328, 36.938554)", () => {
  const c = (long_name: string, ...types: string[]) => ({ long_name, types });
  it("shows no sub-county when geocode results disagree", () => {
    const admin = adminFromGeocodeResults([
      {
        formatted_address: "Kajiado, East",
        address_components: [c("Kajiado East", "administrative_area_level_2")],
      },
      {
        formatted_address: "Kajiado Central",
        address_components: [c("Kajiado Central", "administrative_area_level_2")],
      },
    ]);
    expect(admin.subCounty).toBeNull();
  });
  it("keeps the sub-county when all results agree", () => {
    const admin = adminFromGeocodeResults([
      {
        formatted_address: "a",
        address_components: [c("Kajiado East", "administrative_area_level_2")],
      },
      {
        formatted_address: "b",
        address_components: [c("Kajiado East", "administrative_area_level_2")],
      },
    ]);
    expect(admin.subCounty).toBe("Kajiado East");
  });
});
