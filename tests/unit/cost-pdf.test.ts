import { describe, expect, it } from "vitest";
import { buildCostPdf } from "@/lib/pdf-cost-estimate";
import { estimateCosts } from "@/lib/construction-cost";

describe("cost estimate PDF", () => {
  it("produces a valid non-empty PDF with all three walling systems", () => {
    const rows = estimateCosts({ grossM2: 240, storeys: 2, use: "residential", slopeAdjust: 1.05 });
    const doc = buildCostPdf({ title: "Test villa", grossM2: 240, storeys: 2, rows });
    const bytes = new Uint8Array(doc.output("arraybuffer"));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(2000);
    const text = doc.output();
    for (const s of ["masonry", "Precast", "EPS"]) expect(text).toContain(s);
  });
});
