import { describe, expect, it } from "vitest";
import {
  parseCsvRfc4180,
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
      {
        ward: "B Ward",
        sub_county: null,
        county: "Kiambu",
        landMedian: 900_000,
        landObservations: 7,
      },
      {
        ward: "A Ward",
        sub_county: null,
        county: "Kiambu",
        landMedian: 900_000,
        landObservations: 5,
      },
      {
        ward: "C Ward",
        sub_county: null,
        county: "Kiambu",
        landMedian: 2_000_000,
        landObservations: 9,
      },
      {
        ward: "D Ward",
        sub_county: null,
        county: "Kiambu",
        landMedian: 500_000,
        landObservations: 6,
      },
    ];
    const out = rankBudgetOptions(wards, 1_000_000, 2_000_000);
    expect(out.map((o) => o.ward)).toEqual(["D Ward", "A Ward", "B Ward"]);
    expect(out[0].margin).toBe(500_000);
    // C Ward (3.0M combined) is over budget and excluded.
    expect(out.find((o) => o.ward === "C Ward")).toBeUndefined();
  });
});

describe("labour in build cost (fix 1)", () => {
  it("adds labour lines to the total and counts them in the 90% gate", () => {
    const c = costBoq([
      { item_code: "cement", quantity: 100, kind: "material", price_kes: 800 },
      { item_code: "labour:fundis", quantity: 20, kind: "labour", price_kes: 1500 },
    ]);
    expect(c.total).toBe(100 * 800 + 20 * 1500);
    expect(c.pricedShare).toBe(1);
  });
  it("an unpriced labour line can push the BoQ below 90% and null the total", () => {
    // 8 priced materials + 1 priced labour + 1 unpriced labour = 90% priced.
    const lines = [
      ...Array.from({ length: 8 }, (_, i) => ({
        item_code: `m${i}`,
        quantity: 1,
        kind: "material" as const,
        price_kes: 100,
      })),
      { item_code: "labour:a", quantity: 5, kind: "labour" as const, price_kes: 1000 },
      { item_code: "labour:b", quantity: 5, kind: "labour" as const, price_kes: null },
    ];
    const c = costBoq(lines);
    expect(c.pricedShare).toBe(0.9);
    expect(c.total).toBe(8 * 100 + 5 * 1000);
    // Remove one priced line: 8/10 = 80% < 90%, total withheld.
    const c2 = costBoq(lines.slice(1));
    expect(c2.total).toBeNull();
  });
  it("ranged prices produce low–high totals", () => {
    const c = costBoq([
      { item_code: "steel", quantity: 10, price_kes: 900, price_kes_high: 1100 },
      { item_code: "labour:x", quantity: 2, kind: "labour", price_kes: 1200, price_kes_high: 1500 },
    ]);
    expect(c.total).toBe(10 * 900 + 2 * 1200);
    expect(c.totalHigh).toBe(10 * 1100 + 2 * 1500);
  });
});

describe("median source filter (fix 3)", () => {
  it("excludes index rows from the median and reports them as a cross-check", () => {
    const rows = [
      ...Array.from({ length: 5 }, () => obs(1_000_000, 5000)), // listing, 200/sqft
      { ...obs(20_000_000, 5000), source_type: "index" }, // 4000/sqft index outlier
    ];
    const s = summarizeLandPrices(rows, "ward");
    expect(s).not.toBeNull();
    expect(s!.medianPerSqft).toBe(200);
    expect(s!.observations).toBe(5);
    expect(s!.indexMedianPerSqft).toBe(4000);
    expect(s!.indexObservations).toBe(1);
  });
  it("excludes include_in_median=false rows", () => {
    const rows = [
      ...Array.from({ length: 4 }, () => obs(1_000_000, 5000)),
      { ...obs(1_000_000, 5000), include_in_median: false },
    ];
    expect(summarizeLandPrices(rows, "ward")).toBeNull();
  });
  it("index rows alone never produce a median", () => {
    const rows = Array.from({ length: 8 }, () => ({ ...obs(1_000_000, 5000), source_type: "index" }));
    expect(summarizeLandPrices(rows, "ward")).toBeNull();
  });
});

describe("RFC-4180 CSV parser (fix 5)", () => {
  it("parses quoted fields with commas and escaped quotes", () => {
    const rows = parseCsvRfc4180(
      'county,source_name,price_kes\r\n"Nairobi, Westlands","He said ""hi""",500000\n"Kajiado","Plain",250000',
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].county).toBe("Nairobi, Westlands");
    expect(rows[0].source_name).toBe('He said "hi"');
    expect(rows[1].county).toBe("Kajiado");
  });
  it("handles CRLF, trailing newline and empty lines", () => {
    const rows = parseCsvRfc4180("a,b\r\n1,2\r\n\r\n3,4\r\n");
    expect(rows).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });
  it("returns [] for header-only input", () => {
    expect(parseCsvRfc4180("a,b,c")).toEqual([]);
  });
});

describe("budget sub-county fallback (fix 6)", () => {
  it("keeps the scope label through ranking", () => {
    const wards = [
      { ward: "WardWithData", sub_county: "X", county: "Kajiado", scope: "ward" as const, landMedian: 800_000, landObservations: 6 },
      { ward: "SparseWard", sub_county: "X", county: "Kajiado", scope: "sub_county" as const, landMedian: 850_000, landObservations: 9 },
    ];
    const out = rankBudgetOptions(wards, 1_000_000, 3_000_000);
    expect(out.map((o) => [o.ward, o.scope])).toEqual([
      ["WardWithData", "ward"],
      ["SparseWard", "sub_county"],
    ]);
  });
});
