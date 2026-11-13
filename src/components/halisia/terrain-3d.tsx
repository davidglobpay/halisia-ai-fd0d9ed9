import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, Minus, Mountain, Plus, RefreshCw, RotateCcw } from "lucide-react";
import { ViewerGuide } from "@/components/halisia/viewer-guide";
import {
  cellLatLng,
  drawIsometricTerrain,
  fetchElevationGrid,
  gridStats,
  pickIsoCell,
  type ElevationGrid,
  type IsoLayout,
} from "@/lib/terrain-grid";
import {
  getTerrainTelemetry,
  recordTerrainEvent,
  startTerrainTimer,
} from "@/lib/terrain-telemetry";

/**
 * 3D terrain preview — Wave 1 & Wave 2.
 * Fetches a 9×9 elevation grid from Open-Topo-Data (ASTER 30m, key-free) and
 * renders it as an interactive isometric heightmap. Hover a cell to inspect
 * its elevation and lat/lng; click Refresh to re-sample.
 */
export function Terrain3D({
  lat,
  lng,
  height = "h-56",
  variant = "compact",
}: {
  lat: number;
  lng: number;
  height?: string;
  variant?: "compact" | "expanded";
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<IsoLayout | null>(null);
  const [grid, setGrid] = useState<ElevationGrid | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setGrid(null);
    setErr(null);
    fetchElevationGrid(lat, lng, 9, 0.02, ctrl.signal, "contour-grid")
      .then(setGrid)
      .catch((e: unknown) => {
        if ((e as Error).name === "AbortError") return;
        recordTerrainEvent({
          layer: nonce === 0 ? "contour-grid" : "refresh",
          kind: "error",
          error: (e as Error).message,
        });
        setErr((e as Error).message);
      });
    return () => ctrl.abort();
  }, [lat, lng, nonce]);

  useEffect(() => {
    if (!grid || !ref.current) return;
    const c = ref.current;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    const timer = startTerrainTimer("render", {
      w: c.width,
      h: c.height,
      cells: grid.n * grid.n,
    });
    try {
      layoutRef.current = drawIsometricTerrain(ctx, grid, c.width, c.height, {
        highlight: hover,
      });
      timer.success();
    } catch (e) {
      timer.error(e);
      setErr((e as Error).message);
    }
  }, [grid, hover]);

  const stats = useMemo(() => (grid ? gridStats(grid) : null), [grid]);
  const hoverInfo = useMemo(() => {
    if (!grid || !hover) return null;
    const { lat: hlat, lng: hlng } = cellLatLng(grid, hover.x, hover.y);
    return {
      elev: Math.round(grid.values[hover.y][hover.x]),
      lat: hlat,
      lng: hlng,
    };
  }, [grid, hover]);

  // Mouse hover and finger taps both inspect a tile. The canvas may be zoomed
  // with a CSS scale, so map the pointer through its on-screen size.
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!grid || !ref.current || !layoutRef.current) return;
    const rect = ref.current.getBoundingClientRect();
    const box = boxRef.current?.getBoundingClientRect() ?? rect;
    const x = (e.clientX - rect.left) * (ref.current.width / rect.width);
    const y = (e.clientY - rect.top) * (ref.current.height / rect.height);
    setPointer({ x: e.clientX - box.left, y: e.clientY - box.top });
    const cell = pickIsoCell(grid, layoutRef.current, x, y);
    setHover(cell);
  };

  const downloadTelemetry = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      lat,
      lng,
      events: getTerrainTelemetry(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `halisia-terrain-telemetry-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="glass rounded-2xl p-3 space-y-2" data-testid="terrain-3d">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mountain className="h-3.5 w-3.5 text-accent" />
          <div className="text-xs font-medium">3D terrain · slope &amp; contour preview</div>
        </div>
        <div className="flex items-center gap-2">
          {stats && (
            <div className="text-[10px] text-muted-foreground tabular-nums">
              {stats.minM}–{stats.maxM} m · Δ {stats.reliefM} m · ~{stats.slopePct}% slope
            </div>
          )}
          <button
            onClick={downloadTelemetry}
            className="inline-flex items-center gap-1 rounded-full glass px-2 py-0.5 text-[10px] hover:bg-white/10"
            data-testid="terrain-3d-telemetry"
            title="Download terrain telemetry (dev)"
          >
            <Download className="h-3 w-3" /> Telemetry
          </button>
          <button
            onClick={() => {
              recordTerrainEvent({ layer: "refresh", kind: "start" });
              setNonce((n) => n + 1);
            }}
            className="inline-flex items-center gap-1 rounded-full glass px-2 py-0.5 text-[10px] hover:bg-white/10"
            data-testid="terrain-3d-refresh"
            title="Resample elevation grid"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      </div>
      <div
        ref={boxRef}
        className={`relative ${height} rounded-xl border border-white/5 bg-[radial-gradient(circle_at_50%_20%,rgba(45,140,255,0.16),transparent_70%)] overflow-hidden`}
      >
        <canvas
          ref={ref}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={(e) => {
            if (e.pointerType !== "mouse") return;
            setHover(null);
            setPointer(null);
          }}
          style={{ transform: `scale(${zoom})`, transformOrigin: "50% 50%" }}
          className="absolute inset-0 h-full w-full cursor-crosshair transition-transform"
          data-testid="terrain-3d-canvas"
        />
        <div className="absolute right-2 top-2 z-10 flex flex-col overflow-hidden rounded-full border border-white/10 bg-card/90 shadow">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.5).toFixed(1)))}
            aria-label="Zoom in"
            className="grid h-9 w-9 place-items-center"
            data-testid="terrain-3d-zoom-in"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))}
            aria-label="Zoom out"
            className="grid h-9 w-9 place-items-center border-t border-white/10"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            aria-label="Reset the view"
            className="grid h-9 w-9 place-items-center border-t border-white/10"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <ViewerGuide
          id="terrain-3d"
          title="Reading the 3D terrain"
          position="top"
          steps={[
            [
              "Find a height",
              "Tap or hover over any tile to see its height above sea level and its position.",
            ],
            ["Zoom", "Use + and − on the right; the arrow resets the view."],
            [
              "Read the colours",
              "Dark green is the lowest ground and pale cream the highest; the bar at the bottom gives the range.",
            ],
            ["Get fresh readings", "Refresh, above the view, samples the ground again."],
          ]}
        />
        {!grid && !err && (
          <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
            <div className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> Sampling elevation grid…
            </div>
          </div>
        )}
        {err && (
          <div className="absolute inset-0 grid place-items-center text-xs text-amber-glow">
            Terrain service unreachable ({err}).
          </div>
        )}
        {hoverInfo && pointer && (
          <div
            className="pointer-events-none absolute rounded-lg bg-black/80 backdrop-blur px-2 py-1 text-[10px] text-foreground shadow-xl border border-white/10"
            style={{
              left: Math.min(pointer.x + 12, 220),
              top: Math.max(pointer.y - 40, 6),
            }}
          >
            <div className="font-mono">{hoverInfo.elev} m</div>
            <div className="text-muted-foreground tabular-nums">
              {hoverInfo.lat.toFixed(4)}, {hoverInfo.lng.toFixed(4)}
            </div>
          </div>
        )}
        {/* Legend */}
        {stats && (
          <div className="absolute bottom-2 left-14 right-2 flex items-center gap-2 text-[9px] text-muted-foreground">
            <span>{stats.minM} m</span>
            <div
              className="flex-1 h-1.5 rounded-full"
              style={{
                background:
                  "linear-gradient(to right, rgb(23,60,45), rgb(60,130,90), rgb(200,170,90), rgb(245,240,220))",
              }}
            />
            <span>{stats.maxM} m</span>
          </div>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground">
        {variant === "expanded"
          ? "Interactive isometric 9×9 grid · hover to inspect elevation · Open-Topo-Data ASTER 30m."
          : "Isometric 9×9 grid · Open-Topo-Data ASTER 30m (free, no key). Hover a tile for details."}
      </div>
    </div>
  );
}
