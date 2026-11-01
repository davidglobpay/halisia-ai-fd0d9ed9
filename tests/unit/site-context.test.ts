import { describe, expect, it } from "vitest";
import {
  TERRAIN_GRID_N,
  buildingHeightM,
  buildingHeightSummary,
  heightAt,
  parseOverpassBuildings,
  terrainFromSamples,
  terrainGridPoints,
  toLocalMetres,
} from "@/lib/site-context";

const N = TERRAIN_GRID_N;

/** A plane rising 1 m per 10 m eastward around 1,600 m. */
function eastSlope(spanM: number) {
  const step = spanM / (N - 1);
  const out: number[] = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) out.push(1600 + (-spanM / 2 + c * step) / 10);
  return out;
}

describe("terrain grid", () => {
  it("places 100 points over the span, north row first", () => {
    const pts = terrainGridPoints(-1.5, 36.95, 360);
    expect(pts).toHaveLength(100);
    expect(pts[0].lat).toBeGreaterThan(pts[99].lat);
    expect(pts[0].lng).toBeLessThan(pts[9].lng);
    const sw = toLocalMetres(pts[90].lat, pts[90].lng, -1.5, 36.95);
    expect(Math.round(sw.x)).toBe(-180);
    expect(Math.round(sw.z)).toBe(180);
  });

  it("makes heights relative to the centre and reports relief", () => {
    const t = terrainFromSamples(eastSlope(360), 360)!;
    expect(t.centreElevationM).toBe(1600);
    expect(t.reliefM).toBe(36);
    expect(heightAt(t, 0, 0)).toBeCloseTo(0, 6);
    expect(heightAt(t, 100, 0)).toBeCloseTo(10, 6);
    expect(heightAt(t, -100, 50)).toBeCloseTo(-10, 6);
  });

  it("clamps outside the grid instead of extrapolating", () => {
    const t = terrainFromSamples(eastSlope(360), 360)!;
    expect(heightAt(t, 1000, 0)).toBeCloseTo(18, 6);
  });

  it("rejects missing, zero and spiky samples", () => {
    const good = eastSlope(360);
    expect(terrainFromSamples(good.slice(1), 360)).toBeNull();
    const zero = [...good];
    zero[5] = 0;
    expect(terrainFromSamples(zero, 360)).toBeNull();
    const spike = [...good];
    spike[40] = 2400;
    expect(terrainFromSamples(spike, 360)).toBeNull();
  });

  it("treats no terrain as flat ground", () => {
    expect(heightAt(null, 50, 50)).toBe(0);
  });
});

describe("building heights", () => {
  it("uses a recorded height, then levels, then a labelled default", () => {
    expect(buildingHeightM({ building: "yes", height: "12" })).toEqual({
      heightM: 12,
      source: "height",
    });
    expect(buildingHeightM({ height: "7.5 m" }).heightM).toBe(7.5);
    expect(buildingHeightM({ "building:levels": "4" })).toEqual({ heightM: 12, source: "levels" });
    expect(buildingHeightM({ building: "house" })).toEqual({ heightM: 3, source: "default" });
    expect(buildingHeightM({ height: "tall" }).source).toBe("default");
    expect(buildingHeightM({ height: "900" }).heightM).toBe(150);
  });
});

describe("Overpass buildings", () => {
  const way = (id: number, tags: Record<string, string>, pts: Array<[number, number]>) => ({
    type: "way",
    id,
    tags,
    geometry: pts.map(([lat, lon]) => ({ lat, lon })),
  });

  it("keeps building ways, drops the closing point and degenerate rings", () => {
    const res = parseOverpassBuildings({
      elements: [
        way(1, { building: "yes", "building:levels": "2" }, [
          [0, 0],
          [0, 1e-4],
          [1e-4, 1e-4],
          [0, 0],
        ]),
        way(2, { building: "yes" }, [
          [0, 0],
          [0, 1e-4],
        ]),
        way(3, { highway: "residential" }, [
          [0, 0],
          [0, 1],
          [1, 1],
        ]),
        { type: "node", id: 4 },
      ],
    });
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe(1);
    expect(res[0].ring).toHaveLength(3);
    expect(res[0].heightM).toBe(6);
    expect(buildingHeightSummary(res)).toEqual({ total: 1, recorded: 1, defaulted: 0 });
  });

  it("caps the number of buildings and survives an empty response", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      way(i, { building: "yes" }, [
        [0, 0],
        [0, 1e-4],
        [1e-4, 0],
      ]),
    );
    expect(parseOverpassBuildings({ elements: many }, 4)).toHaveLength(4);
    expect(parseOverpassBuildings(null)).toEqual([]);
  });
});
