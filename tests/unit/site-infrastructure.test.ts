import { describe, expect, it } from "vitest";

import { parseOverpassBuildings, parseOverpassInfrastructure } from "@/lib/site-context";
import { describeBuilding } from "@/components/halisia/plot-planner/context-layers";

const geom = [
  { lat: -1.5, lon: 36.9 },
  { lat: -1.5005, lon: 36.9005 },
];

const json = {
  elements: [
    {
      type: "way",
      id: 1,
      tags: { building: "yes" },
      geometry: [...geom, { lat: -1.501, lon: 36.9 }],
    },
    { type: "way", id: 2, tags: { highway: "primary", name: "Kangundo Road" }, geometry: geom },
    { type: "way", id: 3, tags: { highway: "residential", lanes: "4" }, geometry: geom },
    { type: "way", id: 4, tags: { railway: "rail" }, geometry: geom },
    { type: "way", id: 5, tags: { power: "line" }, geometry: geom },
    { type: "way", id: 6, tags: { highway: "footway" }, geometry: geom },
    { type: "way", id: 7, tags: { highway: "construction" }, geometry: geom },
    { type: "way", id: 8, tags: { railway: "abandoned" }, geometry: geom },
    { type: "way", id: 9, tags: { highway: "primary" }, geometry: [geom[0]] },
  ],
};

describe("roads, railways and power lines from OpenStreetMap", () => {
  const lines = parseOverpassInfrastructure(json);

  it("keeps the kinds it can draw and skips the rest", () => {
    expect(lines.map((l) => l.id)).toEqual([2, 3, 4, 5, 6]);
  });

  it("classifies and sizes them", () => {
    const by = Object.fromEntries(lines.map((l) => [l.id, l]));
    expect(by[2]).toMatchObject({ kind: "major", widthM: 10, name: "Kangundo Road" });
    // Four lanes widen a residential street to 14 m.
    expect(by[3]).toMatchObject({ kind: "minor", widthM: 14 });
    expect(by[4].kind).toBe("rail");
    expect(by[5].kind).toBe("power");
    expect(by[6].kind).toBe("path");
  });

  it("does not let roads leak into the buildings", () => {
    expect(parseOverpassBuildings(json).map((b) => b.id)).toEqual([1]);
  });

  it("says plainly where a building's height came from", () => {
    const ring = [
      { x: 0, z: 0 },
      { x: 5, z: 0 },
      { x: 5, z: 5 },
    ];
    expect(describeBuilding({ id: 1, ring, heightM: 3, defaulted: true })).toMatch(
      /No height is recorded/,
    );
    expect(describeBuilding({ id: 2, ring, heightM: 12, defaulted: false })).toMatch(
      /about 12.0 m tall \(about 4 floors\)/,
    );
  });
});
