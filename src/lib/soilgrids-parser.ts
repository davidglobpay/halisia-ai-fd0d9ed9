import type { SoilLayer } from "./geotech.functions";

type Response = {
  properties?: {
    layers?: Array<{
      name: string;
      unit_measure?: { d_factor?: number };
      depths?: Array<{
        label: string;
        range?: { top_depth: number; bottom_depth: number };
        values?: { mean?: number | null };
      }>;
    }>;
  };
};

/** Missing fractions never become zero or a made-up remainder. Units follow ISRIC metadata. */
export function parseSoilGrids(input: unknown): SoilLayer[] {
  const layers = (input as Response | null)?.properties?.layers ?? [];
  const props: Record<string, Record<string, number>> = {};
  for (const layer of layers) {
    const factor = layer.unit_measure?.d_factor;
    if (typeof factor !== "number" || !Number.isFinite(factor) || factor <= 0) continue;
    props[layer.name] = {};
    for (const d of layer.depths ?? []) {
      const value = d.values?.mean;
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) continue;
      const depth = d.range
        ? `${d.range.top_depth}-${d.range.bottom_depth}cm`
        : d.label.replace(/\s+/g, "");
      props[layer.name][depth] = value / factor;
    }
  }
  const result: SoilLayer[] = [];
  for (const depth of ["0-5cm", "5-15cm", "15-30cm", "30-60cm"]) {
    const clay = props.clay?.[depth],
      sand = props.sand?.[depth],
      silt = props.silt?.[depth],
      soc = props.soc?.[depth];
    // Composition needs all three fractions; optional carbon and density stay null.
    if ([clay, sand, silt].some((v) => v == null || !Number.isFinite(v))) continue;
    if ([clay, sand, silt].some((v) => v > 100) || Math.abs(clay + sand + silt - 100) > 5) continue;
    const texture =
      clay >= 40
        ? "Clay"
        : clay >= 27 && sand <= 45
          ? "Clay loam"
          : sand >= 70 && clay < 15
            ? "Sandy"
            : silt >= 50 && clay < 27
              ? "Silty loam"
              : sand >= 50 && clay < 20
                ? "Sandy loam"
                : "Loam";
    result.push({
      depth,
      clayPct: clay,
      sandPct: sand,
      siltPct: silt,
      organicPct: soc == null ? null : soc / 10,
      bulkDensity: props.bdod?.[depth] ?? null,
      texture,
      drainage: null,
    });
  }
  return result;
}
