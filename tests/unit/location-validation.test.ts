import { describe, expect, it } from "vitest";
import {
  classifyGeocode,
  compareCounty,
  comparePoints,
  countyForPoint,
  locationConfidence,
  validateCoordinate,
} from "@/lib/location-validation";

describe("validateCoordinate", () => {
  it("accepts a normal Kenyan point", () => {
    expect(validateCoordinate(-1.2, 36.9).ok).toBe(true);
  });
  it("rejects out-of-range and missing values", () => {
    expect(validateCoordinate(95, 36).ok).toBe(false);
    expect(validateCoordinate(null, 36).ok).toBe(false);
    expect(validateCoordinate("abc", 36).ok).toBe(false);
  });
  it("rejects default/zero coordinates instead of silently using them", () => {
    expect(validateCoordinate(0, 0).ok).toBe(false);
    expect(validateCoordinate(-1.286389, 36.817223).ok).toBe(false);
  });
  it("corrects reversed lat/lng", () => {
    const r = validateCoordinate(36.9, -1.2);
    expect(r.ok).toBe(true);
    expect(r.swapped).toBe(true);
    expect(r.lat).toBe(-1.2);
  });
  it("rejects points outside Kenya", () => {
    expect(validateCoordinate(51.5, -0.12).ok).toBe(false);
  });
});

describe("county + discrepancy", () => {
  it("finds Nairobi for a CBD-area point", () => {
    expect(countyForPoint(-1.29, 36.82)?.name).toBe("Nairobi");
  });
  it("flags a pin outside the county named on a deed", () => {
    const d = compareCounty({ lat: -1.29, lng: 36.82 }, "Mombasa", "Pin");
    expect(d?.sourceA).toContain("Mombasa");
  });
  it("flags points more than 2 km apart", () => {
    expect(comparePoints({ lat: -1.29, lng: 36.82, source: "A" }, { lat: -1.35, lng: 36.82, source: "B" })?.distanceKm).toBeGreaterThan(2);
    expect(comparePoints({ lat: -1.29, lng: 36.82, source: "A" }, { lat: -1.291, lng: 36.82, source: "B" })).toBeNull();
  });
});

describe("confidence model", () => {
  it("never rates a geocode as highly as verified geometry", () => {
    expect(locationConfidence("approximate", "ROOFTOP")).toBeLessThan(locationConfidence("verified_geometry"));
    expect(classifyGeocode(["locality", "political"])).toBe("administrative");
    expect(classifyGeocode(["route"])).toBe("approximate");
  });
});
