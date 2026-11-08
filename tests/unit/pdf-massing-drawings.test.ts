import { describe, expect, it } from "vitest";

import { blockClearances, rayToRing } from "@/lib/pdf-massing-drawings";

const plot = [
  { x: -28, y: -15 },
  { x: 28, y: -15 },
  { x: 28, y: 20 },
  { x: -28, y: 20 },
];

describe("site plan clearances", () => {
  it("measures each side of the block square to the boundary", () => {
    const block = [
      { x: -12, y: -6 },
      { x: 12, y: -6 },
      { x: 12, y: 6 },
      { x: -12, y: 6 },
    ];
    expect(blockClearances(block, plot).map((c) => c.m)).toEqual([9, 16, 14, 16]);
  });

  it("finds the first boundary crossing along a ray, or none", () => {
    expect(rayToRing(plot, { x: 0, y: 0 }, { x: 1, y: 0 })?.d).toBeCloseTo(28);
    expect(rayToRing(plot, { x: 100, y: 0 }, { x: 1, y: 0 })).toBeNull();
  });
});
