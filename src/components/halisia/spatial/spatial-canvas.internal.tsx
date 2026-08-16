import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  buildableEnvelope,
  gpsToLocal,
  polygonAreaSqm,
  sunPosition,
  sunVector,
  type SpatialParcel,
  type SpatialPrototype,
  type Vec2,
} from "@/lib/spatial";

export type SpatialCanvasHandle = {
  startAr: () => Promise<void>;
  startVr: () => Promise<void>;
  endXr: () => void;
  resetView: () => void;
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
  handleRef?: Ref<SpatialCanvasHandle>;
};

function shapeFromRing(ring: Vec2[]): THREE.Shape {
  const shape = new THREE.Shape();
  ring.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y)));
  shape.closePath();
  return shape;
}

function ringToPoints(ring: Vec2[], y: number): THREE.Vector3[] {
  return [...ring, ring[0]!].map((p) => new THREE.Vector3(p.x, y, -p.y));
}

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
  handleRef,
}: SpatialCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    sun: THREE.DirectionalLight;
    sunMarker: THREE.Mesh;
    content: THREE.Group;
    rig: THREE.Group;
    grid: THREE.GridHelper;
    reticle: THREE.Mesh;
    hitTestSource: XRHitTestSource | null;
    sessionMode: "ar" | "vr" | null;
    placed: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [xrMode, setXrMode] = useState<"ar" | "vr" | null>(null);
  const [placedUi, setPlacedUi] = useState(false);
  const [xrScale, setXrScale] = useState(0.02);

  // ---- one-time scene bootstrap -------------------------------------------
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
    controls.enableDamping = !reducedMotion;
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

    stateRef.current = { renderer, scene, camera, controls, sun, sunMarker, content };

    const onResize = () => {
      if (!mount.clientWidth) return;
      camera.aspect = mount.clientWidth / Math.max(mount.clientHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    let t = 0;
    renderer.setAnimationLoop(() => {
      t += 0.005;
      if (!reducedMotion) {
        content.children.forEach((child) => {
          if (child.userData["pulse"]) {
            const s = 1 + Math.sin(t * 3 + (child.userData["phase"] as number)) * 0.12;
            child.scale.setScalar(s);
          }
        });
      }
      controls.update();
      renderer.render(scene, camera);
    });

    const onSessionEnd = () => onXrStateChange?.(false);
    const onSessionStart = () => onXrStateChange?.(true);
    renderer.xr.addEventListener("sessionstart", onSessionStart);
    renderer.xr.addEventListener("sessionend", onSessionEnd);

    return () => {
      renderer.xr.removeEventListener("sessionstart", onSessionStart);
      renderer.xr.removeEventListener("sessionend", onSessionEnd);
      renderer.setAnimationLoop(null);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  }, [reducedMotion, onXrStateChange]);

  // ---- parcel geometry ----------------------------------------------------
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    const { content } = s;
    content.clear();

    const env = buildableEnvelope(parcel);
    if (env.ring.length < 3) return;

    // Ground plate
    const ground = new THREE.Mesh(
      new THREE.ShapeGeometry(shapeFromRing(env.ring)),
      new THREE.MeshStandardMaterial({
        color: 0x0f1a15,
        roughness: 0.95,
        side: THREE.DoubleSide,
      }),
    );
    ground.rotation.x = Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    content.add(ground);

    // Parcel boundary
    content.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(ringToPoints(env.ring, 0.08)),
        new THREE.LineBasicMaterial({ color: 0x008f55 }),
      ),
    );

    // Setback ribbon (band between boundary and buildable footprint)
    if (showSetback && env.setbackM > 0) {
      const outer = shapeFromRing(env.ring);
      outer.holes.push(new THREE.Path(env.footprint.map((p) => new THREE.Vector2(p.x, p.y))));
      const ribbon = new THREE.Mesh(
        new THREE.ShapeGeometry(outer),
        new THREE.MeshBasicMaterial({
          color: 0xe12635,
          transparent: true,
          opacity: 0.28,
          side: THREE.DoubleSide,
        }),
      );
      ribbon.rotation.x = Math.PI / 2;
      ribbon.position.y = 0.12;
      content.add(ribbon);
      content.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(ringToPoints(env.footprint, 0.16)),
          new THREE.LineDashedMaterial({ color: 0xe12635 }),
        ),
      );
    }

    // Zoning envelope — extruded buildable volume to the permitted height
    if (showEnvelope && env.footprint.length >= 3) {
      const geo = new THREE.ExtrudeGeometry(shapeFromRing(env.footprint), {
        depth: env.heightM,
        bevelEnabled: false,
      });
      geo.rotateX(-Math.PI / 2);
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
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.22, 4, 12, 1, true),
          new THREE.MeshBasicMaterial({
            color: 0x00c2e8,
            transparent: true,
            opacity: 0.55,
            side: THREE.DoubleSide,
          }),
        );
        pillar.position.set(local.x, 2, -local.y);
        content.add(pillar);
        const knob = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.85),
          new THREE.MeshBasicMaterial({ color: 0xd4af37 }),
        );
        knob.position.set(local.x, 4.4, -local.y);
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

  useImperativeHandle(
    handleRef,
    () => ({
      async startAr() {
        const s = stateRef.current;
        const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
        if (!s || !xr) throw new Error("WebXR is not available in this browser.");
        const session = await xr.requestSession("immersive-ar", {
          requiredFeatures: ["local-floor"],
          optionalFeatures: ["hit-test", "dom-overlay"],
        });
        await s.renderer.xr.setSession(session);
        // Scale the parcel down to a tabletop model for room-scale AR.
        s.content.scale.setScalar(0.02);
        s.content.position.set(0, -0.6, -1.2);
        session.addEventListener("end", () => {
          s.content.scale.setScalar(1);
          s.content.position.set(0, 0, 0);
        });
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
    }),
    [],
  );

  return (
    <div
      ref={mountRef}
      data-testid="spatial-canvas"
      className="absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full"
    >
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
          {error}
        </div>
      )}
    </div>
  );
}