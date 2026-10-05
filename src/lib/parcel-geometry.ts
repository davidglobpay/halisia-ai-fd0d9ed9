/**
 * Parcel geometry: area, perimeter, bearings, and fitting a drawn shape to a
 * stated area.
 *
 * Everything here is pure arithmetic on coordinates. It makes no claim about
 * where a boundary actually is — it measures the shape a person drew or a
 * mutation plan described, and reports what that shape would be on the ground.
 *
 * The distinction matters enough to repeat in code: scaling a polygon so its
 * area matches the figure on a title deed does NOT make it the correct parcel.
 * A shape of the right size in the wrong place is still the wrong land. These
 * functions produce a sketch for planning. A licensed surveyor produces a
 * boundary.
 */

export type LatLng = { lat: number; lng: number };
/** Metres east and north of a local origin. */
export type LocalXY = { x: number; y: number };

const R = 6_371_008.8; // IUGG mean Earth radius
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/**
 * Project to a local east/north plane in metres.
 *
 * Equirectangular about the origin. Over a parcel — tens to a few hundred
 * metres — the error against a proper transverse Mercator is well under a
 * centimetre, and unlike UTM it has no zone edges to fall off. Kenya spans UTM
 * 36N and 37N, so a parcel near 36°E would otherwise need zone handling for no
 * gain at this scale.
 */
export function toLocalMetres(points: LatLng[], origin: LatLng): LocalXY[] {
  const cosLat = Math.cos(origin.lat * D2R);
  return points.map((p) => ({
    x: (p.lng - origin.lng) * D2R * R * cosLat,
    y: (p.lat - origin.lat) * D2R * R,
  }));
}

/** Inverse of toLocalMetres, about the same origin. */
export function fromLocalMetres(points: LocalXY[], origin: LatLng): LatLng[] {
  const cosLat = Math.cos(origin.lat * D2R);
  return points.map((p) => ({
    lat: origin.lat + (p.y / R) * R2D,
    lng: origin.lng + (p.x / (R * cosLat)) * R2D,
  }));
}

/**
 * Area in square metres, by the shoelace formula.
 *
 * Always positive: a ring digitised clockwise and the same ring digitised
 * anticlockwise enclose the same ground. Returns 0 for fewer than three
 * distinct points, because a line encloses nothing.
 */
export function areaM2(ring: LocalXY[]): number {
  if (ring.length < 3) return 0;
  let twice = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    twice += (ring[j].x + ring[i].x) * (ring[j].y - ring[i].y);
  }
  return Math.abs(twice / 2);
}

/** Closed perimeter in metres. */
export function perimeterM(ring: LocalXY[]): number {
  if (ring.length < 2) return 0;
  let total = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    total += Math.hypot(ring[i].x - ring[j].x, ring[i].y - ring[j].y);
  }
  return total;
}

/** Centroid of the enclosed area, not the mean of the vertices. */
export function centroid(ring: LocalXY[]): LocalXY {
  if (!ring.length) return { x: 0, y: 0 };
  if (ring.length < 3) {
    return {
      x: ring.reduce((a, p) => a + p.x, 0) / ring.length,
      y: ring.reduce((a, p) => a + p.y, 0) / ring.length,
    };
  }
  let twice = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const cross = ring[j].x * ring[i].y - ring[i].x * ring[j].y;
    twice += cross;
    cx += (ring[j].x + ring[i].x) * cross;
    cy += (ring[j].y + ring[i].y) * cross;
  }
  // A degenerate ring (all points collinear) has zero signed area; fall back
  // to the vertex mean rather than dividing by zero.
  if (Math.abs(twice) < 1e-9) {
    return {
      x: ring.reduce((a, p) => a + p.x, 0) / ring.length,
      y: ring.reduce((a, p) => a + p.y, 0) / ring.length,
    };
  }
  return { x: cx / (3 * twice), y: cy / (3 * twice) };
}

export type Edge = {
  /** Metres along this boundary line. */
  lengthM: number;
  /** Degrees clockwise from true north, 0–360. */
  bearingDeg: number;
  /** Eight-point compass, for reading aloud. */
  compass: string;
};

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/**
 * Length and bearing of every boundary line, in order.
 *
 * This is the form a surveyor's plan states a parcel in, so it is the form
 * worth printing back: a person can take these to a surveyor and be understood.
 */
export function edges(ring: LocalXY[]): Edge[] {
  if (ring.length < 2) return [];
  const out: Edge[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    // atan2(east, north) gives a compass bearing directly, unlike the usual
    // atan2(y, x) which measures anticlockwise from east.
    const bearing = (Math.atan2(dx, dy) * R2D + 360) % 360;
    out.push({
      lengthM: Math.hypot(dx, dy),
      bearingDeg: bearing,
      compass: COMPASS[Math.round(bearing / 45) % 8],
    });
  }
  return out;
}

export type AreaFit = {
  ring: LocalXY[];
  /** Linear factor applied. 1 means the drawing already matched. */
  factor: number;
  drawnAreaM2: number;
  targetAreaM2: number;
  /** How far the drawn area was out, as a percentage of the target. */
  errorPct: number;
};

/**
 * Scale a ring about its own centroid until its area matches a target.
 *
 * Area scales with the square of a linear factor, so the factor is the square
 * root of the ratio — scaling each coordinate by 1.1 inflates the area by 21%,
 * not 10%, and getting that wrong is the obvious way to produce a plot that
 * looks right and measures wrong.
 *
 * Shape and orientation are preserved exactly; only size changes. The result
 * is a sketch whose area agrees with the deed. It is NOT a survey, and the
 * caller must not present it as one.
 */
export function fitToArea(ring: LocalXY[], targetAreaM2: number): AreaFit | null {
  if (ring.length < 3 || !(targetAreaM2 > 0)) return null;
  const drawn = areaM2(ring);
  if (!(drawn > 0)) return null;

  const factor = Math.sqrt(targetAreaM2 / drawn);
  const c = centroid(ring);
  return {
    ring: ring.map((p) => ({
      x: c.x + (p.x - c.x) * factor,
      y: c.y + (p.y - c.y) * factor,
    })),
    factor,
    drawnAreaM2: drawn,
    targetAreaM2,
    errorPct: ((drawn - targetAreaM2) / targetAreaM2) * 100,
  };
}

/** Rotate a ring about a point, degrees clockwise. For placing a plan. */
export function rotate(ring: LocalXY[], degrees: number, about: LocalXY): LocalXY[] {
  const t = -degrees * D2R; // clockwise on screen is negative in maths convention
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  return ring.map((p) => {
    const dx = p.x - about.x;
    const dy = p.y - about.y;
    return {
      x: about.x + dx * cos - dy * sin,
      y: about.y + dx * sin + dy * cos,
    };
  });
}

/** Translate a ring by metres east and north. */
export function translate(ring: LocalXY[], dx: number, dy: number): LocalXY[] {
  return ring.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

/* ---------------- units a Kenyan record actually uses ---------------- */

export const ACRE_M2 = 4046.8564224;
export const HECTARE_M2 = 10_000;

export type ParsedArea = {
  m2: number;
  unit: string;
  /**
   * True when the text gave dimensions without saying which unit they are in.
   * "50 x 100" is an eighth-acre plot in feet and half a hectare in metres,
   * and nothing in the string decides. The caller must ask.
   */
  ambiguous?: boolean;
  /** The alternative reading, when ambiguous. */
  alternativeM2?: number;
};

/**
 * Read an area the way it appears on a title or a mutation plan.
 *
 * Handles "0.044Ha" with no space, which is how every plot on a real Kenyan
 * subdivision sheet is labelled — the first version of this function required
 * a word boundary before the unit and refused that format outright, because
 * "4" and "h" are both word characters. Number and unit are now matched as one
 * token, which is the only way the two reliably stay together.
 *
 * Returns null rather than guessing. An area read wrongly is worse than an
 * area not read at all, because everything downstream scales to it.
 */
export function parseArea(text: string): ParsedArea | null {
  const s = (text ?? "").trim().toLowerCase();
  if (!s) return null;

  // Dimensions. A mutation plan states these in metres and says so; a plot
  // advertisement states them in feet and does not. Both readings are returned
  // and the caller decides — see ParsedArea.ambiguous.
  const dims = s.match(
    /^(\d+(?:\.\d+)?)\s*(?:x|by|\*)\s*(\d+(?:\.\d+)?)\s*(m|ft|feet|metres?|meters?)?$/,
  );
  if (dims) {
    const a = parseFloat(dims[1]);
    const b = parseFloat(dims[2]);
    if (!(a > 0 && b > 0)) return null;
    const metric = a * b;
    const imperial = metric * 0.09290304;
    const stated = dims[3];
    if (stated && /^(m|metres?|meters?)$/.test(stated)) return { m2: metric, unit: "m" };
    if (stated) return { m2: imperial, unit: "ft" };
    return { m2: imperial, unit: "ft", ambiguous: true, alternativeM2: metric };
  }

  // A fraction with a unit: "1/8 acre".
  const frac = s.match(/(\d+)\s*\/\s*(\d+)\s*(ha|hectares?|acres?|ac)\b/);
  if (frac) {
    const value = parseInt(frac[1], 10) / parseInt(frac[2], 10);
    if (!(value > 0)) return null;
    return /^h/.test(frac[3])
      ? { m2: value * HECTARE_M2, unit: "ha" }
      : { m2: value * ACRE_M2, unit: "acre" };
  }

  // Number and unit as one token, so "0.044Ha" and "0.044 Ha" both read.
  const m = s.match(
    // The trailing guard is a lookahead, not \\b: "m\u00b2" ends in a superscript
    // two, which is not a word character, so a word boundary after it never
    // matches and "443.7 m\u00b2" was refused outright.
    /(\d+(?:\.\d+)?)\s*(hectares?|ha|acres?|ac|sq\.?\s*m(?:etres?|eters?)?|sqm|m2|m\u00b2|square\s*met(?:er|re)s?)(?![a-z0-9])/,
  );
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = m[2].replace(/\s+/g, "");

  if (/^(hectares?|ha)$/.test(unit)) return { m2: value * HECTARE_M2, unit: "ha" };
  if (/^(acres?|ac)$/.test(unit)) return { m2: value * ACRE_M2, unit: "acre" };
  return { m2: value, unit: "m2" };
}

/* ---------------- reading a subdivision plan ---------------- */

/**
 * A rectangular plot as a ring, centred on the origin, long axis north.
 *
 * Most plots on a Kenyan subdivision sheet are rectangles stated by width and
 * depth — "15.3" across and "29.0" deep. There is no need to trace a drawing
 * or parse vector paths to reproduce one: the numbers on the plan define it
 * exactly. The caller rotates and positions it over the imagery.
 */
export function rectangleRing(widthM: number, depthM: number): LocalXY[] | null {
  if (!(widthM > 0) || !(depthM > 0)) return null;
  const w = widthM / 2;
  const d = depthM / 2;
  return [
    { x: -w, y: -d },
    { x: w, y: -d },
    { x: w, y: d },
    { x: -w, y: d },
  ];
}

/**
 * A plot bounded by two parallel widths — the trapezoid at the end of a row,
 * where a road or a boundary cuts the block at an angle.
 */
export function trapezoidRing(frontM: number, backM: number, depthM: number): LocalXY[] | null {
  if (!(frontM > 0) || !(backM > 0) || !(depthM > 0)) return null;
  const d = depthM / 2;
  return [
    { x: -frontM / 2, y: -d },
    { x: frontM / 2, y: -d },
    { x: backM / 2, y: d },
    { x: -backM / 2, y: d },
  ];
}

export type PlanCheck = {
  /** Area implied by the dimensions printed on the plan. */
  computedM2: number;
  /** Area printed on the plan for that plot. */
  statedM2: number;
  /** Signed difference as a percentage of the stated area. */
  errorPct: number;
  /** Within the rounding a plan's own printed precision allows. */
  consistent: boolean;
};

/**
 * Cross-check a plot's printed dimensions against its printed area.
 *
 * A subdivision sheet states both, which makes it self-checking: on the Konza
 * South sheet, 15.3 x 29.0 m is 443.7 m2 against a printed 0.044 Ha, which is
 * 0.8% out and entirely explained by rounding the area to three decimals.
 *
 * A plot whose numbers disagree by more than rounding can explain is worth
 * stopping on. It may be a typo on the plan, a misread by OCR, or a figure
 * that has been altered — this function does not say which, only that the two
 * numbers do not agree.
 *
 * The tolerance is derived, not guessed: an area printed to three decimals of
 * a hectare is quantised to 10 m2, so a 440 m2 plot carries up to ~1.1% of
 * rounding before anything is wrong. 2% leaves room for the dimensions being
 * rounded to one decimal too.
 */
export function checkPlanConsistency(
  widthM: number,
  depthM: number,
  statedM2: number,
  tolerancePct = 2,
): PlanCheck | null {
  if (!(widthM > 0) || !(depthM > 0) || !(statedM2 > 0)) return null;
  const computed = widthM * depthM;
  const errorPct = ((computed - statedM2) / statedM2) * 100;
  return {
    computedM2: computed,
    statedM2,
    errorPct,
    consistent: Math.abs(errorPct) <= tolerancePct,
  };
}

/**
 * Metres on the ground per millimetre on the paper, from a stated scale.
 *
 * "Scale 1:1000" means one millimetre of paper is one metre of ground. Used to
 * turn a measured distance on the sheet into a ground distance when a plot's
 * dimensions are not printed.
 */
export function parseScale(text: string): { ratio: number; metresPerMm: number } | null {
  const m = (text ?? "").match(/1\s*[:/]\s*(\d{2,6})/);
  if (!m) return null;
  const ratio = parseInt(m[1], 10);
  if (!(ratio > 0)) return null;
  return { ratio, metresPerMm: ratio / 1000 };
}

/** Area in the phrasing a Kenyan buyer would recognise. */
export function describeArea(m2: number): string {
  const acres = m2 / ACRE_M2;
  if (m2 < 2000) return `${Math.round(m2)} m² (about ${acres.toFixed(3)} acres)`;
  if (m2 < HECTARE_M2) return `${Math.round(m2)} m² (about ${acres.toFixed(2)} acres)`;
  return `${(m2 / HECTARE_M2).toFixed(2)} ha (about ${acres.toFixed(2)} acres)`;
}
