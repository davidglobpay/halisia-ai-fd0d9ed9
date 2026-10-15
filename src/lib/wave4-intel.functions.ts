import { fetchPublicJson } from "@/lib/public-json";
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
  /**
   * Always null, every field. These were five 0-100 indicators and a composite
   * of them; see the note above `coverage()` for what they actually measured.
   * The keys and the `number | null` type are kept so nothing that reads them
   * breaks — it simply gets nothing instead of a plausible number.
   */
  scores: {
    accessibility: number | null;
    infrastructure: number | null;
    environment: number | null;
    development: number | null;
    investment: number | null;
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

/**
 * What was counted for one indicator, and how far the count can be trusted.
 *
 * It used to carry `score` (0-100) and `formula` (the arithmetic that produced
 * it, e.g. "25 + transit·6 + fuel·4 + markets·5"). Printing the arithmetic was
 * an honest gesture aimed at the wrong thing: showing your working does not
 * make the working mean anything, and no reader could tell you why a transit
 * stop was worth six and a fuel station four. Nobody could, including us.
 *
 * `score` is now always null. `formula` is replaced by `method`, which says in
 * words what was counted and where, and `weight` by `unit`, which says what
 * each figure is a count OF. The figures themselves are unchanged and are the
 * point: they are counts of features mapped in OpenStreetMap, which anyone can
 * open and check.
 */
export type ScoreExplain = {
  /** Always null. Nothing here produces a score. */
  score: number | null;
  /** Plain words: what was counted, over what area, from which source. */
  method: string;
  /**
   * `unit` says what the figure counts — never a weighting.
   *
   * `value` is null when the reading did not arrive. It used to be
   * `number`, and the climate factors filled a missing reading with
   * `?? 0` — so a point where the archive returned nothing published
   * "0 °C mean temperature" rather than admitting it did not know. A
   * count of zero and an absent reading are different facts and the
   * type now distinguishes them.
   */
  factors: Array<{ label: string; value: number | null; unit: string }>;
  /**
   * How well this area is mapped in the source data — a statement about the
   * dataset's coverage here, never a judgement of the place itself.
   */
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
    return await fetchPublicJson<NominatimResp>(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
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
      return await fetchPublicJson<OverpassResp>(ep, {
        method: "POST",
        headers: { "Content-Type": "text/plain", "User-Agent": UA },
        body: query,
      });
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
    const j = await fetchPublicJson<{
      daily?: { temperature_2m_mean?: number[]; precipitation_sum?: number[] };
    }>(url);
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

/**
 * What is mapped near this point, and how completely.
 *
 * WHAT THIS REPLACED
 *
 * Five indicators out of 100 and a composite of them. They were:
 *
 *   accessibility   25 + transit*6 + fuel*4 + markets*5
 *   infrastructure  20 + hospitals*5 + schools*4 + banks*4 + police*6
 *                      + fire*6 + government*3
 *   environment     55, +/-15 for a temperature band, +/-15 for a rainfall band
 *   development     (accessibility + infrastructure) / 2 + min(20, ...)
 *   investment      0.35*access + 0.35*infra + 0.15*env + 0.15*dev
 *
 * Three things were wrong with them, and the third is the one that mattered.
 *
 * The constants were invented. There is no source for a transit stop being
 * worth six and a fuel station four, and no reading of the result that could
 * be checked against anything.
 *
 * `environment` began at 55 and moved by fixed steps, so a point where the
 * climate API returned nothing still published 55 — the same constant-standing-
 * in-for-data defect the land engine was rewritten to remove.
 *
 * And the counts underneath were truncated before they were used. The Overpass
 * query returns at most 60 elements for the whole 3 km radius, and each
 * category is then cut to its 12 nearest. So a neighbourhood with twelve
 * schools and one with two hundred produced the same infrastructure figure.
 * The indicator could not distinguish them, while looking as though it had.
 *
 * WHAT IS HERE NOW
 *
 * The counts, named for what they count, with the cap stated wherever a
 * category hit it. Every one is checkable: open OpenStreetMap at this point
 * and count the same features. `confidence` is kept, and says how well mapped
 * this area is — a fact about the dataset, not a verdict on the place.
 */

/** Per-category cap applied in `extractFacilities`. A count at the cap means "at least". */
const LIST_CAP = 12;

export function coverage(
  facilities: Record<string, Wave4Facility[]>,
  climate: Wave4Intel["climate"],
) {
  const count = (k: string) => facilities[k]?.length ?? 0;
  /** Says what the figure is, and admits it when the list was cut short. */
  const within = (k: string) =>
    count(k) >= LIST_CAP
      ? `or more within 3 km — the list is capped at ${LIST_CAP}`
      : "mapped within 3 km";
  const COUNTED =
    "Counted from features mapped in OpenStreetMap within 3 km of this point, " +
    `at most ${LIST_CAP} per category. Open the map at this point and you can count the same features.`;
  // Coverage is per-category: a group may only claim as much coverage as the
  // features actually mapped in it. A group with nothing mapped says "low",
  // which is the honest reading of an empty count — it may mean there is
  // nothing there, or that nobody has mapped it yet, and from here those two
  // cannot be told apart.
  const band = (signal: number): ScoreExplain["confidence"] =>
    signal >= 15 ? "high" : signal >= 6 ? "medium" : "low";
  const RANK: Record<ScoreExplain["confidence"], number> = { low: 0, medium: 1, high: 2 };
  const weakest = (...cs: ScoreExplain["confidence"][]): ScoreExplain["confidence"] =>
    cs.reduce((a, b) => (RANK[b] < RANK[a] ? b : a), "high" as ScoreExplain["confidence"]);

  const accessSignal = count("transit") + count("fuel") + count("markets");
  const infraSignal =
    count("hospitals") +
    count("schools") +
    count("banks") +
    count("police") +
    count("fire") +
    count("government");
  const accessibilityConfidence = band(accessSignal);
  const infrastructureConfidence = band(infraSignal);
  // Community anchors are counted from the same Overpass response as access
  // and services, so they inherit the weakest coverage of the two.
  const developmentConfidence = weakest(accessibilityConfidence, infrastructureConfidence);
  // Climate is an independent source — good climate coverage says nothing
  // about how well the area is mapped in OpenStreetMap.
  const environmentConfidence: ScoreExplain["confidence"] =
    climate.meanTempC != null && climate.annualRainfallMm != null ? "high" : "low";
  // The summary group gathers the OSM-derived counts, so it is only as well
  // covered as the worst of them. Climate coverage must never speak for them.
  const investmentConfidence = weakest(
    accessibilityConfidence,
    infrastructureConfidence,
    developmentConfidence,
  );

  const breakdown: Wave4Intel["breakdown"] = {
    accessibility: {
      score: null,
      method: COUNTED,
      factors: [
        { label: "Transit stops", value: count("transit"), unit: within("transit") },
        { label: "Fuel stations", value: count("fuel"), unit: within("fuel") },
        { label: "Marketplaces", value: count("markets"), unit: within("markets") },
      ],
      confidence: accessibilityConfidence,
      note: "How you would reach this place and move from it. A mapped stop is not proof of a running service.",
    },
    infrastructure: {
      score: null,
      method: COUNTED,
      factors: [
        { label: "Healthcare", value: count("hospitals"), unit: within("hospitals") },
        { label: "Schools", value: count("schools"), unit: within("schools") },
        { label: "Banks / ATM", value: count("banks"), unit: within("banks") },
        { label: "Police", value: count("police"), unit: within("police") },
        { label: "Fire stations", value: count("fire"), unit: within("fire") },
        { label: "Government offices", value: count("government"), unit: within("government") },
      ],
      confidence: infrastructureConfidence,
      note: "Services mapped nearby. Presence is not capacity: none of these counts says whether a facility is open, staffed or able to take you.",
    },
    environment: {
      score: null,
      method:
        "Open-Meteo climate archive, EC-Earth3P-HR downscaled, averaged over 2010–2020. These are the long-run normals for the grid cell containing this point, not readings taken on this land.",
      factors: [
        {
          label: "Mean temperature",
          value: climate.meanTempC,
          unit: climate.meanTempC != null ? "°C, 2010–2020 mean" : "not returned",
        },
        {
          label: "Annual rainfall",
          value: climate.annualRainfallMm,
          unit: climate.annualRainfallMm != null ? "mm per year, 2010–2020 mean" : "not returned",
        },
      ],
      confidence: environmentConfidence,
      note: "A modelled climate normal for the surrounding grid cell. It describes the area's weather over a decade, and says nothing about this parcel's own drainage, shade or exposure.",
    },
    development: {
      score: null,
      method: COUNTED,
      factors: [
        { label: "Places of worship", value: count("worship"), unit: within("worship") },
        { label: "Marketplaces", value: count("markets"), unit: within("markets") },
      ],
      confidence: developmentConfidence,
      note: "Community anchors that are mapped here. This used to carry the claim that they 'correlate with settled, buildable neighbourhoods', which was asserted rather than measured and is not repeated.",
    },
    investment: {
      score: null,
      method:
        "A gathering of the counts above, not a calculation over them. Nothing here is weighted, combined or ranked.",
      factors: [
        { label: "Transit stops", value: count("transit"), unit: within("transit") },
        { label: "Healthcare", value: count("hospitals"), unit: within("hospitals") },
        { label: "Schools", value: count("schools"), unit: within("schools") },
        { label: "Marketplaces", value: count("markets"), unit: within("markets") },
      ],
      confidence: investmentConfidence,
      note: "HALISIA holds no prices, rents, yields, sales or approvals for this point and publishes no investment figure. What is mapped nearby is a starting point for your own questions, not an answer about money.",
    },
  };
  return {
    scores: {
      accessibility: null,
      infrastructure: null,
      environment: null,
      development: null,
      investment: null,
    },
    breakdown,
  };
}

/**
 * @deprecated Former name for `coverage`, kept so no existing import breaks.
 * It produces no scores; every `score` field it returns is null.
 */
export const score = coverage;

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

    if (!ovp || !Array.isArray(ovp.elements)) {
      throw new Error(
        "Public mapping provider unavailable. Nearby facility counts are not assessed; no absence of facilities is established.",
      );
    }

    const admin = classifyAdmin(nom);
    const facilities = extractFacilities(ovp, { lat: data.lat, lng: data.lng });
    const climate: Wave4Intel["climate"] = {
      annualRainfallMm: cli?.annualRainfallMm ?? null,
      meanTempC: cli?.meanTempC ?? null,
      tempMinC: cli?.tempMinC ?? null,
      tempMaxC: cli?.tempMaxC ?? null,
    };
    const { scores, breakdown } = coverage(facilities, climate);
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
