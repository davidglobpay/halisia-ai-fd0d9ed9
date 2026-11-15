import { describe, expect, it } from "vitest";
import {
  convexHull,
  describeMeasurement,
  footprintDims,
  measureBetween,
  polygonArea,
} from "@/lib/measure-3d";

const rect = (l: number, w: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    [-l / 2, -w / 2],
    [l / 2, -w / 2],
    [l / 2, w / 2],
    [-l / 2, w / 2],
  ].map(([x, z]) => ({ x: x * c - z * s + 100, z: x * s + z * c - 40 }));
};

describe("footprintDims", () => {
  it("measures a rotated rectangle's length, width and area", () => {
    const d = footprintDims(rect(12, 8, 30));
    expect(d.lengthM).toBeCloseTo(12, 1);
    expect(d.widthM).toBeCloseTo(8, 1);
    expect(d.areaM2).toBeCloseTo(96, 0);
  });
  it("uses the real outline area for an L-shape", () => {
    const L = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 4 },
      { x: 4, z: 4 },
      { x: 4, z: 10 },
      { x: 0, z: 10 },
    ];
    expect(polygonArea(L)).toBeCloseTo(64, 5);
    const d = footprintDims(L);
    expect(d.lengthM).toBeCloseTo(10, 1);
    expect(d.widthM).toBeCloseTo(10, 1);
    expect(convexHull(L).length).toBe(5);
  });
});

describe("measureBetween", () => {
  it("splits a measurement into across-the-ground and rise", () => {
    const m = measureBetween({ x: 0, y: 1, z: 0 }, { x: 30, y: 4, z: 40 });
    expect(m.horizontalM).toBeCloseTo(50, 5);
    expect(m.riseM).toBeCloseTo(3, 5);
    expect(m.directM).toBeCloseTo(Math.hypot(50, 3), 1);
    expect(m.slopePct).toBeCloseTo(6, 1);
    expect(describeMeasurement(m)).toContain("3.00 m higher");
  });
  it("gives no slope for a straight-up measurement", () => {
    const m = measureBetween({ x: 2, y: 0, z: 2 }, { x: 2, y: 9, z: 2 });
    expect(m.horizontalM).toBe(0);
    expect(m.slopePct).toBeNull();
  });
});
