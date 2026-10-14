import { describe, expect, it } from "vitest";
import { estimateCosts, CONCEPT_USE } from "@/lib/construction-cost";
import { buildCostPdf } from "@/lib/pdf-cost-estimate";
import { STUDIO_CONCEPTS } from "@/components/halisia/design-studio/catalog";

describe("construction cost estimator", () => {
  it("returns masonry, precast and EPS bands with low<=high", () => {
    const rows = estimateCosts({ grossM2: 200, storeys: 2, use: "residential" });
    expect(rows.map((r) => r.system)).toEqual(["masonry", "precast", "eps"]);
    for (const r of rows) {
      expect(r.rateLow).toBeGreaterThan(0);
      expect(r.totalLow).toBeLessThanOrEqual(r.totalHigh);
      expect(r.totalLow).toBe(r.rateLow * 200);
      expect(r.pros.length).toBeGreaterThan(0);
      expect(r.cons.length).toBeGreaterThan(0);
    }
  });
  it("covers every studio concept topology/use", () => {
    for (const c of STUDIO_CONCEPTS) expect(CONCEPT_USE[c.id]).toBeTruthy();
  });
  it("handles zero/invalid area without NaN", () => {
    const r = estimateCosts({ grossM2: Number.NaN, storeys: 0, use: "commercial" })[0];
    expect(r.totalHigh).toBe(0);
  });
  it("builds a nonempty valid PDF", () => {
    const rows = estimateCosts({ grossM2: 150, storeys: 1, use: "residential" });
    const out = buildCostPdf({ title: "Test", grossM2: 150, storeys: 1, rows }).output(
      "arraybuffer",
    );
    const head = new TextDecoder().decode(out.slice(0, 5));
    expect(head).toBe("%PDF-");
    expect(out.byteLength).toBeGreaterThan(2000);
  });
});
