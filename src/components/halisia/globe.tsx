import { useEffect, useRef, useState } from "react";
import createGlobe from "cobe";

export function Globe({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const [{ r }, setR] = useState({ r: 0 });

  useEffect(() => {
    let phi = 0;
    let width = 0;
    const onResize = () => canvasRef.current && (width = canvasRef.current.offsetWidth);
    window.addEventListener("resize", onResize);
    onResize();
    if (!canvasRef.current) return;
    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      theta: 0.28,
      dark: 1,
      diffuse: 1.4,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.15, 0.25, 0.5],
      markerColor: [0.38, 0.91, 1],
      glowColor: [0.18, 0.55, 1],
      markers: [
        { location: [-1.286389, 36.817223], size: 0.09 }, // Nairobi
        { location: [-4.0435, 39.6682], size: 0.06 },     // Mombasa
        { location: [0.5143, 35.2698], size: 0.05 },      // Eldoret
        { location: [-0.1022, 34.7617], size: 0.05 },     // Kisumu
        { location: [-0.4906, 35.6667], size: 0.04 },     // Nakuru
        { location: [1.0, 38.0], size: 0.03 },
      ],
      onRender: (state) => {
        if (!pointerInteracting.current) phi += 0.0035;
        state.phi = phi + r;
        state.width = width * 2;
        state.height = width * 2;
      },
    });
    setTimeout(() => canvasRef.current && (canvasRef.current.style.opacity = "1"));
    return () => {
      globe.destroy();
      window.removeEventListener("resize", onResize);
    };
  }, [r]);

  return (
    <div className={`relative aspect-square w-full max-w-[640px] mx-auto ${className}`}>
      <div className="absolute inset-0 rounded-full blur-3xl opacity-60"
        style={{ background: "radial-gradient(circle, oklch(0.68 0.19 249 / 0.35), transparent 60%)" }} />
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          pointerInteracting.current = e.clientX - pointerInteractionMovement.current;
          e.currentTarget.style.cursor = "grabbing";
        }}
        onPointerUp={() => {
          pointerInteracting.current = null;
          if (canvasRef.current) canvasRef.current.style.cursor = "grab";
        }}
        onPointerOut={() => {
          pointerInteracting.current = null;
          if (canvasRef.current) canvasRef.current.style.cursor = "grab";
        }}
        onMouseMove={(e) => {
          if (pointerInteracting.current !== null) {
            const delta = e.clientX - pointerInteracting.current;
            pointerInteractionMovement.current = delta;
            setR({ r: delta / 200 });
          }
        }}
        onTouchMove={(e) => {
          if (pointerInteracting.current !== null && e.touches[0]) {
            const delta = e.touches[0].clientX - pointerInteracting.current;
            pointerInteractionMovement.current = delta;
            setR({ r: delta / 100 });
          }
        }}
        style={{
          width: "100%",
          height: "100%",
          cursor: "grab",
          contain: "layout paint size",
          opacity: 0,
          transition: "opacity 1s ease",
        }}
      />
    </div>
  );
}
