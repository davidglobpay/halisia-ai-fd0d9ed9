import { createServerFn } from "@tanstack/react-start";
import { findKenyaGazetteerPlace } from "@/lib/kenya-gazetteer";

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const v = input as { query?: string };
    if (!v?.query || typeof v.query !== "string") throw new Error("query required");
    return { query: v.query.trim().slice(0, 200) };
  })
  .handler(async ({ data }) => {
    const fallback = findKenyaGazetteerPlace(data.query);
    const lovable = process.env.LOVABLE_API_KEY;
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;

    // Local fallback results are explicitly tagged. They are place indicators,
    // never registry, survey, title or Google-verified records.
    if (!lovable || !mapsKey) {
      return fallback ? { ok: true as const, ...fallback } : { ok: false as const };
    }

    const url = `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?address=${encodeURIComponent(
      data.query + ", Kenya",
    )}&region=ke`;

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${lovable}`,
          "X-Connection-Api-Key": mapsKey,
        },
      });
      if (!res.ok) {
        const body = await res.text();
        console.error("Geocode failed", res.status, body);
        return fallback ? { ok: true as const, ...fallback } : { ok: false as const };
      }
      const json = (await res.json()) as {
        status: string;
        results: Array<{
          formatted_address: string;
          geometry: { location: { lat: number; lng: number } };
          place_id: string;
        }>;
      };
      if (json.status !== "OK" || !json.results.length) {
        return fallback ? { ok: true as const, ...fallback } : { ok: false as const };
      }
      const top = json.results[0];
      return {
        ok: true as const,
        address: top.formatted_address,
        lat: top.geometry.location.lat,
        lng: top.geometry.location.lng,
        placeId: top.place_id,
        source: "google-geocoding" as const,
      };
    } catch (error) {
      console.error("Geocode unavailable", error);
      return fallback ? { ok: true as const, ...fallback } : { ok: false as const };
    }
  });
