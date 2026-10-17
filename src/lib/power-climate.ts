import { fetchPublicJson } from "./public-json";
export type PowerClimate = {
  meanTempC: number | null;
  tempMinC: number | null;
  tempMaxC: number | null;
  annualRainfallMm: number | null;
  source: string;
  period: string;
  monthly: Array<{ month: string; temperatureC: number | null; rainfallMm: number | null }>;
};
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export function parsePowerClimate(input: unknown): PowerClimate | null {
  const j = input as {
    header?: { range?: string; fill_value?: number };
    parameters?: Record<string, { units?: string }>;
    properties?: { parameter?: Record<string, Record<string, unknown>> };
  };
  const p = j?.properties?.parameter;
  if (!p || j.parameters?.PRECTOTCORR?.units !== "mm/day" || j.parameters?.T2M?.units !== "C")
    return null;
  const valid = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) && v !== (j.header?.fill_value ?? -999) ? v : null;
  const monthly = MONTHS.map((month, i) => ({
    month: month[0] + month.slice(1).toLowerCase(),
    temperatureC: valid(p.T2M?.[month]),
    rainfallMm:
      valid(p.PRECTOTCORR?.[month]) == null || valid(p.PRECTOTCORR?.[month])! < 0
        ? null
        : valid(p.PRECTOTCORR?.[month])! * DAYS[i],
  }));
  const temps = monthly.map((m) => m.temperatureC).filter((v): v is number => v != null);
  if (!temps.length && !monthly.some((m) => m.rainfallMm != null)) return null;
  const annual = valid(p.PRECTOTCORR?.ANN);
  return {
    monthly,
    source: "NASA POWER / MERRA-2 reanalysis",
    period: j.header?.range ?? "Provider climatology period not supplied",
    meanTempC: valid(p.T2M?.ANN),
    tempMinC: temps.length ? Math.min(...temps) : null,
    tempMaxC: temps.length ? Math.max(...temps) : null,
    annualRainfallMm: annual == null || annual < 0 ? null : annual * 365.25,
  };
}
const cache = new Map<string, { at: number; value: Promise<PowerClimate | null> }>();
export function fetchPowerClimate(lat: number, lng: number): Promise<PowerClimate | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return Promise.resolve(null);
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`,
    hit = cache.get(key);
  if (hit && Date.now() - hit.at < 15 * 60_000) return hit.value;
  const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,PRECTOTCORR&community=AG&longitude=${lng.toFixed(4)}&latitude=${lat.toFixed(4)}&format=JSON`;
  const value = fetchPublicJson(url, {}, 20_000)
    .then(parsePowerClimate)
    .catch(() => null);
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 256) cache.delete(cache.keys().next().value!);
  return value;
}
