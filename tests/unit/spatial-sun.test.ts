import { describe, expect, it } from "vitest";
import { sunPosition, sunVector } from "@/lib/spatial";

const LAT = -1.2921;
const LNG = 36.8219;
/** Local clock hour of solar noon in Nairobi (EAT is ~33 min ahead of local solar time). */
const SOLAR_NOON = 12.55;

/** True when the azimuth sits east of the north–south axis (0–180°). */
const eastOfNorth = (az: number) => az > 0 && az < 180;

describe("sunPosition — Nairobi", () => {
  it("puts the June solstice noon sun due north", () => {
    const s = sunPosition(LAT, LNG, 172, SOLAR_NOON);
    expect(s.azimuthDeg <= 6 || s.azimuthDeg >= 354).toBe(true);
    expect(s.altitudeDeg).toBeGreaterThan(60);
    expect(s.altitudeDeg).toBeLessThan(72);
    expect(s.isDay).toBe(true);
  });

  it("puts the December solstice noon sun due south", () => {
    const s = sunPosition(LAT, LNG, 355, SOLAR_NOON);
    expect(s.azimuthDeg).toBeGreaterThanOrEqual(174);
    expect(s.azimuthDeg).toBeLessThanOrEqual(186);
  });

  it("puts the June solstice mid-afternoon sun west-north-west", () => {
    const s = sunPosition(LAT, LNG, 172, 15);
    expect(s.azimuthDeg).toBeGreaterThanOrEqual(285);
    expect(s.azimuthDeg).toBeLessThanOrEqual(315);
  });

  it("places morning and afternoon on opposite sides of the N–S axis", () => {
    const morning = sunPosition(LAT, LNG, 172, 9);
    const afternoon = sunPosition(LAT, LNG, 172, 15);
    expect(eastOfNorth(morning.azimuthDeg)).toBe(true);
    expect(eastOfNorth(afternoon.azimuthDeg)).toBe(false);
  });

  it("reports night before dawn", () => {
    const s = sunPosition(LAT, LNG, 172, 2);
    expect(s.isDay).toBe(false);
    expect(s.altitudeDeg).toBeLessThan(0);
  });

  it("keeps azimuth finite and within [0, 360) all day, all seasons", () => {
    for (const day of [1, 172, 355]) {
      for (let h = 0; h <= 23.5; h += 0.5) {
        const s = sunPosition(LAT, LNG, day, h);
        expect(Number.isFinite(s.azimuthDeg)).toBe(true);
        expect(s.azimuthDeg).toBeGreaterThanOrEqual(0);
        expect(s.azimuthDeg).toBeLessThan(360);
      }
    }
  });
});

describe("sunVector", () => {
  it("returns a unit vector with positive y during the day", () => {
    const s = sunPosition(LAT, LNG, 172, SOLAR_NOON);
    const v = sunVector(s);
    const len = Math.hypot(v.x, v.y, v.z);
    expect(len).toBeCloseTo(1, 6);
    expect(v.y).toBeGreaterThan(0);
  });
});
