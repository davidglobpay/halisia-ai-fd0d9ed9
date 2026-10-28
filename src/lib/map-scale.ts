/**
 * Web Mercator scale, and the furniture a map sheet needs to be read.
 *
 * A map without a scale is a picture. The Land Passport embeds composited
 * tiles, so the ground distance those tiles represent has to be computed from
 * the projection rather than guessed — and it changes with latitude, which is
 * the part that is easy to get wrong. At Kenya's latitudes the cosine term is
 * within 1% of unity, so an error here hides well in testing and shows up as
 * a wrong scale bar on a printed sheet.
 */

/** WGS-84 equatorial circumference, metres. The Web Mercator constant. */
export const EQUATORIAL_CIRCUMFERENCE_M = 40075016.686;
/** Standard raster tile edge, pixels. Esri, OSM and Google all use 256. */
export const TILE_SIZE_PX = 256;
/** PostScript points per inch — jsPDF's unit when constructed with "pt". */
const POINTS_PER_INCH = 72;
const METRES_PER_INCH = 0.0254;

/**
 * Ground distance one screen pixel covers, at a latitude and zoom.
 *
 * At zoom 0 on the equator this is 156,543.03 m/px, halving with each zoom
 * level and shrinking by cos(latitude) away from the equator.
 */
export function metresPerPixel(lat: number, zoom: number, tileSize = TILE_SIZE_PX): number | null {
  if (!Number.isFinite(lat) || Math.abs(lat) > 85.05112878) return null;
  if (!Number.isFinite(zoom) || zoom < 0 || zoom > 24) return null;
  if (!Number.isFinite(tileSize) || tileSize <= 0) return null;
  return (
    (EQUATORIAL_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (tileSize * 2 ** zoom)
  );
}

export type ScaleBar = {
  /** Length to draw, in the same pixels `metresPerPixel` was computed for. */
  lengthPx: number;
  /** The round ground distance that length represents. */
  lengthM: number;
  /** How to label it: "200 m", "1 km". */
  label: string;
};

/**
 * A scale bar whose ground length is a round number.
 *
 * A bar labelled "137 m" is useless: a reader measures against it by eye, so
 * the number has to be one they can halve and quarter. The 1-2-5 sequence is
 * the convention, and the bar is drawn at whatever pixel length that round
 * distance works out to — never the other way round.
 */
export function niceScaleBar(targetPx: number, mPerPx: number): ScaleBar | null {
  if (!Number.isFinite(targetPx) || targetPx <= 0) return null;
  if (!Number.isFinite(mPerPx) || mPerPx <= 0) return null;

  const roughM = targetPx * mPerPx;
  const magnitude = 10 ** Math.floor(Math.log10(roughM));
  const normalized = roughM / magnitude;
  const step = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;
  const lengthM = step * magnitude;

  return {
    lengthM,
    lengthPx: lengthM / mPerPx,
    label: formatGroundDistance(lengthM),
  };
}

export function formatGroundDistance(metres: number): string {
  if (!Number.isFinite(metres) || metres <= 0) return "";
  if (metres >= 1000) {
    const km = metres / 1000;
    return `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
  }
  if (metres >= 1) return `${Math.round(metres)} m`;
  return `${metres.toFixed(2)} m`;
}

/**
 * The representative fraction for a printed sheet: "1:2,500".
 *
 * `pdfPoints` is how wide the image is drawn in the document, and
 * `groundMetres` is what that width spans on the ground. Printed at 100% on A4
 * this is the true scale; the caller should say so, because a reader who
 * prints "fit to page" gets a different one.
 */
export function printScaleRatio(groundMetres: number, pdfPoints: number): string | null {
  if (!Number.isFinite(groundMetres) || groundMetres <= 0) return null;
  if (!Number.isFinite(pdfPoints) || pdfPoints <= 0) return null;
  const paperMetres = (pdfPoints / POINTS_PER_INCH) * METRES_PER_INCH;
  const denominator = groundMetres / paperMetres;
  return `1:${Math.round(denominator).toLocaleString("en-KE")}`;
}

/**
 * The deepest zoom whose pixels still resolve a given ground detail.
 *
 * Used to stop a sheet being drawn at a zoom its tiles cannot support: asking
 * for 0.1 m detail from a service that publishes to zoom 19 produces a blurry
 * enlargement that reads as precision.
 */
export function zoomForGroundResolution(
  lat: number,
  targetMPerPx: number,
  maxZoom = 19,
): number | null {
  if (!Number.isFinite(targetMPerPx) || targetMPerPx <= 0) return null;
  for (let z = 0; z <= maxZoom; z++) {
    const m = metresPerPixel(lat, z);
    if (m != null && m <= targetMPerPx) return z;
  }
  return null;
}

/**
 * Choose the zoom that frames a bounding box in a given pixel viewport, with
 * a margin so the shape does not touch the edge of the sheet.
 */
export function zoomToFitBBox(
  bbox: { west: number; south: number; east: number; north: number },
  viewportPx: { width: number; height: number },
  options: { maxZoom?: number; marginFraction?: number } = {},
): number | null {
  const { west, south, east, north } = bbox;
  if (![west, south, east, north].every(Number.isFinite)) return null;
  if (east <= west || north <= south) return null;
  if (!(viewportPx.width > 0) || !(viewportPx.height > 0)) return null;

  const maxZoom = options.maxZoom ?? 19;
  const margin = options.marginFraction ?? 0.1;
  const usableW = viewportPx.width * (1 - margin);
  const usableH = viewportPx.height * (1 - margin);
  const midLat = (north + south) / 2;

  // Span in metres. Longitude shrinks with latitude; latitude does not.
  const mPerDegLat = EQUATORIAL_CIRCUMFERENCE_M / 360;
  const spanLatM = (north - south) * mPerDegLat;
  const spanLngM = (east - west) * mPerDegLat * Math.cos((midLat * Math.PI) / 180);

  for (let z = maxZoom; z >= 0; z--) {
    const m = metresPerPixel(midLat, z);
    if (m == null) continue;
    if (spanLngM / m <= usableW && spanLatM / m <= usableH) return z;
  }
  return 0;
}
