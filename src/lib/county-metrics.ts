// Deterministic pseudo-metrics per county code. Same seed → same numbers.
function hash(seed: number, salt: number) {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return Math.floor((x - Math.floor(x)) * 40) + 55; // 55..94
}

export type CountyMetric = "livability" | "population" | "growth" | "water";

export const METRIC_LABELS: Record<CountyMetric, string> = {
  livability: "Livability index",
  population: "Population density",
  growth: "YoY growth",
  water: "Water reliability",
};

export const METRIC_UNITS: Record<CountyMetric, string> = {
  livability: "/100",
  population: "k / km²",
  growth: "%",
  water: "/100",
};

export function countyMetrics(code: number) {
  const livability = hash(code, 11);
  const population = Math.max(3, Math.round(hash(code, 22) * 0.5));
  const growth = Math.round((hash(code, 33) - 55) * 0.35 * 10) / 10; // 0..~14
  const water = hash(code, 44);
  return { livability, population, growth, water };
}

export function confidence(code: number, metric: CountyMetric): "low" | "med" | "high" {
  const salts: Record<CountyMetric, number> = {
    livability: 111,
    population: 222,
    growth: 333,
    water: 444,
  };
  const v = hash(code, salts[metric]);
  if (v > 82) return "high";
  if (v > 68) return "med";
  return "low";
}

export function metricValue(code: number, metric: CountyMetric): number {
  return countyMetrics(code)[metric];
}

export function formatMetric(metric: CountyMetric, v: number): string {
  if (metric === "growth") return `${v > 0 ? "+" : ""}${v}%`;
  if (metric === "population") return `${v}k/km²`;
  return `${v}`;
}
