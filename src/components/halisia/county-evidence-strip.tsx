import { useEffect, useState } from "react";
import { fetchStaticMapCached } from "@/lib/static-map-cache";

type Tile = { label: string; layer: "roadmap-light" | "terrain" | "satellite" | "hybrid"; zoom: number };

const TILES: Tile[] = [
  { label: "Street map", layer: "roadmap-light", zoom: 11 },
  { label: "Terrain relief", layer: "terrain", zoom: 10 },
  { label: "Satellite hybrid", layer: "hybrid", zoom: 12 },
  { label: "Satellite view", layer: "satellite", zoom: 13 },
];

/**
 * Always-visible evidence strip for county profiles. Uses fetchStaticMapCached,
 * which auto-falls-back to OSM/Esri tile stitching when Google Static Maps is
 * blocked — so every tile renders a real image and no placeholder is ever blank.
 */
export function CountyEvidenceStrip({
  lat,
  lng,
  countyName,
}: {
  lat: number;
  lng: number;
  countyName: string;
}) {
  const [images, setImages] = useState<Array<string | null>>(() => TILES.map(() => null));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        TILES.map((t) => fetchStaticMapCached({ lat, lng, layer: t.layer, zoom: t.zoom })),
      );
      if (cancelled) return;
      setImages(results.map((r) => (r.ok ? r.dataUrl : null)));
    })();
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-4 gap-3"
      data-testid="county-evidence-strip"
      aria-label={`Map evidence for ${countyName}`}
    >
      {TILES.map((t, i) => {
        const src = images[i];
        return (
          <figure
            key={t.label}
            className="glass rounded-2xl overflow-hidden border border-white/10"
          >
            <div className="relative aspect-[4/3] bg-[#0a1735]">
              {src ? (
                <img
                  src={src}
                  alt={`${countyName} — ${t.label}`}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div
                  aria-hidden
                  className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#0e2451] via-[#0a1735] to-[#132a63]"
                />
              )}
            </div>
            <figcaption className="px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              {t.label}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}