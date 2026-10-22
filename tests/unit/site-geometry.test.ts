import { describe, expect, it } from "vitest";
import {
  measureSite, ringAreaSqM, ringPerimeterM, haversineM, pointInRing,
  normalizeRing, formatArea, SQM_PER_ACRE, type LngLat,
} from "@/lib/site-geometry";

const R = 6371007.181;
const D2R = Math.PI / 180;
const NAIROBI = { lat: -1.286389, lng: 36.817223 };

/** A rectangle of w x h metres centred on a point, via the local degree scale. */
function rect(centre: LngLat, w: number, h: number): LngLat[] {
  const mPerDegLat = R * D2R;
  const mPerDegLng = mPerDegLat * Math.cos(centre.lat * D2R);
  const dLat = h / 2 / mPerDegLat;
  const dLng = w / 2 / mPerDegLng;
  return [
    { lat: centre.lat - dLat, lng: centre.lng - dLng },
    { lat: centre.lat - dLat, lng: centre.lng + dLng },
    { lat: centre.lat + dLat, lng: centre.lng + dLng },
    { lat: centre.lat + dLat, lng: centre.lng - dLng },
  ];
}

/** Spherical law of cosines — a different formula from the haversine under test. */
function lawOfCosinesM(a: LngLat, b: LngLat): number {
  const p1 = a.lat * D2R;
  const p2 = b.lat * D2R;
  const dl = (b.lng - a.lng) * D2R;
  return (
    Math.acos(Math.min(1, Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl))) * R
  );
}

describe("geodesic distance", () => {
  it("agrees with an independent law-of-cosines implementation", () => {
    const mombasa = { lat: -4.043477, lng: 39.668206 };
    expect(haversineM(NAIROBI, mombasa)!).toBeCloseTo(lawOfCosinesM(NAIROBI, mombasa), 0);
  });

  it("puts Nairobi about 440 km from Mombasa", () => {
    const km = haversineM(NAIROBI, { lat: -4.043477, lng: 39.668206 })! / 1000;
    expect(km).toBeGreaterThan(430);
    expect(km).toBeLessThan(450);
  });
});

describe("area of a drawn ring", () => {
  // Plot sizes a Kenyan buyer actually sees, checked against planar area.
  it.each([
    ["one acre", 63.6149, 63.6149, 4046.86],
    ["50 x 100 ft plot", 15.24, 30.48, 464.52],
    ["eighth of an acre", 22.49, 22.49, 505.8],
    ["one square kilometre", 1000, 1000, 1_000_000],
  ])("measures %s", (_label, w, h, expected) => {
    expect(ringAreaSqM(rect(NAIROBI, w, h))!).toBeCloseTo(expected, -1);
  });

  it("reads one acre as 1.00 acres", () => {
    const acres = ringAreaSqM(rect(NAIROBI, 63.6149, 63.6149))! / SQM_PER_ACRE;
    expect(acres).toBeCloseTo(1, 2);
  });

  it("is positive whichever way the ring is wound", () => {
    const ring = rect(NAIROBI, 100, 100);
    expect(ringAreaSqM([...ring].reverse())!).toBeCloseTo(ringAreaSqM(ring)!, 3);
  });

  it("treats a closed ring and an open one as the same shape", () => {
    const ring = rect(NAIROBI, 100, 100);
    expect(ringAreaSqM([...ring, ring[0]])).toBe(ringAreaSqM(ring));
    expect(normalizeRing([...ring, ring[0]])).toHaveLength(4);
  });
});

describe("perimeter and containment", () => {
  it("measures a 50 x 100 ft plot perimeter as 91.44 m", () => {
    expect(ringPerimeterM(rect(NAIROBI, 15.24, 30.48))!).toBeCloseTo(91.44, 1);
  });

  it("places points inside and outside correctly", () => {
    const plot = rect(NAIROBI, 100, 100);
    expect(pointInRing(NAIROBI, plot)).toBe(true);
    expect(pointInRing({ lat: NAIROBI.lat + 0.01, lng: NAIROBI.lng }, plot)).toBe(false);
  });
});

describe("a half-drawn or broken shape returns null, never a number", () => {
  it.each([
    ["an empty ring", []],
    ["a single point", [NAIROBI]],
    ["two points", [NAIROBI, { lat: -1.3, lng: 36.9 }]],
    ["a NaN coordinate", [NAIROBI, { lat: -1.3, lng: 36.9 }, { lat: NaN, lng: 5 }]],
    ["a latitude out of range", [NAIROBI, { lat: -1.3, lng: 36.9 }, { lat: 200, lng: 5 }]],
  ])("rejects %s", (_label, ring) => {
    expect(measureSite(ring as LngLat[])).toBeNull();
    expect(ringAreaSqM(ring as LngLat[])).toBeNull();
  });
});

describe("how the number is presented", () => {
  it("leads with square metres under a tenth of an acre", () => {
    expect(formatArea(300)).toMatch(/^300 m2/);
  });

  it("leads with acres above a tenth of an acre", () => {
    expect(formatArea(SQM_PER_ACRE)).toMatch(/^1\.00 acres/);
  });

  it("says so when there is no area", () => {
    expect(formatArea(0)).toBe("not available");
  });

  it("carries its provenance with the numbers, so a caller cannot drop it", () => {
    expect(measureSite(rect(NAIROBI, 100, 100))!.provenance).toContain("not a surveyed area");
  });
});
