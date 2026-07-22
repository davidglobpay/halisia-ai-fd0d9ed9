import { createServerFn } from "@tanstack/react-start";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

// -- Module-scope TTL cache (per Worker instance) ----------------------------
// Keeps details / route-matrix / photo lookups responsive when external
// providers are slow or intermittently failing. 15-minute TTL is short enough
// that opening-hours and live "open now" flags stay useful.
const TTL_MS = 15 * 60 * 1000;
type CacheEntry<T> = { at: number; value: T };
const memoCache = new Map<string, CacheEntry<unknown>>();
async function memo<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const hit = memoCache.get(key) as CacheEntry<T> | undefined;
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = await factory();
  memoCache.set(key, { at: Date.now(), value });
  return value;
}

type PlaceLite = {
  id: string;
  name: string;
  address?: string;
  distanceKm?: number;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  photoRef?: string;
  photoRefs?: string[];
  photoUrls?: string[];
  location?: { lat: number; lng: number };
  openNow?: boolean | null;
  weekdayText?: string[];
  phone?: string;
  website?: string;
  mapsUri?: string;
  priceLevel?: string;
  businessStatus?: string;
  driveMin?: number | null;
  walkMin?: number | null;
  driveKm?: number | null;
};

export type LocationIntel = {
  ok: true;
  coords: { lat: number; lng: number };
  elevation: { meters: number | null; resolution: number | null } | null;
  airQuality: {
    universalAqi: number | null;
    category: string | null;
    dominant: string | null;
    color: string | null;
  } | null;
  categories: {
    schools: PlaceLite[];
    hospitals: PlaceLite[];
    groceries: PlaceLite[];
    transit: PlaceLite[];
    restaurants: PlaceLite[];
    banks: PlaceLite[];
  };
  photos: string[]; // full photo URLs (through the gateway, with browser key)
  hero: PlaceLite | null;
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

async function callGateway(path: string, init?: RequestInit) {
  const lovable = process.env.LOVABLE_API_KEY;
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovable || !mapsKey) throw new Error("Google Maps not configured");
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${lovable}`);
  headers.set("X-Connection-Api-Key", mapsKey);
  return fetch(`${GATEWAY}${path}`, { ...init, headers });
}

async function fetchElevation(lat: number, lng: number) {
  try {
    const res = await callGateway(`/maps/api/elevation/json?locations=${lat},${lng}`);
    if (!res.ok) return null;
    const j = (await res.json()) as {
      results?: Array<{ elevation: number; resolution: number }>;
    };
    const r = j.results?.[0];
    return r ? { meters: r.elevation, resolution: r.resolution } : null;
  } catch {
    return null;
  }
}

async function fetchAirQuality(lat: number, lng: number) {
  try {
    const res = await callGateway(`/airquality/v1/currentConditions:lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: { latitude: lat, longitude: lng } }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      indexes?: Array<{
        code: string;
        displayName: string;
        aqi: number;
        category: string;
        dominantPollutant?: string;
        color?: { red?: number; green?: number; blue?: number };
      }>;
    };
    const uni = j.indexes?.find((i) => i.code === "uaqi") ?? j.indexes?.[0];
    if (!uni) return null;
    const c = uni.color;
    const rgb = c
      ? `rgb(${Math.round((c.red ?? 0) * 255)}, ${Math.round((c.green ?? 0) * 255)}, ${Math.round((c.blue ?? 0) * 255)})`
      : null;
    return {
      universalAqi: uni.aqi,
      category: uni.category,
      dominant: uni.dominantPollutant ?? null,
      color: rgb,
    };
  } catch {
    return null;
  }
}

async function fetchNearby(
  lat: number,
  lng: number,
  includedTypes: string[],
  max = 6,
): Promise<PlaceLite[]> {
  try {
    const res = await callGateway(`/places/v1/places:searchNearby`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.photos,places.regularOpeningHours,places.currentOpeningHours,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.businessStatus,places.priceLevel",
      },
      body: JSON.stringify({
        includedTypes,
        maxResultCount: max,
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lng }, radius: 3000 },
        },
      }),
    });
    if (!res.ok) return [];
    const j = (await res.json()) as {
      places?: Array<{
        id: string;
        displayName?: { text: string };
        formattedAddress?: string;
        location?: { latitude: number; longitude: number };
        rating?: number;
        userRatingCount?: number;
        types?: string[];
        photos?: Array<{ name: string }>;
        regularOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
        currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
        nationalPhoneNumber?: string;
        internationalPhoneNumber?: string;
        websiteUri?: string;
        googleMapsUri?: string;
        businessStatus?: string;
        priceLevel?: string;
      }>;
    };
    return (j.places ?? []).map((p) => {
      const loc = p.location ? { lat: p.location.latitude, lng: p.location.longitude } : undefined;
      const oh = p.currentOpeningHours ?? p.regularOpeningHours;
      const photoRefs = (p.photos ?? []).map((x) => x.name).filter(Boolean).slice(0, 4);
      return {
        id: p.id,
        name: p.displayName?.text ?? "Unknown",
        address: p.formattedAddress,
        location: loc,
        distanceKm: loc ? haversineKm({ lat, lng }, loc) : undefined,
        rating: p.rating,
        userRatingCount: p.userRatingCount,
        types: p.types,
        photoRef: photoRefs[0],
        photoRefs,
        openNow: oh?.openNow ?? null,
        weekdayText: oh?.weekdayDescriptions,
        phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber,
        website: p.websiteUri,
        mapsUri: p.googleMapsUri,
        priceLevel: p.priceLevel,
        businessStatus: p.businessStatus,
      };
    });
  } catch {
    return [];
  }
}

async function fetchRouteMatrix(
  origin: { lat: number; lng: number },
  destinations: Array<{ lat: number; lng: number }>,
  mode: "DRIVE" | "WALK",
): Promise<Array<{ minutes: number | null; km: number | null }>> {
  if (!destinations.length) return [];
  const key = `rm|${mode}|${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}|${destinations
    .map((d) => `${d.lat.toFixed(4)},${d.lng.toFixed(4)}`)
    .join(";")}`;
  try {
    return await memo(key, async () => {
    const res = await callGateway(`/routes/distanceMatrix/v2:computeRouteMatrix`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,condition",
      },
      body: JSON.stringify({
        origins: [
          {
            waypoint: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
          },
        ],
        destinations: destinations.map((d) => ({
          waypoint: { location: { latLng: { latitude: d.lat, longitude: d.lng } } },
        })),
        travelMode: mode,
        ...(mode === "DRIVE" ? { routingPreference: "TRAFFIC_AWARE" } : {}),
      }),
    });
    if (!res.ok) return destinations.map(() => ({ minutes: null, km: null }));
    const text = await res.text();
    // Response is a JSON array (or NDJSON). Parse defensively.
    let items: Array<{
      destinationIndex?: number;
      duration?: string;
      distanceMeters?: number;
      condition?: string;
    }> = [];
    try {
      const parsed = JSON.parse(text);
      items = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      items = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          try {
            return JSON.parse(l);
          } catch {
            return null;
          }
        })
        .filter(Boolean) as typeof items;
    }
    const out = destinations.map(() => ({ minutes: null as number | null, km: null as number | null }));
    for (const it of items) {
      const idx = it.destinationIndex ?? 0;
      if (idx < 0 || idx >= out.length) continue;
      if (it.condition && it.condition !== "ROUTE_EXISTS") continue;
      const secs = it.duration ? parseInt(String(it.duration).replace(/s$/, ""), 10) : NaN;
      out[idx] = {
        minutes: Number.isFinite(secs) ? Math.round(secs / 60) : null,
        km: typeof it.distanceMeters === "number" ? it.distanceMeters / 1000 : null,
      };
    }
    return out;
    });
  } catch {
    return destinations.map(() => ({ minutes: null, km: null }));
  }
}

export const getLocationIntel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const v = input as { lat?: number; lng?: number };
    if (typeof v?.lat !== "number" || typeof v?.lng !== "number")
      throw new Error("lat/lng required");
    return { lat: v.lat, lng: v.lng };
  })
  .handler(async ({ data }): Promise<LocationIntel> => {
    const browserKey = process.env.GOOGLE_MAPS_BROWSER_KEY;
    const [elevation, airQuality, schools, hospitals, groceries, transit, restaurants, banks] =
      await Promise.all([
        fetchElevation(data.lat, data.lng),
        fetchAirQuality(data.lat, data.lng),
        fetchNearby(data.lat, data.lng, ["school", "primary_school", "secondary_school"], 6),
        fetchNearby(data.lat, data.lng, ["hospital", "doctor", "pharmacy"], 6),
        fetchNearby(data.lat, data.lng, ["supermarket", "grocery_store"], 6),
        fetchNearby(data.lat, data.lng, ["bus_station", "transit_station", "train_station"], 6),
        fetchNearby(data.lat, data.lng, ["restaurant", "cafe"], 6),
        fetchNearby(data.lat, data.lng, ["bank", "atm"], 6),
      ]);

    // Compute walking + driving times for all destinations in two matrix calls.
    const all = [...schools, ...hospitals, ...groceries, ...transit, ...restaurants, ...banks];
    const dests = all
      .map((p, i) => ({ p, i, loc: p.location }))
      .filter((x) => !!x.loc) as Array<{
      p: PlaceLite;
      i: number;
      loc: { lat: number; lng: number };
    }>;
    if (dests.length) {
      const [drive, walk] = await Promise.all([
        fetchRouteMatrix(data, dests.map((d) => d.loc), "DRIVE"),
        fetchRouteMatrix(data, dests.map((d) => d.loc), "WALK"),
      ]);
      dests.forEach((d, k) => {
        d.p.driveMin = drive[k]?.minutes ?? null;
        d.p.driveKm = drive[k]?.km ?? null;
        d.p.walkMin = walk[k]?.minutes ?? null;
      });
    }

    // Build photo URLs. Places Photos (New): GET /v1/{name}/media?maxWidthPx=...
    // The photo endpoint returns a redirect to an image; the browser key can hit it directly.
    if (browserKey) {
      for (const p of all) {
        p.photoUrls = (p.photoRefs ?? []).map(
          (name) => `https://places.googleapis.com/v1/${name}/media?maxWidthPx=640&key=${browserKey}`,
        );
      }
    }
    const photoRefs = [...schools, ...hospitals, ...groceries, ...restaurants, ...transit, ...banks]
      .map((p) => p.photoRef)
      .filter((x): x is string => !!x)
      .slice(0, 8);
    const photos = browserKey
      ? photoRefs.map(
          (name) =>
            `https://places.googleapis.com/v1/${name}/media?maxWidthPx=640&key=${browserKey}`,
        )
      : [];

    const hero =
      [...restaurants, ...schools, ...hospitals, ...groceries].find((p) => p.photoRef) ?? null;

    return {
      ok: true,
      coords: { lat: data.lat, lng: data.lng },
      elevation,
      airQuality,
      categories: { schools, hospitals, groceries, transit, restaurants, banks },
      photos,
      hero,
    };
  });

// -- On-demand place details (reviews, extra photos) ---------------------------

export type PlaceReview = {
  author?: string;
  rating?: number;
  text?: string;
  relativeTime?: string;
};

export type PlaceDetails = {
  id: string;
  name?: string;
  rating?: number;
  userRatingCount?: number;
  address?: string;
  phone?: string;
  website?: string;
  mapsUri?: string;
  openNow?: boolean | null;
  weekdayText?: string[];
  photoUrls: string[];
  reviews: PlaceReview[];
};

export const getPlaceDetails = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const v = input as { id?: string };
    if (typeof v?.id !== "string" || !v.id) throw new Error("place id required");
    return { id: v.id };
  })
  .handler(async ({ data }): Promise<PlaceDetails> => {
    const browserKey = process.env.GOOGLE_MAPS_BROWSER_KEY;
    const res = await callGateway(`/places/v1/${data.id}`, {
      method: "GET",
      headers: {
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,rating,userRatingCount,nationalPhoneNumber,internationalPhoneNumber,websiteUri,googleMapsUri,regularOpeningHours,currentOpeningHours,photos,reviews",
      },
    });
    if (!res.ok) throw new Error(`Places details ${res.status}`);
    const p = (await res.json()) as {
      id: string;
      displayName?: { text: string };
      formattedAddress?: string;
      rating?: number;
      userRatingCount?: number;
      nationalPhoneNumber?: string;
      internationalPhoneNumber?: string;
      websiteUri?: string;
      googleMapsUri?: string;
      regularOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
      currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
      photos?: Array<{ name: string }>;
      reviews?: Array<{
        authorAttribution?: { displayName?: string };
        rating?: number;
        text?: { text?: string };
        relativePublishTimeDescription?: string;
      }>;
    };
    const oh = p.currentOpeningHours ?? p.regularOpeningHours;
    const photoRefs = (p.photos ?? []).map((x) => x.name).slice(0, 6);
    return {
      id: p.id,
      name: p.displayName?.text,
      rating: p.rating,
      userRatingCount: p.userRatingCount,
      address: p.formattedAddress,
      phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber,
      website: p.websiteUri,
      mapsUri: p.googleMapsUri,
      openNow: oh?.openNow ?? null,
      weekdayText: oh?.weekdayDescriptions,
      photoUrls: browserKey
        ? photoRefs.map(
            (n) => `https://places.googleapis.com/v1/${n}/media?maxWidthPx=800&key=${browserKey}`,
          )
        : [],
      reviews: (p.reviews ?? []).slice(0, 5).map((r) => ({
        author: r.authorAttribution?.displayName,
        rating: r.rating,
        text: r.text?.text,
        relativeTime: r.relativePublishTimeDescription,
      })),
    };
  });
