import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import { getElevationSamples } from "@/lib/elevation.functions";
import { getBuildCost } from "@/lib/cost-intel.functions";
import { DEFAULT_BUILD_SELECTION, comparisonTotalText, kes } from "@/lib/cost-intel";
import { countyForPoint } from "@/lib/location-validation";
import { KENYA_COUNTY_FACTS } from "@/lib/kenya-county-facts";
import { imageryTiles, metresPerPixel, typologyName } from "@/lib/plot-placement";
import { deliverBlob } from "@/lib/pdf-delivery";
import { downloadSitePackPdf, type SitePackView } from "@/lib/pdf-site-pack";
import { KitButton } from "@/components/halisia/ds/button";
import { disposeSubtree } from "../disposal";
import { QUICK_LOOK_UNAVAILABLE_MESSAGE, labPlatformFromUA, type LabPlatform } from "../device";
import { planFoundation, type FoundationPlan } from "./foundation";
import { SCHEMATIC_LABEL, structureLabel } from "./house-spec";
import {
  buildFoundation,
  buildSiteHouse,
  scaleFigure,
  setHouseLights,
  type SiteHouse,
} from "./site-house";
import { describeStyle, loadInspiration, type DesignStyle } from "./design-style";
import { InspirationPanel } from "./inspiration-panel";
import { REAL_FURNITURE_CREDITS, preloadRealFurniture, upgradeFurniture } from "./real-furniture";
import { createFinisher, loadSkyEnvironment, type Finisher } from "./render-quality";
import type { SiteParams } from "./site-params";
import {
  SITE_SPAN_M,
  heightAt,
  loadSiteTerrain,
  siteDisclaimer,
  type SiteTerrain,
} from "./site-terrain";
import { eatInstant, solarPosition, sunDirection } from "./solar";

const EYE_M = 1.6;
const BODY_M = 1.75;
const RADIUS_M = 0.25;
const WALK_SPEED = 1.6; // m/s
const IMAGERY_ZOOM = 19;
/** Footings go this far below the lowest ground so nothing floats. */
const EMBED_M = 0.4;
/** Daylight from the environment: the studio fallback, then the real sky. */
const ENV_DAY_STUDIO = 0.45;
const ENV_DAY_SKY = 0.5;

type Engine = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  sky: Sky;
  /** Positioned at finished-floor height; holds the house and its footings. */
  root: THREE.Group;
  built: SiteHouse | null;
  plan: FoundationPlan | null;
  floorY: number;
  colliders: THREE.Box3[];
  ground: THREE.Group | null;
  terrain: SiteTerrain | null;
  yaw: number;
  pitch: number;
  baseRef: XRReferenceSpace | null;
  envTex: THREE.Texture;
  /** The real photographed sky, once loaded; used outdoors. */
  skyEnv: THREE.Texture | null;
  /** Environment strength by day (higher once the real sky has loaded). */
  envDay: number;
  /** Ambient occlusion, lamp glow and smooth edges; null when not created. */
  finisher: Finisher | null;
  /** Use the finisher (desktop default; phones opt in; never in VR). */
  hq: boolean;
  /** A standing person beside the house, for scale. */
  person: THREE.Group;
};

type Imagery = { canvas: HTMLCanvasElement; tint: number } | null;

function todayIso() {
  const d = new Date(Date.now() + 3 * 3600_000);
  return d.toISOString().slice(0, 10);
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

/** Esri World Imagery cropped to the terrain square, plus its average colour. */
async function loadSiteImagery(lat: number, lng: number): Promise<Imagery> {
  const block = imageryTiles(lat, lng, IMAGERY_ZOOM, 2);
  if (!block) return null;
  const mosaic = document.createElement("canvas");
  mosaic.width = block.sizePx;
  mosaic.height = block.sizePx;
  const mctx = mosaic.getContext("2d");
  if (!mctx) return null;
  const imgs = await Promise.all(block.tiles.map((t) => loadImage(t.src)));
  let loaded = 0;
  imgs.forEach((img, i) => {
    if (!img) return;
    loaded++;
    mctx.drawImage(img, block.tiles[i].px, block.tiles[i].py, 256, 256);
  });
  if (loaded < block.tiles.length * 0.6) return null;
  const span = Math.round(SITE_SPAN_M / metresPerPixel(lat, IMAGERY_ZOOM));
  const crop = document.createElement("canvas");
  crop.width = span;
  crop.height = span;
  const cctx = crop.getContext("2d");
  if (!cctx) return null;
  cctx.drawImage(
    mosaic,
    block.pointPx.x - span / 2,
    block.pointPx.y - span / 2,
    span,
    span,
    0,
    0,
    span,
    span,
  );
  let tint = 0x8a8466;
  try {
    const one = document.createElement("canvas");
    one.width = 1;
    one.height = 1;
    const octx = one.getContext("2d");
    if (octx) {
      octx.drawImage(crop, 0, 0, 1, 1);
      const [r, g, b] = octx.getImageData(0, 0, 1, 1).data;
      tint = (r << 16) | (g << 8) | b;
    }
  } catch {
    /* tainted canvas — keep the default tint */
  }
  return { canvas: crop, tint };
}

export default function SiteViewer({ params }: { params: SiteParams }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const eng = useRef<Engine | null>(null);
  const modeRef = useRef<"orbit" | "walk">("orbit");
  const keys = useRef(new Set<string>());
  const touchMove = useRef(0);

  const [terrain, setTerrain] = useState<SiteTerrain | null>(null);
  const [imagery, setImagery] = useState<Imagery | "loading">("loading");
  const [mode, setMode] = useState<"orbit" | "walk">("orbit");
  const [date, setDate] = useState(todayIso);
  const [hour, setHour] = useState(10);
  const [sun, setSun] = useState<{ az: number; el: number } | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [vrSupported, setVrSupported] = useState<boolean | null>(null);
  const [inVr, setInVr] = useState(false);
  const [vrError, setVrError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<LabPlatform>("desktop");
  const [coarse, setCoarse] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [stacked, setStacked] = useState(false);
  /** Best picture: soft shadows where things meet, lamp glow, smooth edges. */
  const [hq, setHq] = useState(false);
  const [style, setStyle] = useState<DesignStyle | null>(null);
  const styleRef = useRef<DesignStyle | null>(null);
  styleRef.current = style;
  /** True between dusk and dawn: the house lights are on. */
  const nightRef = useRef(false);
  const [seeInside, setSeeInside] = useState(false);
  const [cinematic, setCinematic] = useState(false);
  const [info, setInfo] = useState<{ house: SiteHouse; plan: FoundationPlan } | null>(null);
  const [usdzUrl, setUsdzUrl] = useState<string | null>(null);
  const [glbState, setGlbState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [packState, setPackState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [fileError, setFileError] = useState<string | null>(null);

  modeRef.current = mode;
  const seeInsideRef = useRef(false);
  seeInsideRef.current = seeInside;

  /* ---------------- house placement (on build, terrain or stack change) */
  const placeHouse = useCallback(
    (stack: boolean, reframe = true) => {
      const e = eng.current;
      if (!e) return;
      for (const child of [...e.root.children]) {
        e.root.remove(child);
        disposeSubtree(child);
      }
      const built = buildSiteHouse({
        structure: params.structure,
        typology: params.typology,
        floorAreaM2: params.floorAreaM2,
        stacked: stack,
        style: styleRef.current,
      });
      const t = e.terrain;
      const samples: number[] = [];
      for (const r of built.groundRects)
        for (const x of [r.x0, (r.x0 + r.x1) / 2, r.x1])
          for (const z of [r.z0, (r.z0 + r.z1) / 2, r.z1]) samples.push(t ? heightAt(t, x, z) : 0);
      const hi = Math.max(...samples);
      const lo = Math.min(...samples);
      const terrainKnown = t?.kind === "terrain";
      const plan = planFoundation({
        structure: params.structure,
        dropM: terrainKnown ? hi - lo : null,
        stacked: built.levels > 1,
        source: t?.kind === "terrain" ? `${t.dataset} (${t.resolution})` : null,
      });
      const floorY = hi + plan.clearanceM;
      e.root.add(built.group);
      e.root.add(buildFoundation(built, plan, floorY - lo + EMBED_M));
      e.root.position.set(0, floorY, 0);
      for (const o of built.cutaway) o.visible = !seeInsideRef.current;
      setHouseLights(built, nightRef.current);
      const px = built.lengthM / 2 + 1.2;
      const pz = built.widthM / 2 + 1.6;
      e.person.position.set(px, t ? heightAt(t, px, pz) : 0, pz);
      e.person.rotation.y = -0.6;
      e.built = built;
      e.plan = plan;
      e.floorY = floorY;
      e.colliders = built.colliders.map((b) =>
        b.clone().translate(new THREE.Vector3(0, floorY, 0)),
      );
      const size = Math.max(built.lengthM, built.widthM);
      const sc = e.sun.shadow.camera as THREE.OrthographicCamera;
      const half = Math.max(30, size * 0.9);
      sc.left = -half;
      sc.right = half;
      sc.top = half;
      sc.bottom = -half;
      sc.updateProjectionMatrix();
      if (reframe && modeRef.current === "orbit") frameOrbit(e);
      setInfo({ house: built, plan });
      // Swap the box sofas for real models once they have downloaded.
      void upgradeFurniture(built.group);
    },
    [params.structure, params.typology, params.floorAreaM2],
  );

  /* ---------------- engine (once) */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setPlatform(labPlatformFromUA(navigator.userAgent, navigator.maxTouchPoints));
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(reducedMotion);
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    setHq(!coarsePointer);
    preloadRealFurniture();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (err) {
      setWebglError((err as Error)?.message ?? "WebGL unavailable");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType("local-floor");
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    canvas.setAttribute("aria-label", "Schematic site model viewer");
    host.appendChild(canvas);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xc9d7e3);
    scene.fog = new THREE.Fog(0xc9d7e3, 260, 1500);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = envTex;
    scene.environmentIntensity = 0.45;

    const sky = new Sky();
    sky.scale.setScalar(2400);
    const su = sky.material.uniforms;
    su["turbidity"].value = 5;
    su["rayleigh"].value = 1.4;
    su["mieCoefficient"].value = 0.004;
    su["mieDirectionalG"].value = 0.8;
    scene.add(sky);

    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 3000);
    camera.rotation.order = "YXZ";
    camera.position.set(16, 9, 20);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = !reducedMotion;
    controls.target.set(0, 1.2, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.autoRotateSpeed = 0.5;

    const hemi = new THREE.HemisphereLight(0xdfe9ff, 0x6b5b40, 0.5);
    const sunLight = new THREE.DirectionalLight(0xfff1dc, 3.0);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    const sc = sunLight.shadow.camera as THREE.OrthographicCamera;
    sc.near = 1;
    sc.far = 260;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.03;
    scene.add(hemi, sunLight, sunLight.target);

    const root = new THREE.Group();
    root.name = "house-on-site";
    scene.add(root);
    const person = scaleFigure();
    scene.add(person);

    eng.current = {
      renderer,
      scene,
      camera,
      controls,
      sun: sunLight,
      hemi,
      sky,
      root,
      built: null,
      plan: null,
      floorY: 0,
      colliders: [],
      ground: null,
      terrain: null,
      yaw: 0,
      pitch: 0,
      baseRef: null,
      envTex,
      skyEnv: null,
      envDay: ENV_DAY_STUDIO,
      finisher: null,
      hq: !coarsePointer,
      person,
    };
    try {
      eng.current.finisher = createFinisher(renderer, scene, camera);
    } catch {
      eng.current.finisher = null;
    }
    // The real photographed sky replaces the studio light when it arrives.
    let alive = true;
    void loadSkyEnvironment(renderer).then((sky) => {
      const e = eng.current;
      if (!sky) return;
      if (!alive || !e) {
        sky.dispose();
        return;
      }
      e.skyEnv = sky;
    });

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      eng.current?.finisher?.setSize(w, h, renderer.getPixelRatio());
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    /* ---- look input */
    const look = (dx: number, dy: number) => {
      const e = eng.current;
      if (!e) return;
      e.yaw -= dx * 0.0025;
      e.pitch = Math.max(-1.4, Math.min(1.4, e.pitch - dy * 0.0025));
    };
    const onMouseMove = (ev: MouseEvent) => {
      if (modeRef.current === "walk" && document.pointerLockElement === canvas)
        look(ev.movementX, ev.movementY);
    };
    let drag: { id: number; x: number; y: number } | null = null;
    const onPointerDown = (ev: PointerEvent) => {
      if (modeRef.current !== "walk") return;
      if (ev.pointerType === "mouse") {
        if (document.pointerLockElement !== canvas) void canvas.requestPointerLock?.();
        return;
      }
      drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
    };
    const onPointerMove = (ev: PointerEvent) => {
      if (!drag || drag.id !== ev.pointerId) return;
      look(ev.clientX - drag.x, ev.clientY - drag.y);
      drag.x = ev.clientX;
      drag.y = ev.clientY;
    };
    const onPointerUp = () => {
      drag = null;
    };
    const onKey = (down: boolean) => (ev: KeyboardEvent) => {
      const k = ev.key.toLowerCase();
      if (!["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k))
        return;
      if (modeRef.current !== "walk") return;
      if (down) keys.current.add(k);
      else keys.current.delete(k);
    };
    const kd = onKey(true);
    const ku = onKey(false);
    document.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    /* ---- VR teleport */
    const raycaster = new THREE.Raycaster();
    const tmpM = new THREE.Matrix4();
    const teleportTo = (p: THREE.Vector3) => {
      const e = eng.current;
      if (!e?.baseRef || typeof XRRigidTransform === "undefined") return;
      const t = new XRRigidTransform(
        { x: -p.x, y: -p.y, z: -p.z, w: 1 },
        { x: 0, y: 0, z: 0, w: 1 },
      );
      renderer.xr.setReferenceSpace(e.baseRef.getOffsetReferenceSpace(t));
    };
    for (const i of [0, 1]) {
      const ctrl = renderer.xr.getController(i);
      ctrl.addEventListener("select", () => {
        const e = eng.current;
        if (!e) return;
        tmpM.identity().extractRotation(ctrl.matrixWorld);
        raycaster.ray.origin.setFromMatrixPosition(ctrl.matrixWorld);
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tmpM);
        const hit = raycaster.intersectObjects([...(e.ground ? [e.ground] : []), e.root], true)[0];
        if (hit) teleportTo(hit.point);
      });
      scene.add(ctrl);
    }
    const onSessionStart = () => {
      const e = eng.current;
      if (!e) return;
      e.baseRef = renderer.xr.getReferenceSpace();
      const z = (e.built?.widthM ?? 10) / 2 + 6;
      teleportTo(new THREE.Vector3(0, e.terrain ? heightAt(e.terrain, 0, z) : 0, z));
      setInVr(true);
    };
    const onSessionEnd = () => {
      if (eng.current) eng.current.baseRef = null;
      setInVr(false);
    };
    renderer.xr.addEventListener("sessionstart", onSessionStart);
    renderer.xr.addEventListener("sessionend", onSessionEnd);
    const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
    if (xr?.isSessionSupported)
      void xr
        .isSessionSupported("immersive-vr")
        .then(setVrSupported)
        .catch(() => setVrSupported(false));
    else setVrSupported(false);

    /* ---- loop */
    const clock = new THREE.Clock();
    const fwd = new THREE.Vector3();
    const right = new THREE.Vector3();
    const blocked = (x: number, z: number, feet: number) =>
      (eng.current?.colliders ?? []).some(
        (b) =>
          x > b.min.x - RADIUS_M &&
          x < b.max.x + RADIUS_M &&
          z > b.min.z - RADIUS_M &&
          z < b.max.z + RADIUS_M &&
          feet + 0.3 < b.max.y &&
          feet + BODY_M > b.min.y,
      );
    renderer.setAnimationLoop(() => {
      const e = eng.current;
      if (!e) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      if (!renderer.xr.isPresenting) {
        if (modeRef.current === "walk") {
          const k = keys.current;
          let f = touchMove.current;
          let s = 0;
          if (k.has("w") || k.has("arrowup")) f += 1;
          if (k.has("s") || k.has("arrowdown")) f -= 1;
          if (k.has("d") || k.has("arrowright")) s += 1;
          if (k.has("a") || k.has("arrowleft")) s -= 1;
          fwd.set(-Math.sin(e.yaw), 0, -Math.cos(e.yaw));
          right.set(Math.cos(e.yaw), 0, -Math.sin(e.yaw));
          const dx = (fwd.x * f + right.x * s) * WALK_SPEED * dt;
          const dz = (fwd.z * f + right.z * s) * WALK_SPEED * dt;
          const p = e.camera.position;
          const feetAt = (x: number, z: number) => {
            const g = e.terrain ? heightAt(e.terrain, x, z) : 0;
            return insideHouse(e, x, z) ? Math.max(g, e.floorY + 0.12) : g;
          };
          if (dx && !blocked(p.x + dx, p.z, feetAt(p.x + dx, p.z))) p.x += dx;
          if (dz && !blocked(p.x, p.z + dz, feetAt(p.x, p.z + dz))) p.z += dz;
          p.x = Math.max(-95, Math.min(95, p.x));
          p.z = Math.max(-95, Math.min(95, p.z));
          p.y = feetAt(p.x, p.z) + EYE_M;
          e.camera.rotation.set(e.pitch, e.yaw, 0, "YXZ");
        } else {
          e.controls.update();
        }
      }
      // Outdoors the real sky lights the scene; indoors the neutral studio
      // light reads better (a room is lit by its own walls, not the sky).
      if (e.skyEnv) {
        const c = e.camera.position;
        const indoors = insideHouse(e, c.x, c.z) && c.y < e.floorY + 3.2;
        const want = indoors ? e.envTex : e.skyEnv;
        if (e.scene.environment !== want) {
          e.scene.environment = want;
          e.envDay = indoors ? ENV_DAY_STUDIO : ENV_DAY_SKY;
          if (e.scene.environmentIntensity > 0.1) e.scene.environmentIntensity = e.envDay;
        }
      }
      if (e.hq && e.finisher && !renderer.xr.isPresenting) e.finisher.render(e.camera);
      else renderer.render(e.scene, e.camera);
    });

    placeHouse(false);

    return () => {
      alive = false;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      document.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      renderer.xr.removeEventListener("sessionstart", onSessionStart);
      renderer.xr.removeEventListener("sessionend", onSessionEnd);
      void renderer.xr
        .getSession()
        ?.end()
        .catch(() => undefined);
      controls.dispose();
      disposeSubtree(scene);
      eng.current?.envTex.dispose();
      eng.current?.skyEnv?.dispose();
      eng.current?.finisher?.dispose();
      renderer.dispose();
      canvas.remove();
      eng.current = null;
    };
    // Engine is built once per mounted params set; the route remounts on change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- terrain (one request) and satellite imagery */
  useEffect(() => {
    let alive = true;
    void loadSiteTerrain(params.lat, params.lng, (locations) =>
      getElevationSamples({ data: { locations } }),
    ).then((t) => {
      if (alive) setTerrain(t);
    });
    if (params.lat !== null && params.lng !== null) {
      void loadSiteImagery(params.lat, params.lng)
        .catch(() => null)
        .then((img) => {
          if (alive) setImagery(img);
        });
    } else setImagery(null);
    return () => {
      alive = false;
    };
  }, [params.lat, params.lng]);

  /* ---------------- ground mesh, then the house on it */
  useEffect(() => {
    const e = eng.current;
    if (!e || !terrain) return;
    if (e.ground) {
      e.scene.remove(e.ground);
      disposeSubtree(e.ground);
    }
    e.terrain = terrain;
    e.ground = buildGround(terrain, imagery === "loading" ? null : imagery, e.renderer);
    e.scene.add(e.ground);
    placeHouse(stacked);
    // Rebuilding the house on every imagery change is unnecessary; terrain and stack drive it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terrain, imagery]);

  useEffect(() => {
    if (eng.current?.terrain) placeHouse(stacked);
  }, [stacked, placeHouse]);

  useEffect(() => {
    if (eng.current) eng.current.hq = hq;
  }, [hq]);

  // A new design style rebuilds the house in place, keeping the camera.
  useEffect(() => {
    if (eng.current?.terrain) placeHouse(stacked, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style]);

  useEffect(() => {
    const e = eng.current;
    if (!e?.built) return;
    for (const o of e.built.cutaway) o.visible = !seeInside;
  }, [seeInside, info]);

  useEffect(() => {
    const e = eng.current;
    if (!e) return;
    e.controls.autoRotate = cinematic && !reduced && mode === "orbit";
    if (cinematic && mode === "orbit") frameOrbit(e, true);
  }, [cinematic, reduced, mode]);

  /* ---------------- sun */
  useEffect(() => {
    const lat = params.lat ?? -1.2921;
    const lng = params.lng ?? 36.8219;
    const pos = solarPosition(eatInstant(date, hour), lat, lng);
    setSun({ az: pos.azimuthDeg, el: pos.elevationDeg });
    const e = eng.current;
    if (!e) return;
    const [x, y, z] = sunDirection(pos.azimuthDeg, pos.elevationDeg);
    e.sun.position.set(x * 120, y * 120, z * 120);
    e.sun.target.position.set(0, 0, 0);
    const up = pos.elevationDeg > 0;
    e.sun.intensity = up ? 3.0 * Math.min(1, pos.elevationDeg / 12 + 0.2) : 0;
    e.hemi.intensity = up ? 0.5 : 0.08;
    e.scene.environmentIntensity = up ? e.envDay : 0.06;
    (e.sky.material.uniforms["sunPosition"].value as THREE.Vector3).set(x, y, z);
    e.sky.visible = up;
    // House lights come on from just before sunset.
    nightRef.current = pos.elevationDeg < 4;
    if (e.built) setHouseLights(e.built, nightRef.current);
    e.finisher?.setNight(nightRef.current);
    const bg = up ? 0xc9d7e3 : 0x141c2a;
    (e.scene.background as THREE.Color).setHex(bg);
    (e.scene.fog as THREE.Fog).color.setHex(bg);
  }, [date, hour, params.lat, params.lng]);

  /* ---------------- mode switch */
  useEffect(() => {
    const e = eng.current;
    if (!e) return;
    keys.current.clear();
    touchMove.current = 0;
    if (mode === "walk") {
      e.controls.enabled = false;
      e.controls.autoRotate = false;
      const z = (e.built?.widthM ?? 10) / 2 + 6;
      e.camera.position.set(0, (e.terrain ? heightAt(e.terrain, 0, z) : 0) + EYE_M, z);
      e.yaw = 0;
      e.pitch = 0;
    } else {
      if (document.pointerLockElement) document.exitPointerLock();
      e.controls.enabled = true;
      frameOrbit(e);
    }
  }, [mode]);

  const enterVr = useCallback(async () => {
    setVrError(null);
    const e = eng.current;
    const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
    if (!e || !xr) return;
    try {
      const session = await xr.requestSession("immersive-vr", {
        optionalFeatures: ["local-floor"],
      });
      await e.renderer.xr.setSession(session);
    } catch (err) {
      setVrError(`VR could not start: ${(err as Error)?.message ?? "session rejected"}`);
    }
  }, []);

  const fileBase = `halisia-${params.typology}-${params.structure}${stacked ? "-stacked" : ""}`;

  /** Export the house and footings with the floor at the model origin. */
  const withOriginAtFloor = async <T,>(fn: (root: THREE.Group) => Promise<T>) => {
    const e = eng.current;
    if (!e) throw new Error("The 3D view is not ready yet.");
    const y = e.root.position.y;
    e.root.position.y = 0;
    e.root.updateMatrixWorld(true);
    try {
      return await fn(e.root);
    } finally {
      e.root.position.y = y;
      e.root.updateMatrixWorld(true);
    }
  };

  const saveGlb = useCallback(async () => {
    setGlbState("busy");
    setFileError(null);
    try {
      const glb = (await withOriginAtFloor((root) =>
        new GLTFExporter().parseAsync(root, { binary: true }),
      )) as ArrayBuffer;
      deliverBlob(new Blob([glb], { type: "model/gltf-binary" }), `${fileBase}.glb`);
      setGlbState("done");
    } catch (err) {
      setGlbState("error");
      setFileError(
        `The 3D model could not be saved: ${(err as Error)?.message ?? "export failed"}`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileBase]);

  const prepareQuickLook = useCallback(async () => {
    setFileError(null);
    try {
      const usdz = await withOriginAtFloor((root) => new USDZExporter().parseAsync(root));
      setUsdzUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(new Blob([usdz as BlobPart], { type: "model/vnd.usdz+zip" }));
      });
    } catch (err) {
      setFileError(`AR file could not be made: ${(err as Error)?.message ?? "export failed"}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(
    () => () => {
      if (usdzUrl) URL.revokeObjectURL(usdzUrl);
    },
    [usdzUrl],
  );

  const savePack = useCallback(async () => {
    const e = eng.current;
    if (!e?.built || !e.plan) return;
    setPackState("busy");
    setFileError(null);
    try {
      const views = captureViews(e);
      const cost = await costSummary(params, e.built);
      const h = e.built;
      const title = `${typologyName(params.typology)} · ${structureLabel(params.structure)}${
        h.levels > 1 ? " (stacked two high)" : ""
      }`;
      downloadSitePackPdf({
        title,
        place:
          params.lat !== null && params.lng !== null
            ? `${params.lat.toFixed(6)}, ${params.lng.toFixed(6)}`
            : null,
        views,
        house: h,
        foundation: e.plan,
        ground: siteDisclaimer(e.terrain),
        cost,
        inspiration:
          style && style.source !== "default"
            ? {
                lines: describeStyle(style),
                notes: style.notes,
                thumb: loadInspiration()?.thumb ?? null,
              }
            : null,
        notes: [
          "Check the county's building lines, plot coverage and approval rules before fixing the position.",
          "Get the boundary beacons confirmed by a licensed surveyor; the view is not placed on a surveyed boundary.",
          "Ask an architect to turn this massing into approved drawings, and a quantity surveyor to price the final design.",
          "Terrain comes from a 30–90 m public grid; a site level survey shows the real fall, ditches and rock.",
        ],
      });
      setPackState("done");
    } catch (err) {
      setPackState("error");
      setFileError(
        `The site pack could not be made: ${(err as Error)?.message ?? "unknown error"}`,
      );
    }
  }, [params, style]);

  const disclaimer = siteDisclaimer(terrain);
  const isContainer = params.structure !== "masonry_stone";
  const h = info?.house;

  return (
    <div className="flex flex-col gap-4" data-testid="model-lab-site-mode">
      <div className="relative h-[60vh] min-h-[320px] overflow-hidden rounded-2xl border border-white/10 bg-black/20">
        <div ref={hostRef} className="h-full w-full" />
        {webglError && (
          <p className="absolute inset-0 flex items-center justify-center p-4 text-sm">
            WebGL is unavailable in this browser: {webglError}
          </p>
        )}
        <div className="pointer-events-none absolute left-2 right-2 top-2 rounded-lg bg-background/85 px-3 py-2 text-xs">
          <p className="font-semibold" data-testid="site-schematic-label">
            {SCHEMATIC_LABEL}
          </p>
          <p data-testid="site-disclaimer">
            {disclaimer}
            {imagery === "loading"
              ? " Loading satellite ground…"
              : imagery
                ? " Ground: Esri World Imagery draped on the terrain."
                : params.lat !== null
                  ? " Satellite imagery did not load, so the ground is plain."
                  : ""}
          </p>
        </div>
        {mode === "walk" && coarse && (
          <div className="absolute bottom-3 right-3 flex flex-col gap-2">
            {[
              { label: "Forward", v: 1 },
              { label: "Back", v: -1 },
            ].map((b) => (
              <button
                key={b.label}
                type="button"
                className="min-h-12 min-w-12 rounded-full bg-background/90 px-4 text-sm font-medium"
                onPointerDown={() => (touchMove.current = b.v)}
                onPointerUp={() => (touchMove.current = 0)}
                onPointerLeave={() => (touchMove.current = 0)}
                onPointerCancel={() => (touchMove.current = 0)}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2" data-testid="site-view-controls">
        <KitButton size="sm" onClick={() => setMode(mode === "walk" ? "orbit" : "walk")}>
          {mode === "walk" ? "Exit walk mode" : "Walk around"}
        </KitButton>
        <KitButton
          size="sm"
          variant={seeInside ? "primary" : "secondary"}
          aria-pressed={seeInside}
          onClick={() => setSeeInside((v) => !v)}
          data-testid="site-see-inside"
        >
          {seeInside ? "Put the roof back" : "See inside"}
        </KitButton>
        {!reduced && (
          <KitButton
            size="sm"
            variant={cinematic ? "primary" : "secondary"}
            aria-pressed={cinematic}
            onClick={() => {
              setMode("orbit");
              setCinematic((v) => !v);
            }}
          >
            {cinematic ? "Stop fly-around" : "Fly around"}
          </KitButton>
        )}
        {vrSupported && (
          <KitButton size="sm" onClick={() => void enterVr()} disabled={inVr}>
            Enter VR
          </KitButton>
        )}
      </div>

      <label className="flex min-h-11 items-center gap-3 text-sm" data-testid="site-hq">
        <input
          type="checkbox"
          className="h-5 w-5 accent-primary"
          checked={hq}
          disabled={!eng.current?.finisher}
          onChange={(ev) => setHq(ev.target.checked)}
        />
        <span>
          Best picture
          <span className="block text-xs text-muted-foreground">
            Soft shadows where walls, floors and furniture meet, glowing lamps at night and smooth
            edges. Turn off if the view feels slow on your phone.
          </span>
        </span>
      </label>

      {isContainer && h && (h.units > 1 || stacked) && (
        <label className="flex min-h-11 items-center gap-3 text-sm" data-testid="site-stack">
          <input
            type="checkbox"
            className="h-5 w-5 accent-primary"
            checked={stacked}
            onChange={(ev) => setStacked(ev.target.checked)}
          />
          <span>
            Stack the containers two high
            <span className="block text-xs text-muted-foreground">
              Uses about half the ground and adds an outside stair. Needs stronger footings and
              locked connections.
            </span>
          </span>
        </label>
      )}

      {h && info && (
        <section
          aria-label="This house on this ground"
          className="grid gap-3 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm sm:grid-cols-2"
          data-testid="site-house-facts"
        >
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Size
            </h2>
            <ul className="mt-1 space-y-0.5">
              <li>
                Footprint {h.lengthM.toFixed(1)} × {h.widthM.toFixed(1)} m (
                {(h.lengthM * h.widthM).toFixed(0)} m² of ground)
              </li>
              <li>
                Floor area about {h.floorAreaM2} m²
                {h.levels > 1 ? ` on ${h.levels} levels` : ""}
              </li>
              {h.units > 0 && <li>{h.units} container units</li>}
              <li>{h.bedrooms ? `${h.bedrooms} bedrooms` : "Open-plan bedsitter"}</li>
            </ul>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold">Rooms</summary>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {h.rooms
                  .filter((r) => r.name !== "Outside stair")
                  .map((r, i) => (
                    <li key={i}>
                      {r.name}
                      {h.levels > 1 ? (r.level ? " (upper)" : " (ground)") : ""}:{" "}
                      {(r.x1 - r.x0).toFixed(1)} × {(r.z1 - r.z0).toFixed(1)} m
                    </li>
                  ))}
              </ul>
            </details>
          </div>
          <div data-testid="site-foundation">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Suggested foundation
            </h2>
            <p className="mt-1 font-semibold">{info.plan.name}</p>
            <p className="text-xs">{info.plan.summary}</p>
            <p className="mt-1 text-xs text-muted-foreground">{info.plan.why}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
              {info.plan.checks.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <InspirationPanel value={style} onApply={setStyle} testId="site-inspiration" />

      <div className="flex flex-wrap items-center gap-2" data-testid="site-files">
        <KitButton
          size="sm"
          variant="primary"
          onClick={() => void savePack()}
          disabled={packState === "busy" || !info}
          data-testid="site-pack-pdf"
        >
          {packState === "busy" ? "Making the PDF…" : "Download site pack (PDF)"}
        </KitButton>
        <KitButton
          size="sm"
          onClick={() => void saveGlb()}
          disabled={glbState === "busy" || !info}
          data-testid="site-glb"
        >
          {glbState === "busy" ? "Saving…" : "Save 3D model (GLB)"}
        </KitButton>
        {platform === "ios" && (
          <KitButton size="sm" onClick={() => void prepareQuickLook()}>
            Prepare AR (iPhone)
          </KitButton>
        )}
        {usdzUrl && (
          <a rel="ar" href={usdzUrl} className="underline" data-testid="site-quicklook">
            <img
              alt=""
              width={1}
              height={1}
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E"
            />
            View in AR (Quick Look)
          </a>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        The site pack has three views, a measured floor plan, the foundation suggestion and the cost
        from the price database. The GLB opens in Windows 3D Viewer, Blender, SketchUp or online GLB
        viewers.
      </p>
      {packState === "done" && (
        <p role="status" className="text-xs">
          Site pack ready. If it did not save on its own, tap Save on the card that appeared.
        </p>
      )}
      {fileError && <p className="text-xs text-destructive">{fileError}</p>}

      {mode === "walk" && (
        <p className="text-xs text-muted-foreground">
          {coarse
            ? "Drag to look; hold Forward or Back to move. Walk in through the front door."
            : "Click the view to capture the pointer, look with the mouse, move with W A S D. Press Esc to release."}{" "}
          Eye height 1.6 m.
        </p>
      )}
      {vrError && <p className="text-xs text-destructive">{vrError}</p>}

      <section aria-label="Sun study" className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col text-xs">
          Date
          <input
            type="date"
            className="min-h-11 rounded-lg border border-white/15 bg-background px-2"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
        <label className="flex min-w-[220px] flex-1 flex-col text-xs">
          Time (EAT, UTC+3): {String(Math.floor(hour)).padStart(2, "0")}:
          {String(Math.round((hour % 1) * 60)).padStart(2, "0")}
          <input
            type="range"
            min={6}
            max={19}
            step={0.25}
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            className="min-h-11"
          />
        </label>
        {sun && (
          <p className="font-mono text-xs" data-testid="site-sun">
            Sun azimuth {sun.az.toFixed(1)}°, elevation {sun.el.toFixed(1)}°
            {sun.el <= 0 ? " (below horizon)" : ""} — computed locally (NOAA).
          </p>
        )}
      </section>

      <details className="text-sm" data-testid="site-diagnostics">
        <summary className="cursor-pointer text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Diagnostics
        </summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
          <dt>Structure</dt>
          <dd>
            {structureLabel(params.structure)} ({params.typology})
          </dd>
          <dt>Ground</dt>
          <dd>
            {terrain === null
              ? "loading"
              : terrain.kind === "terrain"
                ? `${terrain.dataset}, 10×10 grid over ~200 m, relief ${terrain.reliefM.toFixed(1)} m`
                : "flat plane (no terrain)"}
          </dd>
          <dt>Imagery</dt>
          <dd>
            {imagery === "loading"
              ? "loading"
              : imagery
                ? `Esri World Imagery z${IMAGERY_ZOOM}`
                : "not loaded"}
          </dd>
          <dt>Models</dt>
          <dd data-testid="site-credits">{REAL_FURNITURE_CREDITS}</dd>
          <dt>Foundation</dt>
          <dd>
            {info ? `${info.plan.kind}, floor ${info.plan.clearanceM} m above high ground` : "—"}
          </dd>
          <dt>VR</dt>
          <dd>{vrSupported === null ? "checking" : vrSupported ? "supported" : "not supported"}</dd>
          <dt>Quick Look</dt>
          <dd>
            {usdzUrl
              ? "USDZ generated"
              : `${QUICK_LOOK_UNAVAILABLE_MESSAGE} (QUICK_LOOK_UNAVAILABLE)`}
          </dd>
          <dt>Platform</dt>
          <dd>{platform}</dd>
        </dl>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

function insideHouse(e: Engine, x: number, z: number) {
  const h = e.built;
  if (!h) return false;
  return h.groundRects.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
}

/** Orbit camera framed on the house; `low` gives a lower, wider cinematic angle. */
function frameOrbit(e: Engine, low = false) {
  const h = e.built;
  const size = h ? Math.max(h.lengthM, h.widthM, 8) : 12;
  const d = size * (low ? 1.9 : 1.55) + 6;
  e.controls.target.set(0, e.floorY + (h ? Math.min(2, h.heightM / 2) : 1.2), 0);
  e.camera.position.set(d * 0.7, e.floorY + d * (low ? 0.22 : 0.42), d * 0.85);
  e.controls.update();
}

function buildGround(t: SiteTerrain, imagery: Imagery, renderer: THREE.WebGLRenderer): THREE.Group {
  const group = new THREE.Group();
  group.name = "site-ground";
  const map = imagery ? new THREE.CanvasTexture(imagery.canvas) : null;
  if (map) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }
  const apronColor = imagery ? imagery.tint : 0x7c8466;
  if (t.kind === "terrain") {
    // Resample the 10×10 grid onto a finer mesh so the imagery drapes smoothly.
    const seg = 80;
    const geo = new THREE.PlaneGeometry(t.spanM, t.spanM, seg, seg);
    geo.rotateX(-Math.PI / 2); // row 0 → north (−Z)
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(t, pos.getX(i), pos.getZ(i)));
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial(
        map ? { map, roughness: 1 } : { color: 0x6b7a4f, roughness: 0.97 },
      ),
    );
    mesh.receiveShadow = true;
    mesh.name = "terrain";
    group.add(mesh);
    const minH = Math.min(...t.heights.flat());
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: apronColor, roughness: 1 }),
    );
    apron.position.y = minH - 0.3;
    apron.receiveShadow = true;
    group.add(apron);
  } else {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: apronColor, roughness: 0.98 }),
    );
    mesh.receiveShadow = true;
    group.add(mesh);
    if (map) {
      const sat = new THREE.Mesh(
        new THREE.PlaneGeometry(SITE_SPAN_M, SITE_SPAN_M).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ map, roughness: 1 }),
      );
      sat.position.y = 0.01;
      sat.receiveShadow = true;
      group.add(sat);
    }
  }
  return group;
}

/** Three stills for the PDF: 3/4 view, eye-level view, and a cut-away plan from above. */
function captureViews(e: Engine): SitePackView[] {
  const { renderer, scene } = e;
  if (renderer.xr.isPresenting) return [];
  const h = e.built;
  const W = 1600;
  const H = 1000;
  const prevRatio = renderer.getPixelRatio();
  const prevSize = renderer.getSize(new THREE.Vector2());
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  const fin = e.hq ? e.finisher : null;
  fin?.setSize(W, H, 1);
  // The stills are all taken from outside, so they use the sky light.
  const prevEnv = scene.environment;
  const prevEnvI = scene.environmentIntensity;
  if (e.skyEnv) {
    scene.environment = e.skyEnv;
    if (prevEnvI > 0.1) scene.environmentIntensity = ENV_DAY_SKY;
  }
  const out: SitePackView[] = [];
  const shot = (cam: THREE.Camera, label: string) => {
    // Ambient occlusion assumes a perspective camera, so the plan uses the plain renderer.
    if (fin && cam instanceof THREE.PerspectiveCamera) fin.render(cam);
    else renderer.render(scene, cam);
    out.push({
      label,
      dataUrl: renderer.domElement.toDataURL("image/jpeg", 0.88),
      widthPx: W,
      heightPx: H,
    });
  };
  try {
    const size = h ? Math.max(h.lengthM, h.widthM, 8) : 12;
    const fy = e.floorY;
    const cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 3000);
    const d = size * 1.7 + 6;
    cam.position.set(d * 0.72, fy + d * 0.38, d * 0.82);
    cam.lookAt(0, fy + 1.5, 0);
    shot(cam, "Three-quarter view from the south-east, on the terrain and satellite ground.");

    const eye = new THREE.PerspectiveCamera(55, W / H, 0.05, 3000);
    const ez = (h?.widthM ?? 10) / 2 + Math.max(8, size * 0.6);
    const ground = e.terrain ? heightAt(e.terrain, -size * 0.3, ez) : 0;
    eye.position.set(-size * 0.3, ground + EYE_M, ez);
    eye.lookAt(0, fy + 1.6, 0);
    shot(eye, "Eye-level view from the front, as you would see it standing on the plot.");

    const hidden = h ? h.cutaway.filter((o) => o.visible) : [];
    hidden.forEach((o) => (o.visible = false));
    const half = size * 0.62 + 2;
    const top = new THREE.OrthographicCamera(
      (-half * W) / H,
      (half * W) / H,
      half,
      -half,
      0.1,
      500,
    );
    top.position.set(0, fy + 120, 0.001);
    top.up.set(0, 0, -1);
    top.lookAt(0, fy, 0);
    shot(top, "Plan from above with the roof removed (north at the top).");
    hidden.forEach((o) => (o.visible = true));
  } finally {
    renderer.setPixelRatio(prevRatio);
    renderer.setSize(prevSize.x, prevSize.y, false);
    fin?.setSize(prevSize.x, prevSize.y, prevRatio);
    scene.environment = prevEnv;
    scene.environmentIntensity = prevEnvI;
  }
  return out;
}

async function costSummary(
  p: SiteParams,
  h: SiteHouse,
): Promise<{ headline: string; detail: string[] }> {
  const found = p.lat !== null && p.lng !== null ? countyForPoint(p.lat, p.lng) : null;
  const county =
    found && Object.values(KENYA_COUNTY_FACTS).some((c) => c.name === found.name)
      ? found.name
      : undefined;
  const finish = DEFAULT_BUILD_SELECTION.finish;
  const detail = [
    `Finish: ${finish}. Prices: ${county ? `${county} where recorded, national otherwise` : "national"}.`,
    "Covers the house only: not the land, approvals, water and power connections, boundary wall, or foundation upgrades for poor soil.",
  ];
  if (h.levels > 1)
    detail.push(
      "Stacking is not priced separately: stronger pads, the stair, structural connections and crane hire change the total.",
    );
  try {
    const r = await getBuildCost({
      data: { typology: p.typology, structure: p.structure, finish, county },
    });
    if (!r.lines.length)
      return {
        headline:
          "No bill of quantities exists yet for this house type and building system, so no cost is shown.",
        detail,
      };
    const c = r.costing;
    if (c.total == null)
      return {
        headline: `Only ${Math.round(c.pricedShare * 100)}% of the bill of quantities is priced, so no total is shown (HALISIA needs at least 90%).`,
        detail,
      };
    const scale =
      p.structure === "masonry_stone" && r.floorAreaM2 && h.floorAreaM2
        ? h.floorAreaM2 / r.floorAreaM2
        : 1;
    const total = c.total * scale;
    const high = c.totalHigh != null ? c.totalHigh * scale : null;
    if (scale !== 1)
      detail.unshift(
        `Scaled pro-rata from the ${r.floorAreaM2} m² template to about ${h.floorAreaM2} m².`,
      );
    detail.unshift(
      `${c.pricedLines} of ${c.totalLines} bill lines priced from observed supplier and labour prices.`,
    );
    return { headline: `Estimated build cost: ${comparisonTotalText(total, high, kes)}`, detail };
  } catch {
    return {
      headline: "The cost database could not be reached just now, so no cost is shown.",
      detail,
    };
  }
}
