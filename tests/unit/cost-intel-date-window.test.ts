import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  MIN_LAND_OBSERVATIONS,
  isWithinObservationWindow,
  observationWindow,
  parseIsoDateUtc,
  resolveLandPriceSummary,
  summarizeLandPrices,
  wardLandOptions,
  type LandPriceObservation,
} from "@/lib/cost-intel";
import { validateCsvRow } from "@/lib/cost-intel.functions";

/** Fixed reference instant: no test depends on the real clock. */
const AS_OF = new Date("2026-10-27T12:00:00Z");
const opts = { asOf: AS_OF };

const obs = (date: string, o: Partial<LandPriceObservation> = {}): LandPriceObservation => ({
  county: "Kajiado",
  sub_county: "Kajiado East",
  ward: "Kitengela",
  plot_size_sqft: 5000,
  price_kes: 1_000_000,
  source_type: "listing",
  observed_date: date,
  include_in_median: true,
  ...o,
});
const recent = (n: number, o: Partial<LandPriceObservation> = {}) =>
  Array.from({ length: n }, () => obs("2026-09-01", o));

describe("observation window", () => {
  it("is the inclusive 12-month window ending on the reference date", () => {
    expect(observationWindow(AS_OF)).toEqual({ start: "2025-10-27", end: "2026-10-27" });
  });
  it("clamps month-end days (29 Feb → 28 Feb)", () => {
    expect(observationWindow(new Date("2028-02-29T00:00:00Z")).start).toBe("2027-02-28");
  });
  it("includes the exact start boundary and today", () => {
    expect(isWithinObservationWindow("2025-10-27", AS_OF)).toBe(true);
    expect(isWithinObservationWindow("2026-10-27", AS_OF)).toBe(true);
  });
  it("excludes one day outside the boundary", () => {
    expect(isWithinObservationWindow("2025-10-26", AS_OF)).toBe(false);
  });
  it("excludes future dates", () => {
    expect(isWithinObservationWindow("2026-10-28", AS_OF)).toBe(false);
    expect(isWithinObservationWindow("2099-01-01", AS_OF)).toBe(false);
  });
  it.each(["", "   ", "2026-13-01", "2026-02-30", "27/10/2026", "2026-9-1", null, undefined])(
    "rejects malformed or empty date %s",
    (d) => {
      expect(parseIsoDateUtc(d)).toBeNull();
      expect(isWithinObservationWindow(d, AS_OF)).toBe(false);
    },
  );
});

describe("summarizeLandPrices with a reference date", () => {
  it("accepts exactly five eligible recent observations", () => {
    const s = summarizeLandPrices(recent(MIN_LAND_OBSERVATIONS), "ward", opts);
    expect(s?.observations).toBe(5);
    expect(s?.medianPerSqft).toBe(200);
  });
  it("four eligible plus stale rows is insufficient", () => {
    const rows = [...recent(4), obs("2025-01-01"), obs("2024-06-30"), obs("2025-10-26")];
    expect(summarizeLandPrices(rows, "ward", opts)).toBeNull();
  });
  it("stale rows do not move the median or the newest date", () => {
    const rows = [...recent(5), obs("2024-01-01", { price_kes: 50_000_000 })];
    const s = summarizeLandPrices(rows, "ward", opts);
    expect(s?.observations).toBe(5);
    expect(s?.medianPerSqft).toBe(200);
    expect(s?.bands[0].high).toBe(1_000_000);
  });
  it("counts a row exactly on the 12-month boundary and drops one a day earlier", () => {
    expect(summarizeLandPrices([...recent(4), obs("2025-10-27")], "ward", opts)?.observations).toBe(
      5,
    );
    expect(summarizeLandPrices([...recent(4), obs("2025-10-26")], "ward", opts)).toBeNull();
  });
  it("future-dated rows never count or become the newest date", () => {
    expect(summarizeLandPrices([...recent(4), obs("2026-11-15")], "ward", opts)).toBeNull();
    const s = summarizeLandPrices([...recent(5), obs("2027-01-01")], "ward", opts);
    expect(s?.newestDate).toBe("2026-09-01");
  });
  it("invalid or empty dates never count, with or without a reference date", () => {
    const bad = [obs(""), obs("2026-02-30"), obs("not-a-date")];
    expect(summarizeLandPrices([...recent(4), ...bad], "ward", opts)).toBeNull();
    expect(summarizeLandPrices([...recent(4), ...bad], "ward")).toBeNull();
  });
  it("index rows alone never produce a primary median", () => {
    expect(summarizeLandPrices(recent(8, { source_type: "index" }), "ward", opts)).toBeNull();
  });
  it("index rows do not satisfy the primary minimum", () => {
    const rows = [...recent(4), ...recent(3, { source_type: "index" })];
    expect(summarizeLandPrices(rows, "ward", opts)).toBeNull();
  });
  it("stale index rows are excluded from the cross-check too", () => {
    const rows = [
      ...recent(5),
      obs("2026-08-01", { source_type: "index", price_kes: 2_000_000 }),
      obs("2023-01-01", { source_type: "index", price_kes: 9_000_000 }),
    ];
    const s = summarizeLandPrices(rows, "ward", opts);
    expect(s?.indexObservations).toBe(1);
    expect(s?.indexMedianPerSqft).toBe(400);
  });
  it("include_in_median false is excluded", () => {
    const rows = [...recent(4), obs("2026-09-01", { include_in_median: false })];
    expect(summarizeLandPrices(rows, "ward", opts)).toBeNull();
  });
  it.each([{ price_kes: 0 }, { price_kes: -5 }, { plot_size_sqft: 0 }, { price_kes: Number.NaN }])(
    "rejects invalid price or plot size %o",
    (bad) => {
      expect(summarizeLandPrices([...recent(4), obs("2026-09-01", bad)], "ward", opts)).toBeNull();
    },
  );
});

describe("fallback tiers and budget planner use the same window", () => {
  it("ward → sub-county → county skips tiers whose rows are stale", async () => {
    const s = await resolveLandPriceSummary(
      { county: "Kajiado", subCounty: "Kajiado East", ward: "Kitengela" },
      async (f) =>
        f.ward
          ? Array.from({ length: 6 }, () => obs("2024-01-01"))
          : f.sub_county
            ? [...recent(5)]
            : recent(9),
      opts,
    );
    expect(s?.scope).toBe("sub_county");
    expect(s?.observations).toBe(5);
  });
  it("returns null — never a fabricated price — when every tier lacks eligible data", async () => {
    const s = await resolveLandPriceSummary(
      { county: "Kajiado", subCounty: "Kajiado East", ward: "Kitengela" },
      async () => [...recent(4), ...Array.from({ length: 10 }, () => obs("2023-05-05"))],
      opts,
    );
    expect(s).toBeNull();
  });
  it("budget planner: stale rows cannot lift a ward or sub-county over the gate", () => {
    const rows = [
      ...recent(4, { ward: null }),
      ...Array.from({ length: 5 }, () => obs("2024-02-02", { ward: null })),
    ];
    expect(wardLandOptions(rows, "Kajiado", 5000, opts)).toEqual([]);
    expect(
      wardLandOptions([...rows, obs("2026-10-01", { ward: null })], "Kajiado", 5000, opts),
    ).toHaveLength(1);
  });
});

describe("CSV import rejects unusable dates", () => {
  const land = {
    county: "Kajiado",
    plot_size_sqft: "5000",
    price_kes: "1000000",
    source_type: "listing",
    observed_date: "2026-09-01",
  };
  it("accepts today and past dates", () => {
    expect(validateCsvRow("land_price_obs", land, AS_OF)).toBeNull();
    expect(validateCsvRow("land_price_obs", { ...land, observed_date: "2026-10-27" }, AS_OF)).toBe(
      null,
    );
  });
  it("rejects future dates", () => {
    expect(
      validateCsvRow("land_price_obs", { ...land, observed_date: "2026-10-28" }, AS_OF),
    ).toMatch(/future/);
  });
  it("rejects impossible calendar dates", () => {
    expect(
      validateCsvRow("land_price_obs", { ...land, observed_date: "2026-02-30" }, AS_OF),
    ).toMatch(/real date/);
  });
});
