import { parseSoilGrids } from "./soilgrids-parser";
import { robustRelief } from "./terrain-relief";
import { fetchPowerClimate } from "./power-climate";
import { createServerFn } from "@tanstack/react-start";
import { parseServerInput, GeotechSchema } from "@/lib/server-input";

/**
 * AI Geotechnical Intelligence — preliminary subsurface assessment from free
 * public datasets (SoilGrids, Open-Topo-Data ASTER30m, Open-Meteo climate).
 * NOT an official geotechnical investigation.
 */

export type GeotechInput = { lat: number; lng: number };

export type SoilLayer = {
  depth: string;
  clayPct: number;
  sandPct: number;
  siltPct: number;
  organicPct: number | null;
  bulkDensity: number | null; // g/cm3
  texture: string;
  drainage: "well" | "moderate" | "poor" | null;
};

export type TerrainMetrics = {
  elevationM: number;
  /** Lowest and highest cell that survived artifact rejection. */
  minM: number;
  maxM: number;
  reliefM: number;
  /** The raw grid extremes, always kept so nothing is hidden. */
  rawMinM: number;
  rawMaxM: number;
  /** How many cells were rejected as raster spikes. */
  reliefOutliers: number;
  /** False when the grid was too damaged to describe relief at all. */
  reliefUsable: boolean;
  /** One sentence explaining the relief figure. Never empty. */
  reliefNote: string;
  slopePct: number;
  aspectDeg: number;
  aspectLabel: string;
  roughness: number;
  landform: "ridge" | "valley" | "slope" | "flat" | "plain";
  erosionRisk: null;
  drainageIndex: null; // Not assessed from elevation
};

export type Foundation = {
  type: "Strip" | "Pad" | "Raft" | "Pile";
  suitability: "Preferred" | "Possible" | "Cautious" | "Not advised";
  note: string;
};

export type RiskIndicator = {
  label: string;
  level: "Low" | "Moderate" | "High";
  note: string;
  mitigation: string[];
  costImpact: {
    band: "Low" | "Moderate" | "High" | "Severe";
    rangeKESPerSqm: [number, number];
    note: string;
  };
};

export type GeotechIntel = {
  ok: true;
  lat: number;
  lng: number;
  terrain: TerrainMetrics | null;
  soilLayers: SoilLayer[];
  geology: null;
  bedrock: null;
  groundwater: {
    shallowLikelihood: null;
    seasonalWaterlogging: null;
    nearestWaterKm: null;
    annualRainMm: number | null;
  };
  foundations: Foundation[];
  risks: RiskIndicator[];
  confidence: null;
  /** Missing provider data stays null; terrainMeasured records grid availability. */
  soilStatus?: "ok" | "no_data" | "failed";
  terrainMeasured: boolean;
  elevationGrid?: { values: number[][]; stepDeg: number; source: string };
  sources: Array<{ label: string; url: string; used: boolean }>;
  disclaimer: string;
};

// ---- helpers ----

function aspectLabel(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

async function fetchSoil(lat: number, lng: number, signal?: AbortSignal): Promise<SoilLayer[]> {
  const props = ["clay", "sand", "silt", "soc", "bdod"];
  const depths = ["0-5cm", "5-15cm", "15-30cm", "30-60cm"];
  const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lng}&lat=${lat}&${props
    .map((p) => `property=${p}`)
    .join("&")}&${depths.map((d) => `depth=${d}`).join("&")}&value=mean`;
  // ISRIC intermittently hangs; cap the wait so the panel degrades fast.
  const timeout = AbortSignal.timeout(12_000);
  const res = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!res.ok) throw new Error(`soilgrids ${res.status}`);
  return parseSoilGrids(await res.json());
}

async function fetchElevGrid(lat: number, lng: number, signal?: AbortSignal) {
  const n = 5;
  const step = 0.01; // ~1.1 km
  const pts: string[] = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      pts.push(
        `${(lat + (y - (n - 1) / 2) * step).toFixed(5)},${(lng + (x - (n - 1) / 2) * step).toFixed(5)}`,
      );
  // Coordinate arrays for both providers
  const lats: number[] = [];
  const lngs: number[] = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      lats.push(lat + (y - (n - 1) / 2) * step);
      lngs.push(lng + (x - (n - 1) / 2) * step);
    }

  // Provider 1: Open-Topo-Data ASTER30m (primary)
  const tryOpenTopo = async (): Promise<number[]> => {
    const res = await fetch(`https://api.opentopodata.org/v1/aster30m?locations=${pts.join("|")}`, {
      signal: signal ?? AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`opentopodata ${res.status}`);
    const j = (await res.json()) as { results?: Array<{ elevation: number | null }> };
    const flat = (j.results ?? []).map((r) => r.elevation);
    if (flat.some((v) => v == null || !Number.isFinite(v)))
      throw new Error("missing elevation sample");
    if (flat.length !== n * n) throw new Error("bad elevation grid");
    return flat as number[];
  };

  // A missing raster sample is unknown, never an elevation of zero.
  const flat = await tryOpenTopo();
  const g: number[][] = [];
  for (let y = 0; y < n; y++) g.push(flat.slice(y * n, (y + 1) * n));
  return { grid: g, n, step };
}

function terrainAnalysis(
  g: number[][],
  n: number,
  step: number,
  lat: number,
): TerrainMetrics | null {
  // Withhold derived conclusions when the supporting raster is suspect.
  // Raw samples remain available in elevationGrid for inspection.
  const quality = robustRelief(g);
  if (!quality.usable || quality.outliers.length > 0) return null;
  const mid = (n - 1) >> 1;
  const elev = g[mid][mid];
  let mn = Infinity,
    mx = -Infinity,
    sum = 0,
    sq = 0;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const v = g[y][x];
      mn = Math.min(mn, v);
      mx = Math.max(mx, v);
      sum += v;
      sq += v * v;
    }
  const count = n * n;
  const mean = sum / count;
  const std = Math.sqrt(sq / count - mean * mean);
  // meters per cell
  const cellM = step * 111000; // approx
  const cellMx = cellM * Math.cos((lat * Math.PI) / 180);
  // central-difference gradient
  const dzdx = (g[mid][mid + 1] - g[mid][mid - 1]) / (2 * cellMx);
  const dzdy = (g[mid + 1][mid] - g[mid - 1][mid]) / (2 * cellM);
  const slope = Math.sqrt(dzdx * dzdx + dzdy * dzdy);
  const slopePct = Math.round(slope * 100 * 10) / 10;
  // Compass bearing of the downslope direction: 0 = N, 90 = E. The previous
  // atan2(dzdy, -dzdx) was this rotated by exactly 90 degrees, so the Kajiado
  // export of 24 Oct 2026 printed "faces W (255 degrees)" for a grid that
  // falls to the north. Aspect is published beside a sentence about which way
  // surface water runs off, so the sign has to be right.
  let aspectDeg = (Math.atan2(-dzdx, -dzdy) * 180) / Math.PI;
  if (aspectDeg < 0) aspectDeg += 360;
  // min/max turns one ASTER spike into a headline number. The Usenge export
  // of 22 Oct 2026 published 67 m of relief from a single 1198 m cell with
  // 1133 m cells on either side, on the Lake Victoria shoreline, in the same
  // panel as a 0.4% slope. Judge each cell against its own neighbours first.
  const rr = robustRelief(g);
  const relief = rr.usable && rr.reliefM != null ? rr.reliefM : 0;
  let landform: TerrainMetrics["landform"] = "flat";
  if (elev - mean > std * 0.75) landform = "ridge";
  else if (mean - elev > std * 0.75) landform = "valley";
  else if (slopePct > 6) landform = "slope";
  else if (relief < 8) landform = "plain";
  return {
    elevationM: Math.round(elev),
    minM: rr.usable && rr.minM != null ? rr.minM : Math.round(mn),
    maxM: rr.usable && rr.maxM != null ? rr.maxM : Math.round(mx),
    reliefM: Math.round(relief),
    rawMinM: Math.round(mn),
    rawMaxM: Math.round(mx),
    reliefOutliers: rr.outliers.length,
    reliefUsable: rr.usable,
    reliefNote: rr.note,
    slopePct,
    aspectDeg: Math.round(aspectDeg),
    aspectLabel: aspectLabel(aspectDeg),
    roughness: Math.round(std * 10) / 10,
    landform,
    erosionRisk: null,
    drainageIndex: null,
  };
}

async function fetchClimate(lat: number, lng: number, _signal?: AbortSignal) {
  return (await fetchPowerClimate(lat, lng))?.annualRainfallMm ?? null;
}

export const getGeotechIntel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    parseServerInput<GeotechInput>(GeotechSchema, input, "location"),
  )
  .handler(async ({ data }): Promise<GeotechIntel> => {
    const { lat, lng } = data;
    let soilStatus: "ok" | "no_data" | "failed" = "no_data";
    const [soil, gridInfo, rain] = await Promise.all([
      fetchSoil(lat, lng)
        .then((layers) => {
          soilStatus = layers.length ? "ok" : "no_data";
          return layers;
        })
        .catch(() => {
          soilStatus = "failed";
          return [] as SoilLayer[];
        }),
      fetchElevGrid(lat, lng).catch(() => null),
      fetchClimate(lat, lng),
    ]);
    const terrain = gridInfo
      ? terrainAnalysis(gridInfo.grid, gridInfo.n, gridInfo.step, lat)
      : null;
    return {
      ok: true,
      lat,
      lng,
      terrain,
      soilLayers: soil,
      soilStatus,
      geology: null,
      bedrock: null,
      groundwater: {
        shallowLikelihood: null,
        seasonalWaterlogging: null,
        nearestWaterKm: null,
        annualRainMm: rain,
      },
      foundations: [],
      risks: [],
      confidence: null,
      terrainMeasured: terrain != null,
      elevationGrid: gridInfo
        ? { values: gridInfo.grid, stepDeg: gridInfo.step, source: "Open-Topo-Data ASTER30m" }
        : undefined,
      sources: [
        { label: "ISRIC SoilGrids v2.0", url: "https://soilgrids.org", used: soil.length > 0 },
        {
          label: "Open-Topo-Data ASTER30m",
          url: "https://www.opentopodata.org/datasets/aster/",
          used: gridInfo != null,
        },
        {
          label: "NASA POWER Climate API",
          url: "https://power.larc.nasa.gov/docs/services/api/temporal/climatology/",
          used: rain != null,
        },
        { label: "OneGeology portal", url: "http://portal.onegeology.org", used: false },
        { label: "USGS Earth Explorer", url: "https://earthexplorer.usgs.gov", used: false },
        { label: "OpenStreetMap", url: "https://www.openstreetmap.org", used: true },
      ],
      disclaimer:
        "Regional terrain and soil-model context only. Bedrock, groundwater, bearing capacity, erosion risk and foundation suitability are not assessed. A qualified geotechnical engineer must investigate the site before structural design.",
    };
  });
