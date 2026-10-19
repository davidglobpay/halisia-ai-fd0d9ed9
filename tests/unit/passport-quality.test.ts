import { describe, expect, it } from "vitest";
import { displayPlaceName, isQueryCentroid } from "@/lib/passport-quality";
import { parseSoilGrids } from "@/lib/soilgrids-parser";
describe("Passport evidence quality", () => {
  it("formats all-capitals labels while retaining acronyms and supplied mixed case", () => {
    expect(displayPlaceName("KOIBATEK PRIMARY")).toBe("Koibatek Primary");
    expect(displayPlaceName("KCB ATM")).toBe("KCB ATM");
    expect(displayPlaceName("Kotut Buiilding")).toBe("Kotut Buiilding");
  });
  it("suppresses query centroids without suppressing located neighbours", () => {
    const origin = { lat: 0.05304, lng: 35.72977 };
    expect(isQueryCentroid(origin, origin)).toBe(true);
    expect(isQueryCentroid({ ...origin, lat: origin.lat + 0.001 }, origin)).toBe(false);
    expect(isQueryCentroid(origin)).toBe(false);
  });
  it("keeps absent and incomplete soil bands missing", () => {
    expect(parseSoilGrids({})).toEqual([]);
    expect(
      parseSoilGrids({
        properties: {
          layers: [
            {
              name: "clay",
              unit_measure: { d_factor: 10 },
              depths: [{ label: "0-5cm", values: { mean: 350 } }],
            },
          ],
        },
      }),
    ).toEqual([]);
  });
  it("uses ISRIC units and normalized depth labels for complete bands", () => {
    const values = { clay: 350, sand: 350, silt: 300, soc: 120, bdod: 130 };
    const response = {
      properties: {
        layers: Object.entries(values).map(([name, mean]) => ({
          name,
          unit_measure: { d_factor: name === "bdod" ? 100 : 10 },
          depths: [{ label: "0 - 5 cm", values: { mean } }],
        })),
      },
    };
    const result = parseSoilGrids(response);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      clayPct: 35,
      sandPct: 35,
      siltPct: 30,
      organicPct: 1.2,
      bulkDensity: 1.3,
      depth: "0-5cm",
    });
    response.properties.layers[0].depths[0].values.mean = -9999;
    expect(parseSoilGrids(response)).toEqual([]);
  });
});
