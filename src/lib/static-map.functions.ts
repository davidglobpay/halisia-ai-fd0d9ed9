import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Layer = "roadmap-light" | "terrain" | "satellite" | "hybrid";

const STYLES: Record<Layer, string> = {
  // Clean light basemap
  "roadmap-light":
    "feature:all|element:labels|visibility:on&style=feature:poi|visibility:off&style=feature:transit|visibility:simplified&style=feature:road|element:geometry|color:0xffffff&style=feature:landscape|color:0xf5f5f2&style=feature:water|color:0xcfe8ef",
  // Terrain proxy for slope evidence
  terrain: "",
  satellite: "",
  hybrid: "",
};

const MAP_TYPES: Record<Layer, string> = {
  "roadmap-light": "roadmap",
  terrain: "terrain",
  satellite: "satellite",
  hybrid: "hybrid",
};

export const fetchStaticMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const v = input as { lat?: number; lng?: number; layer?: Layer; zoom?: number };
    if (typeof v?.lat !== "number" || typeof v?.lng !== "number")
      throw new Error("lat/lng required");
    return {
      lat: v.lat,
      lng: v.lng,
      layer: (v.layer ?? "roadmap-light") as Layer,
      zoom: typeof v.zoom === "number" ? v.zoom : 15,
    };
  })
  .handler(async ({ data }) => {
    const lovable = process.env.LOVABLE_API_KEY;
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovable || !mapsKey) {
      return { ok: false as const, error: "Google Maps not configured" };
    }

    const mapType = MAP_TYPES[data.layer];
    const styleParts = STYLES[data.layer]
      ? STYLES[data.layer]
          .split("&style=")
          .filter(Boolean)
          .map((s) => `style=${s}`)
          .join("&")
      : "";

    const params = new URLSearchParams({
      center: `${data.lat},${data.lng}`,
      zoom: String(data.zoom),
      size: "640x400",
      scale: "2",
      maptype: mapType,
      markers: `color:red|${data.lat},${data.lng}`,
    });

    const url = `https://connector-gateway.lovable.dev/google_maps/maps/api/staticmap?${params.toString()}${styleParts ? `&${styleParts}` : ""}`;

    // Retry with exponential backoff on transient failures (network / 5xx / 429).
    // 4xx (403 referrer/API restrictions, 400 bad request) are not retried.
    let res: Response | null = null;
    let lastErr: string | null = null;
    const attempts = 3;
    for (let i = 0; i < attempts; i++) {
      try {
        res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${lovable}`,
            "X-Connection-Api-Key": mapsKey,
          },
        });
        if (res.ok) break;
        const retryable = res.status >= 500 || res.status === 429;
        const body = await res.text().catch(() => "");
        lastErr = `status_${res.status}`;
        console.error("Static map failed", res.status, body.slice(0, 200));
        if (!retryable) {
          return {
            ok: false as const,
            error: lastErr,
            status: res.status,
            detail: body.slice(0, 200),
          };
        }
      } catch (e) {
        lastErr = "network_error";
        console.error("Static map network error", e);
      }
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 250 * Math.pow(2, i)));
    }
    if (!res || !res.ok) {
      return { ok: false as const, error: lastErr ?? "unknown_error", status: res?.status };
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    const b64 = btoa(binary);
    return { ok: true as const, dataUrl: `data:image/png;base64,${b64}` };
  });
