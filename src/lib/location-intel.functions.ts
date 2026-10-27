import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SliceProvenance, SnapshotMeta } from "@/lib/intel-snapshot.types";

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
  primaryType?: string;
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
  /**
   * Per-provider health so the UI can tell "0 hospitals found" apart from
   * "hospital data unavailable". Never contains keys or secrets.
   */
  providers: ProviderHealthMap;
  /** Per-dataset provenance + freshness for the persisted snapshot. */
  snapshot: SnapshotMeta;
};

export type ProviderStatus = "ok" | "degraded" | "unavailable";
export type ProviderHealth = {
  status: ProviderStatus;
  /** Concise, non-secret reason (HTTP status or short error class). */
  reason?: string;
  httpStatus?: number;
};
export type ProviderHealthMap = {
  elevation: ProviderHealth;
  airQuality: ProviderHealth;
  places: ProviderHealth;
  routes: ProviderHealth;
};

const OK: ProviderHealth = { status: "ok" };

/** Strip anything that could carry a key/URL query string out of an error. */
function safeReason(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/[?&](key|apikey|api_key)=[^&\s]*/gi, "").slice(0, 120);
}

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
    if (!res.ok)
      return {
        value: null,
        health: {
          status: "unavailable" as const,
          reason: `HTTP ${res.status}`,
          httpStatus: res.status,
        },
      };
    const j = (await res.json()) as {
      results?: Array<{ elevation: number; resolution: number }>;
    };
    const r = j.results?.[0];
    return {
      value: r ? { meters: r.elevation, resolution: r.resolution } : null,
      // A 200 with no result is a genuine no-data answer, not a failure.
      health: r ? OK : ({ status: "degraded", reason: "no result" } as ProviderHealth),
    };
  } catch (err) {
    return {
      value: null,
      health: { status: "unavailable" as const, reason: safeReason(err) },
    };
  }
}

async function fetchAirQuality(lat: number, lng: number) {
  try {
    const res = await callGateway(`/airquality/v1/currentConditions:lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: { latitude: lat, longitude: lng } }),
    });
    if (!res.ok)
      return {
        value: null,
        health: {
          status: "unavailable" as const,
          reason: `HTTP ${res.status}`,
          httpStatus: res.status,
        },
      };
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
    if (!uni)
      return { value: null, health: { status: "degraded", reason: "no index" } as ProviderHealth };
    const c = uni.color;
    const rgb = c
      ? `rgb(${Math.round((c.red ?? 0) * 255)}, ${Math.round((c.green ?? 0) * 255)}, ${Math.round((c.blue ?? 0) * 255)})`
      : null;
    return {
      value: {
        universalAqi: uni.aqi,
        category: uni.category,
        dominant: uni.dominantPollutant ?? null,
        color: rgb,
      },
      health: OK,
    };
  } catch (err) {
    return { value: null, health: { status: "unavailable" as const, reason: safeReason(err) } };
  }
}

async function fetchNearby(
  lat: number,
  lng: number,
  includedTypes: string[],
  max = 6,
): Promise<{ value: PlaceLite[]; health: ProviderHealth }> {
  try {
    const res = await callGateway(`/places/v1/places:searchNearby`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.primaryType,places.photos,places.regularOpeningHours,places.currentOpeningHours,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.businessStatus,places.priceLevel",
      },
      body: JSON.stringify({
        includedTypes,
        maxResultCount: max,
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lng }, radius: 3000 },
        },
      }),
    });
    if (!res.ok)
      return {
        value: [],
        health: { status: "unavailable", reason: `HTTP ${res.status}`, httpStatus: res.status },
      };
    const j = (await res.json()) as {
      places?: Array<{
        id: string;
        displayName?: { text: string };
        formattedAddress?: string;
        location?: { latitude: number; longitude: number };
        rating?: number;
        userRatingCount?: number;
        primaryType?: string;
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
    const value = (j.places ?? []).map((p) => {
      const loc = p.location ? { lat: p.location.latitude, lng: p.location.longitude } : undefined;
      const oh = p.currentOpeningHours ?? p.regularOpeningHours;
      const photoRefs = (p.photos ?? [])
        .map((x) => x.name)
        .filter(Boolean)
        .slice(0, 4);
      return {
        id: p.id,
        name: p.displayName?.text ?? "Unknown",
        address: p.formattedAddress,
        location: loc,
        distanceKm: loc ? haversineKm({ lat, lng }, loc) : undefined,
        rating: p.rating,
        userRatingCount: p.userRatingCount,
        primaryType: p.primaryType,
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
    return { value, health: OK };
  } catch (err) {
    return { value: [], health: { status: "unavailable", reason: safeReason(err) } };
  }
}

async function fetchRouteMatrix(
  origin: { lat: number; lng: number },
  destinations: Array<{ lat: number; lng: number }>,
  mode: "DRIVE" | "WALK",
): Promise<{
  value: Array<{ minutes: number | null; km: number | null }>;
  health: ProviderHealth;
}> {
  if (!destinations.length) return { value: [], health: OK };
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
      if (!res.ok)
        return {
          value: destinations.map(() => ({ minutes: null, km: null })),
          health: {
            status: "unavailable",
            reason: `HTTP ${res.status}`,
            httpStatus: res.status,
          } as ProviderHealth,
        };
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
      const out = destinations.map(() => ({
        minutes: null as number | null,
        km: null as number | null,
      }));
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
      return { value: out, health: OK };
    });
  } catch (err) {
    return {
      value: destinations.map(() => ({ minutes: null, km: null })),
      health: { status: "unavailable", reason: safeReason(err) },
    };
  }
}

/** Cached shape of the Places+Routes slice (no key-bearing URLs). */
type PlacesSlicePayload = {
  categories: LocationIntel["categories"];
  photoRefs: string[];
  heroId: string | null;
  places: ProviderHealth;
  routes: ProviderHealth;
};

export const getLocationIntel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const v = input as { lat?: number; lng?: number; parcelId?: string; refresh?: boolean };
    if (typeof v?.lat !== "number" || typeof v?.lng !== "number")
      throw new Error("lat/lng required");
    return {
      lat: v.lat,
      lng: v.lng,
      // Caller-supplied parcel ids are never trusted as shared cache keys.
      parcelId: null as string | null,
      refresh: v.refresh === true,
    };
  })
  .handler(async ({ data }): Promise<LocationIntel> => {
    const browserKey = process.env.GOOGLE_MAPS_BROWSER_KEY;
    const snap = await import("@/lib/intel-snapshot.server");
    const key = snap.locationKey(data.lat, data.lng, data.parcelId);
    const cached = data.refresh ? {} : await snap.readSnapshot(key);
    const provenance: SnapshotMeta["slices"] = {};

    // -- Elevation slice (stable; long TTL) ------------------------------------
    let elevation: LocationIntel["elevation"] = null;
    let elevationHealth: ProviderHealth = OK;
    const elevationHit = cached.elevation;
    if (elevationHit) {
      elevation = elevationHit.payload as LocationIntel["elevation"];
      elevationHealth = { status: elevationHit.provenance.status };
      provenance.elevation = elevationHit.provenance;
    }

    // -- Air quality slice (hours-scale TTL) -----------------------------------
    let airQuality: LocationIntel["airQuality"] = null;
    let airHealth: ProviderHealth = OK;
    const airHit = cached.air_quality;
    if (airHit) {
      airQuality = airHit.payload as LocationIntel["airQuality"];
      airHealth = { status: airHit.provenance.status };
      provenance.air_quality = airHit.provenance;
    }

    // -- Places + routes slice (~30-day TTL) -----------------------------------
    let slice: PlacesSlicePayload | null = null;
    const placesHit = cached.places;
    if (placesHit) {
      slice = placesHit.payload as PlacesSlicePayload;
      provenance.places = placesHit.provenance;
    }

    // Refresh only the missing / stale slices. Each is independent, so one
    // provider failing preserves the rest of the snapshot.
    const [elevationR, airQualityR] = await Promise.all([
      elevationHit ? null : fetchElevation(data.lat, data.lng),
      airHit ? null : fetchAirQuality(data.lat, data.lng),
    ]);

    if (elevationR) {
      elevation = elevationR.value;
      elevationHealth = elevationR.health;
      provenance.elevation =
        elevationR.health.status === "unavailable"
          ? snap.failedProvenance("elevation", elevationR.health.reason)
          : await snap.writeSlice({
              key,
              lat: data.lat,
              lng: data.lng,
              parcelId: data.parcelId,
              slice: "elevation",
              status: elevationR.health.status,
              reason: elevationR.health.reason ?? null,
              payload: elevationR.value,
            });
    }

    if (airQualityR) {
      airQuality = airQualityR.value;
      airHealth = airQualityR.health;
      provenance.air_quality =
        airQualityR.health.status === "unavailable"
          ? snap.failedProvenance("air_quality", airQualityR.health.reason)
          : await snap.writeSlice({
              key,
              lat: data.lat,
              lng: data.lng,
              parcelId: data.parcelId,
              slice: "air_quality",
              status: airQualityR.health.status,
              reason: airQualityR.health.reason ?? null,
              payload: airQualityR.value,
            });
    }

    if (!slice) {
      const [schoolsR, hospitalsR, groceriesR, transitR, restaurantsR, banksR] = await Promise.all([
        fetchNearby(data.lat, data.lng, ["school", "primary_school", "secondary_school"], 6),
        fetchNearby(data.lat, data.lng, ["hospital", "doctor", "pharmacy"], 6),
        fetchNearby(data.lat, data.lng, ["supermarket", "grocery_store"], 6),
        fetchNearby(data.lat, data.lng, ["bus_station", "transit_station", "train_station"], 6),
        fetchNearby(data.lat, data.lng, ["restaurant", "cafe"], 6),
        fetchNearby(data.lat, data.lng, ["bank", "atm"], 6),
      ]);

      const schools = schoolsR.value;
      const hospitals = hospitalsR.value;
      const groceries = groceriesR.value;
      const transit = transitR.value;
      const restaurants = restaurantsR.value;
      const banks = banksR.value;

      // Aggregate Places health: any hard failure degrades the module; all
      // failing makes it unavailable. This is what lets the UI say
      // "hospital data unavailable" instead of "0 hospitals".
      const placesHealths = [schoolsR, hospitalsR, groceriesR, transitR, restaurantsR, banksR].map(
        (r) => r.health,
      );
      const failed = placesHealths.filter((h) => h.status !== "ok");
      const places: ProviderHealth =
        failed.length === 0
          ? OK
          : failed.length === placesHealths.length
            ? { status: "unavailable", reason: failed[0]?.reason ?? "all place queries failed" }
            : { status: "degraded", reason: `${failed.length}/6 place queries failed` };

      let routes: ProviderHealth = OK;

      // Compute walking + driving times for all destinations in two matrix calls.
      const all = [...schools, ...hospitals, ...groceries, ...transit, ...restaurants, ...banks];
      const dests = all.map((p, i) => ({ p, i, loc: p.location })).filter((x) => !!x.loc) as Array<{
        p: PlaceLite;
        i: number;
        loc: { lat: number; lng: number };
      }>;
      if (dests.length) {
        const [drive, walk] = await Promise.all([
          fetchRouteMatrix(
            data,
            dests.map((d) => d.loc),
            "DRIVE",
          ),
          fetchRouteMatrix(
            data,
            dests.map((d) => d.loc),
            "WALK",
          ),
        ]);
        routes =
          drive.health.status === "ok" && walk.health.status === "ok"
            ? OK
            : drive.health.status !== "ok" && walk.health.status !== "ok"
              ? { status: "unavailable", reason: drive.health.reason ?? walk.health.reason }
              : { status: "degraded", reason: drive.health.reason ?? walk.health.reason };
        dests.forEach((d, k) => {
          d.p.driveMin = drive.value[k]?.minutes ?? null;
          d.p.driveKm = drive.value[k]?.km ?? null;
          d.p.walkMin = walk.value[k]?.minutes ?? null;
        });
      }

      const photoRefs = [
        ...schools,
        ...hospitals,
        ...groceries,
        ...restaurants,
        ...transit,
        ...banks,
      ]
        .map((p) => p.photoRef)
        .filter((x): x is string => !!x)
        .slice(0, 8);

      const heroPick =
        [...restaurants, ...schools, ...hospitals, ...groceries].find((p) => p.photoRef) ?? null;

      slice = {
        categories: { schools, hospitals, groceries, transit, restaurants, banks },
        photoRefs,
        heroId: heroPick?.id ?? null,
        places,
        routes,
      };

      // A hard Places failure is never persisted as a fresh snapshot.
      provenance.places =
        places.status === "unavailable"
          ? snap.failedProvenance("places", places.reason)
          : await snap.writeSlice({
              key,
              lat: data.lat,
              lng: data.lng,
              parcelId: data.parcelId,
              slice: "places",
              status: places.status,
              reason: places.reason ?? null,
              payload: slice,
            });
    }

    const categories = slice.categories;
    const all = [
      ...categories.schools,
      ...categories.hospitals,
      ...categories.groceries,
      ...categories.transit,
      ...categories.restaurants,
      ...categories.banks,
    ];

    // Photo URLs are rebuilt at read time; the browser key is never persisted.
    if (browserKey) {
      for (const p of all) {
        p.photoUrls = (p.photoRefs ?? []).map(
          (name) =>
            `https://places.googleapis.com/v1/${name}/media?maxWidthPx=640&key=${browserKey}`,
        );
      }
    }
    const photos = browserKey
      ? slice.photoRefs.map(
          (name) =>
            `https://places.googleapis.com/v1/${name}/media?maxWidthPx=640&key=${browserKey}`,
        )
      : [];
    const hero = all.find((p) => p.id === slice!.heroId) ?? null;

    return {
      ok: true,
      coords: { lat: data.lat, lng: data.lng },
      elevation,
      airQuality,
      categories,
      photos,
      hero,
      providers: {
        elevation: elevationHealth,
        airQuality: airHealth,
        places: slice.places,
        routes: slice.routes,
      },
      snapshot: {
        key,
        slices: provenance,
      },
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const v = input as { id?: string };
    if (typeof v?.id !== "string" || !v.id) throw new Error("place id required");
    return { id: v.id };
  })
  .handler(async ({ data }): Promise<PlaceDetails> => {
    const browserKey = process.env.GOOGLE_MAPS_BROWSER_KEY;
    return memo(`pd|${data.id}|${browserKey ? "b" : "n"}`, async () => {
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
  });
