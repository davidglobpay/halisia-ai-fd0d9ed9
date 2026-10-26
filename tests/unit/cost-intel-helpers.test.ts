import { describe, expect, it } from "vitest";
import {
  cleanCsvRows,
  droppedCsvColumns,
  parseCsvRfc4180,
  wardLandOptions,
  type LandPriceObservation,
} from "@/lib/cost-intel";

const o = (
  ward: string | null,
  sub: string | null,
  price: number,
  extra: Partial<LandPriceObservation> = {},
): LandPriceObservation => ({
  county: "Kajiado",
  sub_county: sub,
  ward,
  plot_size_sqft: 1000,
  price_kes: price,
  source_type: "listing",
  observed_date: "2026-09-01",
  ...extra,
});

describe("CSV column dropping", () => {
  const allowed = ["county", "price_kes", "include_in_median"];

  it("lists unknown columns once, in first-seen order", () => {
    const rows = parseCsvRfc4180("county,junk,price_kes,notes\nKajiado,x,100,a\nKiambu,y,200,b\n");
    expect(droppedCsvColumns(rows, allowed)).toEqual(["junk", "notes"]);
  });

  it("returns [] when every column is allowed", () => {
    expect(droppedCsvColumns([{ county: "Kajiado", price_kes: "1" }], allowed)).toEqual([]);
  });

  it("strips dropped and empty columns and coerces numbers and booleans", () => {
    const rows = [{ county: "Kajiado", junk: "x", price_kes: "250", include_in_median: "No" }];
    expect(cleanCsvRows(rows, allowed, ["price_kes"], ["include_in_median"])).toEqual([
      { county: "Kajiado", price_kes: 250, include_in_median: false },
    ]);
    expect(
      cleanCsvRows(
        [{ county: "", price_kes: "5", include_in_median: "YES" }],
        allowed,
        ["price_kes"],
        ["include_in_median"],
      ),
    ).toEqual([{ price_kes: 5, include_in_median: true }]);
  });
});

describe("budget sub-county fallback decision", () => {
  it("uses the ward median when the ward has at least 5 observations", () => {
    const rows = [100, 200, 300, 400, 500].map((p) => o("Isinya", "Kajiado East", p * 1000));
    const [w] = wardLandOptions(rows, "Kajiado", 2000);
    expect(w).toMatchObject({ ward: "Isinya", scope: "ward", landObservations: 5 });
    expect(w.landMedian).toBe(600_000); // 300 KES/sqft × 2000 sqft
  });

  it("falls back to the sub-county median when the ward has 4 observations", () => {
    const rows = [
      ...[10, 20, 30, 40].map((p) => o("Kitengela", "Kajiado East", p * 1000)),
      ...[50, 60].map((p) => o("Isinya", "Kajiado East", p * 1000)),
    ];
    const kit = wardLandOptions(rows, "Kajiado", 1000).find((w) => w.ward === "Kitengela")!;
    expect(kit).toMatchObject({
      scope: "sub_county",
      sub_county: "Kajiado East",
      landObservations: 6,
    });
    expect(kit.landMedian).toBe(35_000); // median of 10..60 KES/sqft = 35
  });

  it("omits a ward when neither ward nor sub-county passes the gate", () => {
    const rows = [1, 2, 3].map((p) => o("Isinya", "Kajiado East", p * 1000));
    expect(wardLandOptions(rows, "Kajiado", 1000)).toEqual([]);
  });

  it("omits a thin ward with no sub-county", () => {
    expect(wardLandOptions([o("Isinya", null, 1000)], "Kajiado", 1000)).toEqual([]);
  });

  it("does not count index rows toward the gate", () => {
    const rows = [1, 2, 3, 4, 5].map((p) =>
      o("Isinya", "Kajiado East", p * 1000, { source_type: "index" }),
    );
    expect(wardLandOptions(rows, "Kajiado", 1000)).toEqual([]);
  });
});
