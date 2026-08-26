import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  buildableEnvelope,
  enuToThree,
  gpsToLocal,
  polygonAreaSqm,
  sunPosition,
  sunVector,
  type SpatialParcel,
  type SpatialPrototype,
} from "@/lib/spatial";
import {
  disposeObjectTree,
  flatShapeGeometry,
  footprintExtrudeGeometry,
  ringToThreePoints,
  setbackRibbonGeometry,
  xrStartErrorMessage,
  type XrSessionMode,
  type XrStartStage,
} from "@/lib/spatial-three";

export type SpatialCanvasHandle = {
  startAr: () => Promise<void>;
  startVr: () => Promise<void>;
  endXr: () => void;
  resetView: () => void;
  /** Re-arm ground placement so the next tap re-anchors the twin. */
  resetPlacement: () => void;
};

/** Live AR placement state surfaced to the studio UI. */
export type ArPlacementState = {
  /** Hit-test source acquired for this session. */
  hitTest: boolean;
  /** A ground plane is currently detected under the reticle. */
  surfaceFound: boolean;
  /** The parcel twin has been anchored to the ground. */
  placed: boolean;
};

export type SpatialCanvasProps = {
  parcel: SpatialParcel;
  prototype: SpatialPrototype | null;
  /** Local Nairobi hour (decimal) driving the sun-path. */
  sunHour: number;
  dayOfYear: number;
  showBeacons: boolean;
  showSetback: boolean;
  showEnvelope: boolean;
  mode: "site" | "masterplan";
  reducedMotion: boolean;
  onXrStateChange?: (active: boolean, sessionMode?: "ar" | "vr") => void;
  onArPlacementChange?: (state: ArPlacementState) => void;
  handleRef?: Ref<SpatialCanvasHandle>;
};

type CanvasState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  sun: THREE.DirectionalLight;
  sunMarker: THREE.Mesh;
  content: THREE.Group;
  grid: THREE.GridHelper;
  reticle: THREE.Mesh;
  session: XRSession | null;
  onSelect: (() => void) | null;
  hitTestSource: XRHitTestSource | null;
  placed: boolean;
  surfaceFound: boolean;
  arMode: boolean;
};

export default function SpatialCanvasInternal({
  parcel,
  prototype,
  sunHour,
  dayOfYear,
  showBeacons,
  showSetback,
  showEnvelope,
  mode,
  reducedMotion,
  onXrStateChange,
  onArPlacementChange,
  handleRef,
}: SpatialCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  // Callbacks live in refs so a changing callback identity (e.g. an inline
  // prop from the route) can never retrigger the renderer bootstrap below.
  const placementCb = useRef(onArPlacementChange);
  placementCb.current = onArPlacementChange;
  const xrStateCb = useRef(onXrStateChange);
  xrStateCb.current = onXrStateChange;
  const motionRef = useRef(reducedMotion);
  motionRef.current = reducedMotion;
  const stateRef = useRef<CanvasState | null>(null);
  const [error, setError] = useState<string | null>(null);
  // GPU context loss (backgrounding mid-AR, incoming call, memory pressure).
  const [contextLost, setContextLost] = useState(false);
  // Bumped to force the geometry + sun effects to rebuild the scene.
  const [rebuildNonce, setRebuildNonce] = useState(0);
  // Live AR placement mirrored into React so the DOM overlay can show it.
  const [arPlacement, setArPlacement] = useState<ArPlacementState>({
    hitTest: false,
    surfaceFound: false,
    placed: false,
  });
  const [arSessionActive, setArSessionActive] = useState(false);
  // Requested session mode, captured before the session starts so the
  // "sessionstart" handler can report ar/vr instead of a null window.
  const pendingMode = useRef<XrSessionMode | null>(null);
  // Re-show the twin in front of the viewer when hit testing is unavailable.
  const showInFrontRef = useRef<(() => void) | null>(null);
  // Stable emitter: updates local overlay state and notifies the route.
  const emitRef = useRef<(s: ArPlacementState) => void>(() => {});
  emitRef.current = (s: ArPlacementState) => {
    setArPlacement(s);
    placementCb.current?.(s);
  };

  // ---- one-time scene bootstrap -------------------------------------------
  // Deps intentionally empty: the renderer must never be torn down because XR
  // state, callback identity or motion preference changed. Reactive values
  // are read through refs instead.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError("WebGL is unavailable on this device.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.xr.enabled = true;
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x050706, 120, 520);

    const camera = new THREE.PerspectiveCamera(
      55,
      mount.clientWidth / Math.max(mount.clientHeight, 1),
      0.1,
      2000,
    );
    camera.position.set(48, 42, 58);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !motionRef.current;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.HemisphereLight(0x9fd8c0, 0x0b0f0d, 0.75));
    const sun = new THREE.DirectionalLight(0xffe9b8, 1.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    scene.add(sun.target);

    const sunMarker = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0xd4af37 }),
    );
    scene.add(sunMarker);

    const grid = new THREE.GridHelper(400, 40, 0x008f55, 0x1b2a24);
    (grid.material as THREE.Material).opacity = 0.25;
    (grid.material as THREE.Material).transparent = true;
    scene.add(grid);

    const content = new THREE.Group();
    scene.add(content);

    // AR ground reticle — a flat ring that rides the detected surface.
    const reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.09, 0.12, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x00c2e8, side: THREE.DoubleSide }),
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    stateRef.current = {
      renderer,
      scene,
      camera,
      controls,
      sun,
      sunMarker,
      content,
      grid,
      reticle,
      session: null,
      onSelect: null,
      hitTestSource: null,
      placed: false,
      surfaceFound: false,
      arMode: false,
    };

    const onResize = () => {
      if (!mount.clientWidth) return;
      camera.aspect = mount.clientWidth / Math.max(mount.clientHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    let t = 0;
    const renderLoop: XRFrameRequestCallback = (_time, frame) => {
      t += 0.005;
      const st = stateRef.current;
      if (st?.arMode && frame) {
        const refSpace = renderer.xr.getReferenceSpace();
        if (st.hitTestSource && refSpace && !st.placed) {
          const hits = frame.getHitTestResults(st.hitTestSource);
          const hit = hits[0];
          const pose = hit?.getPose(refSpace);
          if (pose) {
            st.reticle.visible = true;
            st.reticle.matrix.fromArray(pose.transform.matrix);
            if (!st.surfaceFound) {
              st.surfaceFound = true;
              emitRef.current({ hitTest: true, surfaceFound: true, placed: false });
            }
          } else if (st.surfaceFound) {
            st.reticle.visible = false;
            st.surfaceFound = false;
            emitRef.current({ hitTest: true, surfaceFound: false, placed: false });
          }
        }
      }
      if (!motionRef.current) {
        content.children.forEach((child) => {
          if (child.userData["pulse"]) {
            const s = 1 + Math.sin(t * 3 + (child.userData["phase"] as number)) * 0.12;
            child.scale.setScalar(s);
          }
        });
      }
      if (!renderer.xr.isPresenting) controls.update();
      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(renderLoop);

    // ---- GPU context loss / restore ---------------------------------------
    const canvas = renderer.domElement;
    const onContextLost = (event: Event) => {
      event.preventDefault();
      renderer.setAnimationLoop(null);
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
      renderer.setAnimationLoop(renderLoop);
      // Force the geometry + sun effects to rebuild the scene graph.
      setRebuildNonce((n) => n + 1);
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    const onSessionEnd = () => {
      const st = stateRef.current;
      if (st) {
        try {
          st.hitTestSource?.cancel();
        } catch {
          /* source already released */
        }
        if (st.session && st.onSelect) st.session.removeEventListener("select", st.onSelect);
        st.session = null;
        st.onSelect = null;
        st.hitTestSource = null;
        st.placed = false;
        st.surfaceFound = false;
        st.arMode = false;
        st.reticle.visible = false;
        st.grid.visible = true;
        st.content.visible = true;
        st.content.position.set(0, 0, 0);
        st.content.quaternion.identity();
        st.content.scale.setScalar(1);
      }
      // Shadows are restored after the passthrough session.
      renderer.shadowMap.enabled = true;
      setArSessionActive(false);
      emitRef.current({ hitTest: false, surfaceFound: false, placed: false });
      // Single end-notification path (no per-session "end" listener).
      xrStateCb.current?.(false, pendingMode.current ?? undefined);
      pendingMode.current = null;
      showInFrontRef.current = null;
    };
    const onSessionStart = () => {
      const wanted = pendingMode.current ?? undefined;
      setArSessionActive(wanted === "ar");
      // Shadow mapping is pure cost on a 1.2 m passthrough twin.
      if (wanted === "ar") renderer.shadowMap.enabled = false;
      xrStateCb.current?.(true, wanted);
    };
    renderer.xr.addEventListener("sessionstart", onSessionStart);
    renderer.xr.addEventListener("sessionend", onSessionEnd);

    return () => {
      renderer.xr.removeEventListener("sessionstart", onSessionStart);
      renderer.xr.removeEventListener("sessionend", onSessionEnd);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      const st = stateRef.current;
      if (st?.session && st.onSelect) st.session.removeEventListener("select", st.onSelect);
      try {
        st?.hitTestSource?.cancel();
      } catch {
        /* source already released */
      }
      renderer.setAnimationLoop(null);
      ro.disconnect();
      controls.dispose();
      // Release GPU resources held by every mesh/line in the scene before the
      // renderer itself is disposed.
      disposeObjectTree(scene);
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  }, []);

  // Damping follows the reduced-motion preference without a renderer rebuild.
  useEffect(() => {
    const s = stateRef.current;
    if (s) s.controls.enableDamping = !reducedMotion;
  }, [reducedMotion]);

  // ---- parcel geometry ----------------------------------------------------
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    const { content } = s;
    // Free GPU resources of the previous build before swapping content.
    disposeObjectTree(content);
    content.clear();

    const env = buildableEnvelope(parcel);
    if (env.ring.length < 3) return;

    // Ground plate (convention baked into the geometry: north → −Z)
    const ground = new THREE.Mesh(
      flatShapeGeometry(env.ring),
      new THREE.MeshStandardMaterial({
        color: 0x0f1a15,
        roughness: 0.95,
        side: THREE.DoubleSide,
      }),
    );
    ground.position.y = 0;
    ground.receiveShadow = true;
    content.add(ground);

    // Parcel boundary
    content.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(ringToThreePoints(env.ring, 0.08)),
        new THREE.LineBasicMaterial({ color: 0x008f55 }),
      ),
    );

    // Setback ribbon (band between boundary and buildable footprint)
    if (showSetback && env.setbackM > 0) {
      const ribbon = new THREE.Mesh(
        setbackRibbonGeometry(env.ring, env.footprint),
        new THREE.MeshBasicMaterial({
          color: 0xe12635,
          transparent: true,
          opacity: 0.28,
          side: THREE.DoubleSide,
        }),
      );
      ribbon.position.y = 0.12;
      content.add(ribbon);
      content.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(ringToThreePoints(env.footprint, 0.16)),
          new THREE.LineDashedMaterial({ color: 0xe12635 }),
        ),
      );
    }

    // Zoning envelope — extruded buildable volume to the permitted height
    if (showEnvelope && env.footprint.length >= 3) {
      const geo = footprintExtrudeGeometry(env.footprint, env.heightM);
      const envelope = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: 0xaeb7bc,
          transparent: true,
          opacity: 0.14,
          roughness: 0.4,
        }),
      );
      envelope.position.y = 0;
      content.add(envelope);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.5 }),
      );
      content.add(edges);
    }

    // Beacon holograms
    if (showBeacons) {
      parcel.beacons.forEach((b, i) => {
        const local = gpsToLocal({ lat: b.lat, lng: b.lng }, parcel.centroid);
        const base = enuToThree(local, 2);
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.22, 4, 12, 1, true),
          new THREE.MeshBasicMaterial({
            color: 0x00c2e8,
            transparent: true,
            opacity: 0.55,
            side: THREE.DoubleSide,
          }),
        );
        pillar.position.set(base.x, base.y, base.z);
        content.add(pillar);
        const knob = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.85),
          new THREE.MeshBasicMaterial({ color: 0xd4af37 }),
        );
        knob.position.set(base.x, 4.4, base.z);
        knob.userData["pulse"] = true;
        knob.userData["phase"] = i;
        content.add(knob);
      });
    }

    // Selected massing prototype, centred on the buildable footprint
    if (prototype) {
      const foot = Math.max(prototype.footprintSqm ?? 0, 40);
      const buildable = polygonAreaSqm(env.footprint) || foot;
      const side = Math.sqrt(Math.min(foot, buildable * 0.85));
      const h = prototype.heightM ?? 8;
      const massing = new THREE.Mesh(
        new THREE.BoxGeometry(side, h, side),
        new THREE.MeshStandardMaterial({
          color: 0x008f55,
          transparent: true,
          opacity: 0.85,
          roughness: 0.5,
          metalness: 0.15,
        }),
      );
      massing.castShadow = true;
      massing.position.set(0, h / 2, 0);
      content.add(massing);
      content.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(side, h, side)),
          new THREE.LineBasicMaterial({ color: 0xd4af37 }),
        ).translateY(h / 2),
      );
      // Floor plates for the masterplan read
      const floors = prototype.floors ?? 1;
      for (let f = 1; f < floors; f++) {
        const plate = new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-side / 2, 0, -side / 2),
            new THREE.Vector3(side / 2, 0, -side / 2),
            new THREE.Vector3(side / 2, 0, side / 2),
            new THREE.Vector3(-side / 2, 0, side / 2),
          ]),
          new THREE.LineBasicMaterial({ color: 0xaeb7bc, transparent: true, opacity: 0.4 }),
        );
        plate.position.y = (h / floors) * f;
        content.add(plate);
      }
    }

    // Frame the parcel
    const box = new THREE.Box3().setFromObject(content);
    const size = box.getSize(new THREE.Vector3()).length() || 60;
    s.camera.position.set(size * 0.55, size * (mode === "masterplan" ? 0.75 : 0.45), size * 0.7);
    s.controls.target.set(0, mode === "masterplan" ? 6 : 2, 0);
    s.controls.update();
  }, [parcel, prototype, showBeacons, showSetback, showEnvelope, mode]);

  // ---- sun path -----------------------------------------------------------
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    const pos = sunPosition(parcel.centroid.lat, parcel.centroid.lng, dayOfYear, sunHour);
    const v = sunVector(pos);
    const dist = 160;
    s.sun.position.set(v.x * dist, Math.max(v.y, 0.05) * dist, v.z * dist);
    s.sun.intensity = pos.isDay ? 0.6 + Math.sin((pos.altitudeDeg * Math.PI) / 180) * 1.2 : 0.08;
    s.sun.color.setHex(pos.altitudeDeg < 12 ? 0xffb26b : 0xffe9b8);
    s.sunMarker.position.copy(s.sun.position).multiplyScalar(0.55);
    s.sunMarker.visible = pos.isDay;
    s.sun.target.position.set(0, 0, 0);
    s.sun.target.updateMatrixWorld();
  }, [sunHour, dayOfYear, parcel]);

  const enterXr = async (sessionMode: XrSessionMode) => {
    const s = stateRef.current;
    if (!s) return;
    // Clear any stale error before a new attempt so recovery is visible.
    setError(null);
    const fail = (stage: XrStartStage, err?: unknown): never => {
      const message = xrStartErrorMessage(sessionMode, stage, err);
      setError(message);
      throw new Error(message);
    };
    const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
    const wanted = sessionMode === "ar" ? "immersive-ar" : "immersive-vr";
    if (!xr) fail("no-webxr");
    const supported = await xr!.isSessionSupported(wanted).catch(() => false);
    if (!supported) fail("unsupported");
    const init: XRSessionInit =
      sessionMode === "ar"
        ? {
            requiredFeatures: ["local-floor"],
            optionalFeatures: ["hit-test", "dom-overlay"],
            ...(overlayRef.current ? { domOverlay: { root: overlayRef.current } } : {}),
          }
        : { optionalFeatures: ["local-floor", "bounded-floor"] };
    let session: XRSession;
    try {
      session = await xr!.requestSession(wanted, init);
    } catch (err) {
      fail("request-failed", err);
    }
    try {
      await s.renderer.xr.setSession(session!);
    } catch (err) {
      try {
        await session!.end();
      } catch {
        /* session already closed */
      }
      fail("request-failed", err);
    }
    // Successful start — make sure no stale overlay survives.
    setError(null);
    s.session = session!;
    s.arMode = sessionMode === "ar";
    if (s.arMode) {
      // Tabletop twin: scale the surveyed parcel to fit ~1.2 m so it can be
      // anchored on a floor or table in the user's room.
      const box = new THREE.Box3().setFromObject(s.content);
      const span = Math.max(box.getSize(new THREE.Vector3()).length(), 1);
      s.content.scale.setScalar(1.2 / span);
      s.content.visible = false;
      s.grid.visible = false;
      s.placed = false;
      s.surfaceFound = false;
      emitRef.current({ hitTest: false, surfaceFound: false, placed: false });
      const showInFront = () => {
        s.hitTestSource = null;
        s.content.visible = true;
        s.content.position.set(0, -0.4, -1.2);
        s.placed = true;
        emitRef.current({ hitTest: false, surfaceFound: false, placed: true });
      };
      try {
        const viewerSpace = await session!.requestReferenceSpace("viewer");
        const source = await session!.requestHitTestSource?.({ space: viewerSpace });
        s.hitTestSource = source ?? null;
        emitRef.current({
          hitTest: Boolean(source),
          surfaceFound: false,
          placed: false,
        });
        if (!source) {
          // No hit testing on this runtime — show the twin in front of the user.
          showInFront();
        }
      } catch {
        showInFront();
      }
      const onSelect = () => {
        const st = stateRef.current;
        if (!st || st.placed || !st.reticle.visible) return;
        st.content.position.setFromMatrixPosition(st.reticle.matrix);
        st.content.quaternion.setFromRotationMatrix(st.reticle.matrix);
        st.content.visible = true;
        st.reticle.visible = false;
        st.placed = true;
        emitRef.current({ hitTest: true, surfaceFound: true, placed: true });
      };
      s.onSelect = onSelect;
      session!.addEventListener("select", onSelect);
    }
    xrStateCb.current?.(true, sessionMode);
    session!.addEventListener("end", () => xrStateCb.current?.(false, sessionMode), {
      once: true,
    });
  };

  useImperativeHandle(
    handleRef,
    () => ({
      async startAr() {
        await enterXr("ar");
      },
      async startVr() {
        await enterXr("vr");
      },
      endXr() {
        void stateRef.current?.renderer.xr.getSession()?.end();
      },
      resetView() {
        const s = stateRef.current;
        if (!s) return;
        s.camera.position.set(48, 42, 58);
        s.controls.target.set(0, 2, 0);
        s.controls.update();
      },
      resetPlacement() {
        const s = stateRef.current;
        if (!s || !s.arMode) return;
        s.placed = false;
        s.surfaceFound = false;
        s.content.visible = false;
        emitRef.current({
          hitTest: Boolean(s.hitTestSource),
          surfaceFound: false,
          placed: false,
        });
      },
    }),
    [],
  );

  return (
    <div
      ref={mountRef}
      data-testid="spatial-canvas"
      className="absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full"
    >
      {/* DOM overlay surfaced inside the immersive AR session. */}
      <div ref={overlayRef} className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
        <p className="mx-auto max-w-md rounded-full bg-black/60 px-3 py-1.5 text-center text-[11px] text-white/85">
          Approximate spatial visualization — not a cadastral survey.
        </p>
      </div>
      {error && (
        <div
          data-testid="spatial-canvas-error"
          className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground"
        >
          {error}
        </div>
      )}
    </div>
  );
}
