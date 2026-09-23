import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("live geospatial experience", () => {
  const intro = read("src/components/halisia/globe-intro.tsx");
  const cesium = read("src/components/halisia/cesium-globe.internal.tsx");
  const map = read("src/components/halisia/map-view.tsx");
  const street = read("src/components/halisia/street-view-panel.tsx");

  it("uses streamed satellite imagery for the Earth to Kenya flight", () => {
    expect(intro).toContain("<CesiumGlobe");
    expect(intro).toContain("Earth · Africa · Kenya");
    expect(intro).not.toContain("<svg");
    expect(cesium).toContain("World_Imagery/MapServer/tile");
    expect(cesium).toContain("Tiles © Esri");
  });

  it("keeps advanced terrain credential-gated with an ellipsoid fallback", () => {
    expect(cesium).toContain("VITE_CESIUM_ION_TOKEN");
    expect(cesium).toContain("Terrain.fromWorldTerrain");
    expect(cesium).toContain("EllipsoidTerrainProvider");
  });

  it("never represents provider imagery as live or uniformly available", () => {
    expect(intro).toContain("provider dates and coverage vary");
    expect(intro).not.toMatch(/latest satellite|live satellite/i);
    expect(street).toContain("coverage varies");
  });

  it("provides an in-app Street View lifecycle and external fallback", () => {
    expect(map).toContain('data-testid="open-street-view"');
    expect(street).toContain("StreetViewService");
    expect(street).toContain("StreetViewPanorama");
    expect(street).toContain("Open in Google Maps");
    expect(street).toContain('data-testid="close-street-view"');
  });
});
