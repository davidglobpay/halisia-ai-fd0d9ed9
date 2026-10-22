/**
 * The site map sheet for the Land Passport.
 *
 * A map a reader can measure against, rather than a picture of a map: the
 * boundary, a scale bar whose ground length is a round number, a north arrow,
 * the corner coordinates, the imagery source and what it does not establish.
 *
 * Layout is computed by `computeSheetLayout`, which is pure and unit-tested.
 * `drawSiteSheet` does nothing but paint what that returns, so the arithmetic
 * that decides whether a scale bar fits inside the frame is covered by tests
 * even though the drawing is not.
 */

import type jsPDF from "jspdf";
import { PDF, sanitize } from "./pdf-chrome";
import {
  metresPerPixel, niceScaleBar, printScaleRatio, zoomToFitBBox, type ScaleBar,
} from "./map-scale";
import { formatArea, type BBox, type SiteMeasurement } from "./site-geometry";

export type SheetLayout = {
  map: { x: number; y: number; width: number; height: number };
  scaleBar: (ScaleBar & { x: number; y: number }) | null;
  northArrow: { x: number; y: number; size: number };
  coordinateLine: { x: number; y: number };
  legend: { x: number; y: number; rows: Array<{ label: string; value: string }> };
  printScale: string | null;
  zoom: number | null;
};

/** How wide the scale bar aims to be, as a share of the map frame. */
const SCALE_BAR_TARGET_FRACTION = 0.3;
const NORTH_ARROW_PT = 26;
const INSET_PT = 14;

/**
 * Work out where everything goes, and whether a scale bar is possible at all.
 *
 * A scale bar is omitted rather than faked when the zoom cannot be determined
 * — an unlabelled map is honest, a bar with the wrong ground length is not.
 */
export function computeSheetLayout(input: {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  mapTop: number;
  mapHeight: number;
  bbox: BBox | null;
  measurement: SiteMeasurement | null;
  imagerySource: string;
  imageryDate: string | null;
  maxZoom?: number;
}): SheetLayout {
  const { pageWidth, margin, mapTop, mapHeight, bbox, measurement } = input;
  const mapWidth = pageWidth - margin * 2;
  const map = { x: margin, y: mapTop, width: mapWidth, height: mapHeight };

  // The composited image is rendered at `mapWidth` points but sampled at a
  // tile zoom. Both are needed: one sets the paper size, the other the ground.
  const zoom =
    bbox != null
      ? zoomToFitBBox(bbox, { width: 512, height: 320 }, { maxZoom: input.maxZoom ?? 19 })
      : null;

  let scaleBar: SheetLayout["scaleBar"] = null;
  let printScale: string | null = null;

  if (zoom != null && bbox != null) {
    const midLat = (bbox.north + bbox.south) / 2;
    const mPerPx = metresPerPixel(midLat, zoom);
    if (mPerPx != null) {
      // The image is drawn `mapWidth` pt wide from a 512 px composite, so a
      // point on paper covers more ground than a pixel did.
      const mPerPoint = (mPerPx * 512) / mapWidth;
      const bar = niceScaleBar(mapWidth * SCALE_BAR_TARGET_FRACTION, mPerPoint);
      if (bar) {
        scaleBar = {
          ...bar,
          x: margin + INSET_PT,
          y: mapTop + mapHeight - INSET_PT - 10,
        };
        printScale = printScaleRatio(mPerPoint * mapWidth, mapWidth);
      }
    }
  }

  const rows: Array<{ label: string; value: string }> = [];
  if (measurement) {
    rows.push({ label: "Area", value: formatArea(measurement.areaSqM) });
    rows.push({ label: "Perimeter", value: `${measurement.perimeterM.toFixed(1)} m` });
    rows.push({ label: "Corners", value: String(measurement.vertices) });
    rows.push({
      label: "Centroid",
      value: `${measurement.centroid.lat.toFixed(5)}, ${measurement.centroid.lng.toFixed(5)}`,
    });
  }
  rows.push({ label: "Imagery", value: input.imagerySource });
  rows.push({ label: "Capture date", value: input.imageryDate ?? "not published by this provider" });
  if (printScale) rows.push({ label: "Scale at 100%", value: printScale });

  return {
    map,
    scaleBar,
    northArrow: {
      x: pageWidth - margin - INSET_PT - NORTH_ARROW_PT,
      y: mapTop + INSET_PT,
      size: NORTH_ARROW_PT,
    },
    coordinateLine: { x: margin, y: mapTop + mapHeight + 14 },
    legend: { x: margin, y: mapTop + mapHeight + 34, rows },
    printScale,
    zoom,
  };
}

/** Does the bar fit inside its frame? Used by the layout tests, and by callers. */
export function scaleBarFits(layout: SheetLayout): boolean {
  if (!layout.scaleBar) return true;
  const right = layout.scaleBar.x + layout.scaleBar.lengthPx;
  return right <= layout.map.x + layout.map.width - INSET_PT;
}

/* ------------------------------------------------------------- drawing --- */

function drawNorthArrow(doc: jsPDF, x: number, y: number, size: number) {
  doc.setFillColor(255, 253, 248);
  doc.roundedRect(x - 4, y - 4, size + 8, size + 18, 4, 4, "F");
  doc.setFillColor(...PDF.forest);
  doc.triangle(x + size / 2, y, x + size, y + size, x + size / 2, y + size * 0.72, "F");
  doc.triangle(x + size / 2, y, x, y + size, x + size / 2, y + size * 0.72, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF.forest);
  doc.text("N", x + size / 2, y + size + 11, { align: "center" });
}

function drawScaleBar(doc: jsPDF, bar: NonNullable<SheetLayout["scaleBar"]>) {
  const h = 7;
  doc.setFillColor(255, 253, 248);
  doc.roundedRect(bar.x - 6, bar.y - 16, bar.lengthPx + 12, h + 26, 4, 4, "F");
  // Alternating blocks, the convention that lets a reader halve the bar by eye.
  const half = bar.lengthPx / 2;
  doc.setFillColor(...PDF.forest);
  doc.rect(bar.x, bar.y, half, h, "F");
  doc.setDrawColor(...PDF.forest);
  doc.setLineWidth(0.8);
  doc.rect(bar.x + half, bar.y, half, h, "S");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF.forest);
  doc.text("0", bar.x, bar.y - 4);
  doc.text(bar.label, bar.x + bar.lengthPx, bar.y - 4, { align: "right" });
}

/**
 * Paint the sheet. Returns the y a caller should continue from.
 *
 * `mapImage` is a composited tile block; when it is absent the frame is drawn
 * empty with a plain statement rather than being skipped, so the sheet does
 * not silently lose a page.
 */
export function drawSiteSheet(
  doc: jsPDF,
  layout: SheetLayout,
  content: {
    mapImage: { dataUrl: string; width: number; height: number } | null;
    boundaryPx: Array<{ x: number; y: number }> | null;
    attribution: string;
    limitation: string;
  },
): number {
  const { map } = layout;

  if (content.mapImage) {
    doc.addImage(
      content.mapImage.dataUrl, "PNG", map.x, map.y, map.width, map.height, undefined, "FAST",
    );
  } else {
    doc.setFillColor(...PDF.paper);
    doc.rect(map.x, map.y, map.width, map.height, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...PDF.stone2);
    doc.text(
      "Imagery unavailable for this export. The boundary and its measurements below are unaffected.",
      map.x + 16, map.y + map.height / 2,
    );
  }

  if (content.boundaryPx && content.boundaryPx.length >= 3) {
    doc.setDrawColor(...PDF.gold);
    doc.setLineWidth(2);
    const pts = content.boundaryPx;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      doc.line(map.x + a.x, map.y + a.y, map.x + b.x, map.y + b.y);
    }
    doc.setLineWidth(0.6);
  }

  doc.setDrawColor(...PDF.stone2);
  doc.rect(map.x, map.y, map.width, map.height, "S");

  drawNorthArrow(doc, layout.northArrow.x, layout.northArrow.y, layout.northArrow.size);
  if (layout.scaleBar) drawScaleBar(doc, layout.scaleBar);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF.stone2);
  doc.text(sanitize(content.attribution), layout.coordinateLine.x, layout.coordinateLine.y);

  let y = layout.legend.y;
  for (const row of layout.legend.rows) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PDF.goldInk);
    doc.text(sanitize(row.label.toUpperCase()), layout.legend.x, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...PDF.forest);
    doc.text(sanitize(row.value), layout.legend.x + 110, y);
    y += 16;
  }

  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(...PDF.stone2);
  const lines = doc.splitTextToSize(
    sanitize(content.limitation), layout.map.width,
  ) as string[];
  doc.text(lines, layout.legend.x, y);
  return y + lines.length * 11 + 8;
}

/** The sentence every site sheet carries. Not optional, and not a footnote. */
export const SITE_SHEET_LIMITATION =
  "The boundary shown was drawn by hand on reference imagery. It is an estimate of the shape drawn, not a surveyed parcel: corner positions carry the basemap's georeferencing error and the zoom they were placed at. Area and perimeter follow from those corners. Confirm any boundary, area or beacon position with a licensed surveyor before relying on it.";
