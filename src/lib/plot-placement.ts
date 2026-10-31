/**
 * Placing a schematic house on a plot over satellite imagery: the pure maths.
 *
 * Nothing here is a survey. The plot outline is drawn from the size the user
 * picks (or types) around the chosen point, the house is schematic massing
 * sized from the same floor-area assumptions as the cost templates, and the
 * imagery is reference context with no stated capture date.
 */
import { PLOT_SIZES, SQFT_PER_ACRE } from "@/lib/cost-intel";

export const FT_TO_M = 0.3048;

/** Floor areas used by the cost templates (assumptions; QS review needed). */
export const TYPOLOGY_AREA_M2: Record<string, number> = {
  bedsitter: 25,
  "1br": 40,
  "2br": 70,
  "3br": 110,
  "4br": 150,
  "5br": 200,
  "6br": 250,
};

/** Fabricated container units: floor area each, external size (ISO). */
export const CONTAINER_UNITS = {
  container_20ft: { areaM2: 14.6, lengthM: 6.058, widthM: 2.438 },
  container_40ft: { areaM2: 29.7, lengthM: 12.192, widthM: 2.438 },
} as const;

/** "Bedsitter", "1 bedroom", "3 bedrooms". */
export function typologyName(typology: string): string {
  if (typology === "bedsitter") return "Bedsitter";
  const m = /^(\d+)br$/.exec(typology);
  if (!m) return typology;
  return `${m[1]} bedroom${m[1] === "1" ? "" : "s"}`;
}

export type ContainerKind = keyof typeof CONTAINER_UNITS;

export function isContainer(structure: string): structure is ContainerKind {
  return structure === "container_20ft" || structure === "container_40ft";
}

/** Units needed for a typology, matching the cost templates (bedsitter = 1). */
export function containerCount(typology: string, structure: ContainerKind): number {
  if (typology === "bedsitter") return 1;
  const area = TYPOLOGY_AREA_M2[typology] ?? TYPOLOGY_AREA_M2["3br"];
  return Math.ceil(area / CONTAINER_UNITS[structure].areaM2);
}

/**
 * Container layout: units side by side along their long edges, in rows of
 * up to `perRow`, with a gap between rows. Returns unit centres in metres
 * (x along the house length, z across) about the layout centre.
 */
export function containerLayout(n: number, structure: ContainerKind, perRow = 4, rowGapM = 1.5) {
  const { lengthM, widthM } = CONTAINER_UNITS[structure];
  const count = Math.max(1, Math.floor(n));
  const cols = Math.min(count, perRow);
  const rows = Math.ceil(count / perRow);
  const totalW = cols * widthM;
  const totalL = rows * lengthM + (rows - 1) * rowGapM;
  const units: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / perRow);
    const c = i % perRow;
    units.push({
      z: -totalW / 2 + widthM * (c + 0.5),
      x: -totalL / 2 + lengthM / 2 + r * (lengthM + rowGapM),
    });
  }
  return { units, lengthM: totalL, widthM: totalW };
}

/** Single-storey footprint for a floor area at the template's 1.4:1 aspect, 200 mm walls. */
export function slabFootprint(floorAreaM2: number) {
  const innerW = Math.sqrt(floorAreaM2 / 1.4);
  return { lengthM: innerW * 1.4 + 0.4, widthM: innerW + 0.4 };
}

export type HouseFootprint = {
  lengthM: number;
  widthM: number;
  floorAreaM2: number;
  /** Container unit centres, when the house is made of containers. */
  units?: Array<{ x: number; z: number }>;
};

export function houseFootprint(typology: string, structure: string): HouseFootprint {
  if (isContainer(structure)) {
    const n = containerCount(typology, structure);
    const layout = containerLayout(n, structure);
    return {
      lengthM: layout.lengthM,
      widthM: layout.widthM,
      floorAreaM2: Math.round(n * CONTAINER_UNITS[structure].areaM2 * 10) / 10,
      units: layout.units,
    };
  }
  const area = TYPOLOGY_AREA_M2[typology] ?? TYPOLOGY_AREA_M2["3br"];
  return { ...slabFootprint(area), floorAreaM2: area };
}

/** Rectangle used for each standard plot size: frontage × depth in feet. */
const PLOT_SHAPES_FT: Record<string, [number, number]> = {
  "50x100": [50, 100],
  "eighth-acre": [50, SQFT_PER_ACRE / 8 / 50],
  "quarter-acre": [100, SQFT_PER_ACRE / 4 / 100],
  "half-acre": [100, SQFT_PER_ACRE / 2 / 100],
  acre: [Math.sqrt(SQFT_PER_ACRE), Math.sqrt(SQFT_PER_ACRE)],
};

export type PlotShape = { key: string; label: string; widthM: number; depthM: number };

export const PLOT_SHAPES: PlotShape[] = PLOT_SIZES.map((p) => {
  const [w, d] = PLOT_SHAPES_FT[p.key];
  return {
    key: p.key,
    // "50×100 ft" already states its size; the acre fractions get theirs added.
    label: p.label.includes("×") ? p.label : `${p.label} (${Math.round(w)}×${Math.round(d)} ft)`,
    widthM: w * FT_TO_M,
    depthM: d * FT_TO_M,
  };
});

/** Ground metres per pixel of a Web Mercator tile image at a latitude and zoom. */
export function metresPerPixel(lat: number, zoom: number): number {
  return (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / (256 * 2 ** zoom);
}

/**
 * The tiles of a (2r+1)×(2r+1) block around a point, with the point's pixel
 * position inside the stitched image. Esri World Imagery, x/y/z scheme.
 */
export function imageryTiles(lat: number, lng: number, zoom: number, r = 2) {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 85.05112878 ||
    Math.abs(lng) > 180
  )
    return null;
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const y = ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n;
  const x0 = Math.floor(x) - r;
  const y0 = Math.floor(y) - r;
  const size = (2 * r + 1) * 256;
  const tiles: Array<{ src: string; px: number; py: number }> = [];
  for (let dy = 0; dy <= 2 * r; dy++) {
    for (let dx = 0; dx <= 2 * r; dx++) {
      const row = y0 + dy;
      if (row < 0 || row >= n) continue;
      const col = (((x0 + dx) % n) + n) % n;
      tiles.push({
        src: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${row}/${col}`,
        px: dx * 256,
        py: dy * 256,
      });
    }
  }
  return { tiles, sizePx: size, pointPx: { x: (x - x0) * 256, y: (y - y0) * 256 } };
}

export type Placement = { x: number; z: number; rotationDeg: number };

function corners(center: Placement, lengthM: number, widthM: number) {
  const a = (center.rotationDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    [lengthM / 2, widthM / 2],
    [-lengthM / 2, widthM / 2],
    [-lengthM / 2, -widthM / 2],
    [lengthM / 2, -widthM / 2],
  ].map(([lx, lz]) => ({ x: center.x + lx * c - lz * s, z: center.z + lx * s + lz * c }));
}

export type EdgeDistances = {
  /** Smallest gap to each plot edge, metres; negative when the house crosses it. */
  front: number;
  back: number;
  left: number;
  right: number;
  inside: boolean;
  coveragePct: number;
};

/**
 * Gaps between the house and each plot edge, in the plot's own frame
 * (front = the edge toward −z of the plot, i.e. the road side by convention).
 */
export function edgeDistances(
  house: Placement,
  houseSize: { lengthM: number; widthM: number },
  plot: Placement,
  plotSize: { widthM: number; depthM: number },
): EdgeDistances {
  const a = (-plot.rotationDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const local = corners(house, houseSize.lengthM, houseSize.widthM).map((p) => {
    const dx = p.x - plot.x;
    const dz = p.z - plot.z;
    return { x: dx * c - dz * s, z: dx * s + dz * c };
  });
  const hw = plotSize.widthM / 2;
  const hd = plotSize.depthM / 2;
  const round = (v: number) => Math.round(v * 10) / 10;
  const left = round(Math.min(...local.map((p) => p.x + hw)));
  const right = round(Math.min(...local.map((p) => hw - p.x)));
  const front = round(Math.min(...local.map((p) => p.z + hd)));
  const back = round(Math.min(...local.map((p) => hd - p.z)));
  const footprint = houseSize.lengthM * houseSize.widthM;
  return {
    front,
    back,
    left,
    right,
    inside: Math.min(front, back, left, right) >= 0,
    coveragePct: Math.round((footprint / (plotSize.widthM * plotSize.depthM)) * 1000) / 10,
  };
}
