import { describe, expect, it } from "vitest";
import { geotechAvailability } from "../../src/lib/geotech-availability";
describe("geotechnical output availability", () => {
  it.each([false, undefined, null])(
    "withholds derived output and export for %s grid status",
    (status) => {
      const result = geotechAvailability(status);
      expect(result.terrainDerivedAvailable).toBe(false);
      expect(result.exportAvailable).toBe(false);
      expect(result.message).toContain("withheld");
    },
  );
  it("allows a reported grid without implying measured subsurface", () => {
    const result = geotechAvailability(true);
    expect(result.terrainDerivedAvailable).toBe(true);
    expect(result.exportAvailable).toBe(true);
    expect(result.message).toContain(
      "subsurface conditions and foundation suitability are not assessed",
    );
  });

  it("says when a loaded grid was rejected, rather than calling it missing", () => {
    const result = geotechAvailability(false, true);
    expect(result.exportAvailable).toBe(false);
    expect(result.message).toContain("failed quality checks");
    expect(result.message).toContain("withheld");
    expect(result.message).not.toContain("unavailable. Terrain");
  });
});
