import { useEffect, useRef, useState } from "react";
import { Loader2, Mountain } from "lucide-react";

/**
 * Wave 1 · 3D terrain preview.
 * Fetches a 9×9 elevation grid around the point from Open-Topo-Data (public,
 * key-free, aster30m dataset) and renders it as an isometric heightmap on a
 * canvas — no WebGL / no external globes needed.
 */
export function Terrain3D({ lat, lng }: { lat: number; lng: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [grid, setGrid] = useState<number[][] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setGrid(null);
    setErr(null);
    const N = 9;
    const stepDeg = 0.02; // ~2.2 km
    const pts: string[] = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const plat = lat + (y - (N - 1) / 2) * stepDeg;
        const plng = lng + (x - (N - 1) / 2) * stepDeg;
        pts.push(`${plat.toFixed(5)},${plng.toFixed(5)}`);
      }
    }
    fetch(`https://api.opentopodata.org/v1/aster30m?locations=${pts.join("|")}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { results?: Array<{ elevation: number | null }> }) => {
        if (cancelled) return;
        const flat = (j.results ?? []).map((r) => r.elevation ?? 0);
        if (flat.length !== N * N) throw new Error("bad grid");
        const rows: number[][] = [];
        for (let y = 0; y < N; y++) rows.push(flat.slice(y * N, (y + 1) * N));
        setGrid(rows);
      })
      .catch((e) => !cancelled && setErr((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  useEffect(() => {
    if (!grid || !ref.current) return;
    const c = ref.current;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth * dpr;
    const H = c.clientHeight * dpr;
    c.width = W;
    c.height = H;
    ctx.clearRect(0, 0, W, H);

    const N = grid.length;
    const flat = grid.flat();
    const min = Math.min(...flat);
    const max = Math.max(...flat);
    const range = Math.max(1, max - min);

    const cx = W / 2;
    const cy = H * 0.62;
    const tileW = (W * 0.75) / N;
    const tileH = tileW * 0.55;
    const maxLift = H * 0.32;

    // Diamond-project: from back rows to front rows so painters' algorithm holds.
    for (let y = N - 1; y >= 0; y--) {
      for (let x = 0; x < N; x++) {
        const h = (grid[y][x] - min) / range;
        const px = cx + (x - y) * (tileW / 2);
        const py = cy + (x + y - N + 1) * (tileH / 2) - h * maxLift;

        // Diamond top face
        const c0 = shade(h);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + tileW / 2, py + tileH / 2);
        ctx.lineTo(px, py + tileH);
        ctx.lineTo(px - tileW / 2, py + tileH / 2);
        ctx.closePath();
        ctx.fillStyle = c0;
        ctx.fill();

        // Right side wall (down to base) — darker
        ctx.beginPath();
        ctx.moveTo(px + tileW / 2, py + tileH / 2);
        ctx.lineTo(px + tileW / 2, py + tileH / 2 + h * maxLift);
        ctx.lineTo(px, py + tileH + h * maxLift);
        ctx.lineTo(px, py + tileH);
        ctx.closePath();
        ctx.fillStyle = shade(h * 0.55);
        ctx.fill();

        // Left side wall — darkest
        ctx.beginPath();
        ctx.moveTo(px - tileW / 2, py + tileH / 2);
        ctx.lineTo(px - tileW / 2, py + tileH / 2 + h * maxLift);
        ctx.lineTo(px, py + tileH + h * maxLift);
        ctx.lineTo(px, py + tileH);
        ctx.closePath();
        ctx.fillStyle = shade(h * 0.35);
        ctx.fill();
      }
    }

    // Pin over centre
    ctx.fillStyle = "#62E9FF";
    ctx.beginPath();
    ctx.arc(cx, cy + tileH * 0.5 - ((grid[(N - 1) / 2][(N - 1) / 2] - min) / range) * maxLift, 6, 0, Math.PI * 2);
    ctx.fill();
  }, [grid]);

  return (
    <div className="glass rounded-2xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mountain className="h-3.5 w-3.5 text-accent" />
          <div className="text-xs font-medium">3D terrain · slope & contour preview</div>
        </div>
        {grid && (
          <div className="text-[10px] text-muted-foreground tabular-nums">
            {Math.round(Math.min(...grid.flat()))} – {Math.round(Math.max(...grid.flat()))} m
          </div>
        )}
      </div>
      <div className="relative h-56 rounded-xl border border-white/5 bg-[radial-gradient(circle_at_50%_20%,rgba(45,140,255,0.16),transparent_70%)] overflow-hidden">
        <canvas ref={ref} className="absolute inset-0 h-full w-full" />
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
      </div>
      <div className="text-[10px] text-muted-foreground">
        Isometric 9×9 grid · Open-Topo-Data ASTER 30m (free, no key). Colour ramp encodes relative
        elevation; pin marks the search point.
      </div>
    </div>
  );
}

function shade(t: number) {
  // Cool green → amber → white for high peaks.
  const stops: Array<[number, [number, number, number]]> = [
    [0, [23, 60, 45]],
    [0.35, [60, 130, 90]],
    [0.65, [200, 170, 90]],
    [1, [245, 240, 220]],
  ];
  const c = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    if (c <= stops[i][0]) {
      const [t0, a] = stops[i - 1];
      const [t1, b] = stops[i];
      const k = (c - t0) / (t1 - t0);
      const r = a[0] + (b[0] - a[0]) * k;
      const g = a[1] + (b[1] - a[1]) * k;
      const bl = a[2] + (b[2] - a[2]) * k;
      return `rgb(${r | 0},${g | 0},${bl | 0})`;
    }
  }
  return "rgb(245,240,220)";
}