import { presetPosition } from "./preset-position";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { disposeSubtree, hasRenderableMesh } from "@/components/halisia/model-lab/disposal";
import { framingFromObject } from "@/components/halisia/model-lab/framing";
import { loadGlbBytes } from "@/components/halisia/model-lab/loader";
import type { StudioConcept, StudioEnvironment, StudioTopology } from "./catalog";

export type StudioViewerProps = {
  concept: StudioConcept;
  widthM: number;
  depthM: number;
  topology: StudioTopology;
  environment: StudioEnvironment;
  rotationDeg: number;
  scalePct: number;
  showParking: boolean;
  showLandscape: boolean;
  fitToken: number;
  generated: { use: "residential" | "commercial" | "mixed"; floors: number } | null;
  onApi?: (api: StudioViewerApi | null) => void;
  onState?: (state: { loading: boolean; error: string | null }) => void;
};

import type { CameraPreset } from "./camera-presets";
export type { CameraPreset };

export type RenderCapability = { maxWidth: number; maxHeight: number; supports8k: boolean };

export type StudioViewerApi = {
  setView: (preset: CameraPreset) => void;
  capability: () => RenderCapability;
  /** Renders offscreen at the requested size; rejects if the GPU cannot. */
  capture: (width: number, height: number) => Promise<Blob>;
};

type Engine = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  content: THREE.Group;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
};

const C = {
  soil: 0x8b7654,
  grass: 0x637b45,
  path: 0xc7b891,
  parking: 0x5e625e,
  marking: 0xe7e0d2,
  trunk: 0x5d4931,
  leaf: 0x38623d,
  water: 0x668e8e,
};

function material(color: number, roughness = 0.9) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
}

function box(w: number, h: number, d: number, color: number) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
}

function addTree(root: THREE.Group, x: number, z: number, scale: number) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14 * scale, 0.22 * scale, 1.7 * scale, 7),
    material(C.trunk),
  );
  trunk.position.y = 0.85 * scale;
  trunk.castShadow = true;
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85 * scale, 1), material(C.leaf, 1));
  crown.position.y = 2 * scale;
  crown.castShadow = true;
  tree.add(trunk, crown);
  tree.position.set(x, 0, z);
  root.add(tree);
}

function makeSite(
  widthM: number,
  depthM: number,
  topology: StudioTopology,
  showParking: boolean,
  showLandscape: boolean,
): THREE.Group {
  const root = new THREE.Group();
  root.name = "design-studio-site";
  const ground = box(widthM, 0.35, depthM, topology === "terraced" ? C.soil : C.grass);
  ground.position.y = -0.2;
  ground.receiveShadow = true;
  if (topology === "gentle-slope") ground.rotation.z = THREE.MathUtils.degToRad(-2.5);
  root.add(ground);

  if (topology === "terraced") {
    for (let i = 0; i < 4; i += 1) {
      const terrace = box(widthM * 0.94, 0.2 + i * 0.18, depthM / 4 - 0.35, C.grass);
      terrace.position.set(0, i * 0.09, -depthM / 2 + (i + 0.5) * (depthM / 4));
      terrace.receiveShadow = true;
      root.add(terrace);
    }
  }

  const path = box(Math.min(4, widthM * 0.12), 0.08, depthM * 0.82, C.path);
  path.position.set(-widthM * 0.32, 0.05, 0);
  path.receiveShadow = true;
  root.add(path);

  if (showParking) {
    const parkingW = Math.min(widthM * 0.42, 24);
    const parkingD = Math.min(depthM * 0.22, 11);
    const parking = box(parkingW, 0.08, parkingD, C.parking);
    parking.position.set(widthM * 0.22, 0.06, depthM * 0.32);
    parking.receiveShadow = true;
    root.add(parking);
    const bays = Math.max(2, Math.min(8, Math.floor(parkingW / 2.8)));
    for (let i = 1; i < bays; i += 1) {
      const line = box(0.06, 0.02, parkingD * 0.76, C.marking);
      line.position.set(
        parking.position.x - parkingW / 2 + (parkingW / bays) * i,
        0.12,
        parking.position.z,
      );
      root.add(line);
    }
  }

  const swale = box(widthM * 0.72, 0.04, Math.max(0.8, depthM * 0.035), C.water);
  swale.position.set(0, 0.03, -depthM * 0.42);
  root.add(swale);

  if (showLandscape) {
    const x = widthM * 0.4;
    const z = depthM * 0.35;
    [
      [-x, -z],
      [x, -z],
      [-x, z],
      [x, z],
      [0, -z],
      [0, z],
    ].forEach(([tx, tz], index) => addTree(root, tx, tz, 0.75 + (index % 3) * 0.12));
  }
  return root;
}

function makeGeneratedMassing(
  widthM: number,
  depthM: number,
  use: "residential" | "commercial" | "mixed",
  floors: number,
): THREE.Group {
  const root = new THREE.Group();
  root.name = "generated-concept-massing";
  const count = use === "residential" ? 2 : 1;
  const buildingWidth = Math.min(
    widthM * (count === 2 ? 0.28 : 0.5),
    use === "commercial" ? 30 : 20,
  );
  const buildingDepth = Math.min(depthM * (count === 2 ? 0.34 : 0.46), 24);
  const height = Math.max(3, floors * 3.1);
  const facade = use === "commercial" ? 0xb78952 : use === "mixed" ? 0xd1b875 : 0xd9d1bd;
  for (let i = 0; i < count; i += 1) {
    const building = box(buildingWidth, height, buildingDepth, facade);
    building.position.set((i - (count - 1) / 2) * (buildingWidth + 3), height / 2, -depthM * 0.05);
    building.castShadow = true;
    building.receiveShadow = true;
    root.add(building);
    for (let floor = 1; floor <= floors; floor += 1) {
      const band = box(buildingWidth + 0.12, 0.1, buildingDepth + 0.12, 0x365844);
      band.position.set(building.position.x, floor * 3.1 - 0.15, building.position.z);
      root.add(band);
    }
    const roof = box(buildingWidth * 0.86, 0.45, buildingDepth * 0.86, 0x6a5540);
    roof.position.set(building.position.x, height + 0.22, building.position.z);
    roof.castShadow = true;
    root.add(roof);
  }
  return root;
}

function applyEnvironment(engine: Engine, mode: StudioEnvironment) {
  const bg = mode === "night" ? 0x26352d : mode === "neutral" ? 0xe7e0d2 : 0xc7d6c5;
  engine.scene.background = new THREE.Color(bg);
  engine.hemi.intensity = mode === "night" ? 0.75 : mode === "neutral" ? 1.45 : 1.8;
  engine.sun.intensity = mode === "night" ? 0.8 : mode === "neutral" ? 1.4 : 2.2;
  engine.sun.color.set(mode === "night" ? 0xe5d3aa : 0xfff2d3);
  engine.renderer.toneMappingExposure = mode === "night" ? 0.85 : 1;
}

function frame(engine: Engine) {
  const f = framingFromObject(engine.content, 42, engine.camera.aspect || 16 / 9);
  engine.camera.position.copy(f.position);
  engine.camera.near = f.near;
  engine.camera.far = f.far;
  engine.camera.updateProjectionMatrix();
  engine.controls.target.copy(f.target);
  engine.controls.minDistance = f.minDistance;
  engine.controls.maxDistance = f.maxDistance;
  engine.controls.update();
}

function frameSite(engine: Engine, widthM: number, depthM: number) {
  void widthM;
  void depthM;
  frame(engine);
}

function applyPreset(engine: Engine, preset: CameraPreset) {
  const bounds = new THREE.Box3().setFromObject(engine.content);
  if (bounds.isEmpty()) return;
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  const size = bounds.getSize(new THREE.Vector3());
  const { position, target } = presetPosition(preset, sphere.center, sphere.radius, size.y);
  engine.camera.position.copy(position);
  engine.camera.near = 0.05;
  engine.camera.far = Math.max(5000, sphere.radius * 20);
  engine.camera.updateProjectionMatrix();
  engine.controls.minDistance = 0.5;
  engine.controls.target.copy(target);
  engine.controls.update();
}

function renderCapability(engine: Engine): RenderCapability {
  const gl = engine.renderer.getContext();
  const maxRb = Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)) || 0;
  const dims = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array | number[] | null;
  const maxTex = engine.renderer.capabilities.maxTextureSize || 0;
  const maxWidth = Math.min(maxRb, maxTex, dims ? Number(dims[0]) : maxRb);
  const maxHeight = Math.min(maxRb, maxTex, dims ? Number(dims[1]) : maxRb);
  return { maxWidth, maxHeight, supports8k: maxWidth >= 7680 && maxHeight >= 4320 };
}

async function captureFrame(engine: Engine, width: number, height: number): Promise<Blob> {
  const cap = renderCapability(engine);
  if (width > cap.maxWidth || height > cap.maxHeight) {
    throw new Error(
      `This device's graphics renderer supports at most ${cap.maxWidth} × ${cap.maxHeight} px.`,
    );
  }
  const { renderer, scene, camera } = engine;
  const target = new THREE.WebGLRenderTarget(width, height, {
    samples: Math.min(4, renderer.capabilities.maxSamples || 0),
    colorSpace: THREE.SRGBColorSpace,
  });
  const prevAspect = camera.aspect;
  const prevShadow = engine.sun.shadow.mapSize.x;
  try {
    engine.sun.shadow.mapSize.set(4096, 4096);
    engine.sun.shadow.map?.dispose();
    engine.sun.shadow.map = null;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const pixels = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx || canvas.width !== width)
      throw new Error("The browser could not allocate this image size.");
    const img = ctx.createImageData(width, height);
    const row = width * 4;
    for (let y = 0; y < height; y += 1) {
      img.data.set(pixels.subarray((height - 1 - y) * row, (height - y) * row), y * row);
    }
    ctx.putImageData(img, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Image encoding failed."))),
        "image/png",
      ),
    );
  } finally {
    renderer.setRenderTarget(null);
    target.dispose();
    engine.sun.shadow.mapSize.set(prevShadow, prevShadow);
    engine.sun.shadow.map?.dispose();
    engine.sun.shadow.map = null;
    camera.aspect = prevAspect;
    camera.updateProjectionMatrix();
  }
}

export default function StudioViewerInternal(props: StudioViewerProps) {
  const {
    concept,
    widthM,
    depthM,
    topology,
    environment,
    rotationDeg,
    scalePct,
    showParking,
    showLandscape,
    fitToken,
    generated,
    onState,
    onApi,
  } = props;
  const onApiRef = useRef(onApi);
  onApiRef.current = onApi;
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const requestRef = useRef(0);
  const onStateRef = useRef(onState);
  onStateRef.current = onState;
  const generatedUse = generated?.use;
  const generatedFloors = generated?.floors;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      onApiRef.current?.(null);
      onStateRef.current?.({
        loading: false,
        error:
          "3D rendering is unavailable in this browser. Enable hardware acceleration or use another supported browser. Your concept inputs remain available.",
      });
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 5000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.03;
    const hemi = new THREE.HemisphereLight(0xf6f0df, 0x594c39, 1.8);
    const sun = new THREE.DirectionalLight(0xfff2d3, 2.2);
    sun.position.set(35, 55, 24);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    const content = new THREE.Group();
    scene.add(hemi, sun, content);
    const engine = { renderer, scene, camera, controls, content, sun, hemi };
    engineRef.current = engine;
    applyEnvironment(engine, "day");
    onApiRef.current?.({
      setView: (preset) => applyPreset(engine, preset),
      capability: () => renderCapability(engine),
      capture: (w, h) => captureFrame(engine, w, h),
    });

    const resize = () => {
      const width = host.clientWidth || 640;
      const height = host.clientHeight || 520;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (content.children.length > 0) frame(engine);
      renderer.render(scene, camera);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();
    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });
    return () => {
      requestRef.current += 1;
      onApiRef.current?.(null);
      ro.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      disposeSubtree(content);
      renderer.dispose();
      renderer.domElement.remove();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (engine) applyEnvironment(engine, environment);
  }, [environment]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const token = ++requestRef.current;
    const controller = new AbortController();
    onStateRef.current?.({ loading: true, error: null });
    for (const child of [...engine.content.children]) disposeSubtree(child);
    const site = makeSite(widthM, depthM, topology, showParking, showLandscape);
    engine.content.add(site);
    if (generatedUse && generatedFloors) {
      const massing = makeGeneratedMassing(widthM, depthM, generatedUse, generatedFloors);
      massing.rotation.y = THREE.MathUtils.degToRad(rotationDeg);
      massing.scale.setScalar(scalePct / 100);
      engine.content.add(massing);
      frameSite(engine, widthM, depthM);
      engine.renderer.render(engine.scene, engine.camera);
      onStateRef.current?.({ loading: false, error: null });
      return () => controller.abort();
    }
    frameSite(engine, widthM, depthM);

    loadGlbBytes(concept.modelUrl, { signal: controller.signal, retries: 1 })
      .then(
        (bytes) =>
          new Promise<THREE.Group>((resolve, reject) => {
            new GLTFLoader().parse(bytes, "", (gltf) => resolve(gltf.scene), reject);
          }),
      )
      .then((model) => {
        if (token !== requestRef.current) {
          disposeSubtree(model);
          return;
        }
        if (!hasRenderableMesh(model))
          throw new Error("This concept file contains no visible mesh.");
        model.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });
        const wrapper = new THREE.Group();
        wrapper.name = "placed-concept";
        wrapper.add(model);
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const centre = bounds.getCenter(new THREE.Vector3());
        const targetWidth = Math.min(widthM * 0.52, Math.sqrt(concept.authoredFootprintSqm) * 1.2);
        const targetDepth = Math.min(depthM * 0.52, concept.authoredFootprintSqm / targetWidth);
        const authored = Math.max(size.x || 1, size.z || 1);
        const target = Math.max(targetWidth, targetDepth);
        const scale = (target / authored) * (scalePct / 100);
        wrapper.scale.setScalar(scale);
        model.position.set(-centre.x, -bounds.min.y, -centre.z);
        wrapper.rotation.y = THREE.MathUtils.degToRad(rotationDeg);
        wrapper.position.set(widthM * 0.04, 0.08, -depthM * 0.06);
        engine.content.add(wrapper);
        frameSite(engine, widthM, depthM);
        engine.renderer.render(engine.scene, engine.camera);
        onStateRef.current?.({ loading: false, error: null });
      })
      .catch((error: unknown) => {
        if ((error as Error)?.name === "AbortError" || token !== requestRef.current) return;
        onStateRef.current?.({
          loading: false,
          error: (error as Error)?.message || "The concept model could not be opened.",
        });
      });
    return () => controller.abort();
  }, [
    concept,
    widthM,
    depthM,
    topology,
    rotationDeg,
    scalePct,
    showParking,
    showLandscape,
    generatedUse,
    generatedFloors,
  ]);

  useEffect(() => {
    const engine = engineRef.current;
    if (engine && engine.content.children.length) frame(engine);
  }, [fitToken]);

  return <div ref={hostRef} className="h-full w-full" data-testid="design-studio-canvas" />;
}
