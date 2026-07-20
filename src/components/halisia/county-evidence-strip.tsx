import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, ImageOff } from "lucide-react";
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
  type TileState = { status: "loading" | "ok" | "error"; src?: string };
  const [tiles, setTiles] = useState<TileState[]>(() => TILES.map(() => ({ status: "loading" })));
  const [nonce, setNonce] = useState(0);

  const retry = useCallback((i: number) => {
    setTiles((prev) => prev.map((t, idx) => (idx === i ? { status: "loading" } : t)));
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setTiles((prev) => prev.map((t) => (t.status === "error" ? { status: "loading" } : t)));
    TILES.forEach((t, i) => {
      fetchStaticMapCached({ lat, lng, layer: t.layer, zoom: t.zoom }).then((r) => {
        if (cancelled) return;
        setTiles((prev) => {
          const next = prev.slice();
          next[i] = r.ok ? { status: "ok", src: r.dataUrl } : { status: "error" };
          return next;
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lng, nonce]);

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-4 gap-3"
      data-testid="county-evidence-strip"
      aria-label={`Map evidence for ${countyName}`}
    >
      {TILES.map((t, i) => {
        const state = tiles[i];
        return (
          <figure
            key={t.label}
            className="glass rounded-2xl overflow-hidden border border-white/10"
          >
            <div
              className="relative aspect-[4/3] bg-[#0a1735]"
              role="img"
              aria-label={`${countyName} — ${t.label}${
                state.status === "loading"
                  ? " (loading)"
                  : state.status === "error"
                    ? " (failed to load)"
                    : ""
              }`}
            >
              {state.status === "ok" && state.src && (
                <img
                  src={state.src}
                  alt={`${countyName} — ${t.label}`}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              {state.status === "loading" && (
                <>
                  <div
                    aria-hidden
                    className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#0e2451] via-[#0a1735] to-[#132a63]"
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-[11px] text-white/70">
                    <Loader2 aria-hidden className="mr-1.5 h-3.5 w-3.5 animate-spin text-[#00C2E8]" />
                    Stitching tiles…
                  </div>
                </>
              )}
              {state.status === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0a1735] text-[11px] text-white/75">
                  <ImageOff aria-hidden className="h-4 w-4 text-amber-300" />
                  <span>Tile source unavailable</span>
                  <button
                    type="button"
                    onClick={() => retry(i)}
                    className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2E8]"
                    aria-label={`Retry loading ${t.label} tile for ${countyName}`}
                  >
                    <RefreshCw aria-hidden className="h-3 w-3" /> Retry
                  </button>
                </div>
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