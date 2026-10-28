import { describe, expect, it } from "vitest";
import { computeSheetLayout, scaleBarFits, SITE_SHEET_LIMITATION } from "@/lib/passport-site-sheet";
import { measureSite, type LngLat } from "@/lib/site-geometry";

const R = 6371007.181;
const D2R = Math.PI / 180;
const NAIROBI = { lat: -1.286389, lng: 36.817223 };

function rect(c: LngLat, w: number, h: number): LngLat[] {
  const mLat = R * D2R;
  const mLng = mLat * Math.cos(c.lat * D2R);
  const dLat = h / 2 / mLat;
  const dLng = w / 2 / mLng;
  return [
    { lat: c.lat - dLat, lng: c.lng - dLng }, { lat: c.lat - dLat, lng: c.lng + dLng },
    { lat: c.lat + dLat, lng: c.lng + dLng }, { lat: c.lat + dLat, lng: c.lng - dLng },
  ];
}

/** A4 in points, as passport-pdf.ts constructs its document. */
const PAGE = { pageWidth: 595.28, pageHeight: 841.89, margin: 40, mapTop: 120, mapHeight: 300 };
const base = { ...PAGE, imagerySource: "Esri World Imagery", imageryDate: null };
const sheetFor = (metres: number) => {
  const m = measureSite(rect(NAIROBI, metres, metres))!;
  return computeSheetLayout({ ...base, bbox: m.bbox, measurement: m });
};

describe("the frame", () => {
  it("respects the page margins and stays on the page", () => {
    const l = sheetFor(60);
    expect(l.map.x).toBe(PAGE.margin);
    expect(l.map.x + l.map.width).toBeLessThanOrEqual(PAGE.pageWidth - PAGE.margin + 0.01);
  });
});

describe("the scale bar", () => {
  it.each([30, 60, 200, 800])("fits inside the frame for a %s m site", (metres) => {
    const l = sheetFor(metres);
    expect(l.scaleBar).not.toBeNull();
    expect(scaleBarFits(l)).toBe(true);
  });

  it.each([30, 60, 200, 800])("carries a 1/2/5 ground length for a %s m site", (metres) => {
    const bar = sheetFor(metres).scaleBar!;
    const mantissa = bar.lengthM / 10 ** Math.floor(Math.log10(bar.lengthM));
    expect([1, 2, 5]).toContainEqual(Math.round(mantissa));
  });
});

describe("with no boundary, nothing is invented", () => {
  const none = computeSheetLayout({ ...base, bbox: null, measurement: null });

  it("omits the scale rather than guessing one", () => {
    expect(none.scaleBar).toBeNull();
    expect(none.printScale).toBeNull();
    expect(none.zoom).toBeNull();
  });

  it("still states the imagery source and that no capture date is published", () => {
    expect(none.legend.rows.find((r) => r.label === "Imagery")).toBeDefined();
    expect(none.legend.rows.find((r) => r.label === "Capture date")!.value).toContain("not published");
  });
});

describe("the legend", () => {
  const l = sheetFor(60);

  it.each(["Area", "Perimeter", "Corners", "Centroid", "Imagery", "Capture date", "Scale at 100%"])(
    "carries %s",
    (label) => expect(l.legend.rows.map((r) => r.label)).toContain(label),
  );

  it("formats the area rather than printing a raw number", () => {
    expect(l.legend.rows.find((r) => r.label === "Area")!.value).toMatch(/m2|acres/);
  });

  it("fits above the page footer", () => {
    expect(l.legend.y + l.legend.rows.length * 16).toBeLessThan(PAGE.pageHeight - 60);
  });
});

describe("the limitation sentence", () => {
  it("denies a survey and names who to ask", () => {
    expect(SITE_SHEET_LIMITATION).toContain("not a surveyed parcel");
    expect(SITE_SHEET_LIMITATION).toContain("licensed surveyor");
  });
});
