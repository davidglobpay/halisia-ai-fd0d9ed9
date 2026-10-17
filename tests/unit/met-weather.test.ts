import { expect, it } from "vitest";
import { parseWeatherForecast } from "@/lib/met-weather";
it("does not turn missing or invalid weather into zero", () => {
  expect(parseWeatherForecast({})).toBeNull();
  expect(
    parseWeatherForecast({
      properties: {
        timeseries: [
          {
            time: "2026-10-17T12:00:00Z",
            data: { instant: { details: { air_temperature: null } } },
          },
        ],
      },
    }),
  ).toBeNull();
});
it("keeps forecast timestamps and distinguishes real zero rainfall from missing rain", () => {
  const result = parseWeatherForecast({
    properties: {
      meta: { updated_at: "2026-10-17T11:00:00Z" },
      timeseries: [
        {
          time: "2026-10-17T12:00:00Z",
          data: {
            instant: { details: { air_temperature: 22 } },
            next_1_hours: {
              details: { precipitation_amount: 0 },
              summary: { symbol_code: "clearsky_day" },
            },
          },
        },
        { time: "2026-10-17T13:00:00Z", data: { instant: { details: { air_temperature: 23 } } } },
      ],
    },
  });
  expect(result?.points[0].rainfallMm).toBe(0);
  expect(result?.points[1].rainfallMm).toBeNull();
  expect(result?.updatedAt).toBe("2026-10-17T11:00:00Z");
});
