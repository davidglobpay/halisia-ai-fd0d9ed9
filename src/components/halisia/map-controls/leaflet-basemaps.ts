import type { LayerGroup } from "./map-control-dock";
import { esriTileTemplate } from "@/lib/esri-tiles";

/** The two basemaps offered on simple Leaflet maps. */
export const SIMPLE_BASEMAPS = {
  map: {
    label: "Map",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
    maxNativeZoom: 19,
  },
  satellite: {
    label: "Satellite",
    url: esriTileTemplate("World_Imagery"),
    attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    maxNativeZoom: 19,
  },
} as const;

export type SimpleBasemap = keyof typeof SIMPLE_BASEMAPS;

export function basemapGroup(
  selected: SimpleBasemap,
  onChange: (b: SimpleBasemap) => void,
): LayerGroup {
  return {
    id: "basemap",
    title: "Map",
    kind: "single",
    options: (Object.keys(SIMPLE_BASEMAPS) as SimpleBasemap[]).map((id) => ({
      id,
      label: SIMPLE_BASEMAPS[id].label,
    })),
    selected: [selected],
    onChange: ([v]) => onChange((v as SimpleBasemap) ?? "map"),
  };
}
