import type { GeotechIntel, SoilLayer, Foundation } from "@/lib/geotech.functions";

/** Rough allowable bearing pressure band (kPa) from texture + bulk density. */
export function bearingCapacityKpa(L: SoilLayer): { low: number; high: number; note: string } {
  const rho = L.bulkDensity ?? 1.4;
  const base: Record<string, [number, number]> = {
    Clay: [50, 100],
    "Clay loam": [80, 140],
    Loam: [100, 180],
    "Silty loam": [90, 160],
    "Sandy loam": [120, 200],
    Sandy: [150, 260],
  };
  const b = base[L.texture] ?? [90, 160];
  const k = Math.max(0.75, Math.min(1.25, rho / 1.4));
  return {
    low: Math.round(b[0] * k),
    high: Math.round(b[1] * k),
    note: `Indicative allowable pressure for a strip footing at ${L.depth}.`,
  };
}

/** Shrink–swell potential score 0–100 from clay % and organic matter. */
export function shrinkSwellScore(L: SoilLayer): {
  score: number;
  band: "Low" | "Moderate" | "High" | "Severe";
} {
  const s = Math.max(0, Math.min(100, L.clayPct * 1.8 - L.organicPct * 4));
  const band: "Low" | "Moderate" | "High" | "Severe" =
    s >= 75 ? "Severe" : s >= 55 ? "High" : s >= 30 ? "Moderate" : "Low";
  return { score: Math.round(s), band };
}

/** Groundwater probability (0–100) — combines shallow + seasonal levels. */
export function groundwaterScore(g: GeotechIntel): number {
  const map = { Low: 15, Moderate: 55, High: 90 } as const;
  return Math.round(
    (map[g.groundwater.shallowLikelihood] + map[g.groundwater.seasonalWaterlogging]) / 2,
  );
}

export type FoundationScore = {
  loadCapacity: number; // 0-100
  costEfficiency: number;
  siteFit: number;
  costLabel: string;
};

export function foundationScore(f: Foundation, g: GeotechIntel): FoundationScore {
  const swelling = (g.soilLayers[0]?.clayPct ?? 0) > 35;
  const rocky = g.bedrock.maxM < 3;
  const soft = (g.soilLayers[0]?.clayPct ?? 0) > 35 && (g.soilLayers[0]?.sandPct ?? 0) < 20;
  const suit = f.suitability;
  const base = suit === "Preferred" ? 88 : suit === "Possible" ? 70 : suit === "Cautious" ? 50 : 25;
  switch (f.type) {
    case "Strip":
      return {
        loadCapacity: rocky ? 82 : 55,
        costEfficiency: 92,
        siteFit: base,
        costLabel: "KES 3.5k–6.5k / m²",
      };
    case "Pad":
      return {
        loadCapacity: 70,
        costEfficiency: 80,
        siteFit: swelling ? 45 : base,
        costLabel: "KES 4.5k–8k / m²",
      };
    case "Raft":
      return {
        loadCapacity: 85,
        costEfficiency: 55,
        siteFit: soft || swelling ? 92 : base,
        costLabel: "KES 7k–12k / m²",
      };
    case "Pile":
      return {
        loadCapacity: 96,
        costEfficiency: 30,
        siteFit: g.bedrock.minM > 6 || soft ? 90 : base,
        costLabel: "KES 12k–24k / m²",
      };
  }
}

export const SOIL_LAYER_KEYS = ["clay", "sand", "silt", "organic", "density"] as const;
export type SoilLayerKey = (typeof SOIL_LAYER_KEYS)[number];
export const SOIL_LAYER_META: Record<SoilLayerKey, { label: string; color: string; unit: string }> =
  {
    clay: { label: "Clay", color: "#d4a017", unit: "%" },
    sand: { label: "Sand", color: "#62e9ff", unit: "%" },
    silt: { label: "Silt", color: "#7aa2ff", unit: "%" },
    organic: { label: "Organic", color: "#22c55e", unit: "%" },
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
