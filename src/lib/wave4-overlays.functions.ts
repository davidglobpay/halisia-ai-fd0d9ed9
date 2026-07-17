import { createServerFn } from "@tanstack/react-start";

/**
 * Wave 4 — Spatial overlays (admin boundaries + drainage) via Overpass.
 * All sources are free/open (OpenStreetMap). Cached 30 min.
 */

type OverpassGeomEl = {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
  members?: Array<{ role: string; geometry?: Array<{ lat: number; lon: number }> }>;
};

export type Wave4Overlays = {
  boundaries: {
    county: GeoRing[];
    ward: GeoRing[];
  };
  drainage: GeoRing[];
  facilities: Array<{ id: string; lat: number; lng: number; label: string; kind: string }>;
  generatedAt: string;
};

export type GeoRing = { name: string; coords: Array<[number, number]> };

const cache = new Map<string, { at: number; value: Wave4Overlays }>();
const TTL = 30 * 60_000;
const UA = "HalisiaAI/1.0 (Wave4 overlays)";

async function overpass(q: string) {
  const eps = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  for (const ep of eps) {
    try {
      const r = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "text/plain", "User-Agent": UA },
        body: q,
      });
      if (r.ok) return (await r.json()) as { elements: OverpassGeomEl[] };
    } catch {
      /* next */
    }
  }
  return null;
}

function ringsFromRelation(el: OverpassGeomEl): Array<Array<[number, number]>> {
  const rings: Array<Array<[number, number]>> = [];
  for (const m of el.members ?? []) {
    if (m.role !== "outer" || !m.geometry) continue;
    rings.push(m.geometry.map((g) => [g.lat, g.lon] as [number, number]));
  }
  return rings;
}

function ringsFromWay(el: OverpassGeomEl): Array<Array<[number, number]>> {
  if (!el.geometry) return [];
  return [el.geometry.map((g) => [g.lat, g.lon] as [number, number])];
}

export const getWave4Overlays = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const v = input as { lat?: number; lng?: number; refresh?: boolean };
    if (typeof v?.lat !== "number" || typeof v?.lng !== "number") throw new Error("lat/lng");
    return { lat: v.lat, lng: v.lng, refresh: !!v.refresh };
  })
  .handler(async ({ data }): Promise<Wave4Overlays> => {
    const key = `${data.lat.toFixed(2)},${data.lng.toFixed(2)}`;
    if (!data.refresh) {
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < TTL) return hit.value;
    }
    const R = 6000;
    const bboxQ = `(around:${R},${data.lat},${data.lng})`;
    // Admin boundaries: level 4 (county) + level 6 (sub-county/constituency) + level 7 (ward)
    const q = `[out:json][timeout:25];
(
  relation${bboxQ}["boundary"="administrative"]["admin_level"~"4|6|7"];
  way${bboxQ}["waterway"~"river|stream|canal"];
  node${bboxQ}["amenity"~"hospital|school|police|fire_station|bank"];
);
out geom tags 200;`;
    const res = await overpass(q);
    const boundariesCounty: GeoRing[] = [];
    const boundariesWard: GeoRing[] = [];
    const drainage: GeoRing[] = [];
    const facilities: Wave4Overlays["facilities"] = [];

    for (const el of res?.elements ?? []) {
      const tags = el.tags ?? {};
      if (el.type === "relation" && tags.boundary === "administrative") {
        const name = tags.name ?? tags["name:en"] ?? "Boundary";
        const rings = ringsFromRelation(el);
        for (const r of rings) {
          if (r.length < 4) continue;
          const bucket = tags.admin_level === "4" ? boundariesCounty : boundariesWard;
          bucket.push({ name, coords: r });
        }
      } else if (el.type === "way" && tags.waterway) {
        const rings = ringsFromWay(el);
        for (const r of rings) drainage.push({ name: tags.name ?? tags.waterway, coords: r });
      } else if (el.type === "node" && tags.amenity) {
        // node geometry: use lat/lon on element
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = el as any;
        if (typeof e.lat === "number" && typeof e.lon === "number") {
          facilities.push({
            id: `n${el.id}`,
            lat: e.lat,
            lng: e.lon,
            label: tags.name ?? tags.amenity,
            kind: tags.amenity,
          });
        }
      }
    }
    const value: Wave4Overlays = {
      boundaries: { county: boundariesCounty, ward: boundariesWard },
      drainage,
      facilities,
      generatedAt: new Date().toISOString(),
    };
    cache.set(key, { at: Date.now(), value });
    return value;
  });
