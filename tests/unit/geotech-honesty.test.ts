import { afterEach, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ inputValidator: () => ({ handler: (fn: unknown) => fn }) }),
}));
vi.mock("@/lib/power-climate", () => ({ fetchPowerClimate: async () => null }));
import { getGeotechIntel } from "@/lib/geotech.functions";
afterEach(() => vi.unstubAllGlobals());
it("returns null ground and subsurface conditions when providers fail", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Synthetic unavailable provider")));
  const result = await getGeotechIntel({ data: { lat: 0.05, lng: 35.73 } });
  expect(result.terrainMeasured).toBe(false);
  expect(result.terrain).toBeNull();
  expect(result.elevationGrid).toBeUndefined();
  expect(result.soilStatus).toBe("failed");
  expect(result.soilLayers).toEqual([]);
  expect(result.geology).toBeNull();
  expect(result.bedrock).toBeNull();
  expect(result.groundwater.shallowLikelihood).toBeNull();
  expect(result.foundations).toEqual([]);
  expect(result.risks).toEqual([]);
});
it("retains actual grid samples without turning elevation into engineering verdicts", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("opentopodata"))
        return new Response(
          JSON.stringify({
            results: Array.from({ length: 25 }, (_, i) => ({ elevation: 1400 + i })),
          }),
        );
      return new Response(JSON.stringify({ properties: { layers: [] } }));
    }),
  );
  const result = await getGeotechIntel({ data: { lat: 0.05, lng: 35.73 } });
  expect(result.terrainMeasured).toBe(true);
  expect(result.elevationGrid?.values[0]).toEqual([1400, 1401, 1402, 1403, 1404]);
  expect(result.terrain?.erosionRisk).toBeNull();
  expect(result.terrain?.drainageIndex).toBeNull();
  expect(result.bedrock).toBeNull();
  expect(result.foundations).toEqual([]);
});
