import { createServerFn } from "@tanstack/react-start";

/**
 * Wave 4 — Public open-data intelligence.
 *
 * Aggregates fully free/open sources:
 *   • Nominatim (OSM) → reverse geocoding + Kenyan admin hierarchy
 *     (county / constituency / ward / town / village)
 *   • Overpass (OSM) → nearby public facilities, roads, transport
 *   • Open-Meteo → climate normals (rainfall, temperature)
 *
 * All sources are public and require no key. Responses are cached in-memory
 * to keep the free endpoints happy.
 */

type NominatimResp = {
  display_name?: string;
  address?: Record<string, string>;
};

type OverpassElement = {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResp = { elements: OverpassElement[] };

export type Wave4Facility = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  distanceKm: number;
};

export type Wave4Intel = {
  admin: {
    county: string | null;
    constituency: string | null;
    ward: string | null;
    town: string | null;
    village: string | null;
    displayName: string | null;
  };
  facilities: Record<string, Wave4Facility[]>;
  climate: {
    annualRainfallMm: number | null;
    meanTempC: number | null;
    tempMinC: number | null;
    tempMaxC: number | null;
  };
  scores: {
    accessibility: number;
    infrastructure: number;
    environment: number;
    development: number;
    investment: number;
  };
  breakdown: {
    accessibility: ScoreExplain;
    infrastructure: ScoreExplain;
    environment: ScoreExplain;
    development: ScoreExplain;
    investment: ScoreExplain;
  };
  distanceBuckets: Record<string, { close: number; near: number; far: number }>;
  sources: Array<{ label: string; url: string; used: boolean }>;
  generatedAt: string;
};

export type ScoreExplain = {
  score: number;
  formula: string;
  factors: Array<{ label: string; value: number; weight: string }>;
  confidence: "low" | "medium" | "high";
  note: string;
};

const cache = new Map<string, { at: number; value: Wave4Intel }>();
const TTL = 15 * 60_000;

const UA =
  "HalisiaAI/1.0 (Kenya land intelligence; public open-data connector; contact: hello@halisia.ai)";

// Overpass query — nearby facilities in a 3 km radius.
const OVERPASS_CATEGORIES: Array<{ key: string; label: string; filter: string }> = [
  {
    key: "hospitals",
    label: "Healthcare",
    filter: '["amenity"~"hospital|clinic|doctors|pharmacy"]',
  },
  {
    key: "schools",
    label: "Education",
    filter: '["amenity"~"school|kindergarten|college|university"]',
  },
  { key: "police", label: "Police", filter: '["amenity"="police"]' },
  { key: "fire", label: "Fire stations", filter: '["amenity"="fire_station"]' },
  { key: "banks", label: "Banks / ATM", filter: '["amenity"~"bank|atm"]' },
  { key: "fuel", label: "Fuel stations", filter: '["amenity"="fuel"]' },
  { key: "markets", label: "Markets & shops", filter: '["amenity"="marketplace"]' },
  { key: "worship", label: "Places of worship", filter: '["amenity"="place_of_worship"]' },
  { key: "transit", label: "Public transport", filter: '["highway"="bus_stop"]' },
  { key: "government", label: "Government offices", filter: '["office"~"government"]' },
];

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

async function fetchNominatim(lat: number, lng: number) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1&countrycodes=ke`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as NominatimResp;
  } catch {
    return null;
  }
}

async function fetchOverpass(lat: number, lng: number, radiusM = 3000) {
  const parts = OVERPASS_CATEGORIES.map(
    (c) =>
      `node(around:${radiusM},${lat},${lng})${c.filter};way(around:${radiusM},${lat},${lng})${c.filter};`,
  ).join("");
  const query = `[out:json][timeout:20];(${parts});out center tags 60;`;
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "text/plain", "User-Agent": UA },
        body: query,
      });
      if (!res.ok) continue;
      return (await res.json()) as OverpassResp;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function fetchClimate(lat: number, lng: number) {
  // 2010–2020 normals from the Open-Meteo climate archive.
  const url = `https://climate-api.open-meteo.com/v1/climate?latitude=${lat}&longitude=${lng}&start_date=2010-01-01&end_date=2020-12-31&models=EC_Earth3P_HR&daily=temperature_2m_mean,precipitation_sum`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = (await res.json()) as {
      daily?: { temperature_2m_mean?: number[]; precipitation_sum?: number[] };
    };
    const temps = j.daily?.temperature_2m_mean ?? [];
    const rains = j.daily?.precipitation_sum ?? [];
    if (!temps.length || !rains.length) return null;
    const meanTempC = temps.reduce((a, b) => a + b, 0) / temps.length;
    const tempMinC = Math.min(...temps);
    const tempMaxC = Math.max(...temps);
    // Rain daily → annual mean over ~11 years.
    const totalRain = rains.reduce((a, b) => a + b, 0);
    const years = rains.length / 365.25;
    const annualRainfallMm = years > 0 ? totalRain / years : null;
    return { meanTempC, tempMinC, tempMaxC, annualRainfallMm };
  } catch {
    return null;
  }
}

function classifyAdmin(n: NominatimResp | null) {
  const a = n?.address ?? {};
  return {
    county: a["county"] ?? a["state"] ?? a["region"] ?? null,
    constituency: a["state_district"] ?? null,
    ward: a["suburb"] ?? a["neighbourhood"] ?? a["quarter"] ?? null,
    town: a["city"] ?? a["town"] ?? null,
    village: a["village"] ?? a["hamlet"] ?? null,
    displayName: n?.display_name ?? null,
  };
}

function extractFacilities(
  data: OverpassResp | null,
  origin: { lat: number; lng: number },
): Record<string, Wave4Facility[]> {
  const out: Record<string, Wave4Facility[]> = {};
  for (const c of OVERPASS_CATEGORIES) out[c.key] = [];
  if (!data) return out;

  for (const el of data.elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const tags = el.tags ?? {};
    let key: string | null = null;
    if (
      tags.amenity === "hospital" ||
      tags.amenity === "clinic" ||
      tags.amenity === "doctors" ||
      tags.amenity === "pharmacy"
    )
      key = "hospitals";
    else if (["school", "kindergarten", "college", "university"].includes(tags.amenity ?? ""))
      key = "schools";
    else if (tags.amenity === "police") key = "police";
    else if (tags.amenity === "fire_station") key = "fire";
    else if (tags.amenity === "bank" || tags.amenity === "atm") key = "banks";
    else if (tags.amenity === "fuel") key = "fuel";
    else if (tags.amenity === "marketplace") key = "markets";
    else if (tags.amenity === "place_of_worship") key = "worship";
    else if (tags.highway === "bus_stop") key = "transit";
    else if (tags.office?.includes("government")) key = "government";
    if (!key) continue;

    out[key].push({
      id: `${el.type}/${el.id}`,
      name: tags.name ?? tags["name:en"] ?? "(unnamed)",
      category: key,
      lat,
      lng: lon,
      distanceKm: haversineKm(origin, { lat, lng: lon }),
    });
  }
  for (const key of Object.keys(out)) {
    out[key] = out[key].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 12);
  }
  return out;
}

function score(facilities: Record<string, Wave4Facility[]>, climate: Wave4Intel["climate"]) {
  const count = (k: string) => facilities[k]?.length ?? 0;
  const clip = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  const accessibility = clip(count("transit") * 6 + count("fuel") * 4 + count("markets") * 5 + 25);
  const infrastructure = clip(
    count("hospitals") * 5 +
      count("schools") * 4 +
      count("banks") * 4 +
      count("police") * 6 +
      count("fire") * 6 +
      count("government") * 3 +
      20,
  );
  // Climate suitability: warm-temperate + moderate rainfall = higher.
  let envBase = 55;
  if (climate.meanTempC != null) {
    if (climate.meanTempC > 17 && climate.meanTempC < 26) envBase += 15;
    else if (climate.meanTempC > 30) envBase -= 15;
  }
  if (climate.annualRainfallMm != null) {
    if (climate.annualRainfallMm > 600 && climate.annualRainfallMm < 1500) envBase += 15;
    else if (climate.annualRainfallMm < 300) envBase -= 15;
  }
  const environment = clip(envBase);
  const development = clip(
    (accessibility + infrastructure) / 2 + Math.min(20, count("worship") + count("markets") * 2),
  );
  const investment = clip(
    accessibility * 0.35 + infrastructure * 0.35 + environment * 0.15 + development * 0.15,
  );
  const dataSignal = count("hospitals") + count("schools") + count("transit") + count("markets");
  const confidence: ScoreExplain["confidence"] =
    dataSignal >= 15 ? "high" : dataSignal >= 6 ? "medium" : "low";

  const breakdown = {
    accessibility: {
      score: accessibility,
      formula: "25 + transit·6 + fuel·4 + markets·5",
      factors: [
        { label: "Transit stops (3 km)", value: count("transit"), weight: "×6" },
        { label: "Fuel stations", value: count("fuel"), weight: "×4" },
        { label: "Marketplaces", value: count("markets"), weight: "×5" },
      ],
      confidence,
      note: "Higher when there are many transit stops and market anchors within 3 km.",
    },
    infrastructure: {
      score: infrastructure,
      formula: "20 + hospitals·5 + schools·4 + banks·4 + police·6 + fire·6 + gov·3",
      factors: [
        { label: "Healthcare", value: count("hospitals"), weight: "×5" },
        { label: "Schools", value: count("schools"), weight: "×4" },
        { label: "Banks / ATM", value: count("banks"), weight: "×4" },
        { label: "Police", value: count("police"), weight: "×6" },
        { label: "Fire stations", value: count("fire"), weight: "×6" },
        { label: "Government offices", value: count("government"), weight: "×3" },
      ],
      confidence,
      note: "Weights emergency services higher because they're rarer but critical.",
    },
    environment: {
      score: environment,
      formula: "55 + climate suitability (temp + rainfall bands)",
      factors: [
        { label: "Mean temp (°C)", value: climate.meanTempC ?? 0, weight: "17–26 ideal" },
        {
          label: "Rainfall (mm/yr)",
          value: climate.annualRainfallMm ?? 0,
          weight: "600–1500 ideal",
        },
      ],
      confidence: (climate.meanTempC != null && climate.annualRainfallMm != null
        ? "high"
        : "low") as ScoreExplain["confidence"],
      note: "Open-Meteo 2010–2020 climate normals (EC-Earth3P-HR downscaled).",
    },
    development: {
      score: development,
      formula: "(access + infra) / 2 + min(20, worship + markets·2)",
      factors: [
        { label: "Places of worship", value: count("worship"), weight: "×1" },
        { label: "Marketplaces", value: count("markets"), weight: "×2" },
      ],
      confidence,
      note: "Community anchors correlate with settled, buildable neighbourhoods.",
    },
    investment: {
      score: investment,
      formula: "0.35·access + 0.35·infra + 0.15·env + 0.15·dev",
      factors: [
        { label: "Accessibility", value: accessibility, weight: "×0.35" },
        { label: "Infrastructure", value: infrastructure, weight: "×0.35" },
        { label: "Environment", value: environment, weight: "×0.15" },
        { label: "Development", value: development, weight: "×0.15" },
      ],
      confidence,
      note: "Composite view — not a valuation.",
    },
  };
  return {
    scores: { accessibility, infrastructure, environment, development, investment },
    breakdown,
  };
}

function distanceBuckets(facilities: Record<string, Wave4Facility[]>) {
  const out: Record<string, { close: number; near: number; far: number }> = {};
  for (const [key, list] of Object.entries(facilities)) {
    let close = 0,
      near = 0,
      far = 0;
    for (const f of list) {
      if (f.distanceKm <= 0.5) close++;
      else if (f.distanceKm <= 1.5) near++;
      else far++;
    }
    out[key] = { close, near, far };
  }
  return out;
}

export const getWave4Intel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const v = input as { lat?: number; lng?: number; refresh?: boolean };
    if (typeof v?.lat !== "number" || typeof v?.lng !== "number")
      throw new Error("lat/lng required");
    return { lat: v.lat, lng: v.lng, refresh: !!v.refresh };
  })
  .handler(async ({ data }): Promise<Wave4Intel> => {
    const key = `${data.lat.toFixed(3)},${data.lng.toFixed(3)}`;
    if (!data.refresh) {
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < TTL) return hit.value;
    }

    const [nom, ovp, cli] = await Promise.all([
      fetchNominatim(data.lat, data.lng),
      fetchOverpass(data.lat, data.lng),
      fetchClimate(data.lat, data.lng),
    ]);

    const admin = classifyAdmin(nom);
    const facilities = extractFacilities(ovp, { lat: data.lat, lng: data.lng });
    const climate: Wave4Intel["climate"] = {
      annualRainfallMm: cli?.annualRainfallMm ?? null,
      meanTempC: cli?.meanTempC ?? null,
      tempMinC: cli?.tempMinC ?? null,
      tempMaxC: cli?.tempMaxC ?? null,
    };
    const { scores, breakdown } = score(facilities, climate);
    const bucketMap = distanceBuckets(facilities);

    const value: Wave4Intel = {
      admin,
      facilities,
      climate,
      scores,
      breakdown,
      distanceBuckets: bucketMap,
      sources: [
        {
          label: "OpenStreetMap Nominatim (admin lookup)",
          url: "https://nominatim.openstreetmap.org",
          used: !!nom,
        },
        {
          label: "OpenStreetMap Overpass (facilities)",
          url: "https://overpass-api.de",
          used: !!ovp,
        },
        { label: "Open-Meteo Climate Archive", url: "https://open-meteo.com", used: !!cli },
        { label: "Kenya Open Data Portal", url: "https://opendata.go.ke", used: false },
        { label: "Kenya National Bureau of Statistics", url: "https://knbs.or.ke", used: false },
        { label: "IEBC boundaries", url: "https://iebc.or.ke", used: false },
        { label: "Kenya Forest Service", url: "https://kfs.go.ke", used: false },
        { label: "Kenya Wildlife Service", url: "https://kws.go.ke", used: false },
        { label: "Water Resources Authority", url: "https://wra.go.ke", used: false },
        { label: "NEMA", url: "https://nema.go.ke", used: false },
        {
          label: "Sentinel-2 / Landsat / OpenTopography",
          url: "https://scihub.copernicus.eu",
          used: false,
        },
      ],
      generatedAt: new Date().toISOString(),
    };
    cache.set(key, { at: Date.now(), value });
    return value;
  });

export const OVERPASS_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  OVERPASS_CATEGORIES.map((c) => [c.key, c.label]),
);
