import { describe, expect, it } from "vitest";
import { distanceMeters, gpsToLocal } from "@/lib/spatial";

const NAIROBI = { lat: -1.2921, lng: 36.8219 };

describe("distanceMeters (haversine)", () => {
  it("is zero for identical points", () => {
    expect(distanceMeters(NAIROBI, NAIROBI)).toBe(0);
  });

  it("is symmetric", () => {
    const a = { lat: -1.2921, lng: 36.8219 };
    const b = { lat: 0.5143, lng: 35.2698 }; // Eldoret-ish
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6);
  });

  it("measures one degree of latitude at ~110.6 km", () => {
    const d = distanceMeters(NAIROBI, { lat: NAIROBI.lat + 1, lng: NAIROBI.lng });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(111_500);
  });

  it("measures east-west distance at Kenyan latitude with cosine shrinkage", () => {
    // 1° of longitude at lat −1.2921° ≈ 111.17 km — strictly less than the
    // flat 111.32 km-per-degree estimate the old jitter math used.
    const d = distanceMeters(NAIROBI, { lat: NAIROBI.lat, lng: NAIROBI.lng + 1 });
    expect(d).toBeGreaterThan(110_500);
    expect(d).toBeLessThan(111_250);
    expect(d).toBeLessThan(111_320);
  });

  it("applies longitude cosine correction strongly at high latitudes", () => {
    // 1° of longitude at 60°N ≈ 55.8 km — half the flat estimate.
    const d = distanceMeters({ lat: 60, lng: 0 }, { lat: 60, lng: 1 });
    expect(d).toBeGreaterThan(55_000);
    expect(d).toBeLessThan(56_500);
  });

  it("measures metre-scale GPS jitter in metres, not degrees", () => {
    // 0.0001° latitude ≈ 11.1 m of jitter.
    const d = distanceMeters(NAIROBI, { lat: NAIROBI.lat + 0.0001, lng: NAIROBI.lng });
    expect(d).toBeGreaterThan(10);
    expect(d).toBeLessThan(12);
  });

  it("agrees with gpsToLocal for short on-site distances", () => {
    const beacon = { lat: -1.2919, lng: 36.8222 };
    const local = gpsToLocal(beacon, NAIROBI);
    const planar = Math.hypot(local.x, local.y);
    const great = distanceMeters(NAIROBI, beacon);
    // Within 1% over ~40 m — planar and great-circle agree on site scale.
    expect(Math.abs(planar - great) / great).toBeLessThan(0.01);
  });
});
