import { describe, expect, it } from "vitest";
import { ARCGIS_BROWSER_API_KEY } from "@/config/public-browser-keys";
import { esriTileTemplate, esriTileUrl, isArcgisApiKey } from "@/lib/esri-tiles";

// Synthetic, key-shaped value; never a real credential.
const KEY = "AAPTxy3SyntheticTestKeyOnly_abcdefghijklmnopqrstuvwxyz0123456789";

describe("ArcGIS key detection", () => {
  it("accepts an API-key-shaped value", () => {
    expect(isArcgisApiKey(KEY)).toBe(true);
  });

  it("rejects native SDK licence strings and junk", () => {
    expect(isArcgisApiKey("runtimelite,1000,abc,none,XXXXXXXXXXXXXXXXXXXX")).toBe(false);
    expect(isArcgisApiKey("nativelite,3000,abc,none,XXXXXXXXXXXXXXXXXXXX")).toBe(false);
    expect(isArcgisApiKey("")).toBe(false);
    expect(isArcgisApiKey(undefined)).toBe(false);
    expect(isArcgisApiKey("short")).toBe(false);
    expect(isArcgisApiKey(`${KEY} extra`)).toBe(false);
  });
});

describe("Esri tile URLs", () => {
  it("keeps the public host when no key is configured", () => {
    expect(esriTileTemplate("World_Imagery", "")).toBe(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    );
    expect(esriTileUrl("World_Imagery", 19, 2, 3, "")).toBe(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/19/2/3",
    );
  });

  it("uses the licensed host with a token for imagery and hillshade", () => {
    expect(esriTileTemplate("World_Imagery", KEY)).toBe(
      `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${KEY}`,
    );
    expect(esriTileUrl("Elevation/World_Hillshade", 5, 6, 7, KEY)).toBe(
      `https://ibasemaps-api.arcgis.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/5/6/7?token=${KEY}`,
    );
  });

  it("uses the configured browser key by default", () => {
    expect(isArcgisApiKey(ARCGIS_BROWSER_API_KEY)).toBe(true);
    expect(esriTileUrl("World_Imagery", 19, 2, 3)).toBe(
      `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/19/2/3?token=${encodeURIComponent(ARCGIS_BROWSER_API_KEY)}`,
    );
  });

  it("leaves services the licensed host does not serve on the public host", () => {
    expect(esriTileUrl("World_Topo_Map", 1, 2, 3, KEY)).toBe(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/1/2/3",
    );
  });
});
