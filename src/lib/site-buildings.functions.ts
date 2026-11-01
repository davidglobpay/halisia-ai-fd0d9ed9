import { createServerFn } from "@tanstack/react-start";
import { parseCoordInput } from "./request-guards";
import { parseOverpassBuildings, type NearbyBuilding } from "./site-context";

/**
 * OpenStreetMap building footprints around a point, for neighbourhood context
 * in the plot planner. Public and free (Overpass); results are cached per
 * ~10 m cell for 30 minutes, and `refresh` is ignored so callers cannot bypass
 * the cache.
 */
export const BUILDINGS_RADIUS_M = 250;
const TTL_MS = 30 * 60_000;
const MAX_BYTES = 6 * 1024 * 1024;
const UA = "HalisiaAI/1.0 (plot planner neighbourhood context; contact: hello@halisia.ai)";
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const cache = new Map<string, { at: number; value: NearbyBuildingsResult }>();

export type NearbyBuildingsResult = {
  status: "ok" | "unavailable";
  buildings: NearbyBuilding[];
  radiusM: number;
  source: string;
  retrievedAt: string;
};

async function overpass(query: string): Promise<unknown | null> {
  for (const ep of ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const r = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "text/plain", "User-Agent": UA },
        body: query,
        signal: controller.signal,
      });
      if (!r.ok) continue;
      const text = await r.text();
      if (text.length > MAX_BYTES) continue;
      return JSON.parse(text);
    } catch {
      /* try the next mirror */
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

export const getNearbyBuildings = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => parseCoordInput(input))
  .handler(async ({ data }): Promise<NearbyBuildingsResult> => {
    const key = `${data.lat.toFixed(4)},${data.lng.toFixed(4)}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

    const q = `[out:json][timeout:20];way["building"](around:${BUILDINGS_RADIUS_M},${data.lat},${data.lng});out tags geom 400;`;
    const json = await overpass(q);
    const value: NearbyBuildingsResult = {
      status: json ? "ok" : "unavailable",
      buildings: json ? parseOverpassBuildings(json as never) : [],
      radiusM: BUILDINGS_RADIUS_M,
      source: "OpenStreetMap contributors (ODbL), via Overpass API",
      retrievedAt: new Date().toISOString(),
    };
    if (json) {
      if (cache.size > 500) cache.clear();
      cache.set(key, { at: Date.now(), value });
    }
    return value;
  });
