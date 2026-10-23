import { loadBrandImage, type BrandImage } from "./brand-asset";
import { hasMapDetail } from "./map-image-quality";
import { mapPreviewTiles, type EvidenceMapLayer } from "./map-evidence-preview";

/** Captures only the existing reference tiles, with a location marker. No generated imagery. */
export async function passportMapImage(
  lat: number,
  lng: number,
  layer: EvidenceMapLayer,
  zoom = 17,
): Promise<BrandImage | null> {
  try {
    const tiles = mapPreviewTiles({ lat, lng, accuracyM: null }, layer, zoom);
    if (!tiles || typeof document === "undefined") return null;
    const images = await Promise.all(
      tiles
        .filter(
          (tile) =>
            tile.left < 256 && tile.left + 256 > -256 && tile.top < 160 && tile.top + 256 > -160,
        )
        .map(async (tile) => {
          let image = await loadBrandImage(tile.src);
          // Retry only failed URLs once; failed loads are evicted by the loader.
          if (!image) image = await loadBrandImage(tile.src);
          return { tile, image };
        }),
    );
    // 26 amenities x 9 tiles is over 200 requests in one export, so a single
    // transient failure is likely - four cards in the 20 Oct Katani export
    // read "Map image unavailable". Draw the tiles that did arrive instead of
    // discarding a usable image; hasMapDetail below still holds the veto.
    const loaded = images.filter((x) => x.image);
    if (!loaded.length) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 320;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    for (const { tile, image } of loaded) {
      const img = new Image();
      img.src = image!.dataUrl;
      await img.decode();
      ctx.drawImage(img, 256 + tile.left, 160 + tile.top, 256, 256);
    }
    if (!hasMapDetail(ctx.getImageData(0, 0, 512, 320).data)) return null;
    ctx.fillStyle = "#b3261e";
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(256, 160, 7, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: 512,
      height: 320,
      ratio: 1.6,
    };
  } catch {
    return null;
  }
}
