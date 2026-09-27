import { createServerFn } from "@tanstack/react-start";

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const v = input as { query?: string };
    if (!v?.query || typeof v.query !== "string") throw new Error("query required");
    return { query: v.query.trim().slice(0, 200) };
  })
  .handler(async ({ data }) => {
    const lovable = process.env.LOVABLE_API_KEY;
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovable || !mapsKey) throw new Error("Google Maps not configured");
    const url = `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?address=${encodeURIComponent(
      data.query + ", Kenya",
    )}&region=ke`;
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
        geometry: { location: { lat: number; lng: number }; location_type?: string };
        place_id: string;
        types?: string[];
      }>;
    };
    if (json.status !== "OK" || !json.results.length) {
      return { ok: false as const };
    }
    const top = json.results[0];
    return {
      ok: true as const,
      address: top.formatted_address,
      lat: top.geometry.location.lat,
      lng: top.geometry.location.lng,
      placeId: top.place_id,
      /** Google precision class: ROOFTOP | RANGE_INTERPOLATED | GEOMETRIC_CENTER | APPROXIMATE */
      locationType: top.geometry.location_type ?? "APPROXIMATE",
      types: top.types ?? [],
    };
  });
