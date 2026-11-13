/**
 * House-on-plot viewer: satellite imagery draped over the real terrain grid,
 * neighbouring OpenStreetMap buildings, the plot outline the user chose, and
 * schematic house massing to scale, which can be dragged and rotated. Reads
 * Model Lab's schematic house builder; never modifies it.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  buildFoundation,
  buildSiteHouse,
  scaleFigure,
  type SiteHouse,
} from "@/components/halisia/model-lab/site/site-house";
import { planFoundation } from "@/components/halisia/model-lab/site/foundation";
import { upgradeFurniture } from "@/components/halisia/model-lab/site/real-furniture";
import { DEFAULT_STYLE, type DesignStyle } from "@/components/halisia/model-lab/site/design-style";
import { imageryTiles, isContainer, metresPerPixel, type Placement } from "@/lib/plot-placement";
import { loadTileImage } from "@/lib/esri-tiles";
import { hasMapDetail } from "@/lib/map-image-quality";
import { heightAt, type TerrainGrid } from "@/lib/site-context";
import { NO_FEATURES, type BuildingPlan, type SiteFeatures } from "@/lib/building-types";
import { buildBuildingMassing } from "./building-massing";
import { buildSiteFeatures } from "./site-features";

export type GroundMode = "terrain" | "flat" | "plain";

export type LocalBuilding = {
  id: number;
  ring: Array<{ x: number; z: number }>;
  heightM: number;
  defaulted: boolean;
};

export type PlotViewerApi = {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  topView: () => void;
};

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
  ground?: GroundMode;
  terrain?: TerrainGrid | null;
  buildings?: LocalBuilding[];
  showBuildings?: boolean;
  showPlot?: boolean;
  onApi?: (api: PlotViewerApi) => void;
  /** The client's design language from the inspiration panel; HALISIA's default when null. */
  designStyle?: DesignStyle | null;
  /** A larger building (apartments, offices, mixed-use) instead of a house. */
  building?: BuildingPlan | null;
  /** Garden features drawn on the plot. */
  features?: SiteFeatures;
  /** Lay a courtyard in the garden (it does not fit inside the building). */
  gardenCourt?: boolean;
};

/** Imagery zoom levels to try, sharpest first. */
const IMAGERY_ZOOMS = [19, 18, 17] as const;
/** Wall colour for the systems that share the masonry shape, unless the client chose one. */
const WALL_TINT: Record<string, string> = {
  masonry_block: "#bdbcb6",
  precast: "#d9d8d2",
  eps: "#f3f1ea",
};
const DEFAULT_CAMERA = new THREE.Vector3(28, 34, 42);
const PLOT_LIFT_M = 0.08;

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

type Imagery = {
  canvas: HTMLCanvasElement | null;
  sizeM: number;
  /** World position of the image centre (the point is the origin). */
  centre: { x: number; z: number };
  loaded: number;
  total: number;
};

/**
 * Satellite imagery under the plot. Sharpest zoom first; where Esri has no
 * imagery that sharp (common outside big towns) it steps down a level, and
 * each tile falls back from the keyed to the public host, so a key problem or
 * a missing zoom level no longer leaves the plot on plain ground.
 */
async function loadImagery(lat: number, lng: number): Promise<Imagery> {
  let last: Imagery | null = null;
  for (const zoom of IMAGERY_ZOOMS) {
    const got = await loadImageryAt(lat, lng, zoom);
    last = got;
    if (got.canvas && got.loaded >= got.total * 0.6 && imageHasDetail(got.canvas)) return got;
  }
  return last ?? (await loadImageryAt(lat, lng, IMAGERY_ZOOMS[0]));
}

/** False for a blank or single-colour "no imagery here" placeholder mosaic. */
function imageHasDetail(canvas: HTMLCanvasElement): boolean {
  try {
    const probe = document.createElement("canvas");
    probe.width = 64;
    probe.height = 64;
    const ctx = probe.getContext("2d");
    if (!ctx) return true;
    ctx.drawImage(canvas, 0, 0, 64, 64);
    return hasMapDetail(ctx.getImageData(0, 0, 64, 64).data);
  } catch {
    return true;
  }
}

async function loadImageryAt(lat: number, lng: number, zoom: number): Promise<Imagery> {
  const mpp = metresPerPixel(lat, zoom);
  const block = imageryTiles(lat, lng, zoom);
  const sizePx = block?.sizePx ?? 1280;
  const point = block?.pointPx ?? { x: sizePx / 2, y: sizePx / 2 };
  const base = {
    sizeM: sizePx * mpp,
    centre: { x: (sizePx / 2 - point.x) * mpp, z: (sizePx / 2 - point.y) * mpp },
  };
  if (!block) return { ...base, canvas: null, loaded: 0, total: 0 };
  const canvas = document.createElement("canvas");
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ...base, canvas: null, loaded: 0, total: block.tiles.length };
  ctx.fillStyle = "#8a9a6a";
  ctx.fillRect(0, 0, sizePx, sizePx);
  const imgs = await Promise.all(block.tiles.map((t) => loadTileImage(t.src)));
  let loaded = 0;
  imgs.forEach((img, i) => {
    if (!img) return;
    loaded++;
    ctx.drawImage(img, block.tiles[i].px, block.tiles[i].py, 256, 256);
  });
  return { ...base, canvas: loaded ? canvas : null, loaded, total: block.tiles.length };
}

/**
 * The furnished house for the chosen type and system, in the client's style.
 * Systems without their own model (block, precast, EPS) use the masonry
 * shape in their usual wall colour. The house's floor sits at y = 0.
 */
function buildHouseGroup(
  typology: string,
  structure: string,
  style: DesignStyle | null | undefined,
): { group: THREE.Group; house: SiteHouse } {
  const tint = WALL_TINT[structure];
  const effective: DesignStyle | null =
    style && style.source !== "default"
      ? style
      : tint
        ? { ...DEFAULT_STYLE, wallColor: tint, source: "manual" }
        : null;
  const house = buildSiteHouse({
    structure: isContainer(structure) ? structure : "masonry_stone",
    typology,
    floorAreaM2: null,
    style: effective,
  });
  const group = new THREE.Group();
  group.add(house.group);
  group.name = "plot-house";
  // Real sofa models replace the boxes in the background.
  void upgradeFurniture(house.group);
  return { group, house };
}

type HeightFn = (x: number, z: number) => number;

/**
 * A rectangle in the plot's frame, draped over the ground: `u` runs across
 * the plot width, `v` along its depth, both from −1/2 to +1/2 of the size.
 */
function drapedRect(
  sizeU: number,
  sizeV: number,
  segU: number,
  segV: number,
  place: Placement,
  height: HeightFn,
  vOffset = 0,
): THREE.BufferGeometry {
  const a = (-place.rotationDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const pos: number[] = [];
  for (let j = 0; j <= segV; j++) {
    for (let i = 0; i <= segU; i++) {
      const lx = -sizeU / 2 + (sizeU * i) / segU;
      const lz = vOffset - sizeV / 2 + (sizeV * j) / segV;
      const x = place.x + lx * c + lz * s;
      const z = place.z - lx * s + lz * c;
      pos.push(x, height(x, z) + PLOT_LIFT_M, z);
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const p = j * (segU + 1) + i;
      idx.push(p, p + segU + 1, p + 1, p + 1, p + segU + 1, p + segU + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function buildPlotGroup(
  widthM: number,
  depthM: number,
  place: Placement,
  height: HeightFn,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "plot-outline";
  const fill = new THREE.Mesh(
    drapedRect(widthM, depthM, 12, 16, place, height),
    new THREE.MeshBasicMaterial({
      color: 0xf5c542,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  fill.name = "plot-fill";
  group.add(fill);
  // Outline: each edge subdivided so it follows the ground.
  const a = (-place.rotationDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const corners = [
    [-widthM / 2, -depthM / 2],
    [widthM / 2, -depthM / 2],
    [widthM / 2, depthM / 2],
    [-widthM / 2, depthM / 2],
  ];
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k < 4; k++) {
    const [ax, az] = corners[k];
    const [bx, bz] = corners[(k + 1) % 4];
    for (let t = 0; t < 16; t++) {
      const lx = ax + ((bx - ax) * t) / 16;
      const lz = az + ((bz - az) * t) / 16;
      const x = place.x + lx * c + lz * s;
      const z = place.z - lx * s + lz * c;
      pts.push(new THREE.Vector3(x, height(x, z) + PLOT_LIFT_M + 0.04, z));
    }
  }
  group.add(
    new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xf5c542 }),
    ),
  );
  // Front (road-side) edge: a draped orange strip.
  group.add(
    new THREE.Mesh(
      drapedRect(widthM, 0.35, 12, 1, place, height, -depthM / 2 + 0.175),
      new THREE.MeshBasicMaterial({ color: 0xff8a3d, side: THREE.DoubleSide }),
    ),
  );
  return group;
}

function buildNeighbours(buildings: LocalBuilding[], height: HeightFn): THREE.Group {
  const group = new THREE.Group();
  group.name = "neighbour-buildings";
  const recorded = new THREE.MeshStandardMaterial({ color: 0xe9e3d5, roughness: 0.9 });
  const defaulted = new THREE.MeshStandardMaterial({ color: 0xd3ccbc, roughness: 0.9 });
  for (const b of buildings) {
    const shape = new THREE.Shape(b.ring.map((p) => new THREE.Vector2(p.x, -p.z)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: b.heightM, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    // Sit on the lowest ground under the footprint, sunk a little so slopes
    // never leave a gap under the walls.
    const base = Math.min(...b.ring.map((p) => height(p.x, p.z))) - 0.3;
    const mesh = new THREE.Mesh(geo, b.defaulted ? defaulted : recorded);
    mesh.position.y = base;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

export default function PlotViewerInternal(props: PlotViewerProps) {
  const ground = props.ground ?? "terrain";
  const showBuildings = props.showBuildings ?? true;
  const showPlot = props.showPlot ?? true;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    house: THREE.Group | null;
    built: SiteHouse | null;
    footing: THREE.Object3D | null;
    footingKey: string;
    /** Footprint of the larger building, when one is shown instead of a house. */
    massing: { lengthM: number; widthM: number; heightM: number } | null;
    features: THREE.Group | null;
    person: THREE.Group;
    plot: THREE.Group | null;
    ground: THREE.Mesh | null;
    neighbours: THREE.Group | null;
  } | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [imagery, setImagery] = useState<Imagery | null>(null);
  const [imageryState, setImageryState] = useState<"loading" | "ok" | "partial" | "failed">(
    "loading",
  );

  const terrainOn = ground === "terrain" && !!props.terrain;
  const heightRef = useRef<HeightFn>(() => 0);
  heightRef.current = terrainOn ? (x, z) => heightAt(props.terrain ?? null, x, z) : () => 0;

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
    scene.fog = new THREE.Fog(0xdfe9f2, 260, 700);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 4000);
    camera.position.copy(DEFAULT_CAMERA);
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
    sc.left = -80;
    sc.right = 80;
    sc.top = 80;
    sc.bottom = -80;
    scene.add(sun);

    const person = scaleFigure();
    scene.add(person);
    stateRef.current = {
      renderer,
      scene,
      camera,
      controls,
      house: null,
      built: null,
      footing: null,
      footingKey: "",
      massing: null,
      features: null,
      person,
      plot: null,
      ground: null,
      neighbours: null,
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
    window.addEventListener("resize", resize);

    // Camera commands for the floating controls.
    const focus = () => {
      const p = propsRef.current.plotPlacement;
      return new THREE.Vector3(p.x, heightRef.current(p.x, p.z), p.z);
    };
    const dolly = (k: number) => {
      const dir = camera.position.clone().sub(controls.target).multiplyScalar(k);
      const len = THREE.MathUtils.clamp(dir.length(), controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).add(dir.setLength(len));
    };
    propsRef.current.onApi?.({
      zoomIn: () => dolly(0.7),
      zoomOut: () => dolly(1.4),
      resetView: () => {
        const t = focus();
        // Pull back for a tall building so the whole of it is in view.
        const h = stateRef.current?.massing?.heightM ?? 0;
        controls.target.copy(t).add(new THREE.Vector3(0, h * 0.35, 0));
        camera.position
          .copy(t)
          .add(DEFAULT_CAMERA.clone().multiplyScalar(Math.max(1, (h + 20) / 40)));
      },
      topView: () => {
        const t = focus();
        const d = Math.max(60, camera.position.distanceTo(controls.target));
        controls.target.copy(t);
        camera.position.set(t.x, t.y + d, t.z + 0.01);
      },
    });

    // Dragging the selected object across the ground.
    const raycaster = new THREE.Raycaster();
    const flat = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ndc = new THREE.Vector2();
    let drag: { id: number; offset: THREE.Vector3 } | null = null;
    const aim = (ev: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(
        ((ev.clientX - r.left) / r.width) * 2 - 1,
        -((ev.clientY - r.top) / r.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
    };
    const groundHit = (): THREE.Vector3 | null => {
      const st = stateRef.current;
      if (st?.ground) {
        const hit = raycaster.intersectObject(st.ground, false)[0];
        if (hit) return hit.point.clone();
      }
      const p = new THREE.Vector3();
      return raycaster.ray.intersectPlane(flat, p) ? p : null;
    };
    const onDown = (ev: PointerEvent) => {
      const st = stateRef.current;
      if (!st) return;
      const obj = propsRef.current.target === "house" ? st.house : st.plot;
      if (!obj || !obj.visible) return;
      aim(ev);
      if (!raycaster.intersectObject(obj, true).length) return;
      const hit = groundHit();
      if (!hit) return;
      const cur =
        propsRef.current.target === "house"
          ? propsRef.current.house
          : propsRef.current.plotPlacement;
      drag = { id: ev.pointerId, offset: new THREE.Vector3(cur.x - hit.x, 0, cur.z - hit.z) };
      controls.enabled = false;
      renderer.domElement.setPointerCapture(ev.pointerId);
    };
    const onMove = (ev: PointerEvent) => {
      if (!drag || drag.id !== ev.pointerId) return;
      aim(ev);
      const hit = groundHit();
      if (!hit) return;
      const cur = propsRef.current;
      const next = {
        x: Math.round((hit.x + drag.offset.x) * 10) / 10,
        z: Math.round((hit.z + drag.offset.z) * 10) / 10,
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
      window.removeEventListener("resize", resize);
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

  // Satellite imagery for the point, fetched once per location.
  useEffect(() => {
    let cancelled = false;
    setImageryState("loading");
    setImagery(null);
    void loadImagery(props.lat, props.lng).then((img) => {
      if (cancelled) return;
      setImagery(img);
      setImageryState(!img.canvas ? "failed" : img.loaded < img.total ? "partial" : "ok");
    });
    return () => {
      cancelled = true;
    };
  }, [props.lat, props.lng]);

  // Ground mesh: imagery or plain, draped on terrain or flat.
  useEffect(() => {
    const st = stateRef.current;
    if (!st || !imagery) return;
    if (st.ground) {
      st.scene.remove(st.ground);
      disposeTree(st.ground);
      st.ground = null;
    }
    const seg = terrainOn ? 64 : 1;
    const geo = new THREE.PlaneGeometry(imagery.sizeM, imagery.sizeM, seg, seg);
    geo.rotateX(-Math.PI / 2);
    if (terrainOn) {
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + imagery.centre.x;
        const z = pos.getZ(i) + imagery.centre.z;
        pos.setY(i, heightAt(props.terrain ?? null, x, z));
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    }
    const useImagery = ground !== "plain" && imagery.canvas;
    const material = useImagery
      ? new THREE.MeshStandardMaterial({
          map: new THREE.CanvasTexture(imagery.canvas as HTMLCanvasElement),
          roughness: 1,
        })
      : new THREE.MeshStandardMaterial({ color: 0xc9c2a8, roughness: 1 });
    if (useImagery) {
      const tex = material.map as THREE.CanvasTexture;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = st.renderer.capabilities.getMaxAnisotropy();
    }
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(imagery.centre.x, 0, imagery.centre.z);
    mesh.receiveShadow = true;
    mesh.name = "satellite-ground";
    st.scene.add(mesh);
    st.ground = mesh;
  }, [imagery, ground, terrainOn, props.terrain]);

  // House massing for the chosen typology and system.
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    if (st.house) {
      st.scene.remove(st.house);
      disposeTree(st.house);
    }
    st.footing = null;
    st.footingKey = "";
    if (props.building) {
      const m = buildBuildingMassing(props.building, props.designStyle);
      const group = new THREE.Group();
      group.name = "plot-house";
      group.add(m.group);
      st.house = group;
      st.built = null;
      st.massing = { lengthM: m.lengthM, widthM: m.widthM, heightM: m.heightM };
      // First time a tall building appears, step back so it is all in view.
      const cam = st.camera.position.distanceTo(st.controls.target);
      if (cam < m.heightM * 1.6) {
        const dir = st.camera.position
          .clone()
          .sub(st.controls.target)
          .setLength(m.heightM * 1.9 + 30);
        st.controls.target.y += m.heightM * 0.3;
        st.camera.position.copy(st.controls.target).add(dir);
      }
    } else {
      const { group, house } = buildHouseGroup(props.typology, props.structure, props.designStyle);
      st.house = group;
      st.built = house;
      st.massing = null;
    }
    st.scene.add(st.house);
  }, [props.typology, props.structure, props.designStyle, props.building]);

  // Garden, fountain and courtyard on the plot.
  const feats = props.features ?? NO_FEATURES;
  const featKey = `${feats.gardens}|${feats.fountain}|${!!props.gardenCourt}`;
  const { x: hX, z: hZ, rotationDeg: hRot } = props.house;
  const { x: pX, z: pZ, rotationDeg: pRot } = props.plotPlacement;
  const fpL = props.building?.lengthM ?? stateRef.current?.built?.lengthM ?? 0;
  const fpW = props.building?.widthM ?? stateRef.current?.built?.widthM ?? 0;
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    if (st.features) {
      st.scene.remove(st.features);
      disposeTree(st.features);
      st.features = null;
    }
    const f = propsRef.current.features ?? NO_FEATURES;
    if (!f.gardens && !f.fountain && !propsRef.current.gardenCourt) return;
    const lengthM = st.massing?.lengthM ?? st.built?.lengthM ?? 0;
    const widthM = st.massing?.widthM ?? st.built?.widthM ?? 0;
    st.features = buildSiteFeatures({
      plot: propsRef.current.plot,
      plotPlacement: { x: pX, z: pZ, rotationDeg: pRot },
      house: { x: hX, z: hZ, rotationDeg: hRot },
      footprint: { lengthM, widthM },
      features: f,
      gardenCourt: !!propsRef.current.gardenCourt,
      height: heightRef.current,
    });
    st.scene.add(st.features);
  }, [
    featKey,
    hX,
    hZ,
    hRot,
    pX,
    pZ,
    pRot,
    fpL,
    fpW,
    props.plot.widthM,
    props.plot.depthM,
    terrainOn,
    props.terrain,
    props.building,
    props.typology,
    props.structure,
  ]);

  // Plot outline, rebuilt when its size, place or the ground changes.
  const { x: ppX, z: ppZ, rotationDeg: ppRot } = props.plotPlacement;
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    if (st.plot) {
      st.scene.remove(st.plot);
      disposeTree(st.plot);
    }
    st.plot = buildPlotGroup(
      props.plot.widthM,
      props.plot.depthM,
      { x: ppX, z: ppZ, rotationDeg: ppRot },
      heightRef.current,
    );
    st.plot.visible = showPlot;
    st.scene.add(st.plot);
  }, [props.plot.widthM, props.plot.depthM, ppX, ppZ, ppRot, terrainOn, props.terrain, showPlot]);

  // Neighbouring buildings.
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    if (st.neighbours) {
      st.scene.remove(st.neighbours);
      disposeTree(st.neighbours);
      st.neighbours = null;
    }
    if (!showBuildings || !props.buildings?.length) return;
    st.neighbours = buildNeighbours(props.buildings, heightRef.current);
    st.scene.add(st.neighbours);
  }, [props.buildings, showBuildings, terrainOn, props.terrain]);

  // House placement on the ground, every render: the floor sits just above
  // the highest ground under the footprint, and footings reach down below
  // the lowest, so the house never floats or sinks.
  useEffect(() => {
    const st = stateRef.current;
    if (!st?.house) return;
    const a = (-props.house.rotationDeg * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    if (st.massing) {
      // A larger building: ground floor just above the highest ground under
      // it, on a concrete podium that reaches below the lowest.
      const m = st.massing;
      const hs: number[] = [];
      for (const lx of [-m.lengthM / 2, 0, m.lengthM / 2])
        for (const lz of [-m.widthM / 2, 0, m.widthM / 2])
          hs.push(
            heightRef.current(props.house.x + lx * c + lz * s, props.house.z - lx * s + lz * c),
          );
      const hi = Math.max(...hs);
      const lo = Math.min(...hs);
      const floorY = hi + 0.15;
      const depth = Math.round((floorY - lo + 0.6) * 20) / 20;
      const key = `podium|${depth}|${m.lengthM}|${m.widthM}`;
      if (key !== st.footingKey) {
        if (st.footing) {
          st.house.remove(st.footing);
          disposeTree(st.footing);
        }
        const podium = new THREE.Mesh(
          new THREE.BoxGeometry(m.lengthM + 0.4, depth, m.widthM + 0.4),
          new THREE.MeshStandardMaterial({ color: 0xa9a49a, roughness: 0.95 }),
        );
        podium.position.y = -depth / 2;
        podium.receiveShadow = true;
        st.footing = podium;
        st.house.add(podium);
        st.footingKey = key;
      }
      st.house.position.set(props.house.x, floorY, props.house.z);
      st.house.rotation.y = a;
      const px = props.house.x + (m.lengthM / 2 + 1.2) * c + (-m.widthM / 2 - 2.5) * s;
      const pz = props.house.z - (m.lengthM / 2 + 1.2) * s + (-m.widthM / 2 - 2.5) * c;
      st.person.position.set(px, heightRef.current(px, pz), pz);
      return;
    }
    if (!st.built) return;
    const b = st.built;
    const samples: number[] = [];
    for (const r of b.groundRects)
      for (const lx of [r.x0, (r.x0 + r.x1) / 2, r.x1])
        for (const lz of [r.z0, (r.z0 + r.z1) / 2, r.z1])
          samples.push(
            heightRef.current(props.house.x + lx * c + lz * s, props.house.z - lx * s + lz * c),
          );
    const hi = Math.max(...samples);
    const lo = Math.min(...samples);
    const plan = planFoundation({
      structure: isContainer(props.structure) ? props.structure : "masonry_stone",
      dropM: terrainOn ? hi - lo : null,
    });
    const floorY = hi + plan.clearanceM;
    const depth = Math.round((floorY - lo + 0.4) * 20) / 20;
    const key = `${plan.kind}|${depth}`;
    if (key !== st.footingKey) {
      if (st.footing) {
        st.house.remove(st.footing);
        disposeTree(st.footing);
      }
      st.footing = buildFoundation(b, plan, depth);
      st.house.add(st.footing);
      st.footingKey = key;
    }
    st.house.position.set(props.house.x, floorY, props.house.z);
    st.house.rotation.y = a;
    // A person beside the front corner, for scale.
    const px = props.house.x + (b.lengthM / 2 + 1.2) * c + (b.widthM / 2 + 1.6) * s;
    const pz = props.house.z - (b.lengthM / 2 + 1.2) * s + (b.widthM / 2 + 1.6) * c;
    st.person.position.set(px, heightRef.current(px, pz), pz);
  });

  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} className="h-full w-full" />
      {imageryState !== "ok" && ground !== "plain" && (
        <p
          role="status"
          className="pointer-events-none absolute bottom-2 left-2 right-16 rounded-lg bg-card/90 px-3 py-2 text-xs text-card-foreground"
        >
          {imageryState === "loading"
            ? "Loading satellite imagery…"
            : imageryState === "partial"
              ? "Some imagery tiles did not load; gaps show as plain ground."
              : "Satellite imagery could not be loaded; the house and plot are shown on plain ground."}
        </p>
      )}
    </div>
  );
}
