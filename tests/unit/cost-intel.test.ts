import { describe, expect, it } from "vitest";
import {
  MIN_LAND_OBSERVATIONS,
  PLOT_SIZES,
  SQFT_PER_ACRE,
  costBoq,
  median,
  rankBudgetOptions,
  summarizeLandPrices,
  type LandPriceObservation,
} from "@/lib/cost-intel";

const obs = (price: number, sqft: number, date = "2026-09-01"): LandPriceObservation => ({
  county: "Kajiado",
  sub_county: "Kajiado East",
  ward: "Kitengela",
  plot_size_sqft: sqft,
  price_kes: price,
  source_type: "listing",
  observed_date: date,
});

describe("unit conversion", () => {
  it("defines the standard Kenyan plot sizes in sqft", () => {
    expect(PLOT_SIZES.map((p) => p.sqft)).toEqual([5000, 5445, 10890, 21780, 43560]);
    expect(SQFT_PER_ACRE).toBe(43560);
    expect(PLOT_SIZES[1].sqft).toBe(SQFT_PER_ACRE / 8);
  });
  it("scales median per-sqft to plot bands", () => {
    // 5 observations at exactly KES 200/sqft on 5,000 sqft plots.
    const rows = Array.from({ length: 5 }, () => obs(1_000_000, 5000));
    const s = summarizeLandPrices(rows, "ward");
    expect(s).not.toBeNull();
    expect(s!.medianPerSqft).toBe(200);
    const eighth = s!.bands.find((b) => b.plot.key === "eighth-acre")!;
    expect(eighth.median).toBe(200 * 5445);
    const acre = s!.bands.find((b) => b.plot.key === "acre")!;
    expect(acre.median).toBe(200 * 43560);
  });
});

describe("median", () => {
  it("handles odd and even counts", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});

describe("n≥5 gate", () => {
  it("returns null below five observations", () => {
    const rows = Array.from({ length: MIN_LAND_OBSERVATIONS - 1 }, () => obs(1_000_000, 5000));
    expect(summarizeLandPrices(rows, "ward")).toBeNull();
  });
  it("returns a summary at exactly five observations", () => {
    const rows = Array.from({ length: MIN_LAND_OBSERVATIONS }, (_, i) =>
      obs((i + 1) * 1_000_000, 5000, `2026-0${i + 1}-15`),
    );
    const s = summarizeLandPrices(rows, "ward");
    expect(s).not.toBeNull();
    expect(s!.observations).toBe(5);
    expect(s!.newestDate).toBe("2026-05-15");
    expect(s!.sourceTypes).toEqual(["listing"]);
    // Median of 1..5 M on 5,000 sqft = 3,000,000.
    expect(s!.bands[0].median).toBe(3_000_000);
    expect(s!.bands[0].low).toBe(1_000_000);
    expect(s!.bands[0].high).toBe(5_000_000);
  });
  it("ignores non-positive or non-finite rows", () => {
    const rows = [
      ...Array.from({ length: 4 }, () => obs(1_000_000, 5000)),
      obs(0, 5000),
      obs(1_000_000, Number.NaN),
    ];
    expect(summarizeLandPrices(rows, "ward")).toBeNull();
  });
});

describe("90%-priced gate", () => {
  const line = (price: number | null) => ({
    item_code: "X",
    quantity: 10,
    price_kes: price,
  });
  it("reports a total when all lines are priced", () => {
    const c = costBoq([line(100), line(200)]);
    expect(c.pricedShare).toBe(1);
    expect(c.total).toBe(10 * 100 + 10 * 200);
  });
  it("withholds the total below 90% priced", () => {
    // 8 of 10 priced = 80% < 90%.
    const c = costBoq([...Array.from({ length: 8 }, () => line(100)), line(null), line(null)]);
    expect(c.pricedShare).toBe(0.8);
    expect(c.total).toBeNull();
    expect(c.lines.filter((l) => l.lineTotal == null)).toHaveLength(2);
  });
  it("reports the total at exactly 90% priced", () => {
    const c = costBoq([...Array.from({ length: 9 }, () => line(100)), line(null)]);
    expect(c.pricedShare).toBe(0.9);
    expect(c.total).toBe(9 * 10 * 100);
  });
  it("treats zero and negative prices as unpriced", () => {
    const c = costBoq([line(0), line(-5), ...Array.from({ length: 8 }, () => line(100))]);
    expect(c.pricedShare).toBe(0.8);
    expect(c.total).toBeNull();
  });
});

describe("budget ranking", () => {
  it("ranks wards by combined cost, excludes over-budget, breaks ties by name", () => {
    const wards = [
      { ward: "B Ward", sub_county: null, county: "Kiambu", landMedian: 900_000, landObservations: 7 },
      { ward: "A Ward", sub_county: null, county: "Kiambu", landMedian: 900_000, landObservations: 5 },
      { ward: "C Ward", sub_county: null, county: "Kiambu", landMedian: 2_000_000, landObservations: 9 },
      { ward: "D Ward", sub_county: null, county: "Kiambu", landMedian: 500_000, landObservations: 6 },
    ];
    const out = rankBudgetOptions(wards, 1_000_000, 2_000_000);
    expect(out.map((o) => o.ward)).toEqual(["D Ward", "A Ward", "B Ward"]);
    expect(out[0].margin).toBe(500_000);
    // C Ward (3.0M combined) is over budget and excluded.
    expect(out.find((o) => o.ward === "C Ward")).toBeUndefined();
  });
});
