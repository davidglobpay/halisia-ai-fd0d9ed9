/**
 * House-on-plot viewer: satellite imagery as the ground, the plot outline the
 * user chose, and schematic house massing to scale, which can be dragged and
 * rotated. Reads Model Lab's schematic house builder; never modifies it.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildHouse } from "@/components/halisia/model-lab/site/house-geometry";
import {
  houseFootprint,
  imageryTiles,
  isContainer,
  metresPerPixel,
  type Placement,
} from "@/lib/plot-placement";

export type PlotViewerProps = {
  lat: number;
  lng: number;
  typology: string;
  structure: string;
  plot: { widthM: number; depthM: number };
  house: Placement;
  plotPlacement: Placement;
  /** Which object a drag moves. */
  target: "house" | "plot";
  onHouseChange: (p: Placement) => void;
  onPlotChange: (p: Placement) => void;
};

const ZOOM = 19;
const WALL_TINT: Record<string, number> = {
  masonry_block: 0xbdbcb6,
  precast: 0xd9d8d2,
  eps: 0xf3f1ea,
};
const STONE_COLOR = 0xcdbf9f;

function disposeTree(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    for (const x of Array.isArray(mat) ? mat : mat ? [mat] : []) {
      (x as THREE.MeshStandardMaterial).map?.dispose();
      x.dispose();
    }
  });
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Stitch the imagery block into one canvas; null when nothing loaded. */
async function imageryCanvas(lat: number, lng: number) {
  const block = imageryTiles(lat, lng, ZOOM);
  if (!block) return null;
  const canvas = document.createElement("canvas");
  canvas.width = block.sizePx;
  canvas.height = block.sizePx;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#8a9a6a";
  ctx.fillRect(0, 0, block.sizePx, block.sizePx);
  const imgs = await Promise.all(block.tiles.map((t) => loadImage(t.src)));
  let loaded = 0;
  imgs.forEach((img, i) => {
    if (!img) return;
    loaded++;
    ctx.drawImage(img, block.tiles[i].px, block.tiles[i].py, 256, 256);
  });
  return loaded ? { canvas, block, loaded, total: block.tiles.length } : null;
}

function buildHouseGroup(typology: string, structure: string): THREE.Group {
  const fp = houseFootprint(typology, structure);
  const group = new THREE.Group();
  if (isContainer(structure)) {
    for (const u of fp.units ?? [{ x: 0, z: 0 }]) {
      const unit = buildHouse(structure, null).group;
      unit.position.set(u.x, 0, u.z);
      group.add(unit);
    }
  } else {
    const h = buildHouse("masonry_stone", fp.floorAreaM2).group;
    const tint = WALL_TINT[structure];
    if (tint != null) {
      h.traverse((c) => {
        const m = c as THREE.Mesh;
        const mat = m.material as THREE.MeshStandardMaterial | undefined;
        if (mat?.color && mat.color.getHex() === STONE_COLOR) {
          const clone = mat.clone();
          clone.color.setHex(tint);
          m.material = clone;
        }
      });
    }
    group.add(h);
  }
  group.name = "plot-house";
  return group;
}

function buildPlotGroup(widthM: number, depthM: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "plot-outline";
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(widthM, depthM),
    new THREE.MeshBasicMaterial({
      color: 0xf5c542,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    }),
  );
  fill.rotation.x = -Math.PI / 2;
  fill.position.y = 0.03;
  fill.name = "plot-fill";
  group.add(fill);
  const pts = [
    [-widthM / 2, -depthM / 2],
    [widthM / 2, -depthM / 2],
    [widthM / 2, depthM / 2],
    [-widthM / 2, depthM / 2],
  ].map(([x, z]) => new THREE.Vector3(x, 0.06, z));
  const line = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0xf5c542 }),
  );
  group.add(line);
  // Front (road-side) edge drawn thicker so its distance reading has a place.
  const front = new THREE.Mesh(
    new THREE.BoxGeometry(widthM, 0.05, 0.25),
    new THREE.MeshBasicMaterial({ color: 0xff8a3d }),
  );
  front.position.set(0, 0.06, -depthM / 2);
  group.add(front);
  return group;
}

export default function PlotViewerInternal(props: PlotViewerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    house: THREE.Group | null;
    plot: THREE.Group | null;
    ground: THREE.Mesh | null;
  } | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [imagery, setImagery] = useState<"loading" | "ok" | "partial" | "failed">("loading");

  // Scene setup, once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.setAttribute("data-testid", "plot-viewer-canvas");

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdfe9f2);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 4000);
    camera.position.set(28, 34, 42);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 8;
    controls.maxDistance = 400;
    controls.enableDamping = true;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x6b6b5a, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-40, 80, -30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -60;
    sc.right = 60;
    sc.top = 60;
    sc.bottom = -60;
    scene.add(sun);

    stateRef.current = {
      renderer,
      scene,
      camera,
      controls,
      house: null,
      plot: null,
      ground: null,
    };

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // Dragging the selected object across the ground plane.
    const raycaster = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ndc = new THREE.Vector2();
    let drag: { id: number; offset: THREE.Vector3 } | null = null;
    const pointAt = (ev: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(
        ((ev.clientX - r.left) / r.width) * 2 - 1,
        -((ev.clientY - r.top) / r.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
    };
    const onDown = (ev: PointerEvent) => {
      const st = stateRef.current;
      if (!st) return;
      const obj = propsRef.current.target === "house" ? st.house : st.plot;
      if (!obj) return;
      pointAt(ev);
      if (!raycaster.intersectObject(obj, true).length) return;
      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(groundPlane, hit)) return;
      drag = { id: ev.pointerId, offset: obj.position.clone().sub(hit) };
      controls.enabled = false;
      renderer.domElement.setPointerCapture(ev.pointerId);
    };
    const onMove = (ev: PointerEvent) => {
      if (!drag || drag.id !== ev.pointerId) return;
      pointAt(ev);
      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(groundPlane, hit)) return;
      const p = hit.add(drag.offset);
      const cur = propsRef.current;
      const next = {
        x: Math.round(p.x * 10) / 10,
        z: Math.round(p.z * 10) / 10,
        rotationDeg: cur.target === "house" ? cur.house.rotationDeg : cur.plotPlacement.rotationDeg,
      };
      if (cur.target === "house") cur.onHouseChange(next);
      else cur.onPlotChange(next);
    };
    const onUp = (ev: PointerEvent) => {
      if (!drag || drag.id !== ev.pointerId) return;
      drag = null;
      controls.enabled = true;
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointercancel", onUp);

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointercancel", onUp);
      controls.dispose();
      scene.traverse((o) => {
        if (o !== scene) disposeTree(o);
      });
      renderer.dispose();
      renderer.domElement.remove();
      stateRef.current = null;
    };
  }, []);

  // Satellite ground for the point.
  useEffect(() => {
    let cancelled = false;
    setImagery("loading");
    (async () => {
      const st = stateRef.current;
      if (!st) return;
      if (st.ground) {
        st.scene.remove(st.ground);
        disposeTree(st.ground);
        st.ground = null;
      }
      const img = await imageryCanvas(props.lat, props.lng);
      if (cancelled || !stateRef.current) return;
      const mpp = metresPerPixel(props.lat, ZOOM);
      const sizePx = img?.block.sizePx ?? 1280;
      const sizeM = sizePx * mpp;
      const material = img
        ? new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(img.canvas), roughness: 1 })
        : new THREE.MeshStandardMaterial({ color: 0x8a9a6a, roughness: 1 });
      if (img) {
        const tex = material.map as THREE.CanvasTexture;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = st.renderer.capabilities.getMaxAnisotropy();
      }
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(sizeM, sizeM), material);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      // Put the chosen point at the scene origin: x = east, z = south.
      const point = img?.block.pointPx ?? { x: sizePx / 2, y: sizePx / 2 };
      ground.position.set((sizePx / 2 - point.x) * mpp, 0, (sizePx / 2 - point.y) * mpp);
      ground.name = "satellite-ground";
      st.scene.add(ground);
      st.ground = ground;
      setImagery(!img ? "failed" : img.loaded < img.total ? "partial" : "ok");
    })();
    return () => {
      cancelled = true;
    };
  }, [props.lat, props.lng]);

  // House massing for the chosen typology and system.
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    if (st.house) {
      st.scene.remove(st.house);
      disposeTree(st.house);
    }
    st.house = buildHouseGroup(props.typology, props.structure);
    st.scene.add(st.house);
  }, [props.typology, props.structure]);

  // Plot outline for the chosen size.
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    if (st.plot) {
      st.scene.remove(st.plot);
      disposeTree(st.plot);
    }
    st.plot = buildPlotGroup(props.plot.widthM, props.plot.depthM);
    st.scene.add(st.plot);
  }, [props.plot.widthM, props.plot.depthM]);

  // Apply placements every render.
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    if (st.house) {
      st.house.position.set(props.house.x, 0, props.house.z);
      st.house.rotation.y = (-props.house.rotationDeg * Math.PI) / 180;
    }
    if (st.plot) {
      st.plot.position.set(props.plotPlacement.x, 0, props.plotPlacement.z);
      st.plot.rotation.y = (-props.plotPlacement.rotationDeg * Math.PI) / 180;
    }
  });

  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} className="h-full w-full" />
      {imagery !== "ok" && (
        <p
          role="status"
          className="pointer-events-none absolute left-2 right-2 top-2 rounded-lg bg-background/85 px-3 py-2 text-xs"
        >
          {imagery === "loading"
            ? "Loading satellite imagery…"
            : imagery === "partial"
              ? "Some imagery tiles did not load; gaps show as plain ground."
              : "Satellite imagery could not be loaded; the house and plot are shown on plain ground."}
        </p>
      )}
    </div>
  );
}
