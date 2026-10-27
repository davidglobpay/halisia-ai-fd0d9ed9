import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";

import { getElevationSamples } from "@/lib/elevation.functions";
import { KitButton } from "@/components/halisia/ds/button";
import { disposeSubtree } from "../disposal";
import { QUICK_LOOK_UNAVAILABLE_MESSAGE, labPlatformFromUA, type LabPlatform } from "../device";
import { buildHouse } from "./house-geometry";
import { SCHEMATIC_LABEL, structureLabel } from "./house-spec";
import type { SiteParams } from "./site-params";
import { heightAt, loadSiteTerrain, siteDisclaimer, type SiteTerrain } from "./site-terrain";
import { eatInstant, solarPosition, sunDirection } from "./solar";

const EYE_M = 1.6;
const BODY_M = 1.75;
const RADIUS_M = 0.25;
const WALK_SPEED = 1.6; // m/s

type Engine = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  house: THREE.Group;
  colliders: THREE.Box3[];
  ground: THREE.Group | null;
  floors: THREE.Object3D[];
  terrain: SiteTerrain | null;
  yaw: number;
  pitch: number;
  baseRef: XRReferenceSpace | null;
};

function todayIso() {
  const d = new Date(Date.now() + 3 * 3600_000);
  return d.toISOString().slice(0, 10);
}

export default function SiteViewer({ params }: { params: SiteParams }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const eng = useRef<Engine | null>(null);
  const modeRef = useRef<"orbit" | "walk">("orbit");
  const keys = useRef(new Set<string>());
  const touchMove = useRef(0);

  const [terrain, setTerrain] = useState<SiteTerrain | null>(null);
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
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [usdzUrl, setUsdzUrl] = useState<string | null>(null);
  const [exportState, setExportState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [exportError, setExportError] = useState<string | null>(null);

  modeRef.current = mode;

  /* ---------------- engine (once) */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setPlatform(labPlatformFromUA(navigator.userAgent, navigator.maxTouchPoints));
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    scene.background = new THREE.Color(0xdfe9f2);
    scene.fog = new THREE.Fog(0xdfe9f2, 150, 900);
    const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.05, 3000);
    camera.rotation.order = "YXZ";
    camera.position.set(14, 9, 18);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = !reduced;
    controls.target.set(0, 1.2, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.05;

    const hemi = new THREE.HemisphereLight(0xe8f0ff, 0x6b5b40, 0.6);
    const sunLight = new THREE.DirectionalLight(0xfff4e0, 2.4);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    const sc = sunLight.shadow.camera as THREE.OrthographicCamera;
    sc.left = -30;
    sc.right = 30;
    sc.top = 30;
    sc.bottom = -30;
    sc.near = 1;
    sc.far = 200;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.04;
    scene.add(hemi, sunLight, sunLight.target);

    const built = buildHouse(params.structure, params.floorAreaM2);
    scene.add(built.group);
    const floors: THREE.Object3D[] = [];
    built.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.position.y < 0.1) floors.push(o);
    });

    eng.current = {
      renderer,
      scene,
      camera,
      controls,
      sun: sunLight,
      hemi,
      house: built.group,
      colliders: built.colliders,
      ground: null,
      floors,
      terrain: null,
      yaw: 0,
      pitch: 0,
      baseRef: null,
    };

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
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
      if (!["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) return;
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
      const t = new XRRigidTransform({ x: -p.x, y: -p.y, z: -p.z, w: 1 }, { x: 0, y: 0, z: 0, w: 1 });
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
        const hit = raycaster.intersectObjects([...(e.ground ? [e.ground] : []), ...e.floors], true)[0];
        if (hit) teleportTo(hit.point);
      });
      scene.add(ctrl);
    }
    const onSessionStart = () => {
      const e = eng.current;
      if (!e) return;
      e.baseRef = renderer.xr.getReferenceSpace();
      const start = new THREE.Vector3(0, e.terrain ? heightAt(e.terrain, 0, 9) : 0, 9);
      teleportTo(start);
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
          const t = e.terrain;
          const feetAt = (x: number, z: number) => (t ? heightAt(t, x, z) : 0);
          if (dx && !blocked(p.x + dx, p.z, feetAt(p.x + dx, p.z))) p.x += dx;
          if (dz && !blocked(p.x, p.z + dz, feetAt(p.x, p.z + dz))) p.z += dz;
          p.x = Math.max(-95, Math.min(95, p.x));
          p.z = Math.max(-95, Math.min(95, p.z));
          // Inside the house the slab is the floor.
          p.y = Math.max(feetAt(p.x, p.z), inside(e, p.x, p.z) ? 0.1 : -Infinity) + EYE_M;
          e.camera.rotation.set(e.pitch, e.yaw, 0, "YXZ");
        } else {
          e.controls.update();
        }
      }
      renderer.render(e.scene, e.camera);
    });

    return () => {
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
      void renderer.xr.getSession()?.end().catch(() => undefined);
      controls.dispose();
      disposeSubtree(scene);
      renderer.dispose();
      canvas.remove();
      eng.current = null;
    };
    // Engine is built once per mounted params set; the route remounts on change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- terrain (one request) */
  useEffect(() => {
    let alive = true;
    void loadSiteTerrain(params.lat, params.lng, (locations) =>
      getElevationSamples({ data: { locations } }),
    ).then((t) => {
      if (!alive) return;
      setTerrain(t);
      const e = eng.current;
      if (!e) return;
      if (e.ground) {
        e.scene.remove(e.ground);
        disposeSubtree(e.ground);
      }
      e.ground = buildGround(t);
      e.terrain = t;
      e.scene.add(e.ground);
    });
    return () => {
      alive = false;
    };
  }, [params.lat, params.lng]);

  /* ---------------- sun */
  useEffect(() => {
    const lat = params.lat ?? -1.2921;
    const lng = params.lng ?? 36.8219;
    const pos = solarPosition(eatInstant(date, hour), lat, lng);
    setSun({ az: pos.azimuthDeg, el: pos.elevationDeg });
    const e = eng.current;
    if (!e) return;
    const [x, y, z] = sunDirection(pos.azimuthDeg, pos.elevationDeg);
    e.sun.position.set(x * 80, y * 80, z * 80);
    e.sun.target.position.set(0, 0, 0);
    const up = pos.elevationDeg > 0;
    e.sun.intensity = up ? 2.4 * Math.min(1, pos.elevationDeg / 10 + 0.15) : 0;
    e.hemi.intensity = up ? 0.6 : 0.15;
    const bg = up ? 0xdfe9f2 : 0x1b2433;
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
      const z = 9;
      e.camera.position.set(0, (e.terrain ? heightAt(e.terrain, 0, z) : 0) + EYE_M, z);
      e.yaw = 0;
      e.pitch = 0;
    } else {
      if (document.pointerLockElement) document.exitPointerLock();
      e.controls.enabled = true;
      e.camera.position.set(14, 9, 18);
      e.controls.target.set(0, 1.2, 0);
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

  const generateAr = useCallback(async () => {
    const e = eng.current;
    if (!e) return;
    setExportState("busy");
    setExportError(null);
    try {
      const glb = (await new GLTFExporter().parseAsync(e.house, { binary: true })) as ArrayBuffer;
      setGlbUrl(URL.createObjectURL(new Blob([glb], { type: "model/gltf-binary" })));
      try {
        const usdz = await new USDZExporter().parseAsync(e.house);
        setUsdzUrl(URL.createObjectURL(new Blob([usdz as BlobPart], { type: "model/vnd.usdz+zip" })));
      } catch {
        setUsdzUrl(null);
      }
      setExportState("done");
    } catch (err) {
      setExportState("error");
      setExportError((err as Error)?.message ?? "Export failed");
    }
  }, []);

  useEffect(
    () => () => {
      if (glbUrl) URL.revokeObjectURL(glbUrl);
    },
    [glbUrl],
  );
  useEffect(
    () => () => {
      if (usdzUrl) URL.revokeObjectURL(usdzUrl);
    },
    [usdzUrl],
  );

  const disclaimer = siteDisclaimer(terrain);
  const fileBase = `halisia-schematic-${params.typology}-${params.structure}`;

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
          <p data-testid="site-disclaimer">{disclaimer}</p>
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

      <div className="flex flex-wrap items-center gap-2">
        <KitButton size="sm" onClick={() => setMode(mode === "walk" ? "orbit" : "walk")}>
          {mode === "walk" ? "Exit walk mode" : "Walk mode"}
        </KitButton>
        <KitButton size="sm" onClick={() => void enterVr()} disabled={!vrSupported || inVr}>
          Enter VR
        </KitButton>
        <KitButton size="sm" onClick={() => void generateAr()} disabled={exportState === "busy"}>
          {exportState === "busy" ? "Generating…" : "Generate AR files"}
        </KitButton>
      </div>
      {mode === "walk" && (
        <p className="text-xs text-muted-foreground">
          {coarse
            ? "Drag to look; hold Forward or Back to move."
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

      {exportState === "done" && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {glbUrl && (
            <a className="underline" href={glbUrl} download={`${fileBase}.glb`}>
              Download GLB
            </a>
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
      )}
      {exportError && <p className="text-xs text-destructive">AR export failed: {exportError}</p>}

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
                ? `${terrain.dataset}, 10×10 grid over ~200 m, relief ${terrain.reliefM.toFixed(1)} m, house at mean ${terrain.meanM.toFixed(0)} m`
                : "flat plane (no terrain)"}
          </dd>
          <dt>VR</dt>
          <dd>{vrSupported === null ? "checking" : vrSupported ? "supported" : "not supported"}</dd>
          <dt>Scene Viewer</dt>
          <dd>
            {glbUrl
              ? "GLB generated locally; Scene Viewer needs a hosted HTTPS file, so this GLB is download-only"
              : "no GLB generated"}
          </dd>
          <dt>Quick Look</dt>
          <dd>{usdzUrl ? "USDZ generated" : `${QUICK_LOOK_UNAVAILABLE_MESSAGE} (QUICK_LOOK_UNAVAILABLE)`}</dd>
          <dt>iOS AR</dt>
          <dd>unverified on device</dd>
          <dt>Platform</dt>
          <dd>{platform}</dd>
        </dl>
      </details>
    </div>
  );
}

function inside(e: Engine, x: number, z: number) {
  const b = new THREE.Box3().setFromObject(e.house);
  return x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z;
}

function buildGround(t: SiteTerrain): THREE.Group {
  const group = new THREE.Group();
  group.name = "site-ground";
  if (t.kind === "terrain") {
    const n = t.n;
    const geo = new THREE.PlaneGeometry(t.spanM, t.spanM, n - 1, n - 1);
    geo.rotateX(-Math.PI / 2); // row 0 → north (−Z)
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, t.heights[Math.floor(i / n)][i % n]);
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: 0x6b7a4f, roughness: 0.97 }),
    );
    mesh.receiveShadow = true;
    group.add(mesh);
    const minH = Math.min(...t.heights.flat());
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x7c8466, roughness: 1 }),
    );
    apron.position.y = minH - 0.05;
    group.add(apron);
  } else {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x6f7360, roughness: 0.98 }),
    );
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
