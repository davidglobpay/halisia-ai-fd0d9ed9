import { createServerFn } from "@tanstack/react-start";

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
  organicPct: number;
  bulkDensity: number | null; // g/cm3
  texture: string;
  drainage: "well" | "moderate" | "poor";
};

export type TerrainMetrics = {
  elevationM: number;
  minM: number;
  maxM: number;
  reliefM: number;
  slopePct: number;
  aspectDeg: number;
  aspectLabel: string;
  roughness: number;
  landform: "ridge" | "valley" | "slope" | "flat" | "plain";
  erosionRisk: "Low" | "Moderate" | "High";
  drainageIndex: number; // 0-100
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
};

export type GeotechIntel = {
  ok: true;
  lat: number;
  lng: number;
  terrain: TerrainMetrics;
  soilLayers: SoilLayer[];
  geology: {
    dominant: string;
    setting:
      | "Weathered overburden"
      | "Residual soils"
      | "Sedimentary formations"
      | "Volcanic formations"
      | "Basement rock";
    confidence: "Low" | "Medium" | "High";
    note: string;
  };
  bedrock: {
    minM: number;
    maxM: number;
    excavation: "Easy" | "Moderate" | "Difficult";
    confidence: "Low" | "Medium" | "High";
  };
  groundwater: {
    shallowLikelihood: "Low" | "Moderate" | "High";
    seasonalWaterlogging: "Low" | "Moderate" | "High";
    nearestWaterKm: number | null;
    annualRainMm: number | null;
  };
  foundations: Foundation[];
  risks: RiskIndicator[];
  confidence: number; // 0-100
  sources: Array<{ label: string; url: string; used: boolean }>;
  disclaimer: string;
};

// ---- helpers ----

function textureClass(clay: number, sand: number, silt: number): string {
  if (clay >= 40) return "Clay";
  if (clay >= 27 && sand <= 45) return "Clay loam";
  if (sand >= 70 && clay < 15) return "Sandy";
  if (silt >= 50 && clay < 27) return "Silty loam";
  if (sand >= 50 && clay < 20) return "Sandy loam";
  return "Loam";
}

function drainageFromTexture(tex: string, slopePct: number): SoilLayer["drainage"] {
  if (tex === "Clay" || tex === "Clay loam") return slopePct > 8 ? "moderate" : "poor";
  if (tex === "Sandy" || tex === "Sandy loam") return "well";
  return slopePct > 5 ? "well" : "moderate";
}

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
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`soilgrids ${res.status}`);
  const j = (await res.json()) as {
    properties?: {
      layers?: Array<{
        name: string;
        unit_measure?: { d_factor?: number };
        depths?: Array<{ label: string; values?: { mean?: number | null } }>;
      }>;
    };
  };
  const layers = j.properties?.layers ?? [];
  const byProp: Record<string, Record<string, number | null>> = {};
  const factors: Record<string, number> = {};
  for (const L of layers) {
    byProp[L.name] = {};
    factors[L.name] = L.unit_measure?.d_factor ?? 1;
    for (const d of L.depths ?? []) {
      const v = d.values?.mean;
      byProp[L.name][d.label] = v == null ? null : v / (L.unit_measure?.d_factor || 1);
    }
  }
  const out: SoilLayer[] = [];
  for (const d of depths) {
    const clay = byProp.clay?.[d] ?? 0;
    const sand = byProp.sand?.[d] ?? 0;
    const silt = byProp.silt?.[d] ?? Math.max(0, 100 - clay - sand);
    const soc = (byProp.soc?.[d] ?? 0) / 10; // dg/kg -> %
    const bdod = byProp.bdod?.[d] ?? null;
    const tex = textureClass(clay, sand, silt);
    out.push({
      depth: d,
      clayPct: Math.round(clay),
      sandPct: Math.round(sand),
      siltPct: Math.round(silt),
      organicPct: Math.round(soc * 10) / 10,
      bulkDensity: bdod != null ? Math.round(bdod * 100) / 100 : null,
      texture: tex,
      drainage: "moderate",
    });
  }
  return out;
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
      signal,
    });
    if (!res.ok) throw new Error(`opentopodata ${res.status}`);
    const j = (await res.json()) as { results?: Array<{ elevation: number | null }> };
    const flat = (j.results ?? []).map((r) => r.elevation ?? 0);
    if (flat.length !== n * n) throw new Error("bad elevation grid");
    return flat;
  };

  // Provider 2: Open-Meteo Elevation API (fallback, different infrastructure)
  const tryOpenMeteo = async (): Promise<number[]> => {
    const res = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lats.join(",")}&longitude=${lngs.join(",")}`,
      { signal },
    );
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const j = (await res.json()) as { elevation?: number[] };
    const flat = j.elevation ?? [];
    if (flat.length !== n * n) throw new Error("bad elevation grid");
    return flat;
  };

  let flat: number[];
  try {
    flat = await tryOpenTopo();
  } catch (primaryErr) {
    try {
      flat = await tryOpenMeteo();
    } catch {
      throw primaryErr;
    }
  }
  const g: number[][] = [];
  for (let y = 0; y < n; y++) g.push(flat.slice(y * n, (y + 1) * n));
  return { grid: g, n, step };
}

function terrainAnalysis(g: number[][], n: number, step: number, lat: number): TerrainMetrics {
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
  let aspectDeg = (Math.atan2(dzdy, -dzdx) * 180) / Math.PI;
  if (aspectDeg < 0) aspectDeg += 360;
  const relief = mx - mn;
  let landform: TerrainMetrics["landform"] = "flat";
  if (elev - mean > std * 0.75) landform = "ridge";
  else if (mean - elev > std * 0.75) landform = "valley";
  else if (slopePct > 6) landform = "slope";
  else if (relief < 8) landform = "plain";
  const erosion: TerrainMetrics["erosionRisk"] =
    slopePct > 15 ? "High" : slopePct > 6 ? "Moderate" : "Low";
  const drainageIdx = Math.max(
    0,
    Math.min(100, Math.round(slopePct * 6 + (landform === "valley" ? -25 : 15) + 40)),
  );
  return {
    elevationM: Math.round(elev),
    minM: Math.round(mn),
    maxM: Math.round(mx),
    reliefM: Math.round(relief),
    slopePct,
    aspectDeg: Math.round(aspectDeg),
    aspectLabel: aspectLabel(aspectDeg),
    roughness: Math.round(std * 10) / 10,
    landform,
    erosionRisk: erosion,
    drainageIndex: drainageIdx,
  };
}

async function fetchClimate(lat: number, lng: number, signal?: AbortSignal) {
  try {
    const res = await fetch(
      `https://climate-api.open-meteo.com/v1/climate?latitude=${lat}&longitude=${lng}&start_date=1990-01-01&end_date=2020-12-31&models=EC_Earth3P_HR&daily=precipitation_sum`,
      { signal },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as {
      daily?: { precipitation_sum?: number[] };
    };
    const arr = j.daily?.precipitation_sum ?? [];
    if (!arr.length) return null;
    const total = arr.reduce((a, b) => a + (b || 0), 0);
    const years = arr.length / 365;
    return Math.round(total / years);
  } catch {
    return null;
  }
}

function interpretGeology(
  terrain: TerrainMetrics,
  soil: SoilLayer[],
  elevationM: number,
): GeotechIntel["geology"] {
  const surface = soil[0];
  const clay = surface?.clayPct ?? 0;
  if (terrain.landform === "ridge" && terrain.slopePct > 10) {
    return {
      dominant: "Weathered volcanic rock",
      setting: "Weathered overburden",
      confidence: "Medium",
      note: "Elevated, sloping terrain typical of the East African Rift volcanic highlands with weathered overburden above competent rock.",
    };
  }
  if (terrain.landform === "valley" && clay > 30) {
    return {
      dominant: "Alluvial / lacustrine sediments",
      setting: "Sedimentary formations",
      confidence: "Medium",
      note: "Valley-bottom clays suggest deposited sediments; expect variable compressibility and shallow groundwater.",
    };
  }
  if (elevationM > 1500 && clay > 25) {
    return {
      dominant: "Nairobi phonolite / trachyte with residual clays",
      setting: "Residual soils",
      confidence: "Medium",
      note: "High-plateau residual clays (e.g. Nairobi black-cotton) develop over volcanic bedrock — expect swell/shrink behaviour.",
    };
  }
  if (surface && surface.sandPct > 55) {
    return {
      dominant: "Sandy sedimentary cover",
      setting: "Sedimentary formations",
      confidence: "Low",
      note: "Sandy surface suggests sedimentary cover; underlying bedrock may be deep and variable.",
    };
  }
  return {
    dominant: "Mixed volcanic-sedimentary cover",
    setting: "Weathered overburden",
    confidence: "Low",
    note: "AI interpretation from public datasets — commission a site investigation for confirmation.",
  };
}

function estimateBedrock(
  terrain: TerrainMetrics,
  geology: GeotechIntel["geology"],
): GeotechIntel["bedrock"] {
  let base = 6;
  if (geology.setting === "Basement rock") base = 2;
  else if (geology.setting === "Weathered overburden") base = 5;
  else if (geology.setting === "Residual soils") base = 8;
  else if (geology.setting === "Sedimentary formations") base = 12;
  else if (geology.setting === "Volcanic formations") base = 4;
  if (terrain.landform === "valley") base += 4;
  if (terrain.slopePct > 15) base = Math.max(1, base - 2);
  const min = Math.max(0.5, Math.round((base - 2) * 10) / 10);
  const max = Math.round((base + 4) * 10) / 10;
  const excavation: GeotechIntel["bedrock"]["excavation"] =
    base <= 3 ? "Difficult" : base <= 7 ? "Moderate" : "Easy";
  return { minM: min, maxM: max, excavation, confidence: geology.confidence };
}

function groundwater(
  terrain: TerrainMetrics,
  soil: SoilLayer[],
  rainMm: number | null,
): GeotechIntel["groundwater"] {
  const clay = soil[0]?.clayPct ?? 0;
  const wet = terrain.landform === "valley" || (rainMm != null && rainMm > 1200) || clay > 35;
  const shallow: "Low" | "Moderate" | "High" =
    terrain.landform === "valley" ? "High" : wet ? "Moderate" : "Low";
  const seasonal: "Low" | "Moderate" | "High" =
    clay > 40 && terrain.slopePct < 3 ? "High" : clay > 25 ? "Moderate" : "Low";
  return {
    shallowLikelihood: shallow,
    seasonalWaterlogging: seasonal,
    nearestWaterKm: null,
    annualRainMm: rainMm,
  };
}

function foundationGuidance(
  terrain: TerrainMetrics,
  soil: SoilLayer[],
  bedrock: GeotechIntel["bedrock"],
): Foundation[] {
  const surface = soil[0];
  const swelling = (surface?.clayPct ?? 0) > 35;
  const soft = surface?.sandPct != null && surface.sandPct < 20 && (surface?.clayPct ?? 0) > 35;
  const rocky = bedrock.maxM < 3;
  return [
    {
      type: "Strip",
      suitability: rocky ? "Preferred" : swelling ? "Cautious" : "Possible",
      note: rocky
        ? "Shallow rock supports strip footings for light structures."
        : swelling
          ? "Swell/shrink clay — strip footings need reinforcement and deeper embedment."
          : "Workable for low-rise if soil bearing verified on site.",
    },
    {
      type: "Pad",
      suitability: swelling ? "Cautious" : "Possible",
      note: "Localised columns; ensure pads sit below active clay zone (>1.2 m in expansive soils).",
    },
    {
      type: "Raft",
      suitability: soft || swelling ? "Preferred" : "Possible",
      note: "Spreads load over soft or expansive soils; typical solution for Nairobi black cotton.",
    },
    {
      type: "Pile",
      suitability: bedrock.minM > 6 || soft ? "Preferred" : "Cautious",
      note: `Recommended when competent stratum is deeper than ~6 m (estimated here ${bedrock.minM}–${bedrock.maxM} m).`,
    },
  ];
}

function riskIndicators(
  terrain: TerrainMetrics,
  gw: GeotechIntel["groundwater"],
  soil: SoilLayer[],
): RiskIndicator[] {
  const swell = (soil[0]?.clayPct ?? 0) > 35;
  return [
    {
      label: "Slope stability",
      level: terrain.slopePct > 15 ? "High" : terrain.slopePct > 7 ? "Moderate" : "Low",
      note: `Local slope ~${terrain.slopePct}% (${terrain.landform}).`,
    },
    {
      label: "Erosion",
      level: terrain.erosionRisk,
      note: "Derived from slope and terrain roughness.",
    },
    {
      label: "Settlement",
      level: swell ? "High" : soil[0]?.sandPct != null && soil[0].sandPct > 60 ? "Low" : "Moderate",
      note: swell
        ? "Expansive clays imply swell/shrink and differential settlement."
        : "Typical residual/loam profile — monitor during long rains.",
    },
    {
      label: "Drainage",
      level:
        gw.seasonalWaterlogging === "High"
          ? "High"
          : gw.seasonalWaterlogging === "Moderate"
            ? "Moderate"
            : "Low",
      note: `Seasonal waterlogging ${gw.seasonalWaterlogging.toLowerCase()}; shallow groundwater ${gw.shallowLikelihood.toLowerCase()}.`,
    },
  ];
}

export const getGeotechIntel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as GeotechInput)
  .handler(async ({ data }): Promise<GeotechIntel> => {
    const { lat, lng } = data;
    const [soil, gridInfo, rain] = await Promise.all([
      fetchSoil(lat, lng).catch(() => [] as SoilLayer[]),
      fetchElevGrid(lat, lng).catch(() => null),
      fetchClimate(lat, lng),
    ]);
    // Graceful fallback: if elevation API is unreachable, synthesise a flat
    // terrain grid so downstream analysis (and the UI) still work. Confidence
    // is reduced below to reflect the missing data.
    const effectiveGrid =
      gridInfo ??
      (() => {
        const n = 5;
        const step = 0.01;
        const grid: number[][] = Array.from({ length: n }, () => Array(n).fill(1000));
        return { grid, n, step };
      })();
    const terrain = terrainAnalysis(effectiveGrid.grid, effectiveGrid.n, effectiveGrid.step, lat);
    // apply slope-informed drainage back onto soil layers
    for (const l of soil) l.drainage = drainageFromTexture(l.texture, terrain.slopePct);
    const geology = interpretGeology(terrain, soil, terrain.elevationM);
    const bedrock = estimateBedrock(terrain, geology);
    const gw = groundwater(terrain, soil, rain);
    const foundations = foundationGuidance(terrain, soil, bedrock);
    const risks = riskIndicators(terrain, gw, soil);
    const conf =
      (soil.length ? 30 : 0) +
      (gridInfo ? 35 : 5) +
      (rain != null ? 15 : 0) +
      (geology.confidence === "High" ? 20 : geology.confidence === "Medium" ? 12 : 5);
    return {
      ok: true,
      lat,
      lng,
      terrain,
      soilLayers: soil,
      geology,
      bedrock,
      groundwater: gw,
      foundations,
      risks,
      confidence: Math.min(100, conf),
      sources: [
        { label: "ISRIC SoilGrids v2.0", url: "https://soilgrids.org", used: soil.length > 0 },
        {
          label: "Open-Topo-Data ASTER30m",
          url: "https://www.opentopodata.org/datasets/aster/",
          used: gridInfo != null,
        },
        {
          label: "Open-Meteo Climate API",
          url: "https://open-meteo.com/en/docs/climate-api",
          used: rain != null,
        },
        { label: "OneGeology portal", url: "http://portal.onegeology.org", used: false },
        { label: "USGS Earth Explorer", url: "https://earthexplorer.usgs.gov", used: false },
        { label: "OpenStreetMap", url: "https://www.openstreetmap.org", used: true },
      ],
      disclaimer:
        "This is an AI-generated preliminary geotechnical assessment based on publicly available datasets. It is intended for planning purposes only and must not be used as a substitute for a professional site-specific geotechnical investigation carried out by a qualified geotechnical engineer.",
    };
  });
