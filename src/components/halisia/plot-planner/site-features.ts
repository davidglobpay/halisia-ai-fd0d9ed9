/**
 * Landscape on the plot: manicured gardens (lawn, clipped hedges, trees,
 * flower beds and a paved entrance path), a fountain in the front yard, and a
 * paved courtyard in the garden. Everything sits on the ground the viewer
 * draws (terrain or flat) and keeps clear of the building.
 *
 * Placement is worked out in the plot's own frame: u across the plot, v along
 * its depth, the road edge at v = −depth/2.
 */
import * as THREE from "three";
import type { Placement } from "@/lib/plot-placement";
import type { SiteFeatures } from "@/lib/building-types";
import { layoutFeatures, nearBuilding, toWorld, yards } from "@/lib/site-layout";
import { tree } from "./building-massing";

type HeightFn = (x: number, z: number) => number;

export type FeatureInput = {
  plot: { widthM: number; depthM: number };
  plotPlacement: Placement;
  house: Placement;
  footprint: { lengthM: number; widthM: number };
  features: SiteFeatures;
  /** Also lay a courtyard in the garden (houses, or a building too small to wrap one). */
  gardenCourt: boolean;
  height: HeightFn;
};

/** A box sitting on the ground at a world point. */
function onGround(mesh: THREE.Object3D, x: number, z: number, height: HeightFn, lift = 0) {
  mesh.position.set(x, height(x, z) + lift, z);
  return mesh;
}

export function buildSiteFeatures(i: FeatureInput): THREE.Group {
  const group = new THREE.Group();
  group.name = "site-features";
  const { plot, plotPlacement: pp, features: f, height } = i;
  const rot = (-pp.rotationDeg * Math.PI) / 180;
  const yard = yards(i);
  const lay = layoutFeatures(i, f, i.gardenCourt);

  if (f.gardens) {
    // Lawn over the plot (the building hides the part under it).
    const lawnMat = new THREE.MeshStandardMaterial({ color: 0x5c8f3a, roughness: 1 });
    const segU = 16;
    const segV = 24;
    const pos: number[] = [];
    for (let j = 0; j <= segV; j++)
      for (let k = 0; k <= segU; k++) {
        const u = -plot.widthM / 2 + 0.4 + ((plot.widthM - 0.8) * k) / segU;
        const v = -plot.depthM / 2 + 0.4 + ((plot.depthM - 0.8) * j) / segV;
        const w = toWorld(pp, u, v);
        pos.push(w.x, height(w.x, w.z) + 0.12, w.z);
      }
    const idx: number[] = [];
    for (let j = 0; j < segV; j++)
      for (let k = 0; k < segU; k++) {
        const p = j * (segU + 1) + k;
        idx.push(p, p + segU + 1, p + 1, p + 1, p + segU + 1, p + segU + 2);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const lawn = new THREE.Mesh(g, lawnMat);
    lawn.receiveShadow = true;
    lawn.name = "lawn";
    group.add(lawn);

    // Clipped hedges round the sides and back, a gap at the front for the gate.
    const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x2f5e27, roughness: 1 });
    const hedgeRun = (u0: number, v0: number, u1: number, v1: number) => {
      const len = Math.hypot(u1 - u0, v1 - v0);
      const n = Math.max(1, Math.round(len / 2));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const w = toWorld(pp, u0 + (u1 - u0) * t, v0 + (v1 - v0) * t);
        if (nearBuilding(i.house, i.footprint, w.x, w.z, 0.4)) continue;
        const seg = new THREE.Mesh(new THREE.BoxGeometry(len / n + 0.05, 1.1, 0.7), hedgeMat);
        seg.rotation.y = rot + Math.atan2(-(v1 - v0), u1 - u0);
        seg.castShadow = true;
        group.add(onGround(seg, w.x, w.z, height, 0.55));
      }
    };
    const hw = plot.widthM / 2 - 0.5;
    const hd = plot.depthM / 2 - 0.5;
    const gate = Math.min(4, plot.widthM / 3);
    hedgeRun(-hw, -hd, -hw, hd);
    hedgeRun(hw, -hd, hw, hd);
    hedgeRun(-hw, hd, hw, hd);
    hedgeRun(-hw, -hd, -gate / 2, -hd);
    hedgeRun(gate / 2, -hd, hw, -hd);

    // Trees along the sides and back, every 6–7 m, clear of the building.
    const plantTree = (u: number, v: number, h: number) => {
      const w = toWorld(pp, u, v);
      if (nearBuilding(i.house, i.footprint, w.x, w.z, 2)) return;
      group.add(tree(w.x, height(w.x, w.z), w.z, h));
    };
    for (let v = -hd + 3; v <= hd - 2; v += 6.5) {
      plantTree(-hw + 1.6, v, 5.5);
      plantTree(hw - 1.6, v + 3, 5);
    }
    for (let u = -hw + 5; u <= hw - 4; u += 7) plantTree(u, hd - 1.8, 6);

    // Flower beds either side of the gate.
    const bedColours = [0xd1495b, 0xf2c14e, 0xf78154, 0xb084cc];
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const u = side * (gate / 2 + 1 + k * 1.1);
        if (Math.abs(u) > hw - 0.8) break;
        const w = toWorld(pp, u, -hd + 1.6);
        if (nearBuilding(i.house, i.footprint, w.x, w.z, 0.5)) continue;
        const bed = new THREE.Mesh(
          new THREE.BoxGeometry(1, 0.35, 1),
          new THREE.MeshStandardMaterial({
            color: bedColours[k % bedColours.length],
            roughness: 0.9,
          }),
        );
        bed.rotation.y = rot;
        group.add(onGround(bed, w.x, w.z, height, 0.3));
      }
    }

    // Paved path from the gate to the building.
    if (yard.front > 0.5) {
      const pathMat = new THREE.MeshStandardMaterial({ color: 0xcbbfa6, roughness: 0.95 });
      const steps = Math.max(1, Math.round(yard.front / 1.2));
      for (let k = 0; k < steps; k++) {
        const v = -plot.depthM / 2 + ((k + 0.5) * yard.front) / steps;
        const w = toWorld(pp, yard.u * ((k + 0.5) / steps), v);
        const slab = new THREE.Mesh(
          new THREE.BoxGeometry(1.8, 0.1, yard.front / steps + 0.02),
          pathMat,
        );
        slab.rotation.y = rot;
        slab.receiveShadow = true;
        group.add(onGround(slab, w.x, w.z, height, 0.17));
      }
    }
  }

  if (lay.fountain) {
    {
      const w = toWorld(pp, lay.fountain.u, lay.fountain.v);
      const r = lay.fountain.radiusM;
      const fountain = new THREE.Group();
      fountain.name = "fountain";
      const stone = new THREE.MeshStandardMaterial({ color: 0xd9d2c3, roughness: 0.8 });
      const water = new THREE.MeshStandardMaterial({
        color: 0x4f9cc3,
        roughness: 0.05,
        metalness: 0.1,
        emissive: 0x0c2a3a,
      });
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 8, 40), stone);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.45;
      fountain.add(rim);
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.45, 40), stone);
      basin.position.y = 0.22;
      fountain.add(basin);
      const pool = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.1, r - 0.1, 0.05, 40), water);
      pool.position.y = 0.43;
      fountain.add(pool);
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.1, 16), stone);
      column.position.y = 0.95;
      fountain.add(column);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.3, 0.22, 24), stone);
      bowl.position.y = 1.55;
      fountain.add(bowl);
      const bowlWater = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.03, 24), water);
      bowlWater.position.y = 1.66;
      fountain.add(bowlWater);
      const spray = new THREE.Mesh(
        new THREE.ConeGeometry(0.45, 1.0, 20, 1, true),
        new THREE.MeshStandardMaterial({
          color: 0xdff1fa,
          transparent: true,
          opacity: 0.45,
          side: THREE.DoubleSide,
          roughness: 0.1,
        }),
      );
      spray.rotation.x = Math.PI;
      spray.position.y = 2.05;
      fountain.add(spray);
      fountain.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
      });
      group.add(onGround(fountain, w.x, w.z, height, 0.1));
    }
  }

  if (lay.court) {
    {
      const size = lay.court.sizeM;
      const w = toWorld(pp, lay.court.u, lay.court.v);
      const court = new THREE.Group();
      court.name = "garden-court";
      const pave = new THREE.Mesh(
        new THREE.BoxGeometry(size, 0.12, size),
        new THREE.MeshStandardMaterial({ color: 0xd8cdb6, roughness: 0.95 }),
      );
      pave.receiveShadow = true;
      court.add(pave);
      const planter = new THREE.MeshStandardMaterial({ color: 0x8f8476, roughness: 0.9 });
      const green = new THREE.MeshStandardMaterial({ color: 0x3f7a35, roughness: 1 });
      for (const [px, pz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.9), planter);
        box.position.set((px * size) / 2 - px * 0.6, 0.33, (pz * size) / 2 - pz * 0.6);
        box.castShadow = true;
        court.add(box);
        const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), green);
        shrub.position.set(box.position.x, 0.9, box.position.z);
        court.add(shrub);
      }
      const bench = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.45, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.8 }),
      );
      bench.position.set(0, 0.28, size / 2 - 1.2);
      court.add(bench);
      court.add(tree(0, 0.06, -0.4, Math.min(5, size * 0.7)));
      court.rotation.y = rot;
      group.add(onGround(court, w.x, w.z, height, 0.08));
    }
  }
  return group;
}
