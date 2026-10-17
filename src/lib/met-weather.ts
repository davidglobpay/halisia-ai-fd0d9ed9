import { fetchPublicJson } from "./public-json";
export type WeatherPoint = {
  time: string;
  temperatureC: number | null;
  rainfallMm: number | null;
  windMS: number | null;
  symbol: string | null;
};
export type WeatherForecast = { updatedAt: string | null; points: WeatherPoint[] };
const finite = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
export function parseWeatherForecast(input: unknown): WeatherForecast | null {
  const p = (
    input as {
      properties?: {
        meta?: { updated_at?: string };
        timeseries?: Array<{
          time?: string;
          data?: {
            instant?: { details?: Record<string, unknown> };
            next_1_hours?: {
              details?: Record<string, unknown>;
              summary?: { symbol_code?: string };
            };
          };
        }>;
      };
    }
  )?.properties;
  const points = (p?.timeseries ?? [])
    .slice(0, 24)
    .filter((v) => v.time && Number.isFinite(Date.parse(v.time)))
    .map((v) => ({
      time: v.time!,
      temperatureC: finite(v.data?.instant?.details?.air_temperature),
      windMS: finite(v.data?.instant?.details?.wind_speed),
      rainfallMm: finite(v.data?.next_1_hours?.details?.precipitation_amount),
      symbol: v.data?.next_1_hours?.summary?.symbol_code ?? null,
    }));
  return points.some((p) => p.temperatureC != null || p.rainfallMm != null)
    ? { updatedAt: p?.meta?.updated_at ?? null, points }
    : null;
}
/** MET Norway permits commercial reuse with attribution. Existing Wave4 TTL bounds requests. */
export async function fetchWeatherForecast(
  lat: number,
  lng: number,
): Promise<WeatherForecast | null> {
  try {
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`;
    return parseWeatherForecast(
      await fetchPublicJson(
        url,
        {
          headers: { "User-Agent": "HALISIA/1.0 https://halisia-ai.lovable.app hello@halisia.ai" },
        },
        12_000,
      ),
    );
  } catch {
    return null;
  }
}
