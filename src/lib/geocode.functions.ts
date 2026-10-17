import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const geocodeAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const v = input as { query?: string };
    if (!v?.query || typeof v.query !== "string") throw new Error("query required");
    return { query: v.query.trim().slice(0, 200) };
  })
  .handler(async ({ data }) => {
    const lovable = process.env.LOVABLE_API_KEY;
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovable || !mapsKey) throw new Error("Google Maps not configured");
    // `region=ke` is only a bias — Google will still return a match outside
    // Kenya if the text looks foreign. `components=country:KE` is a filter, so
    // a deed naming a place that does not exist here returns nothing instead of
    // a confident pin in the wrong country.
    const url = `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?address=${encodeURIComponent(
      data.query,
    )}&region=ke&components=${encodeURIComponent("country:KE")}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": mapsKey,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("Geocode failed", res.status, body);
      throw new Error(`Geocode failed [${res.status}]`);
    }
    const json = (await res.json()) as {
      status: string;
      results: Array<{
        formatted_address: string;
        geometry: {
          location: { lat: number; lng: number };
          location_type?: string;
          /** Google's own bounding box for the match. The honest radius. */
          viewport?: {
            northeast: { lat: number; lng: number };
            southwest: { lat: number; lng: number };
          };
        };
        place_id: string;
        types?: string[];
        partial_match?: boolean;
      }>;
    };
    if (json.status !== "OK" || !json.results.length) {
      return { ok: false as const };
    }
    // Prefer the tightest match Google offers rather than blindly taking the
    // first. ROOFTOP is a building; APPROXIMATE is a neighbourhood.
    const RANK: Record<string, number> = {
      ROOFTOP: 0,
      RANGE_INTERPOLATED: 1,
      GEOMETRIC_CENTER: 2,
      APPROXIMATE: 3,
    };
    const top = [...json.results].sort(
      (a, b) =>
        (RANK[a.geometry.location_type ?? "APPROXIMATE"] ?? 3) -
        (RANK[b.geometry.location_type ?? "APPROXIMATE"] ?? 3),
    )[0];

    // Half the diagonal of Google's own viewport, in metres. This is a measured
    // uncertainty rather than a lookup-table guess, and it is what the map
    // draws as a circle so nobody reads the pin as a surveyed point.
    const vp = top.geometry.viewport;
    let radiusM: number | null = null;
    if (vp) {
      const latSpan = Math.abs(vp.northeast.lat - vp.southwest.lat) * 111_320;
      const lngSpan =
        Math.abs(vp.northeast.lng - vp.southwest.lng) *
        111_320 *
        Math.cos((top.geometry.location.lat * Math.PI) / 180);
      radiusM = Math.round(Math.sqrt(latSpan * latSpan + lngSpan * lngSpan) / 2);
    }

    return {
      ok: true as const,
      address: top.formatted_address,
      lat: top.geometry.location.lat,
      lng: top.geometry.location.lng,
      placeId: top.place_id,
      /** Google precision class: ROOFTOP | RANGE_INTERPOLATED | GEOMETRIC_CENTER | APPROXIMATE */
      locationType: top.geometry.location_type ?? "APPROXIMATE",
      types: top.types ?? [],
      /** Half-diagonal of Google's viewport in metres, or null if none given. */
      radiusM,
      /** True when Google had to guess at part of the query. */
      partialMatch: Boolean(top.partial_match),
      /** How many candidates Google returned, before the tightest was chosen. */
      candidates: json.results.length,
    };
  });
