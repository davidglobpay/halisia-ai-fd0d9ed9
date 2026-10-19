import type { SoilLayer } from "@/lib/geotech.functions";

export const SOIL_LAYER_KEYS = ["clay", "sand", "silt", "organic", "density"] as const;
export type SoilLayerKey = (typeof SOIL_LAYER_KEYS)[number];
export const SOIL_LAYER_META: Record<SoilLayerKey, { label: string; color: string; unit: string }> =
  {
    clay: { label: "Clay", color: "#d4a017", unit: "%" },
    sand: { label: "Sand", color: "#62e9ff", unit: "%" },
    silt: { label: "Silt", color: "#7aa2ff", unit: "%" },
    organic: { label: "Organic carbon", color: "#22c55e", unit: "%" },
    density: { label: "Bulk ρ", color: "#f97316", unit: "g/cm³" },
  };

export function layerValue(L: SoilLayer, key: SoilLayerKey): number | null {
  switch (key) {
    case "clay":
      return L.clayPct;
    case "sand":
      return L.sandPct;
    case "silt":
      return L.siltPct;
    case "organic":
      return L.organicPct;
    case "density":
      return L.bulkDensity;
  }
}
