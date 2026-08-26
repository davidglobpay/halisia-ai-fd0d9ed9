import { describe, expect, it } from "vitest";
import { geometryToRing, isPlausibleKenyaLatLng, KENYA_BOUNDS } from "@/lib/spatial";

describe("isPlausibleKenyaLatLng", () => {
  it("accepts Kenyan WGS84 coordinates", () => {
    expect(isPlausibleKenyaLatLng({ lat: -1.2921, lng: 36.8219 })).toBe(true);
    expect(isPlausibleKenyaLatLng({ lat: KENYA_BOUNDS.maxLat, lng: KENYA_BOUNDS.maxLng })).toBe(
      true,
    );
  });

  it("rejects UTM / projected and non-finite coordinates", () => {
    // Arc 1960 / UTM 37S easting & northing for Nairobi.
    expect(isPlausibleKenyaLatLng({ lat: 9857200, lng: 258000 })).toBe(false);
    expect(isPlausibleKenyaLatLng({ lat: NaN, lng: 36.8 })).toBe(false);
    expect(isPlausibleKenyaLatLng({ lat: 51.5, lng: -0.12 })).toBe(false);
  });
});

describe("geometryToRing", () => {
  it("keeps valid WGS84 rings", () => {
    const ring = geometryToRing({
      type: "Polygon",
      coordinates: [
        [
          [36.8219, -1.2921],
          [36.8229, -1.2921],
          [36.8229, -1.2931],
          [36.8219, -1.2921],
        ],
      ],
    });
    expect(ring).toHaveLength(3);
  });

  it("rejects UTM-style coordinate pairs", () => {
    const ring = geometryToRing({
      type: "Polygon",
      coordinates: [
        [
          [258000, 9857200],
          [258100, 9857200],
          [258100, 9857300],
        ],
      ],
    });
    expect(ring).toHaveLength(0);
  });
});
