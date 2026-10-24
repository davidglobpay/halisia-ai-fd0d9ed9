import { describe, expect, it } from "vitest";
import { robustRelief, reliefAgreesWithSlope, gridSpanM, median, mad } from "@/lib/terrain-relief";

/**
 * The Usenge grid, transcribed from page 5 of the 22 Oct 2026 export.
 * Usenge sits on the Lake Victoria shore; the lake surface is about 1135 m,
 * which is why seventeen of these cells cluster at 1131-1136.
 */
const USENGE = [
  [1135, 1131, 1131, 1132, 1162],
  [1133, 1131, 1135, 1163, 1164],
  [1133, 1143, 1144, 1151, 1132],
  [1133, 1198, 1133, 1136, 1134],
  [1133, 1133, 1133, 1133, 1164],
];

const flat = (v: number, n = 5) =>
  Array.from({ length: n }, () => Array.from({ length: n }, () => v));

/** A real, uniform gradient: 4 m per cell across the grid. */
const ramp = Array.from({ length: 5 }, (_, r) =>
  Array.from({ length: 5 }, (_, c) => 1000 + c * 4 + r * 0),
);

describe("the Usenge regression", () => {
  const r = robustRelief(USENGE);

  it("does not report the raw 67 m range", () => {
    expect(r.rawMaxM - r.rawMinM).toBe(67);
    expect(r.reliefM).not.toBe(67);
  });

  it("rejects the 1198 m cell as a raster spike", () => {
    expect(r.outliers.map((o) => o.value)).toContain(1198);
  });

  it("keeps the north-east rise, which is real terrain", () => {
    // 1162/1163/1164 agree with each other, so they are a slope, not noise.
    const rejected = r.outliers.map((o) => `${o.row},${o.col}`);
    expect(rejected).not.toContain("0,4");
    expect(rejected).not.toContain("1,3");
    expect(rejected).not.toContain("1,4");
  });

  it("reports a relief consistent with the measured slope", () => {
    expect(r.usable).toBe(true);
    expect(r.reliefM).toBe(33);
  });

  it("still exposes the raw range so nothing is hidden", () => {
    expect(r.rawMinM).toBe(1131);
    expect(r.rawMaxM).toBe(1198);
    expect(r.note).toContain("1131-1198");
  });

  it("puts the median at the lakeshore cluster", () => {
    expect(r.medianM).toBe(1133);
  });
});

describe("real terrain is never erased", () => {
  it("rejects nothing on a uniform gradient", () => {
    const r = robustRelief(ramp);
    expect(r.outliers).toHaveLength(0);
    expect(r.reliefM).toBe(16);
    expect(r.note).toContain("no sample rejected");
  });

  it("rejects nothing on a genuine escarpment", () => {
    // Half the grid 80 m above the other half, as a coherent block.
    const scarp = Array.from({ length: 5 }, (_, r) =>
      Array.from({ length: 5 }, (_, c) => (c < 2 ? 1000 : 1080)),
    );
    const r = robustRelief(scarp);
    expect(r.outliers).toHaveLength(0);
    expect(r.reliefM).toBe(80);
  });

  it("rejects nothing on flat ground", () => {
    const r = robustRelief(flat(1133));
    expect(r.outliers).toHaveLength(0);
    expect(r.reliefM).toBe(0);
  });

  it("keeps a STEEP uniform gradient — steepness is not noise", () => {
    // 40 m per cell is about 3.6% over 1.1 km spacing: ordinary hill country,
    // and every step is far above the 25 m spike floor. It survives because a
    // spike is judged against its nearest neighbour, not against a threshold.
    const steep = Array.from({ length: 5 }, (_, r) =>
      Array.from({ length: 5 }, (_, c) => 1000 + c * 40 + r * 0),
    );
    const r = robustRelief(steep);
    expect(r.outliers).toHaveLength(0);
    expect(r.reliefM).toBe(160);
    expect(r.usable).toBe(true);
  });

  it("keeps small undulations well under the spike floor", () => {
    const bumpy = Array.from({ length: 5 }, (_, r) =>
      Array.from({ length: 5 }, (_, c) => 1100 + ((r * 5 + c) % 7) * 3),
    );
    expect(robustRelief(bumpy).outliers).toHaveLength(0);
  });
});

describe("a grid that is mostly noise is refused, not cleaned", () => {
  it("refuses a badly corrupted tile: six isolated spikes on a flat field", () => {
    // 24% of cells, each disagreeing with every neighbour. Past that share
    // there is no terrain signal left to describe, so no figure is published.
    const corrupt = flat(1133).map((row) => [...row]);
    const spikes: Array<[number, number, number]> = [
      [0, 0, 1200],
      [0, 2, 1210],
      [0, 4, 1190],
      [2, 0, 1205],
      [2, 2, 1195],
      [2, 4, 1215],
    ];
    for (const [r0, c0, v] of spikes) corrupt[r0][c0] = v;
    const r = robustRelief(corrupt);
    expect(r.outliers.length).toBeGreaterThan(5);
    expect(r.usable).toBe(false);
    expect(r.reliefM).toBeNull();
    expect(r.note).toContain("No relief figure is reported");
  });

  it("refuses a grid with too few samples", () => {
    const r = robustRelief([[1000, 1001]]);
    expect(r.usable).toBe(false);
    expect(r.reliefM).toBeNull();
  });

  it("always carries a note, even when refusing", () => {
    expect(robustRelief([[1]]).note.length).toBeGreaterThan(0);
  });

  it("ignores non-finite samples rather than treating them as zero", () => {
    const holed = flat(1133).map((row) => [...row]);
    holed[2][2] = Number.NaN;
    const r = robustRelief(holed);
    expect(r.usable).toBe(true);
    expect(r.reliefM).toBe(0);
    expect(r.rawMinM).toBe(1133);
  });
});

describe("relief is checked against the slope on the same grid", () => {
  const span = gridSpanM(5, 0.01, -0.065);

  it("computes the Usenge grid span", () => {
    expect(Math.round(span)).toBe(4423);
  });

  it("flags the published 67 m as inconsistent with 0.4% slope", () => {
    const c = reliefAgreesWithSlope(67, 0.4, span);
    expect(c.agrees).toBe(false);
    expect(Math.round(c.impliedReliefM)).toBe(18);
    expect(c.ratio).toBeGreaterThan(3);
  });

  it("accepts the robust 33 m against the same slope", () => {
    expect(reliefAgreesWithSlope(33, 0.4, span).agrees).toBe(true);
  });

  it("accepts a steep site whose relief matches its gradient", () => {
    expect(reliefAgreesWithSlope(210, 5, span).agrees).toBe(true);
  });

  it("does not divide by zero on perfectly flat ground", () => {
    const c = reliefAgreesWithSlope(0, 0, span);
    expect(Number.isFinite(c.ratio)).toBe(true);
    expect(c.agrees).toBe(true);
  });
});

describe("statistics helpers", () => {
  it("takes the median of an odd count", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("takes the median of an even count", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("returns NaN for an empty median", () => {
    expect(Number.isNaN(median([]))).toBe(true);
  });
  it("computes a MAD a single wild value cannot move", () => {
    expect(mad([10, 10, 10, 10, 9999])).toBe(0);
  });
  it("shrinks the grid span away from the equator", () => {
    expect(gridSpanM(5, 0.01, 60)).toBeLessThan(gridSpanM(5, 0.01, 0));
  });
});
