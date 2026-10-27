import { describe, expect, it } from "vitest";
import {
  DEFAULT_BUILD_SELECTION,
  comparisonTotalText,
  isFixedSizeStructure,
  landPriceTiers,
  landScopeLabel,
  resolveLandPriceSummary,
  summarizeLandPrices,
  type LandPriceObservation,
} from "@/lib/cost-intel";

const row = (o: Partial<LandPriceObservation>): LandPriceObservation =>
  ({
    county: "Kajiado",
    sub_county: null,
    ward: null,
    plot_size_sqft: 5000,
    price_kes: 1_000_000,
    source_type: "listing",
    observed_date: "2026-09-01",
    include_in_median: true,
    ...o,
  }) as LandPriceObservation;

describe("land price fallback (1)", () => {
  it("county-only input yields a county tier", () => {
    expect(landPriceTiers({ county: "Kajiado" }).map((t) => t.scope)).toEqual(["county"]);
  });
  it("orders ward → sub-county → county", () => {
    expect(
      landPriceTiers({ county: "Kajiado", subCounty: "Kajiado East", ward: "Kitengela" }).map(
        (t) => t.scope,
      ),
    ).toEqual(["ward", "sub_county", "county"]);
  });
  it("falls back to county when ward and sub-county have fewer than 5", async () => {
    const s = await resolveLandPriceSummary(
      { county: "Kajiado", subCounty: "Kajiado East", ward: "Kitengela" },
      async (f) => (f.ward || f.sub_county ? [row({})] : Array.from({ length: 5 }, () => row({}))),
    );
    expect(s?.scope).toBe("county");
    expect(s?.observations).toBe(5);
  });
  it("county tier still applies the n≥5 and include_in_median rules", async () => {
    const rows = [...Array.from({ length: 4 }, () => row({})), row({ include_in_median: false })];
    expect(await resolveLandPriceSummary({ county: "Kajiado" }, async () => rows)).toBeNull();
  });

  it("requires include_in_median to be explicitly true", () => {
    const rows = [
      ...Array.from({ length: 4 }, () => row({ include_in_median: true })),
      row({ include_in_median: false }),
      row({ include_in_median: undefined }),
    ];
    expect(summarizeLandPrices(rows, "county")).toBeNull();

    const enough = [...rows, row({ include_in_median: true })];
    expect(summarizeLandPrices(enough, "county")?.observations).toBe(5);
  });
  it("labels all three scopes", () => {
    expect(["ward", "sub_county", "county"].map((s) => landScopeLabel(s as never))).toEqual([
      "ward",
      "sub-county",
      "county",
    ]);
  });
});

describe("floor-area override (3)", () => {
  it("containers are fixed-size, masonry is not", () => {
    expect(isFixedSizeStructure("container_20ft")).toBe(true);
    expect(isFixedSizeStructure("container_40ft")).toBe(true);
    expect(isFixedSizeStructure("masonry_stone")).toBe(false);
  });
});

describe("defaults and comparison (4)", () => {
  it("defaults to 3br masonry_stone basic", () => {
    expect(DEFAULT_BUILD_SELECTION).toEqual({
      typology: "3br",
      structure: "masonry_stone",
      finish: "basic",
    });
  });
  it("shows low–high only when totalHigh > total", () => {
    const f = (n: number) => String(n);
    expect(comparisonTotalText(100, 150, f)).toBe("100–150");
    expect(comparisonTotalText(100, 100, f)).toBe("100");
    expect(comparisonTotalText(100, null, f)).toBe("100");
  });
});
