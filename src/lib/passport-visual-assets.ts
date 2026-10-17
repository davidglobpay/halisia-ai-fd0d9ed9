import { loadBrandImage, type BrandImage } from "./brand-asset";
import { mapPreviewTiles, type EvidenceMapLayer } from "./map-evidence-preview";

/** Captures only the existing reference tiles, with a location marker. No generated imagery. */
export async function passportMapImage(
  lat: number,
  lng: number,
  layer: EvidenceMapLayer,
  zoom = 15,
): Promise<BrandImage | null> {
  const tiles = mapPreviewTiles({ lat, lng, accuracyM: null }, layer, zoom);
  if (!tiles || typeof document === "undefined") return null;
  const images = await Promise.all(
    tiles.map(async (tile) => ({ tile, image: await loadBrandImage(tile.src) })),
  );
  if (images.some((x) => !x.image)) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  for (const { tile, image } of images) {
    const img = new Image();
    img.src = image!.dataUrl;
    await img.decode();
    ctx.drawImage(img, 256 + tile.left, 160 + tile.top, 256, 256);
  }
  ctx.fillStyle = "#b3261e";
  ctx.strokeStyle = "white";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(256, 160, 7, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();
  return { dataUrl: canvas.toDataURL("image/png"), width: 512, height: 320, ratio: 1.6 };
}
