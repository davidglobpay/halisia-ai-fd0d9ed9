/**
 * Shared elevation grid helper used by the Wave 2 3D preview and the PDF
 * dossier. Fetches a small NxN grid from the public Open-Topo-Data ASTER30m
 * dataset (no API key) and renders it as an isometric heightmap on any 2D
 * canvas — the same routine powers both the on-screen interactive panel and
 * the printable infographic page.
 */

import { startTerrainTimer } from "@/lib/terrain-telemetry";

export type ElevationGrid = {
  n: number;
  stepDeg: number;
  origin: { lat: number; lng: number };
  values: number[][]; // [y][x]
  min: number;
  max: number;
};

export async function fetchElevationGrid(
  lat: number,
  lng: number,
  n = 9,
  stepDeg = 0.02,
  signal?: AbortSignal,
  layer: "contour-grid" | "slope-grid" | "pdf-terrain" = "contour-grid",
): Promise<ElevationGrid> {
  const timer = startTerrainTimer(layer, { lat, lng, n, stepDeg });
  try {
  const pts: string[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const plat = lat + (y - (n - 1) / 2) * stepDeg;
      const plng = lng + (x - (n - 1) / 2) * stepDeg;
      pts.push(`${plat.toFixed(5)},${plng.toFixed(5)}`);
    }
  }
  const res = await fetch(`https://api.opentopodata.org/v1/aster30m?locations=${pts.join("|")}`, {
    signal,
  });
  if (!res.ok) {
    timer.error(`opentopodata ${res.status}`, res.status);
    throw new Error(`opentopodata ${res.status}`);
  }
  const j = (await res.json()) as { results?: Array<{ elevation: number | null }> };
  const flat = (j.results ?? []).map((r) => r.elevation ?? 0);
  if (flat.length !== n * n) {
    timer.error("incomplete elevation grid");
    throw new Error("incomplete elevation grid");
  }
  const values: number[][] = [];
  for (let y = 0; y < n; y++) values.push(flat.slice(y * n, (y + 1) * n));
  const grid: ElevationGrid = {
    n,
    stepDeg,
    origin: { lat, lng },
    values,
    min: Math.min(...flat),
    max: Math.max(...flat),
  };
  timer.success({ minM: Math.round(grid.min), maxM: Math.round(grid.max) });
  return grid;
  } catch (e) {
    if ((e as Error)?.name !== "AbortError") timer.error(e);
    throw e;
  }
}

export function shadeElevation(t: number): string {
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

export type IsoLayout = {
  cx: number;
  cy: number;
  tileW: number;
  tileH: number;
  maxLift: number;
  toScreen: (x: number, y: number, h: number) => { px: number; py: number };
};

export function drawIsometricTerrain(
  ctx: CanvasRenderingContext2D,
  grid: ElevationGrid,
  W: number,
  H: number,
  opts: { background?: string; highlight?: { x: number; y: number } | null } = {},
): IsoLayout {
  const { values, n, min, max } = grid;
  const range = Math.max(1, max - min);
  if (opts.background) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.clearRect(0, 0, W, H);
  }
  const cx = W / 2;
  const cy = H * 0.62;
  const tileW = (W * 0.75) / n;
  const tileH = tileW * 0.55;
  const maxLift = H * 0.32;

  const toScreen = (x: number, y: number, h: number) => ({
    px: cx + (x - y) * (tileW / 2),
    py: cy + (x + y - n + 1) * (tileH / 2) - h * maxLift,
  });

  for (let y = n - 1; y >= 0; y--) {
    for (let x = 0; x < n; x++) {
      const h = (values[y][x] - min) / range;
      const { px, py } = toScreen(x, y, h);
      const top = shadeElevation(h);

      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + tileW / 2, py + tileH / 2);
      ctx.lineTo(px, py + tileH);
      ctx.lineTo(px - tileW / 2, py + tileH / 2);
      ctx.closePath();
      ctx.fillStyle = top;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(px + tileW / 2, py + tileH / 2);
      ctx.lineTo(px + tileW / 2, py + tileH / 2 + h * maxLift);
      ctx.lineTo(px, py + tileH + h * maxLift);
      ctx.lineTo(px, py + tileH);
      ctx.closePath();
      ctx.fillStyle = shadeElevation(h * 0.55);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(px - tileW / 2, py + tileH / 2);
      ctx.lineTo(px - tileW / 2, py + tileH / 2 + h * maxLift);
      ctx.lineTo(px, py + tileH + h * maxLift);
      ctx.lineTo(px, py + tileH);
      ctx.closePath();
      ctx.fillStyle = shadeElevation(h * 0.35);
      ctx.fill();

      if (opts.highlight && opts.highlight.x === x && opts.highlight.y === y) {
        ctx.strokeStyle = "#62E9FF";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + tileW / 2, py + tileH / 2);
        ctx.lineTo(px, py + tileH);
        ctx.lineTo(px - tileW / 2, py + tileH / 2);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  // centre pin
  const mid = (n - 1) / 2;
  const { px, py } = toScreen(mid, mid, (values[mid][mid] - min) / range);
  ctx.fillStyle = "#62E9FF";
  ctx.beginPath();
  ctx.arc(px, py + tileH * 0.5, Math.max(4, tileW * 0.12), 0, Math.PI * 2);
  ctx.fill();

  return { cx, cy, tileW, tileH, maxLift, toScreen };
}

export function pickIsoCell(
  grid: ElevationGrid,
  layout: IsoLayout,
  px: number,
  py: number,
): { x: number; y: number } | null {
  const { tileW, tileH, cx, cy, maxLift } = layout;
  const { values, n, min, max } = grid;
  const range = Math.max(1, max - min);
  // Try tiles back-to-front and pick the first whose top diamond contains the pointer.
  for (let y = n - 1; y >= 0; y--) {
    for (let x = 0; x < n; x++) {
      const h = (values[y][x] - min) / range;
      const tx = cx + (x - y) * (tileW / 2);
      const ty = cy + (x + y - n + 1) * (tileH / 2) - h * maxLift;
      const dx = Math.abs(px - tx) / (tileW / 2);
      const dy = Math.abs(py - (ty + tileH / 2)) / (tileH / 2);
      if (dx + dy <= 1) return { x, y };
    }
  }
  return null;
}

export function cellLatLng(grid: ElevationGrid, x: number, y: number) {
  const { origin, n, stepDeg } = grid;
  return {
    lat: origin.lat + (y - (n - 1) / 2) * stepDeg,
    lng: origin.lng + (x - (n - 1) / 2) * stepDeg,
  };
}

export function gridStats(grid: ElevationGrid) {
  const { values, n, min, max, stepDeg } = grid;
  const midElev = values[(n - 1) >> 1][(n - 1) >> 1];
  // Rough approx: 1° lat ≈ 111 km. Slope = rise / run across the sampled area.
  const spanKm = stepDeg * (n - 1) * 111;
  const slopePct = spanKm > 0 ? ((max - min) / (spanKm * 1000)) * 100 : 0;
  return {
    minM: Math.round(min),
    maxM: Math.round(max),
    reliefM: Math.round(max - min),
    midM: Math.round(midElev),
    slopePct: Math.round(slopePct * 10) / 10,
    spanKm: Math.round(spanKm * 10) / 10,
  };
}
