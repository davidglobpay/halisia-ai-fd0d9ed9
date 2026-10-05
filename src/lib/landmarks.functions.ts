import { createServerFn } from "@tanstack/react-start";

/**
 * Find a landmark near a point, so a person can walk the map to their plot.
 *
 * A geocoder answers "where is this NAME?". A parcel has no name, so the best
 * a geocoder can ever return is the centroid of the ward or town the parcel
 * sits in — in testing, 359 m out for Mtwapa and 3.7 km for Kanduyi. No amount
 * of tuning closes that gap, because the question itself is unanswerable from
 * a name.
 *
 * What a seller or an agent DOES know is what the plot is near: a school, a
 * church, a shopping centre, a river, a murram turn-off. This searches for that
 * landmark around the current point and hands back candidates with a bearing
 * and a distance, so the map can be walked to the right neighbourhood and the
 * pin dropped by eye on satellite imagery.
 *
 * The result is never a parcel and never a boundary. It is a way of getting a
 * human close enough to recognise their own land.
 */

export type Landmark = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** Straight-line metres from the point searched around. */
  distanceM: number;
  /** Compass direction from that point, e.g. "NE". */
  bearing: string;
  /** Google's own place types, lightly filtered. */
  kinds: string[];
};

/** Metres between two WGS84 points. Haversine; good to a metre at this scale. */
function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const p1 = (aLat * Math.PI) / 180;
  const p2 = (bLat * Math.PI) / 180;
  const dp = ((bLat - aLat) * Math.PI) / 180;
  const dl = ((bLng - aLng) * Math.PI) / 180;
  const h =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/** Compass point from a to b. Eight-way is as precise as this is useful. */
function bearingOf(aLat: number, aLng: number, bLat: number, bLng: number): string {
  const p1 = (aLat * Math.PI) / 180;
  const p2 = (bLat * Math.PI) / 180;
  const dl = ((bLng - aLng) * Math.PI) / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return COMPASS[Math.round(deg / 45) % 8];
}

/** Google's generic types carry no meaning for a reader. Drop them. */
const NOISE = new Set(["point_of_interest", "establishment", "political", "geocode"]);

export const findLandmarks = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const v = input as { query?: string; lat?: number; lng?: number; radiusM?: number };
    if (!v?.query || typeof v.query !== "string") throw new Error("query required");
    if (typeof v.lat !== "number" || typeof v.lng !== "number") {
      throw new Error("lat and lng required");
    }
    if (v.lat < -5 || v.lat > 5.5 || v.lng < 33.5 || v.lng > 42.5) {
      // Kenya's bounding box. A search centred outside it is a bug upstream,
      // and biasing Google to the wrong continent returns confident nonsense.
      throw new Error("point outside Kenya");
    }
    return {
      query: v.query.trim().slice(0, 120),
      lat: v.lat,
      lng: v.lng,
      radiusM: Math.min(50_000, Math.max(500, Math.round(v.radiusM ?? 15_000))),
    };
  })
  .handler(async ({ data }) => {
    const lovable = process.env.LOVABLE_API_KEY;
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovable || !mapsKey) throw new Error("Google Maps not configured");

    const url =
      `https://connector-gateway.lovable.dev/google_maps/maps/api/place/textsearch/json` +
      `?query=${encodeURIComponent(data.query)}` +
      `&location=${data.lat},${data.lng}` +
      `&radius=${data.radiusM}` +
      `&region=ke`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": mapsKey,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("Landmark search failed", res.status, body);
      return { ok: false as const, reason: `Search failed [${res.status}]`, results: [] };
    }

    const json = (await res.json()) as {
      status: string;
      results?: Array<{
        name?: string;
        formatted_address?: string;
        types?: string[];
        geometry?: { location?: { lat: number; lng: number } };
      }>;
    };

    if (json.status === "ZERO_RESULTS" || !json.results?.length) {
      return {
        ok: true as const,
        results: [] as Landmark[],
        reason: "Nothing by that name near this point. Try a bigger landmark, or a different name.",
      };
    }
    if (json.status !== "OK") {
      console.error("Landmark search status", json.status);
      return { ok: false as const, reason: `Search returned ${json.status}`, results: [] };
    }

    const results: Landmark[] = json.results
      .map((r) => {
        const loc = r.geometry?.location;
        if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") return null;
        return {
          name: r.name ?? "Unnamed place",
          address: r.formatted_address ?? "",
          lat: loc.lat,
          lng: loc.lng,
          distanceM: Math.round(haversine(data.lat, data.lng, loc.lat, loc.lng)),
          bearing: bearingOf(data.lat, data.lng, loc.lat, loc.lng),
          kinds: (r.types ?? []).filter((t) => !NOISE.has(t)).slice(0, 3),
        };
      })
      .filter((r): r is Landmark => r !== null)
      // Nearest first. Google orders by its own relevance, which for this job
      // is the wrong order — the person is trying to get close, not to find
      // the most famous place of that name.
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 8);

    return { ok: true as const, results, reason: null };
  });
