import { describe, expect, it } from "vitest";

import { tidyRingIndexes } from "@/lib/parcel-geometry";

const square = [
  { x: 0, y: 0 },
  { x: 40, y: 0 },
  { x: 40, y: 55 },
  { x: 0, y: 55 },
];

describe("tidyRingIndexes", () => {
  it("keeps a clean four-cornered plot as drawn", () => {
    expect(tidyRingIndexes(square)).toEqual([0, 1, 2, 3]);
  });

  it("merges a second tap on a corner (the 1.0 m and 0.3 m sides)", () => {
    const ring = [
      square[0],
      { x: 0.8, y: -0.6 },
      square[1],
      square[2],
      { x: 39.8, y: 55.2 },
      square[3],
    ];
    expect(tidyRingIndexes(ring)).toEqual([0, 2, 3, 5]);
  });

  it("drops a point nudged onto the middle of a side", () => {
    const ring = [square[0], { x: 20, y: 0.4 }, square[1], square[2], square[3]];
    expect(tidyRingIndexes(ring)).toEqual([0, 2, 3, 4]);
  });

  it("keeps a real inward corner", () => {
    const l = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 20 },
      { x: 15, y: 20 },
      { x: 15, y: 40 },
      { x: 0, y: 40 },
    ];
    expect(tidyRingIndexes(l)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("never goes below three corners", () => {
    const tiny = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 0, y: 0.5 },
    ];
    expect(tidyRingIndexes(tiny).length).toBeGreaterThanOrEqual(3);
  });
});
