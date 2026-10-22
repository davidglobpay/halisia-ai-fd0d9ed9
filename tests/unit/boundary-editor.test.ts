import { describe, expect, it } from "vitest";
import {
  addVertex, clearBoundary, closeRing, emptyBoundary, loadRing, moveVertex,
  readout, removeVertex, reopenRing, toGeoJsonPolygon, undo, type BoundaryState,
} from "@/lib/boundary-editor";
import { SQM_PER_ACRE, type LngLat } from "@/lib/site-geometry";

const R = 6371007.181;
const D2R = Math.PI / 180;
const NAIROBI = { lat: -1.286389, lng: 36.817223 };

function rect(c: LngLat, w: number, h: number): LngLat[] {
  const mLat = R * D2R;
  const mLng = mLat * Math.cos(c.lat * D2R);
  const dLat = h / 2 / mLat;
  const dLng = w / 2 / mLng;
  return [
    { lat: c.lat - dLat, lng: c.lng - dLng },
    { lat: c.lat - dLat, lng: c.lng + dLng },
    { lat: c.lat + dLat, lng: c.lng + dLng },
    { lat: c.lat + dLat, lng: c.lng - dLng },
  ];
}

/** A square of exactly one acre, in Nairobi. */
const ACRE = rect(NAIROBI, 63.6149, 63.6149);
const build = (pts: LngLat[]) => pts.reduce<BoundaryState>((s, p) => addVertex(s, p), emptyBoundary);

describe("drawing", () => {
  it("starts empty and asks for the first corner", () => {
    expect(readout(emptyBoundary).status).toBe("empty");
  });

  it("reports a running length but never an area before three corners", () => {
    // ACRE[0] and ACRE[1] are adjacent corners: one 63.6149 m side.
    const s = addVertex(addVertex(emptyBoundary, ACRE[0]), ACRE[1]);
    const r = readout(s);
    expect(r.status).toBe("drawing");
    if (r.status === "drawing") expect(r.runningLengthM).toBeCloseTo(63.61, 1);
    expect(JSON.stringify(r)).not.toContain("areaSqM");
  });

  it("measures a one-acre square once it is enclosed", () => {
    const r = readout(build(ACRE));
    expect(r.status).toBe("measurable");
    if (r.status === "measurable") {
      expect(r.measurement.areaSqM / SQM_PER_ACRE).toBeCloseTo(1, 2);
      expect(r.measurement.provenance).toContain("not a surveyed area");
    }
  });
});

describe("closing and reopening", () => {
  it("refuses to close a shape with fewer than three corners", () => {
    expect(closeRing(build(ACRE.slice(0, 2))).closed).toBe(false);
  });

  it("ignores new corners once closed, and accepts them again once reopened", () => {
    const closed = closeRing(build(ACRE));
    expect(closed.closed).toBe(true);
    expect(addVertex(closed, NAIROBI).vertices).toHaveLength(4);
    expect(addVertex(reopenRing(closed), NAIROBI).vertices).toHaveLength(5);
  });
});

describe("editing corners", () => {
  it("grows the area when a corner is dragged outward", () => {
    const base = build(ACRE);
    const moved = moveVertex(base, 0, { lat: ACRE[0].lat - 0.0005, lng: ACRE[0].lng });
    const before = readout(base);
    const after = readout(moved);
    if (before.status === "measurable" && after.status === "measurable")
      expect(after.measurement.areaSqM).toBeGreaterThan(before.measurement.areaSqM);
  });

  it("ignores a drag to a non-existent corner or to NaN", () => {
    const base = build(ACRE);
    expect(moveVertex(base, 9, NAIROBI)).toBe(base);
    expect(moveVertex(base, 0, { lat: NaN, lng: 5 })).toBe(base);
  });

  it("falls back from an area to a running length when a corner is removed", () => {
    const three = removeVertex(build(ACRE), 0);
    expect(readout(three).status).toBe("measurable");
    expect(readout(removeVertex(three, 0)).status).toBe("drawing");
  });

  it("drops the closed flag when a removal takes it under three corners", () => {
    const closed = closeRing(build(ACRE));
    expect(removeVertex(closed, 0).closed).toBe(true);
    expect(removeVertex(removeVertex(closed, 0), 0).closed).toBe(false);
  });
});

describe("undo", () => {
  it("restores the exact previous shape", () => {
    const before = build(ACRE.slice(0, 3));
    const after = addVertex(before, ACRE[3]);
    expect(undo(after).vertices).toEqual(before.vertices);
  });

  it("walks back through a run of drags", () => {
    let s = build(ACRE);
    for (let i = 0; i < 6; i++) s = moveVertex(s, 0, { lat: ACRE[0].lat - i * 1e-5, lng: ACRE[0].lng });
    for (let i = 0; i < 6; i++) s = undo(s);
    expect(s.vertices[0].lat).toBeCloseTo(ACRE[0].lat, 9);
  });

  it("is a no-op on an empty editor, and caps its history", () => {
    expect(undo(emptyBoundary)).toBe(emptyBoundary);
    let s = emptyBoundary;
    for (let i = 0; i < 80; i++) s = addVertex(s, { lat: -1 - i * 1e-4, lng: 36 });
    expect(s.past).toHaveLength(50);
  });
});

describe("loading, clearing and export", () => {
  it("loads a ring closed, dropping any repeated closing vertex", () => {
    expect(loadRing(ACRE).closed).toBe(true);
    expect(loadRing([...ACRE, ACRE[0]]).vertices).toHaveLength(4);
  });

  it("gives an empty editor for a shape that is not a polygon", () => {
    expect(loadRing([NAIROBI]).vertices).toHaveLength(0);
    expect(clearBoundary().vertices).toHaveLength(0);
  });

  it("exports a closed GeoJSON polygon in lng,lat order", () => {
    const gj = toGeoJsonPolygon(build(ACRE))!;
    expect(gj.type).toBe("Polygon");
    expect(gj.coordinates[0]).toHaveLength(5);
    expect(gj.coordinates[0][0]).toEqual([ACRE[0].lng, ACRE[0].lat]);
    expect(gj.coordinates[0][0]).toEqual(gj.coordinates[0][4]);
  });

  it("exports nothing from an empty editor", () => {
    expect(toGeoJsonPolygon(emptyBoundary)).toBeNull();
  });
});

describe("immutability", () => {
  it("never mutates the state handed to a transition", () => {
    const original = build(ACRE);
    const snapshot = JSON.stringify(original);
    void addVertex(original, NAIROBI);
    void moveVertex(original, 0, NAIROBI);
    void removeVertex(original, 0);
    void closeRing(original);
    void undo(original);
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});
