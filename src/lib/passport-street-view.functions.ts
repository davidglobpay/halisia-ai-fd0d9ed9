import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Optional bounded metadata probe; never enables an API or treats unavailable imagery as evidence. */
export const passportStreetView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lat: number; lng: number }) => {
    if (
      !Number.isFinite(input.lat) ||
      !Number.isFinite(input.lng) ||
      input.lat < -5 ||
      input.lat > 6 ||
      input.lng < 33 ||
      input.lng > 42
    )
      throw new Error("Valid Kenya coordinates required");
    return input;
  })
  .handler(async ({ data }) => {
    const empty = { date: null as string | null, images: [] as Array<{ dataUrl: string }> };
    const lovable = process.env["LOVABLE_API_KEY"],
      key = process.env["GOOGLE_MAPS_API_KEY"];
    if (!lovable || !key) return empty;
    const headers = { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": key };
    const base = "https://connector-gateway.lovable.dev/google_maps/maps/api/streetview";
    try {
      const metadata = await fetch(
        `${base}/metadata?location=${data.lat},${data.lng}&source=outdoor`,
        { headers, signal: AbortSignal.timeout(8000) },
      );
      if (!metadata.ok) return empty;
      const meta = (await metadata.json()) as { status?: string; date?: string; pano_id?: string };
      if (meta.status !== "OK" || !meta.pano_id) return empty;
      const images: Array<{ dataUrl: string }> = [];
      for (const heading of [0, 180]) {
        const response = await fetch(
          `${base}?size=480x240&pano=${encodeURIComponent(meta.pano_id)}&heading=${heading}&fov=90`,
          { headers, signal: AbortSignal.timeout(8000) },
        );
        if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) break;
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length > 1000000) continue;
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        images.push({
          dataUrl: `data:${response.headers.get("content-type")};base64,${btoa(binary)}`,
        });
      }
      return { date: meta.date ?? null, images };
    } catch {
      return empty;
    }
  });
