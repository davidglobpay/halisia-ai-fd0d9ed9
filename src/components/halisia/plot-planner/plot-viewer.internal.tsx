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
import { describeMeasurement, footprintDims, measureBetween } from "@/lib/measure-3d";
import {
  buildInfrastructure,
  buildNeighbours,
  type ContextStyle,
  type LocalBuilding,
  type LocalInfra,
} from "./context-layers";

export type GroundMode = "terrain" | "flat" | "plain";

export type { LocalBuilding, LocalInfra, ContextStyle } from "./context-layers";

export type PlotViewerApi = {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  topView: () => void;
  /** Stand at the road edge at eye height, looking at the house. */
  eyeLevel: () => void;
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
  /** Roads, railways and power lines around the plot. */
  infrastructure?: LocalInfra[];
  showInfrastructure?: boolean;
  /** "real": massing over the satellite photo; "model": the same look as the design. */
  contextStyle?: ContextStyle;
  /** Ground heights multiplied by this to show the slopes (buildings stay true). */
  reliefScale?: number;
  /** Tape-measure mode: taps pick points instead of moving the house. */
  measuring?: boolean;
};

/** What the info card shows after a tap. */
type Picked =
  | { kind: "text"; text: string }
  | { kind: "building"; b: LocalBuilding & { corrected?: boolean } };

/** A text label that always faces the camera, for the tape measure. */
function labelSprite(text: string): THREE.Sprite {
  const cv = document.createElement("canvas");
  const g = cv.getContext("2d");
  const font = "600 44px system-ui, sans-serif";
  let w = 400;
  if (g) {
    g.font = font;
    w = Math.ceil(g.measureText(text).width) + 48;
  }
  cv.width = w;
  cv.height = 80;
  const c = cv.getContext("2d");
  if (c) {
    c.fillStyle = "rgba(20,24,22,0.86)";
    c.beginPath();
    c.roundRect(0, 0, w, 80, 24);
    c.fill();
    c.font = font;
    c.fillStyle = "#ffffff";
    c.textBaseline = "middle";
    c.fillText(text, 24, 42);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }),
  );
  sprite.renderOrder = 10;
  sprite.userData.aspect = w / 80;
  return sprite;
}

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
    infra: THREE.Group | null;
    measure: THREE.Group | null;
  } | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [imagery, setImagery] = useState<Imagery | null>(null);
  const [imageryState, setImageryState] = useState<"loading" | "ok" | "partial" | "failed">(
    "loading",
  );
  const style: ContextStyle = props.contextStyle ?? "real";
  const showInfra = props.showInfrastructure ?? true;
  /** What a tap on a neighbouring building or road says. */
  const [picked, setPicked] = useState<Picked | null>(null);
  /** Heights the user corrected for neighbouring buildings (OpenStreetMap id → metres). */
  const [heightFix, setHeightFix] = useState<Record<number, number>>({});
  /** The last tape-measure reading, in words. */
  const [measureText, setMeasureText] = useState<string | null>(null);
  const measurePts = useRef<THREE.Vector3[]>([]);
  const clearMeasureRef = useRef<() => void>(() => {});

  const terrainOn = ground === "terrain" && !!props.terrain;
  const relief = terrainOn && !props.measuring ? Math.max(1, props.reliefScale ?? 1) : 1;
  const heightRef = useRef<HeightFn>(() => 0);
  {
    // Exaggerate around the ground at the plot, so the plot stays where it is.
    const base = terrainOn ? heightAt(props.terrain ?? null, 0, 0) : 0;
    heightRef.current = terrainOn
      ? relief === 1
        ? (x, z) => heightAt(props.terrain ?? null, x, z)
        : (x, z) => base + (heightAt(props.terrain ?? null, x, z) - base) * relief
      : () => 0;
  }

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
      infra: null,
      measure: null,
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
      eyeLevel: () => {
        const p = propsRef.current;
        const st = stateRef.current;
        // Stand 6 m outside the plot's road edge, on its centre line.
        const a = (-p.plotPlacement.rotationDeg * Math.PI) / 180;
        const v = -p.plot.depthM / 2 - 6;
        const x = p.plotPlacement.x + v * Math.sin(a);
        const z = p.plotPlacement.z + v * Math.cos(a);
        const eye = new THREE.Vector3(x, heightRef.current(x, z) + 1.7, z);
        const h = st?.massing?.heightM ?? 5;
        const target = new THREE.Vector3(
          p.house.x,
          heightRef.current(p.house.x, p.house.z) + Math.min(h * 0.4, 12),
          p.house.z,
        );
        controls.minDistance = 2;
        controls.target.copy(target);
        camera.position.copy(eye);
      },
      topView: () => {
        const t = focus();
        const d = Math.max(60, camera.position.distanceTo(controls.target));
        controls.target.copy(t);
        camera.position.set(t.x, t.y + d, t.z + 0.01);
      },
    });

    // Tape measure: two points, a line between them, guides showing the
    // ground distance and the rise, and a label at the middle.
    const drawMeasure = () => {
      const st = stateRef.current;
      if (!st) return;
      if (st.measure) {
        scene.remove(st.measure);
        disposeTree(st.measure);
        st.measure = null;
      }
      const pts = measurePts.current;
      if (!pts.length) return;
      const g = new THREE.Group();
      g.name = "tape-measure";
      const dot = new THREE.MeshBasicMaterial({ color: 0xffb020, depthTest: false });
      for (const p of pts) {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(Math.max(0.3, camera.position.distanceTo(p) * 0.008), 16, 12),
          dot,
        );
        m.position.copy(p);
        m.renderOrder = 9;
        g.add(m);
      }
      if (pts.length === 2) {
        const [a, b] = pts;
        const line = (from: THREE.Vector3, to: THREE.Vector3, color: number, dashed: boolean) => {
          const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
          const mat = dashed
            ? new THREE.LineDashedMaterial({ color, dashSize: 0.6, gapSize: 0.4, depthTest: false })
            : new THREE.LineBasicMaterial({ color, depthTest: false });
          const l = new THREE.Line(geo, mat);
          if (dashed) l.computeLineDistances();
          l.renderOrder = 9;
          g.add(l);
        };
        const corner = new THREE.Vector3(b.x, a.y, b.z);
        line(a, b, 0xffb020, false);
        line(a, corner, 0xffffff, true);
        line(corner, b, 0xffffff, true);
        const m = measureBetween(a, b);
        const label = labelSprite(`${m.directM.toFixed(2)} m`);
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const d = camera.position.distanceTo(mid);
        const h = Math.max(1.2, d * 0.045);
        label.scale.set(h * (label.userData.aspect as number), h, 1);
        label.position.copy(mid).add(new THREE.Vector3(0, h * 0.9, 0));
        g.add(label);
        setMeasureText(describeMeasurement(m));
      } else setMeasureText("Now tap the second point.");
      scene.add(g);
      st.measure = g;
    };
    const addMeasurePoint = (p: THREE.Vector3) => {
      measurePts.current = measurePts.current.length >= 2 ? [p] : [...measurePts.current, p];
      drawMeasure();
    };
    clearMeasureRef.current = () => {
      measurePts.current = [];
      drawMeasure();
      setMeasureText(null);
    };

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
    // In tape-measure mode a short tap (not a drag) picks a point.
    let tap: { id: number; x: number; y: number; t: number } | null = null;
    const pickPoint = (): THREE.Vector3 | null => {
      const st = stateRef.current;
      if (!st) return null;
      const targets: THREE.Object3D[] = [];
      for (const o of [st.house, st.neighbours, st.ground, st.features])
        if (o && o.visible) targets.push(o);
      const hit = raycaster.intersectObjects(targets, true)[0];
      return hit ? hit.point.clone() : groundHit();
    };
    const onDown = (ev: PointerEvent) => {
      const st = stateRef.current;
      if (!st) return;
      if (propsRef.current.measuring) {
        tap = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, t: performance.now() };
        return;
      }
      const obj = propsRef.current.target === "house" ? st.house : st.plot;
      aim(ev);
      if (!obj || !obj.visible || !raycaster.intersectObject(obj, true).length) {
        // Not grabbing the house or plot: a tap on a neighbour or a road says what it is.
        const hits = [
          ...(st.neighbours ? raycaster.intersectObject(st.neighbours, true) : []),
          ...(st.infra ? raycaster.intersectObject(st.infra, true) : []),
        ].sort((p, q) => p.distance - q.distance);
        const ud = hits[0]?.object.userData;
        if (ud?.building) {
          const id = (ud.building as LocalBuilding).id;
          const orig = propsRef.current.buildings?.find((x) => x.id === id);
          setPicked({ kind: "building", b: orig ?? (ud.building as LocalBuilding) });
        } else if (ud?.infra) {
          const l = ud.infra as LocalInfra;
          const what =
            l.kind === "rail"
              ? "Railway"
              : l.kind === "path"
                ? "Footpath"
                : l.kind === "track"
                  ? "Track"
                  : l.kind === "major"
                    ? "Main road"
                    : "Road";
          setPicked({
            kind: "text",
            text: `${what}${l.name ? `: ${l.name}` : ""}, from OpenStreetMap. Drawn about ${l.widthM.toFixed(1)} m wide, a typical width for its class, not a measurement.`,
          });
        }
        return;
      }
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
      if (tap && tap.id === ev.pointerId) {
        const moved = Math.hypot(ev.clientX - tap.x, ev.clientY - tap.y);
        const quick = performance.now() - tap.t < 500;
        tap = null;
        if (moved < 8 && quick && propsRef.current.measuring) {
          aim(ev);
          const p = pickPoint();
          if (p) addMeasurePoint(p);
        }
        return;
      }
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
        pos.setY(i, heightRef.current(x, z));
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    }
    const useImagery = ground !== "plain" && style !== "model" && imagery.canvas;
    const material = useImagery
      ? new THREE.MeshStandardMaterial({
          map: new THREE.CanvasTexture(imagery.canvas as HTMLCanvasElement),
          roughness: 1,
        })
      : new THREE.MeshStandardMaterial({
          color: style === "model" ? 0xd5dac6 : 0xc9c2a8,
          roughness: 1,
        });
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
  }, [imagery, ground, terrainOn, props.terrain, style, relief]);

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
    relief,
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
  }, [
    props.plot.widthM,
    props.plot.depthM,
    ppX,
    ppZ,
    ppRot,
    terrainOn,
    props.terrain,
    relief,
    showPlot,
  ]);

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
    const list = props.buildings.map((b) =>
      heightFix[b.id] !== undefined
        ? { ...b, heightM: heightFix[b.id], defaulted: false, corrected: true }
        : b,
    );
    st.neighbours = buildNeighbours(list, heightRef.current, style);
    st.scene.add(st.neighbours);
  }, [props.buildings, showBuildings, terrainOn, props.terrain, style, relief, heightFix]);

  // Roads, railways and power lines.
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    if (st.infra) {
      st.scene.remove(st.infra);
      disposeTree(st.infra);
      st.infra = null;
    }
    if (!showInfra || !props.infrastructure?.length) return;
    st.infra = buildInfrastructure(props.infrastructure, heightRef.current, style);
    st.scene.add(st.infra);
  }, [props.infrastructure, showInfra, terrainOn, props.terrain, style, relief]);

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

  // Leaving tape-measure mode clears the reading.
  useEffect(() => {
    if (!props.measuring) clearMeasureRef.current();
  }, [props.measuring]);

  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} className="h-full w-full" />
      {props.measuring && (
        <div
          role="status"
          data-testid="pp-measure"
          className="absolute bottom-2 left-2 right-16 z-10 flex items-center gap-2 rounded-xl bg-card/95 px-3 py-2 text-xs text-card-foreground shadow"
        >
          <span className="flex-1">
            {measureText ??
              "Tape measure: tap a point on the ground, a roof, a wall or the house, then tap a second point."}
          </span>
          {measureText && (
            <button
              type="button"
              onClick={() => clearMeasureRef.current()}
              className="min-h-8 rounded-full border border-border px-2"
            >
              Clear
            </button>
          )}
        </div>
      )}
      {relief > 1 && !props.measuring && (
        <p
          data-testid="pp-relief-note"
          className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-full bg-black/60 px-2 py-1 text-[11px] text-white"
        >
          Ground heights ×{relief} to show the slopes; buildings at true height.
        </p>
      )}
      {picked && (
        <div
          role="status"
          className="absolute left-14 right-16 top-2 z-10 flex items-start gap-2 rounded-xl bg-card/95 px-3 py-2 text-xs text-card-foreground shadow"
          data-testid="pp-picked"
        >
          {picked.kind === "text" ? (
            <span className="flex-1">{picked.text}</span>
          ) : (
            <BuildingCard
              b={picked.b}
              fixedM={heightFix[picked.b.id]}
              onHeight={(h) =>
                setHeightFix((cur) => {
                  const next = { ...cur };
                  if (h === null) delete next[picked.b.id];
                  else next[picked.b.id] = h;
                  return next;
                })
              }
            />
          )}
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="min-h-8 rounded-full border border-border px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}
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

/** Length, width, footprint and height of a tapped neighbouring building. */
function BuildingCard({
  b,
  fixedM,
  onHeight,
}: {
  b: LocalBuilding;
  fixedM: number | undefined;
  onHeight: (heightM: number | null) => void;
}) {
  const d = footprintDims(b.ring);
  const h = fixedM ?? b.heightM;
  const floors = Math.max(1, Math.round(h / 3));
  const source =
    fixedM !== undefined
      ? "height you set"
      : b.defaulted
        ? "no height recorded, drawn as one floor"
        : "recorded height or floor count";
  return (
    <div className="flex-1 space-y-1" data-testid="pp-building-card">
      <p className="font-medium">Building from OpenStreetMap</p>
      <p>
        Length <b>{d.lengthM.toFixed(1)} m</b> · Width <b>{d.widthM.toFixed(1)} m</b> · Footprint{" "}
        <b>{Math.round(d.areaM2)} m²</b>
      </p>
      <p>
        Height <b>{h.toFixed(1)} m</b> (about {floors} floor{floors === 1 ? "" : "s"}; {source})
      </p>
      <div className="flex flex-wrap items-center gap-1 pt-0.5">
        <span className="text-muted-foreground">Know the floors?</span>
        <button
          type="button"
          aria-label="One floor fewer"
          disabled={floors <= 1}
          onClick={() => onHeight(Math.max(1, floors - 1) * 3)}
          className="min-h-8 min-w-8 rounded-full border border-border px-2 disabled:opacity-40"
        >
          −
        </button>
        <button
          type="button"
          aria-label="One floor more"
          disabled={floors >= 60}
          onClick={() => onHeight(Math.min(60, floors + 1) * 3)}
          className="min-h-8 min-w-8 rounded-full border border-border px-2 disabled:opacity-40"
        >
          +
        </button>
        {fixedM !== undefined && (
          <button
            type="button"
            onClick={() => onHeight(null)}
            className="min-h-8 rounded-full border border-border px-2"
          >
            Undo
          </button>
        )}
      </div>
      <p className="text-muted-foreground">
        Footprint measured from the mapped outline. Use the tape measure for anything else.
      </p>
    </div>
  );
}
