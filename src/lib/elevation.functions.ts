import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Server-side proxy for Open-Topo-Data ASTER30m elevation samples.
 * The public opentopodata.org API does not send CORS headers, so browser
 * fetches are blocked. Routing through this server function fixes Wave 2
 * terrain rendering and the PDF isometric projection.
 */
export const getElevationSamples = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        locations: z
          .array(z.object({ lat: z.number(), lng: z.number() }))
          .min(1)
          .max(100),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const pts = data.locations.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
    // Primary: Open-Topo-Data ASTER30m
    try {
      const res = await fetch(`https://api.opentopodata.org/v1/aster30m?locations=${pts}`);
      if (!res.ok) throw new Error(`opentopodata ${res.status}`);
      const j = (await res.json()) as {
        results?: Array<{ elevation: number | null }>;
      };
      return {
        source: "opentopodata-aster30m" as const,
        elevations: (j.results ?? []).map((r) => r.elevation ?? 0),
      };
    } catch (primaryErr) {
      // Fallback: Open-Meteo Elevation API
      try {
        const lats = data.locations.map((p) => p.lat).join(",");
        const lngs = data.locations.map((p) => p.lng).join(",");
        const res = await fetch(
          `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`,
        );
        if (!res.ok) throw new Error(`open-meteo ${res.status}`);
        const j = (await res.json()) as { elevation?: number[] };
        return {
          source: "open-meteo-elevation" as const,
          elevations: j.elevation ?? [],
        };
      } catch {
        throw primaryErr;
      }
    }
  });
