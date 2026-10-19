import type { EvidencePosition } from "./map-evidence";

export type EvidenceMapLayer = "satellite" | "map" | "terrain";
export const PREVIEW_LAYERS = {
  satellite: { label: "Satellite", attribution: "Tiles © Esri, Maxar" },
  map: { label: "Map", attribution: "© OpenStreetMap contributors" },
  terrain: {
    label: "Terrain",
    attribution: "© OpenStreetMap contributors · © OpenTopoMap (CC-BY-SA)",
  },
} as const;

/** Native 256px tiles from the same reference layers as the existing fallback map.
 * Coordinates locate a reference view; they do not verify the associated finding.
 */
export function mapPreviewTiles(position: EvidencePosition, layer: EvidenceMapLayer, zoom: number) {
  if (
    !Number.isFinite(position.lat) ||
    !Number.isFinite(position.lng) ||
    Math.abs(position.lat) > 85.05112878 ||
    Math.abs(position.lng) > 180 ||
    !Number.isInteger(zoom) ||
    zoom < 1 ||
    zoom > (layer === "terrain" ? 17 : 19)
  )
    return null;
  const n = 2 ** zoom;
  const x = ((position.lng + 180) / 360) * n;
  const radians = (position.lat * Math.PI) / 180;
  const y = ((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * n;
  const tiles = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const column = Math.floor(x) + dx;
      const row = Math.floor(y) + dy;
      if (row < 0 || row >= n) continue;
      const wrapped = ((column % n) + n) % n;
      const src =
        layer === "satellite"
          ? `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${row}/${wrapped}`
          : layer === "terrain"
            ? `https://a.tile.opentopomap.org/${zoom}/${wrapped}/${row}.png`
            : `https://tile.openstreetmap.org/${zoom}/${wrapped}/${row}.png`;
      tiles.push({
        src,
        left: (column - x) * 256,
        top: (row - y) * 256,
      });
    }
  }
  return tiles;
}
