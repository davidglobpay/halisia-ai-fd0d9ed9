import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { disposeSubtree, hasRenderableMesh } from "./disposal";
import { framingFromObject, tabletopScale } from "./framing";
import {
  GlbLoadError,
  humanBytes,
  loadGlbBytes,
  type LoadProgress,
  type LoadState,
} from "./loader";
import type { ModelLabEntry } from "./registry";
import { MODEL_LAB_DISCLAIMER } from "./registry";

export type EnvMode = "day" | "night" | "neutral";
export type PresentationMode = "AUTHORED_SCALE" | "TABLETOP" | "USER_ADJUSTED";

export type ViewerStatus = {
  state: LoadState;
  message: string;
  progress: number | null;
  bytes: string;
  meshes: number;
  triangles: number;
  maxExtentM: number | null;
  xr: {
    arSupported: boolean | null;
    vrSupported: boolean | null;
    inSession: boolean;
    hitTest: boolean;
    placed: boolean;
    note: string;
  };
  contextLost: boolean;
};

export type ViewerApi = {
  reset: () => void;
  fit: () => void;
  setAutoRotate: (on: boolean) => void;
  enterAr: () => void;
  enterVr: () => void;
  exitXr: () => void;
  replace: () => void;
  setPresentation: (m: PresentationMode) => void;
  nudgeScale: (factor: number) => void;
  rotatePlaced: (rad: number) => void;
};

export type ModelLabViewerProps = {
  model: ModelLabEntry;
  env: EnvMode;
  autoRotate: boolean;
  onStatus: (s: ViewerStatus) => void;
  onApi?: (api: ViewerApi | null) => void;
  onUserInteract?: () => void;
  /**
   * Element used as the WebXR dom-overlay root during an immersive AR session.
   * Without a granted dom-overlay, no HTML control is visible in-session.
   */
  overlayRootRef?: { current: HTMLElement | null };
};

const EMPTY_STATUS: ViewerStatus = {
  state: "IDLE",
  message: "Idle.",
  progress: null,
  bytes: "unknown size",
  meshes: 0,
  triangles: 0,
  maxExtentM: null,
  xr: {
    arSupported: null,
    vrSupported: null,
    inSession: false,
    hitTest: false,
    placed: false,
    note: "",
  },
  contextLost: false,
};

export default function ModelLabViewer({
  model,
  env,
  autoRotate,
  onStatus,
  onApi,
  onUserInteract,
}: ModelLabViewerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef(onStatus);
  statusRef.current = onStatus;
  const apiCbRef = useRef(onApi);
  apiCbRef.current = onApi;
  const interactRef = useRef(onUserInteract);
  interactRef.current = onUserInteract;

  const [live, setLive] = useState("");

  // Mutable engine handles, stable across renders.
  const engine = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    modelRoot: THREE.Group;
    arRoot: THREE.Group;
    reticle: THREE.Mesh;
    lights: THREE.Group;
    status: ViewerStatus;
    presentation: PresentationMode;
    userScale: number;
    baseFit: { position: THREE.Vector3; target: THREE.Vector3 } | null;
    hitTestSource: XRHitTestSource | null;
    refSpace: XRReferenceSpace | null;
    session: XRSession | null;
    loadToken: number;
  } | null>(null);

  const push = useCallback((patch: Partial<ViewerStatus>) => {
    const e = engine.current;
    if (!e) return;
    e.status = { ...e.status, ...patch, xr: { ...e.status.xr, ...(patch.xr ?? {}) } };
    statusRef.current?.({ ...e.status });
  }, []);

  /* ---------------------------------------------------------------- engine */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch (err) {
      statusRef.current?.({
        ...EMPTY_STATUS,
        state: "FAILED_WEBGL",
        message: `WebGL is unavailable in this browser: ${(err as Error)?.message ?? "unknown error"}`,
      });
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.xr.enabled = true;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute("aria-label", "Interactive 3D architectural model viewer");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 2000);
    camera.position.set(8, 5, 10);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

    const modelRoot = new THREE.Group();
    const arRoot = new THREE.Group();
    arRoot.visible = false;
    const lights = new THREE.Group();
    scene.add(modelRoot, arRoot, lights);

    const reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.09, 0.11, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x147b35 }),
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    engine.current = {
      renderer,
      scene,
      camera,
      controls,
      modelRoot,
      arRoot,
      reticle,
      lights,
      status: { ...EMPTY_STATUS },
      presentation: "TABLETOP",
      userScale: 1,
      baseFit: null,
      hitTestSource: null,
      refSpace: null,
      session: null,
      loadToken: 0,
    };

    /* -------- resize */
    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || Math.round((w * 9) / 16) || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    window.addEventListener("orientationchange", resize);
    resize();

    /* -------- context loss */
    const onLost = (ev: Event) => {
      ev.preventDefault();
      push({ contextLost: true, state: "FAILED_WEBGL", message: "The WebGL context was lost (usually GPU memory pressure). Press “Restore renderer” to rebuild the scene." });
      setLive("WebGL context lost.");
    };
    const onRestored = () => {
      push({ contextLost: false, message: "WebGL context restored — reloading the model." });
      setLive("WebGL context restored.");
      void loadModel(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", onLost as EventListener, false);
    renderer.domElement.addEventListener("webglcontextrestored", onRestored, false);

    /* -------- interaction cancels auto-rotate */
    const onStart = () => interactRef.current?.();
    controls.addEventListener("start", onStart);

    /* -------- XR support probe */
    const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
    if (xr?.isSessionSupported) {
      void xr
        .isSessionSupported("immersive-ar")
        .then((v) => push({ xr: { ...engine.current!.status.xr, arSupported: v } }))
        .catch(() => push({ xr: { ...engine.current!.status.xr, arSupported: false } }));
      void xr
        .isSessionSupported("immersive-vr")
        .then((v) => push({ xr: { ...engine.current!.status.xr, vrSupported: v } }))
        .catch(() => push({ xr: { ...engine.current!.status.xr, vrSupported: false } }));
    } else {
      push({
        xr: {
          ...EMPTY_STATUS.xr,
          arSupported: false,
          vrSupported: false,
          note: "This browser does not expose the WebXR Device API.",
        },
      });
    }

    /* -------- animation loop */
    let spin = false;
    const clock = new THREE.Clock();
    renderer.setAnimationLoop((_t, frame) => {
      const e = engine.current;
      if (!e) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      if (frame && e.session) tickXr(frame);
      else {
        if (spin) e.modelRoot.rotation.y += dt * 0.35;
        e.controls.update();
      }
      e.renderer.render(e.scene, e.camera);
    });

    const setSpin = (on: boolean) => {
      spin = on;
    };
    spinSetter.current = setSpin;

    return () => {
      const e = engine.current;
      engine.current = null;
      apiCbRef.current?.(null);
      controls.removeEventListener("start", onStart);
      renderer.domElement.removeEventListener("webglcontextlost", onLost as EventListener);
      renderer.domElement.removeEventListener("webglcontextrestored", onRestored);
      ro.disconnect();
      window.removeEventListener("orientationchange", resize);
      abortRef.current?.abort();
      abortRef.current = null;
      if (e) {
        e.hitTestSource?.cancel?.();
        e.session?.end?.().catch(() => undefined);
        disposeSubtree(e.modelRoot);
        disposeSubtree(e.arRoot);
        disposeSubtree(e.reticle);
        disposeSubtree(e.lights);
        e.controls.dispose();
      }
      renderer.setAnimationLoop(null);
      renderer.dispose();
      renderer.domElement.remove();
    };
    // Engine bootstrap must never rerun because a callback prop changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spinSetter = useRef<((on: boolean) => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* ----------------------------------------------------------- lighting */
  const applyEnv = useCallback((mode: EnvMode) => {
    const e = engine.current;
    if (!e) return;
    disposeSubtree(e.lights);
    const g = new THREE.Group();
    e.lights = g;
    e.scene.add(g);

    if (mode === "day") {
      e.scene.background = new THREE.Color(0xdfe9f2);
      e.renderer.toneMappingExposure = 1.05;
      g.add(new THREE.HemisphereLight(0xffffff, 0x8f8b7a, 2.1));
      const sun = new THREE.DirectionalLight(0xfff3dd, 2.4);
      sun.position.set(40, 70, 30);
      g.add(sun);
    } else if (mode === "night") {
      e.scene.background = new THREE.Color(0x0d1420);
      e.renderer.toneMappingExposure = 1.25;
      g.add(new THREE.HemisphereLight(0x35507a, 0x0a0f16, 0.9));
      const moon = new THREE.DirectionalLight(0xbcd2ff, 0.9);
      moon.position.set(-30, 50, -20);
      g.add(moon);
      const fill = new THREE.PointLight(0xffd9a0, 12, 60, 2);
      fill.position.set(0, 6, 0);
      g.add(fill);
    } else {
      e.scene.background = new THREE.Color(0xf1ece0);
      e.renderer.toneMappingExposure = 1;
      g.add(new THREE.HemisphereLight(0xffffff, 0x9a9484, 2.4));
      const key = new THREE.DirectionalLight(0xffffff, 1.4);
      key.position.set(20, 40, 25);
      g.add(key);
      const rim = new THREE.DirectionalLight(0xffffff, 0.6);
      rim.position.set(-25, 20, -30);
      g.add(rim);
    }
  }, []);

  useEffect(() => {
    applyEnv(env);
  }, [env, applyEnv]);

  useEffect(() => {
    spinSetter.current?.(autoRotate);
  }, [autoRotate]);

  /* -------------------------------------------------------------- loading */
  const fit = useCallback(() => {
    const e = engine.current;
    if (!e || e.modelRoot.children.length === 0) return;
    const f = framingFromObject(e.modelRoot, e.camera.fov, e.camera.aspect);
    e.camera.position.copy(f.position);
    e.camera.near = f.near;
    e.camera.far = f.far;
    e.camera.updateProjectionMatrix();
    e.controls.target.copy(f.target);
    e.controls.minDistance = f.minDistance;
    e.controls.maxDistance = f.maxDistance;
    e.controls.update();
    e.baseFit = { position: f.position.clone(), target: f.target.clone() };
    push({ maxExtentM: Number(f.maxExtent.toFixed(2)) });
  }, [push]);

  const loadModel = useCallback(
    async (isReload: boolean) => {
      const e = engine.current;
      if (!e) return;
      const token = ++e.loadToken;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      disposeSubtree(e.modelRoot);
      const fresh = new THREE.Group();
      e.modelRoot = fresh;
      e.scene.add(fresh);

      push({
        state: "CHECKING",
        progress: null,
        message: isReload ? `Reloading ${model.file}…` : `Checking ${model.file}…`,
        meshes: 0,
        triangles: 0,
        maxExtentM: null,
      });
      setLive(`Loading ${model.name}.`);

      try {
        const bytes = await loadGlbBytes(model.glbUrl, {
          signal: ctrl.signal,
          timeoutMs: 30_000,
          retries: 2,
          onProgress: (p: LoadProgress) => {
            if (engine.current?.loadToken !== token) return;
            push({
              state: p.state,
              progress: p.ratio,
              bytes: humanBytes(p.totalBytes ?? p.loadedBytes),
              message:
                p.state === "CHECKING"
                  ? `Checking ${model.file}…`
                  : p.ratio == null
                    ? `Downloading ${model.file} — size unknown, progress cannot be shown as a percentage.`
                    : `Downloading ${model.file} — ${Math.round(p.ratio * 100)}%`,
            });
          },
        });

        if (engine.current?.loadToken !== token) return; // stale request

        push({ state: "PARSING", progress: null, message: `Parsing ${model.file}…` });
        const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
          new GLTFLoader().parse(bytes.slice(0), "", (g) => resolve(g as unknown as { scene: THREE.Group }), reject);
        });

        if (engine.current?.loadToken !== token) {
          disposeSubtree(gltf.scene);
          return;
        }
        if (!hasRenderableMesh(gltf.scene)) {
          disposeSubtree(gltf.scene);
          push({
            state: "FAILED_ASSET",
            progress: null,
            message: `${model.file} parsed successfully but contains no renderable meshes.`,
          });
          setLive("Model contains no renderable meshes.");
          return;
        }

        // Wrap rather than mutate: authored transforms are preserved.
        const wrapper = new THREE.Group();
        wrapper.add(gltf.scene);
        fresh.add(wrapper);

        let meshes = 0;
        let triangles = 0;
        gltf.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh && m.geometry) {
            meshes += 1;
            const idx = m.geometry.getIndex();
            const pos = m.geometry.getAttribute("position");
            triangles += Math.floor((idx ? idx.count : (pos?.count ?? 0)) / 3);
          }
        });

        fit();
        push({
          state: "READY",
          progress: 1,
          message: `${model.name} loaded from ${model.file}.`,
          meshes,
          triangles,
        });
        setLive(`${model.name} loaded.`);
      } catch (err) {
        if (engine.current?.loadToken !== token) return;
        if ((err as Error)?.name === "AbortError") return;
        const state = err instanceof GlbLoadError ? err.state : "FAILED_ASSET";
        const message =
          err instanceof GlbLoadError
            ? err.message
            : `${model.file} could not be parsed as binary glTF: ${(err as Error)?.message ?? "unknown error"}`;
        push({ state, progress: null, message });
        setLive(`Failed to load ${model.name}.`);
      }
      // model is intentionally the only dependency that should retrigger loads
    },
    [model, fit, push],
  );

  useEffect(() => {
    if (!engine.current) return;
    void loadModel(false);
  }, [loadModel]);

  /* ------------------------------------------------------------------- XR */
  const tickXr = useCallback((frame: XRFrame) => {
    const e = engine.current;
    if (!e || !e.refSpace) return;
    if (e.hitTestSource && !e.status.xr.placed) {
      const results = frame.getHitTestResults(e.hitTestSource);
      const hit = results[0];
      const pose = hit?.getPose(e.refSpace);
      if (pose) {
        e.reticle.visible = true;
        e.reticle.matrix.fromArray(pose.transform.matrix);
      } else {
        e.reticle.visible = false;
      }
    }
  }, []);

  const applyPresentation = useCallback(() => {
    const e = engine.current;
    if (!e) return;
    const f = framingFromObject(e.arRoot.children[0] ?? e.arRoot);
    const base =
      e.presentation === "AUTHORED_SCALE" ? 1 : tabletopScale(f.maxExtent, 0.5);
    const s = base * (e.presentation === "USER_ADJUSTED" ? e.userScale : 1);
    e.arRoot.scale.setScalar(s > 0 && Number.isFinite(s) ? s : 1);
  }, []);

  const enterXr = useCallback(
    async (mode: "immersive-ar" | "immersive-vr") => {
      const e = engine.current;
      if (!e) return;
      push({ xr: { ...e.status.xr, note: "" } }); // clear stale error first
      const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
      if (!xr) {
        push({ state: "AR_UNAVAILABLE", message: "WebXR is not available in this browser.", xr: { ...e.status.xr, note: "WebXR Device API missing." } });
        return;
      }
      try {
        const supported = await xr.isSessionSupported(mode);
        if (!supported) {
          push({
            state: "AR_UNAVAILABLE",
            message: `This device or browser does not support ${mode === "immersive-ar" ? "immersive AR" : "immersive VR"}.`,
            xr: { ...e.status.xr, note: "Session mode unsupported." },
          });
          return;
        }
        const session = await xr.requestSession(mode, {
          requiredFeatures: ["local-floor"],
          optionalFeatures: mode === "immersive-ar" ? ["hit-test", "dom-overlay"] : [],
          ...(mode === "immersive-ar" && typeof document !== "undefined"
            ? { domOverlay: { root: document.body } }
            : {}),
        });
        e.session = session;
        await e.renderer.xr.setSession(session);
        const refSpace = await session.requestReferenceSpace("local-floor");
        e.refSpace = refSpace;

        // Move the real loaded scene into the AR/VR wrapper — never a proxy.
        const child = e.modelRoot.children[0];
        if (child) e.arRoot.add(child);
        e.arRoot.visible = mode === "immersive-vr";
        applyPresentation();

        let hitTest = false;
        if (mode === "immersive-ar") {
          try {
            const viewerSpace = await session.requestReferenceSpace("viewer");
            const source = await session.requestHitTestSource?.({ space: viewerSpace });
            if (source) {
              e.hitTestSource = source;
              hitTest = true;
            }
          } catch {
            hitTest = false;
          }
          if (!hitTest) {
            // Viewer-relative fallback — explicitly NOT ground anchoring.
            e.arRoot.position.set(0, -0.3, -1.2);
            e.arRoot.visible = true;
          }
        }

        const onSelect = () => {
          const en = engine.current;
          if (!en || !en.hitTestSource) return;
          if (!en.reticle.visible) return;
          en.arRoot.position.setFromMatrixPosition(en.reticle.matrix);
          en.arRoot.visible = true;
          en.reticle.visible = false;
          push({ xr: { ...en.status.xr, placed: true } });
        };
        session.addEventListener("select", onSelect);

        const onEnd = () => {
          const en = engine.current;
          session.removeEventListener("select", onSelect);
          if (!en) return;
          en.hitTestSource?.cancel?.();
          en.hitTestSource = null;
          en.refSpace = null;
          en.session = null;
          en.reticle.visible = false;
          const back = en.arRoot.children[0];
          if (back) en.modelRoot.add(back);
          en.arRoot.visible = false;
          en.arRoot.position.set(0, 0, 0);
          en.arRoot.rotation.set(0, 0, 0);
          en.arRoot.scale.setScalar(1);
          push({ xr: { ...en.status.xr, inSession: false, placed: false, hitTest: false, note: "" } });
          setLive("Immersive session ended.");
        };
        session.addEventListener("end", onEnd, { once: true });

        push({
          xr: {
            ...e.status.xr,
            inSession: true,
            hitTest,
            placed: false,
            note: hitTest
              ? MODEL_LAB_DISCLAIMER
              : `Surface anchoring unavailable on this device. ${MODEL_LAB_DISCLAIMER}`,
          },
        });
        setLive("Immersive session started.");
      } catch (err) {
        push({
          state: "AR_UNAVAILABLE",
          message: `Could not start the immersive session: ${(err as Error)?.message ?? "unknown error"}`,
          xr: { ...engine.current!.status.xr, inSession: false, note: (err as Error)?.name ?? "" },
        });
      }
    },
    [applyPresentation, push],
  );

  /* ------------------------------------------------------------- imperative */
  useEffect(() => {
    const api: ViewerApi = {
      reset: () => {
        const e = engine.current;
        if (!e) return;
        e.userScale = 1;
        if (e.baseFit) {
          e.camera.position.copy(e.baseFit.position);
          e.controls.target.copy(e.baseFit.target);
          e.controls.update();
        } else fit();
        e.modelRoot.rotation.set(0, 0, 0);
      },
      fit,
      setAutoRotate: (on) => spinSetter.current?.(on),
      enterAr: () => void enterXr("immersive-ar"),
      enterVr: () => void enterXr("immersive-vr"),
      exitXr: () => void engine.current?.session?.end().catch(() => undefined),
      replace: () => {
        const e = engine.current;
        if (!e) return;
        e.arRoot.visible = false;
        push({ xr: { ...e.status.xr, placed: false } });
      },
      setPresentation: (m) => {
        const e = engine.current;
        if (!e) return;
        e.presentation = m;
        applyPresentation();
      },
      nudgeScale: (factor) => {
        const e = engine.current;
        if (!e) return;
        e.userScale = Math.min(20, Math.max(0.05, e.userScale * factor));
        e.presentation = "USER_ADJUSTED";
        applyPresentation();
      },
      rotatePlaced: (rad) => {
        const e = engine.current;
        if (e) e.arRoot.rotation.y += rad;
      },
    };
    apiCbRef.current?.(api);
    return () => apiCbRef.current?.(null);
  }, [fit, enterXr, applyPresentation, push]);

  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} className="h-full w-full" data-testid="model-lab-canvas-host" />
      <p aria-live="polite" role="status" className="sr-only">
        {live}
      </p>
    </div>
  );
}
