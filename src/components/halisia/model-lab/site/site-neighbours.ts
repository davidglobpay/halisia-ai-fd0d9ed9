/**
 * Neighbouring buildings around the site, from OpenStreetMap footprints,
 * extruded to their recorded height (or a single-storey default) and set on
 * the terrain. Context only: footprints are as mapped by volunteers, may be
 * missing or out of date, and are never treated as a survey.
 */
import * as THREE from "three";
import { toLocalMetres, type NearbyBuilding } from "@/lib/site-context";
import { heightAt, type SiteTerrain } from "./site-terrain";

export type LocalNeighbour = {
  ring: Array<{ x: number; z: number }>;
  heightM: number;
  defaulted: boolean;
};

/** Footprints within `radiusM` of the site, minus any under the new house. */
export function localNeighbours(
  buildings: readonly NearbyBuilding[],
  origin: { lat: number; lng: number },
  radiusM: number,
  keepClear: { halfX: number; halfZ: number },
): LocalNeighbour[] {
  const out: LocalNeighbour[] = [];
  for (const b of buildings) {
    if (b.ring.length < 3) continue;
    const ring = b.ring.map((q) => toLocalMetres(q.lat, q.lng, origin.lat, origin.lng));
    const cx = ring.reduce((a, p) => a + p.x, 0) / ring.length;
    const cz = ring.reduce((a, p) => a + p.z, 0) / ring.length;
    if (Math.hypot(cx, cz) > radiusM) continue;
    // A mapped building where the new house stands is what the house would
    // replace (or a mismatch between map and plot): leave the spot clear.
    const overlaps = ring.some(
      (p) => Math.abs(p.x) < keepClear.halfX + 2 && Math.abs(p.z) < keepClear.halfZ + 2,
    );
    if (overlaps || (Math.abs(cx) < keepClear.halfX + 2 && Math.abs(cz) < keepClear.halfZ + 2))
      continue;
    out.push({ ring, heightM: b.heightM, defaulted: b.heightSource === "default" });
  }
  return out;
}

const roofColours = [0x8a3b2a, 0x6f6a63, 0x9a4a32, 0x5b6770, 0x7d2f25];

/** Extruded walls with a thin darker roof slab, sitting on the terrain. */
export function buildNeighbourGroup(
  list: readonly LocalNeighbour[],
  terrain: SiteTerrain | null,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "neighbour-buildings";
  const wall = new THREE.MeshStandardMaterial({ color: 0xe6dfd0, roughness: 0.92 });
  const roofs = roofColours.map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0.1 }),
  );
  list.forEach((b, i) => {
    const shape = new THREE.Shape(b.ring.map((p) => new THREE.Vector2(p.x, -p.z)));
    const base = Math.min(...b.ring.map((p) => (terrain ? heightAt(terrain, p.x, p.z) : 0))) - 0.3;
    const walls = new THREE.ExtrudeGeometry(shape, { depth: b.heightM + 0.3, bevelEnabled: false });
    walls.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(walls, wall);
    m.position.y = base;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    const roof = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false });
    roof.rotateX(-Math.PI / 2);
    const r = new THREE.Mesh(roof, roofs[i % roofs.length]);
    r.position.y = base + b.heightM + 0.3;
    r.castShadow = true;
    group.add(r);
  });
  return group;
}
