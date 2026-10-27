import { describe, expect, it } from "vitest";

import { solarPosition, eatInstant } from "@/components/halisia/model-lab/site/solar";
import {
  CONTAINER_DIMS,
  masonryFootprint,
  MASONRY_WALL_M,
} from "@/components/halisia/model-lab/site/house-spec";
import {
  loadSiteTerrain,
  siteDisclaimer,
  heightAt,
  SITE_GRID_N,
} from "@/components/halisia/model-lab/site/site-terrain";
import { parseSiteParams, parseSiteType } from "@/components/halisia/model-lab/site/site-params";

describe("solar position (NOAA)", () => {
  it("London, 21 Jun 2026 12:00 UTC: elevation ≈ 61.9°, azimuth ≈ south", () => {
    const p = solarPosition(new Date(Date.UTC(2026, 5, 21, 12, 0)), 51.5, 0);
    expect(Math.abs(p.elevationDeg - 61.9)).toBeLessThan(1);
    expect(Math.abs(p.azimuthDeg - 180)).toBeLessThan(2);
  });
  it("Nairobi, 21 Dec 2026 at solar noon (~09:31 UTC): elevation ≈ 67.9°, sun to the south", () => {
    const p = solarPosition(new Date(Date.UTC(2026, 11, 21, 9, 31)), -1.2921, 36.8219);
    expect(Math.abs(p.elevationDeg - 67.85)).toBeLessThan(1);
    expect(Math.abs(p.azimuthDeg - 180)).toBeLessThan(3);
  });
  it("Equator, March equinox solar noon: sun near zenith", () => {
    const p = solarPosition(new Date(Date.UTC(2026, 2, 20, 12, 7)), 0, 0);
    expect(p.elevationDeg).toBeGreaterThan(89);
  });
  it("Nairobi midnight EAT: sun below horizon", () => {
    const p = solarPosition(eatInstant("2026-10-28", 0), -1.29, 36.82);
    expect(p.elevationDeg).toBeLessThan(0);
  });
  it("EAT is UTC+3", () => {
    expect(eatInstant("2026-10-28", 9.5).toISOString()).toBe("2026-10-28T06:30:00.000Z");
  });
});

describe("container dimensions (ISO external)", () => {
  it("20 ft = 6.058 × 2.438 × 2.591 m", () => {
    expect(CONTAINER_DIMS.container_20ft).toEqual({
      lengthM: 6.058,
      widthM: 2.438,
      heightM: 2.591,
    });
  });
  it("40 ft high cube = 12.192 × 2.438 × 2.896 m", () => {
    expect(CONTAINER_DIMS.container_40ft).toEqual({
      lengthM: 12.192,
      widthM: 2.438,
      heightM: 2.896,
    });
  });
});

describe("floor area → footprint", () => {
  it("110 m² internal area, 200 mm walls", () => {
    const f = masonryFootprint(110);
    expect(f.innerLengthM * f.innerWidthM).toBeCloseTo(110, 6);
    expect(f.outerLengthM - f.innerLengthM).toBeCloseTo(2 * MASONRY_WALL_M, 9);
    expect(MASONRY_WALL_M).toBe(0.2);
  });
  it("defaults to 110 m² when area is missing", () => {
    expect(masonryFootprint(null).areaM2).toBe(110);
  });
  it("uses the BoQ floor area when given", () => {
    const f = masonryFootprint(84);
    expect(f.innerLengthM * f.innerWidthM).toBeCloseTo(84, 6);
  });
});

describe("elevation grid fallback", () => {
  it("requests 100 points in one call and centres heights on the mean", async () => {
    let calls = 0;
    const t = await loadSiteTerrain(-1.5, 36.9, async (locs) => {
      calls++;
      expect(locs).toHaveLength(SITE_GRID_N * SITE_GRID_N);
      return { source: "opentopodata-aster30m", elevations: locs.map((_, i) => 1600 + (i % 10)) };
    });
    expect(calls).toBe(1);
    expect(t.kind).toBe("terrain");
    if (t.kind === "terrain") {
      expect(t.meanM).toBeCloseTo(1604.5, 6);
      expect(heightAt(t, 0, 0)).toBeCloseTo(0, 6);
    }
    expect(siteDisclaimer(t)).toContain("Terrain from ASTER GDEM v3 via Open Topo Data (~30 m)");
  });
  it("falls back to flat ground and says so when the call fails", async () => {
    const t = await loadSiteTerrain(-1.5, 36.9, async () => {
      throw new Error("network");
    });
    expect(t.kind).toBe("flat");
    expect(siteDisclaimer(t)).toMatch(/flat ground plane/);
    expect(siteDisclaimer(t)).toMatch(/not survey or boundary evidence/);
  });
  it("treats an incomplete grid as a failure", async () => {
    const t = await loadSiteTerrain(-1.5, 36.9, async () => ({
      source: "opentopodata-aster30m",
      elevations: [1, 2, 3],
    }));
    expect(t.kind).toBe("flat");
  });
});

describe("site-mode URL parsing", () => {
  it("parses typology and structure", () => {
    expect(parseSiteType("3br_masonry_stone")).toEqual({
      typology: "3br",
      structure: "masonry_stone",
    });
    expect(parseSiteType("bedsitter_container_40ft")).toEqual({
      typology: "bedsitter",
      structure: "container_40ft",
    });
  });
  it("rejects unsupported types", () => {
    expect(parseSiteType("3br_eps")).toBeNull();
    expect(parseSiteType("mansion_masonry_stone")).toBeNull();
    expect(parseSiteParams({})).toBeNull();
  });
  it("parses coordinates and drops invalid ones", () => {
    expect(
      parseSiteParams({ type: "3br_masonry_stone", lat: "-1.56", lng: "36.93" }),
    ).toMatchObject({
      lat: -1.56,
      lng: 36.93,
    });
    expect(parseSiteParams({ type: "3br_masonry_stone", lat: "95", lng: "36" })).toMatchObject({
      lat: null,
      lng: null,
    });
    expect(parseSiteParams({ type: "3br_masonry_stone", lat: "-1.5" })).toMatchObject({
      lat: null,
    });
  });
});
