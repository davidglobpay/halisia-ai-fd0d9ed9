/**
 * Deterministic concept-massing viewer for the Design Studio.
 *
 * Three.js primitives only (boxes/planes) built from a pure MassingPlan — no
 * AI meshes, no GLB, nothing written to public/_massing. Framing and disposal
 * are reused from the Model Lab utilities; the Model Lab loader/XR session
 * code is not touched.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { framingFromObject } from "@/components/halisia/model-lab/framing";
import { disposeSubtree } from "@/components/halisia/model-lab/disposal";
import type { MassingPlan } from "@/lib/design-studio/core";

export type MassingViewerProps = {
  plan: MassingPlan | null;
  /** Bumping this re-frames the camera. */
  fitToken?: number;
  className?: string;
};

function buildPlan(plan: MassingPlan): THREE.Group {
  const root = new THREE.Group();
  root.name = "concept-massing";

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(plan.site.widthM, plan.site.depthM),
    new THREE.MeshStandardMaterial({ color: 0xe7e0d2, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  root.add(ground);

  const envelope = new THREE.Mesh(
    new THREE.PlaneGeometry(plan.envelope.widthM, plan.envelope.depthM),
    new THREE.MeshBasicMaterial({ color: 0x147b35, transparent: true, opacity: 0.16 }),
  );
  envelope.rotation.x = -Math.PI / 2;
  envelope.position.set(0, 0.02, plan.envelope.offsetZ);
  root.add(envelope);

  if (plan.parking) {
    const park = new THREE.Mesh(
      new THREE.PlaneGeometry(plan.parking.widthM, plan.parking.depthM),
      new THREE.MeshBasicMaterial({ color: 0xc08a2e, transparent: true, opacity: 0.35 }),
    );
    park.rotation.x = -Math.PI / 2;
    park.position.set(plan.parking.x, 0.03, plan.parking.z);
    root.add(park);
  }

  const mat = new THREE.MeshStandardMaterial({ color: 0x102d1a, roughness: 0.7, metalness: 0.05 });
  for (const b of plan.blocks) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.widthM, b.heightM, b.depthM), mat.clone());
    mesh.position.set(b.x, b.heightM / 2, b.z);
    root.add(mesh);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color: 0x147b35 }),
    );
    edges.position.copy(mesh.position);
    root.add(edges);
  }

  return root;
}

export default function MassingViewerInternal({ plan, fitToken = 0, className }: MassingViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    content: THREE.Group;
  } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth || 640, host.clientHeight || 360);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 5000);
    camera.position.set(40, 30, 40);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8272, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(30, 60, 20);
    scene.add(sun);

    const content = new THREE.Group();
    scene.add(content);

    const onResize = () => {
      const w = host.clientWidth || 640;
      const h = host.clientHeight || 360;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);
    onResize();

    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    stateRef.current = { renderer, scene, camera, controls, content };

    return () => {
      ro.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      disposeSubtree(content);
      renderer.dispose();
      renderer.domElement.remove();
      stateRef.current = null;
    };
  }, []);

  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    disposeSubtree(s.content);
    s.content.clear();
    if (!plan) return;
    s.content.add(buildPlan(plan));

    const f = framingFromObject(s.content, 45, s.camera.aspect || 16 / 9);
    s.camera.position.copy(f.position);
    s.camera.near = f.near;
    s.camera.far = f.far;
    s.camera.updateProjectionMatrix();
    s.controls.target.copy(f.target);
    s.controls.minDistance = f.minDistance;
    s.controls.maxDistance = f.maxDistance;
    s.controls.update();
  }, [plan, fitToken]);

  return (
    <div className={className} data-testid="design-studio-canvas">
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
}
