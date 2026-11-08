/**
 * The design language a client wants, as a few plain choices the 3D house
 * builder understands: roof form, wall finish, window size, interior mood
 * and three colours.
 *
 * It comes from an inspiration image, video or link (read by AI, or by the
 * on-device colour reader when AI is not available), and the client can
 * change every choice afterwards. It steers a schematic massing model; it is
 * never a copy of the inspiration's design or an architect's drawing.
 *
 * Pure: no three.js and no DOM, so it is unit tested on its own.
 */

export const ROOF_FORMS = ["gable", "hip", "flat", "mono"] as const;
export const WALL_FINISHES = ["plaster", "stone", "brick", "timber", "concrete"] as const;
export const WINDOW_SIZES = ["standard", "large"] as const;
export const INTERIOR_MOODS = ["warm", "modern", "classic"] as const;
export const CEILING_TYPES = ["slab", "gypsum", "tng", "wood"] as const;
export const LIGHTING_TYPES = ["recessed", "chandelier", "pendant", "ambient"] as const;
export const FLOOR_FINISHES = ["tiles", "wood", "terrazzo", "carpet"] as const;

export type RoofForm = (typeof ROOF_FORMS)[number];
export type WallFinish = (typeof WALL_FINISHES)[number];
export type WindowSize = (typeof WINDOW_SIZES)[number];
export type InteriorMood = (typeof INTERIOR_MOODS)[number];
export type CeilingType = (typeof CEILING_TYPES)[number];
export type LightingType = (typeof LIGHTING_TYPES)[number];
export type FloorFinish = (typeof FLOOR_FINISHES)[number];

export type DesignStyle = {
  roof: RoofForm;
  wall: WallFinish;
  windows: WindowSize;
  interior: InteriorMood;
  /** Ceiling finish: plain slab, gypsum with a bulkhead, tongue and groove, or timber panels. */
  ceiling: CeilingType;
  /** Main room lighting. */
  lighting: LightingType;
  /** Living-area floor (wet rooms are always tiled; bedrooms follow unless tiled). */
  floor: FloorFinish;
  /** "#rrggbb" */
  wallColor: string;
  roofColor: string;
  trimColor: string;
  /** Short plain-English observations shown to the client (max 6). */
  notes: string[];
  /** How the style was set. */
  source: "default" | "ai" | "colours" | "manual";
};

export const DEFAULT_STYLE: DesignStyle = {
  roof: "gable",
  wall: "plaster",
  windows: "standard",
  interior: "warm",
  ceiling: "gypsum",
  lighting: "recessed",
  floor: "tiles",
  wallColor: "#e8dfcb",
  roofColor: "#6f2f25",
  trimColor: "#2e2f31",
  notes: [],
  source: "default",
};

export const ROOF_LABEL: Record<RoofForm, string> = {
  gable: "Pitched (gable)",
  hip: "Hipped",
  flat: "Flat with parapet",
  mono: "Mono-pitch (single slope)",
};
export const WALL_LABEL: Record<WallFinish, string> = {
  plaster: "Smooth plaster",
  stone: "Dressed stone",
  brick: "Brick",
  timber: "Timber cladding",
  concrete: "Fair-face concrete",
};
export const WINDOW_LABEL: Record<WindowSize, string> = {
  standard: "Standard windows",
  large: "Large glazing",
};
export const CEILING_LABEL: Record<CeilingType, string> = {
  slab: "Flat slab, plain plaster",
  gypsum: "Gypsum with bulkhead",
  tng: "Tongue and groove (pine)",
  wood: "Dark timber panels",
};
export const LIGHTING_LABEL: Record<LightingType, string> = {
  recessed: "Recessed downlights",
  chandelier: "Chandelier in living and dining",
  pendant: "Pendant lights",
  ambient: "Ambient cove lighting",
};
export const FLOOR_LABEL: Record<FloorFinish, string> = {
  tiles: "Porcelain tiles",
  wood: "Wood floor",
  terrazzo: "Terrazzo",
  carpet: "Carpet in bedrooms, tiles elsewhere",
};
export const INTERIOR_LABEL: Record<InteriorMood, string> = {
  warm: "Warm and earthy",
  modern: "Modern and light",
  classic: "Classic and dark wood",
};

const HEX_RE = /^#[0-9a-f]{6}$/i;

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

function hex(v: unknown, fallback: string): string {
  if (typeof v !== "string") return fallback;
  const s = v.trim();
  if (HEX_RE.test(s)) return s.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  return fallback;
}

/** Words the AI may use for roof forms, mapped to the builder's four. */
const ROOF_SYNONYMS: Record<string, RoofForm> = {
  gable: "gable",
  gabled: "gable",
  pitched: "gable",
  hip: "hip",
  hipped: "hip",
  flat: "flat",
  parapet: "flat",
  mono: "mono",
  "mono-pitch": "mono",
  monopitch: "mono",
  skillion: "mono",
  shed: "mono",
  "single slope": "mono",
};

/**
 * Turn untrusted JSON (from the AI or from browser storage) into a valid
 * style. Unknown values fall back to the defaults; nothing throws.
 */
export function sanitizeStyle(raw: unknown, base: DesignStyle = DEFAULT_STYLE): DesignStyle {
  const v = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const roofWord = typeof v.roof === "string" ? v.roof.trim().toLowerCase() : "";
  const notes = Array.isArray(v.notes)
    ? v.notes
        .filter((n): n is string => typeof n === "string")
        .map((n) => n.replace(/\s+/g, " ").trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 6)
    : base.notes;
  const source = pick(v.source, ["default", "ai", "colours", "manual"] as const, base.source);
  return {
    roof: ROOF_SYNONYMS[roofWord] ?? base.roof,
    wall: pick(v.wall, WALL_FINISHES, base.wall),
    windows: pick(v.windows, WINDOW_SIZES, base.windows),
    interior: pick(v.interior, INTERIOR_MOODS, base.interior),
    ceiling: pick(v.ceiling, CEILING_TYPES, base.ceiling ?? DEFAULT_STYLE.ceiling),
    lighting: pick(v.lighting, LIGHTING_TYPES, base.lighting ?? DEFAULT_STYLE.lighting),
    floor: pick(v.floor, FLOOR_FINISHES, base.floor ?? DEFAULT_STYLE.floor),
    wallColor: hex(v.wallColor, base.wallColor),
    roofColor: hex(v.roofColor, base.roofColor),
    trimColor: hex(v.trimColor, base.trimColor),
    notes,
    source,
  };
}

/** One line per choice, for the panel and the PDF. */
export function describeStyle(s: DesignStyle): string[] {
  return [
    `Roof: ${ROOF_LABEL[s.roof]}`,
    `Walls: ${WALL_LABEL[s.wall]}`,
    `Windows: ${WINDOW_LABEL[s.windows]}`,
    `Interior: ${INTERIOR_LABEL[s.interior]}`,
    `Ceiling: ${CEILING_LABEL[s.ceiling]}; lighting: ${LIGHTING_LABEL[s.lighting]}`,
    `Floors: ${FLOOR_LABEL[s.floor]}`,
    `Colours: walls ${s.wallColor}, roof ${s.roofColor}, frames ${s.trimColor}`,
  ];
}

/* ---------------------------------------------------------------- colours */

export type Rgb = [number, number, number];

export function toHex([r, g, b]: Rgb): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function fromHex(h: string): Rgb {
  const s = hex(h, "#000000");
  return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
}

export function hexToInt(h: string): number {
  const [r, g, b] = fromHex(h);
  return (r << 16) | (g << 8) | b;
}

const lum = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const sat = ([r, g, b]: Rgb) => {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
};

export type PaletteColour = { rgb: Rgb; hex: string; share: number };

/**
 * Main colours of an image by k-means over its pixels (RGBA, row-major),
 * largest share first. Seeds are chosen farthest-first (starting from the
 * median-brightness pixel), so small but distinct areas such as dark window
 * frames keep their own colour. Deterministic: the same image always gives
 * the same palette.
 */
export function extractPalette(rgba: ArrayLike<number>, k = 6, iterations = 10): PaletteColour[] {
  const px: Rgb[] = [];
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    px.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
  }
  if (!px.length) return [];
  const d2 = (a: Rgb, b: Rgb) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const sorted = [...px].sort((a, b) => lum(a) - lum(b));
  const kk = Math.min(k, px.length);
  // Farthest-first seeding over a sample of at most ~4000 pixels.
  const step = Math.max(1, Math.floor(px.length / 4000));
  const sample = px.filter((_, i) => i % step === 0);
  let centres: Rgb[] = [sorted[Math.floor(sorted.length / 2)]];
  const nearest = sample.map((p) => d2(p, centres[0]));
  while (centres.length < kk) {
    let far = 0;
    for (let i = 1; i < sample.length; i++) if (nearest[i] > nearest[far]) far = i;
    if (nearest[far] === 0) break;
    const c = sample[far];
    centres.push(c);
    for (let i = 0; i < sample.length; i++) nearest[i] = Math.min(nearest[i], d2(sample[i], c));
  }
  const assign = new Array<number>(px.length).fill(0);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < px.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centres.length; c++) {
        const d =
          (px[i][0] - centres[c][0]) ** 2 +
          (px[i][1] - centres[c][1]) ** 2 +
          (px[i][2] - centres[c][2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      assign[i] = best;
    }
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < px.length; i++) {
      const s = sums[assign[i]];
      s[0] += px[i][0];
      s[1] += px[i][1];
      s[2] += px[i][2];
      s[3] += 1;
    }
    centres = centres.map((c, j) =>
      sums[j][3]
        ? ([sums[j][0] / sums[j][3], sums[j][1] / sums[j][3], sums[j][2] / sums[j][3]] as Rgb)
        : c,
    );
  }
  const counts = centres.map((_, j) => assign.filter((a) => a === j).length);
  return centres
    .map((c, j) => ({ rgb: c, hex: toHex(c), share: counts[j] / px.length }))
    .filter((c) => c.share > 0)
    .sort((a, b) => b.share - a.share);
}

/** Sky (bright blue/white-blue) and plants (green) are scenery, not the building. */
export function isScenery([r, g, b]: Rgb): boolean {
  const l = lum([r, g, b]);
  const sky = b > r + 12 && b >= g && l > 120;
  const green = g > r + 10 && g > b + 6;
  return sky || green;
}

/**
 * A starting style from colours alone: walls take the largest light colour
 * on the building, the roof a darker or warmer colour that differs from the
 * walls, frames the darkest. Everything else stays as `base`.
 */
export function styleFromPalette(
  palette: PaletteColour[],
  base: DesignStyle = DEFAULT_STYLE,
): DesignStyle {
  const building = palette.filter((c) => !isScenery(c.rgb));
  const pool = building.length ? building : palette;
  if (!pool.length) return { ...base, source: "colours" };
  const dist = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const light = pool.filter((c) => lum(c.rgb) > 105);
  const wall = (light.length ? light : pool)[0];
  const others = pool.filter((c) => c !== wall && dist(c.rgb, wall.rgb) > 45);
  const roof =
    [...others].sort(
      (a, b) => sat(b.rgb) * 1.5 - lum(b.rgb) / 255 - (sat(a.rgb) * 1.5 - lum(a.rgb) / 255),
    )[0] ?? null;
  const trim = [...pool].sort((a, b) => lum(a.rgb) - lum(b.rgb))[0];
  return {
    ...base,
    wallColor: wall.hex,
    roofColor: roof ? roof.hex : base.roofColor,
    trimColor: trim && trim !== wall ? trim.hex : base.trimColor,
    notes: [
      "Colours read on this device from the picture. Roof form, walls and windows are your choices below.",
    ],
    source: "colours",
  };
}

/* ---------------------------------------------------------------- storage */

export const STYLE_STORAGE_KEY = "halisia:design-style:v1";

export type StoredInspiration = { style: DesignStyle; thumb: string | null; savedAt: string };

export function saveInspiration(style: DesignStyle, thumb: string | null): void {
  try {
    const value: StoredInspiration = {
      style,
      // Keep storage small: thumbnails over ~60 KB are dropped.
      thumb: thumb && thumb.length < 80_000 ? thumb : null,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* storage unavailable: the style still applies to this visit */
  }
}

export function loadInspiration(): StoredInspiration | null {
  try {
    const raw = window.localStorage.getItem(STYLE_STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { style?: unknown; thumb?: unknown; savedAt?: unknown };
    return {
      style: sanitizeStyle(v.style),
      thumb: typeof v.thumb === "string" && v.thumb.startsWith("data:image/") ? v.thumb : null,
      savedAt: typeof v.savedAt === "string" ? v.savedAt : "",
    };
  } catch {
    return null;
  }
}

export function clearInspiration(): void {
  try {
    window.localStorage.removeItem(STYLE_STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}
