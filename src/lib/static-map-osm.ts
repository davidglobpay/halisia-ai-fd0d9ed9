// Browser-side OpenStreetMap / Esri tile stitcher.
// Used as a fallback when the Google Static Maps server function is
// unavailable (missing key, 403 referrer restriction, quota, etc.) so
// the PDF dossier and any other consumer always has map imagery.

type Layer = "roadmap-light" | "terrain" | "satellite" | "hybrid";

const TILE = 256;
// 3x2 tile grid → 768x512 image (matches Google 640x400 @scale=2 roughly).
const COLS = 3;
const ROWS = 2;

function lonToTileX(lng: number, z: number) {
  return ((lng + 180) / 360) * Math.pow(2, z);
}
function latToTileY(lat: number, z: number) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z);
}

function tileUrl(layer: Layer, z: number, x: number, y: number): string {
  const wrap = (n: number) => ((n % Math.pow(2, z)) + Math.pow(2, z)) % Math.pow(2, z);
  const xw = wrap(x);
  switch (layer) {
    case "terrain":
      return `https://a.tile.opentopomap.org/${z}/${xw}/${y}.png`;
    case "satellite":
    case "hybrid":
      return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${xw}`;
    case "roadmap-light":
    default:
      return `https://tile.openstreetmap.org/${z}/${xw}/${y}.png`;
  }
}

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function fetchStaticMapOSM(args: {
  lat: number;
  lng: number;
  layer: Layer;
  zoom: number;
}): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  if (typeof document === "undefined") return { ok: false, error: "no_dom" };
  const z = Math.max(1, Math.min(18, Math.round(args.zoom)));
  const cx = lonToTileX(args.lng, z);
  const cy = latToTileY(args.lat, z);
  const x0 = Math.floor(cx) - Math.floor(COLS / 2);
  const y0 = Math.floor(cy) - Math.floor(ROWS / 2);

  const canvas = document.createElement("canvas");
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, error: "no_canvas" };

  // Background so failed tiles don't leave black holes.
  ctx.fillStyle = "#e6ecf2";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const jobs: Promise<void>[] = [];
  let ok = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tx = x0 + c;
      const ty = y0 + r;
      if (ty < 0 || ty >= Math.pow(2, z)) continue;
      const url = tileUrl(args.layer, z, tx, ty);
      jobs.push(
        loadImg(url).then((img) => {
          if (img) {
            ctx.drawImage(img, c * TILE, r * TILE, TILE, TILE);
            ok++;
          }
        }),
      );
    }
  }
  await Promise.all(jobs);
  if (ok === 0) return { ok: false, error: "all_tiles_failed" };

  // Marker
  const px = (cx - x0) * TILE;
  const py = (cy - y0) * TILE;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 2;
  ctx.fillStyle = "#e11d48";
  ctx.beginPath();
  ctx.arc(px, py, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Attribution strip
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(0, canvas.height - 14, canvas.width, 14);
  ctx.fillStyle = "#334155";
  ctx.font = "10px sans-serif";
  const attribution =
    args.layer === "satellite" || args.layer === "hybrid"
      ? "© Esri, Maxar, Earthstar Geographics"
      : args.layer === "terrain"
        ? "© OpenTopoMap (CC-BY-SA) · © OpenStreetMap"
        : "© OpenStreetMap contributors";
  ctx.fillText(attribution, 6, canvas.height - 4);

  try {
    const dataUrl = canvas.toDataURL("image/png");
    return { ok: true, dataUrl };
  } catch (e) {
    return { ok: false, error: "canvas_taint:" + String(e).slice(0, 80) };
  }
}
