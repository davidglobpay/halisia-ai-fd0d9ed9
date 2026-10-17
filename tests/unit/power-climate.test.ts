import { expect, it } from "vitest";
import { parsePowerClimate } from "@/lib/power-climate";
it("uses declared units and provider period, and excludes fill values", () => {
  const x = parsePowerClimate({
    header: { fill_value: -999, range: "QA period" },
    parameters: { PRECTOTCORR: { units: "mm/day" }, T2M: { units: "C" } },
    properties: {
      parameter: {
        PRECTOTCORR: { JAN: 2, FEB: -999, ANN: 3 },
        T2M: { JAN: 20, FEB: -999, ANN: 21 },
      },
    },
  });
  expect(x?.period).toBe("QA period");
  expect(x?.monthly[0].rainfallMm).toBe(62);
  expect(x?.monthly[1].rainfallMm).toBeNull();
  expect(x?.annualRainfallMm).toBe(1095.75);
  expect(x?.tempMinC).toBe(20);
  expect(parsePowerClimate({ properties: { parameter: {} } })).toBeNull();
});
