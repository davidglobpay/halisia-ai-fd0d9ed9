import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { enuToThree, gpsToLocal } from "@/lib/spatial";
import {
  disposeObjectTree,
  flatShapeGeometry,
  footprintExtrudeGeometry,
  ringToThreePoints,
  setbackRibbonGeometry,
  xrStartErrorMessage,
} from "@/lib/spatial-three";

// Local ENU ring: 10 m east × 20 m north rectangle.
const RING = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 20 },
  { x: 0, y: 20 },
];

function bbox(geo: THREE.BufferGeometry) {
  geo.computeBoundingBox();
  return geo.boundingBox!;
}

describe("ENU → Three.js orientation convention", () => {
  it("maps east to +X, up to +Y, north to −Z", () => {
    expect(enuToThree({ x: 3, y: 7 }, 1)).toEqual({ x: 3, y: 1, z: -7 });
  });

  it("ringToThreePoints follows the same convention and closes the ring", () => {
    const pts = ringToThreePoints(RING, 0.08);
    expect(pts).toHaveLength(RING.length + 1);
    expect(pts[2]!.toArray()).toEqual([10, 0.08, -20]);
    expect(pts[0]!.toArray()).toEqual(pts[pts.length - 1]!.toArray());
  });

  it("flatShapeGeometry (ground) aligns with the boundary convention", () => {
    const b = bbox(flatShapeGeometry(RING));
    expect(b.min.x).toBeCloseTo(0);
    expect(b.max.x).toBeCloseTo(10);
    expect(b.min.z).toBeCloseTo(-20); // north edge lands on −Z
    expect(b.max.z).toBeCloseTo(0);
    expect(b.min.y).toBeCloseTo(0);
    expect(b.max.y).toBeCloseTo(0);
  });

  it("setbackRibbonGeometry spans the outer ring on the same axes", () => {
    const inner = RING.map((p) => ({ x: p.x * 0.5 + 2.5, y: p.y * 0.5 + 5 }));
    const b = bbox(setbackRibbonGeometry(RING, inner));
    expect(b.min.z).toBeCloseTo(-20);
    expect(b.max.z).toBeCloseTo(0);
    expect(b.max.x).toBeCloseTo(10);
  });

  it("footprintExtrudeGeometry matches boundary north/south and grows +Y", () => {
    const b = bbox(footprintExtrudeGeometry(RING, 12));
    expect(b.min.z).toBeCloseTo(-20);
    expect(b.max.z).toBeCloseTo(0);
    expect(b.min.y).toBeCloseTo(0);
    expect(b.max.y).toBeCloseTo(12);
  });

  it("gpsToLocal → enuToThree agrees with ringToThreePoints for beacons", () => {
    const origin = { lat: -1.2921, lng: 36.8219 };
    const beacon = { lat: -1.2919, lng: 36.8222 };
    const local = gpsToLocal(beacon, origin);
    const v = enuToThree(local, 2);
    expect(v.x).toBeCloseTo(local.x);
    expect(v.z).toBeCloseTo(-local.y);
  });
});

describe("disposeObjectTree", () => {
  it("disposes geometries and materials of every descendant", () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]),
      [new THREE.LineBasicMaterial(), new THREE.LineBasicMaterial()],
    ) as unknown as THREE.Line;
    const child = new THREE.Group();
    const nested = new THREE.Mesh(
      new THREE.SphereGeometry(1),
      new THREE.MeshStandardMaterial(),
    );
    child.add(nested);
    group.add(mesh, line, child);

    const geoSpy = vi.spyOn(mesh.geometry, "dispose");
    const matSpy = vi.spyOn(mesh.material as THREE.Material, "dispose");
    const lineGeoSpy = vi.spyOn(line.geometry, "dispose");
    const lineMatSpies = (line.material as THREE.Material[]).map((m) => vi.spyOn(m, "dispose"));
    const nestedGeoSpy = vi.spyOn(nested.geometry, "dispose");

    disposeObjectTree(group);

    expect(geoSpy).toHaveBeenCalled();
    expect(matSpy).toHaveBeenCalled();
    expect(lineGeoSpy).toHaveBeenCalled();
    lineMatSpies.forEach((s) => expect(s).toHaveBeenCalled());
    expect(nestedGeoSpy).toHaveBeenCalled();
  });
});

describe("xrStartErrorMessage", () => {
  it("differentiates missing WebXR from unsupported modes", () => {
    expect(xrStartErrorMessage("ar", "no-webxr")).toMatch(/WebXR is not available/);
    expect(xrStartErrorMessage("vr", "unsupported")).toMatch(/does not support immersive VR/);
    expect(xrStartErrorMessage("ar", "unsupported")).toMatch(/immersive AR/);
  });

  it("surfaces permission denial distinctly", () => {
    const denied = Object.assign(new Error("denied"), { name: "NotAllowedError" });
    expect(xrStartErrorMessage("ar", "request-failed", denied)).toMatch(/Permission .* denied/);
  });

  it("preserves the underlying error message instead of masking it", () => {
    const err = new Error("session limit reached");
    expect(xrStartErrorMessage("vr", "request-failed", err)).toContain("session limit reached");
  });

  it("handles non-Error failures without crashing", () => {
    expect(xrStartErrorMessage("ar", "request-failed", "boom")).toMatch(/Could not start/);
  });
});
