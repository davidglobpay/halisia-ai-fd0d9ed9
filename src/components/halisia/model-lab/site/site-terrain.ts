/**
 * One-request 10 × 10 elevation grid (~200 m square) for site mode, with an
 * explicit flat-ground fallback. The fetcher is injected so the fallback is
 * unit-testable without the network.
 */
export const SITE_GRID_N = 10;
export const SITE_SPAN_M = 200;
const M_PER_DEG_LAT = 111_320;

export type ElevationFetcher = (
  locations: Array<{ lat: number; lng: number }>,
) => Promise<{ source: string; elevations: number[] }>;

export type SiteTerrain =
  | {
      kind: "terrain";
      n: number;
      spanM: number;
      /** Heights relative to the mean, [row north→south][col west→east]. */
      heights: number[][];
      meanM: number;
      reliefM: number;
      dataset: string;
      resolution: string;
    }
  | { kind: "flat"; reason: string };

/** Human dataset name + nominal resolution for the provider's source id. */
export function datasetLabel(source: string): { name: string; resolution: string } {
  if (source === "opentopodata-aster30m")
    return { name: "ASTER GDEM v3 via Open Topo Data", resolution: "~30 m" };
  if (source === "open-meteo-elevation")
    return { name: "Copernicus DEM GLO-90 via Open-Meteo", resolution: "~90 m" };
  return { name: source, resolution: "unknown resolution" };
}

export function siteGridLocations(lat: number, lng: number) {
  const n = SITE_GRID_N;
  const stepM = SITE_SPAN_M / (n - 1);
  const dLat = stepM / M_PER_DEG_LAT;
  const dLng = stepM / (M_PER_DEG_LAT * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  const out: Array<{ lat: number; lng: number }> = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      // Row 0 is the northern edge.
      out.push({ lat: lat + ((n - 1) / 2 - r) * dLat, lng: lng + (c - (n - 1) / 2) * dLng });
    }
  }
  return out;
}

export async function loadSiteTerrain(
  lat: number | null,
  lng: number | null,
  fetcher: ElevationFetcher,
): Promise<SiteTerrain> {
  if (lat === null || lng === null)
    return { kind: "flat", reason: "No location given — flat ground plane shown." };
  const n = SITE_GRID_N;
  try {
    const res = await fetcher(siteGridLocations(lat, lng));
    const flat = res.elevations;
    if (flat.length !== n * n || flat.some((v) => typeof v !== "number" || !Number.isFinite(v)))
      throw new Error("incomplete grid");
    const mean = flat.reduce((a, b) => a + b, 0) / flat.length;
    const heights: number[][] = [];
    for (let r = 0; r < n; r++) heights.push(flat.slice(r * n, (r + 1) * n).map((v) => v - mean));
    const ds = datasetLabel(res.source);
    return {
      kind: "terrain",
      n,
      spanM: SITE_SPAN_M,
      heights,
      meanM: mean,
      reliefM: Math.max(...flat) - Math.min(...flat),
      dataset: ds.name,
      resolution: ds.resolution,
    };
  } catch {
    return {
      kind: "flat",
      reason: "The elevation request failed — flat ground plane shown instead of terrain.",
    };
  }
}

/** Bilinear height (relative to mean) at scene x (east), z (south). */
export function heightAt(t: SiteTerrain, x: number, z: number): number {
  if (t.kind !== "terrain") return 0;
  const n = t.n;
  const u = Math.min(Math.max(x / t.spanM + 0.5, 0), 1) * (n - 1);
  const v = Math.min(Math.max(z / t.spanM + 0.5, 0), 1) * (n - 1);
  const c0 = Math.floor(u);
  const r0 = Math.floor(v);
  const c1 = Math.min(c0 + 1, n - 1);
  const r1 = Math.min(r0 + 1, n - 1);
  const tu = u - c0;
  const tv = v - r0;
  const h = t.heights;
  const a = h[r0][c0] + (h[r0][c1] - h[r0][c0]) * tu;
  const b = h[r1][c0] + (h[r1][c1] - h[r1][c0]) * tu;
  return a + (b - a) * tv;
}

export function siteDisclaimer(t: SiteTerrain | null): string {
  if (!t) return "Schematic visualisation. Loading terrain…";
  if (t.kind === "flat")
    return `Schematic visualisation. ${t.reason} Position is illustrative, not survey or boundary evidence.`;
  return `Schematic visualisation. Terrain from ${t.dataset} (${t.resolution}); position is illustrative, not survey or boundary evidence.`;
}
