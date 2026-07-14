import { createServerFn } from "@tanstack/react-start";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

type PlaceLite = {
  id: string;
  name: string;
  address?: string;
  distanceKm?: number;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  photoRef?: string;
  location?: { lat: number; lng: number };
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
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.photos",
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
      }>;
    };
    return (j.places ?? []).map((p) => {
      const loc = p.location ? { lat: p.location.latitude, lng: p.location.longitude } : undefined;
      return {
        id: p.id,
        name: p.displayName?.text ?? "Unknown",
        address: p.formattedAddress,
        location: loc,
        distanceKm: loc ? haversineKm({ lat, lng }, loc) : undefined,
        rating: p.rating,
        userRatingCount: p.userRatingCount,
        types: p.types,
        photoRef: p.photos?.[0]?.name,
      };
    });
  } catch {
    return [];
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

    // Build photo URLs. Places Photos (New): GET /v1/{name}/media?maxWidthPx=...
    // The photo endpoint returns a redirect to an image; the browser key can hit it directly.
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
