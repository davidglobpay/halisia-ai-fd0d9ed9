import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Minimal desktop-only 3D preview for the developer LR fixture.
 *
 * Deliberately standalone: it does not import, extend or modify any Spatial
 * renderer, XR session, hit-test or re-place code. Models render at their
 * authored scale — the camera frames them, nothing is fitted or shrunk to a
 * document-stated area.
 */
export default function FixtureModelPreview({
  url,
  onStatus,
}: {
  url: string;
  onStatus?: (s: "loading" | "loaded" | "error") => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef(onStatus);
  statusRef.current = onStatus;
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1ece0);
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 5000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, Math.round((host.clientWidth * 9) / 16));
    host.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f7a, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(40, 80, 30);
    scene.add(sun);

    const root = new THREE.Group();
    scene.add(root);

    let frame = 0;
    let angle = 0.6;
    let radius = 20;
    let height = 8;
    let target = new THREE.Vector3();

    const renderLoop = () => {
      angle += 0.0025;
      camera.position.set(
        target.x + Math.cos(angle) * radius,
        target.y + height,
        target.z + Math.sin(angle) * radius,
      );
      camera.lookAt(target);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(renderLoop);
    };

    statusRef.current?.("loading");
    new GLTFLoader().load(
      url,
      (gltf) => {
        if (disposed) return;
        root.add(gltf.scene);
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3());
        target = box.getCenter(new THREE.Vector3());
        const extent = Math.max(size.x, size.y, size.z) || 10;
        radius = extent * 1.6;
        height = extent * 0.7;
        setError(null);
        statusRef.current?.("loaded");
      },
      (ev) => {
        if (ev.total) setProgress(Math.round((ev.loaded / ev.total) * 100));
      },
      (err) => {
        if (disposed) return;
        setError(err instanceof Error ? err.message : "Model failed to load");
        statusRef.current?.("error");
      },
    );

    const onResize = () => {
      const w = host.clientWidth;
      const h = Math.round((w * 9) / 16);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);
    onResize();
    frame = requestAnimationFrame(renderLoop);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      scene.traverse((obj) => {
        const o = obj as unknown as {
          geometry?: { dispose(): void };
          material?: { dispose(): void } | Array<{ dispose(): void }>;
        };
        o.geometry?.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [url]);

  return (
    <div>
      <div
        ref={hostRef}
        className="overflow-hidden rounded-xl border border-white/15"
        data-testid="fixture-3d-host"
      />
      <p className="text-muted-foreground mt-2 text-xs" data-testid="fixture-3d-status">
        {error
          ? `3D preview failed: ${error}`
          : progress > 0 && progress < 100
            ? `Loading model… ${progress}%`
            : "Authored scale — not fitted to the document-stated area."}
      </p>
    </div>
  );
}
