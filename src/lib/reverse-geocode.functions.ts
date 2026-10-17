import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const reverseGeocode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const v = input as { lat?: number; lng?: number };
    if (typeof v?.lat !== "number" || typeof v?.lng !== "number")
      throw new Error("lat/lng required");
    return { lat: v.lat, lng: v.lng };
  })
  .handler(async ({ data }) => {
    const lovable = process.env.LOVABLE_API_KEY;
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovable || !mapsKey) throw new Error("Google Maps not configured");
    const url = `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?latlng=${data.lat},${data.lng}&region=ke`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": mapsKey,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("Reverse geocode failed", res.status, body);
      throw new Error(`Reverse geocode failed [${res.status}]`);
    }
    const json = (await res.json()) as {
      status: string;
      results: Array<{
        formatted_address: string;
        place_id: string;
        address_components?: Array<{ long_name: string; types: string[] }>;
      }>;
    };
    if (json.status !== "OK" || !json.results.length) {
      return {
        ok: true as const,
        address: `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}`,
        placeId: null,
        admin: { locality: null, subCounty: null, ward: null },
      };
    }
    // Pull the administrative hierarchy Google reports across all results.
    const pick = (type: string) => {
      for (const r of json.results) {
        const c = r.address_components?.find((x) => x.types.includes(type));
        if (c) return c.long_name;
      }
      return null;
    };
    return {
      ok: true as const,
      address: json.results[0].formatted_address,
      placeId: json.results[0].place_id,
      admin: {
        locality: pick("locality") ?? pick("sublocality"),
        subCounty: pick("administrative_area_level_2"),
        ward: pick("administrative_area_level_3") ?? pick("sublocality_level_1"),
      },
    };
  });
