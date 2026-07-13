/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";

// Kenya viewport
const KENYA_CENTER = { lat: 0.5, lng: 37.9 };
const KENYA_BOUNDS = {
  north: 5.5,
  south: -4.8,
  east: 42.0,
  west: 33.9,
};

let loaderPromise: Promise<typeof google> | null = null;
function loadMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loaderPromise) return loaderPromise;
  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
  loaderPromise = new Promise((resolve, reject) => {
    (window as unknown as { __initHalisiaMap?: () => void }).__initHalisiaMap = () =>
      resolve(window.google);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__initHalisiaMap&channel=${channel}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

export function Kenya3DMap({
  className = "",
  onSelect,
}: {
  className?: string;
  onSelect?: (loc: { lat: number; lng: number }) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const rafRef = useRef<number>(0);
  const headingRef = useRef<number>(0);
  const pausedRef = useRef<boolean>(false);
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then((g) => {
        if (cancelled || !el.current) return;
        const map = new g.maps.Map(el.current, {
          center: KENYA_CENTER,
          zoom: 6,
          mapTypeId: "hybrid",
          tilt: 67.5,
          heading: 0,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          backgroundColor: "#050d24",
          restriction: { latLngBounds: KENYA_BOUNDS, strictBounds: false },
          minZoom: 5,
          maxZoom: 20,
        });
        mapRef.current = map;
        setReady(true);

        // Auto-rotate heading for cinematic feel
        const tick = () => {
          if (!pausedRef.current && mapRef.current) {
            headingRef.current = (headingRef.current + 0.06) % 360;
            mapRef.current.setHeading(headingRef.current);
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);

        // Pause rotation on interaction
        const pause = () => {
          pausedRef.current = true;
        };
        map.addListener("dragstart", pause);
        map.addListener("zoom_changed", pause);
        map.addListener("mousedown", pause);

        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          pausedRef.current = true;
          setHint({ lat, lng });
          markerRef.current?.setMap(null);
          markerRef.current = new g.maps.Marker({
            position: { lat, lng },
            map,
            animation: g.maps.Animation.DROP,
            icon: {
              path: g.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: "#62E9FF",
              fillOpacity: 1,
              strokeColor: "#2D8CFF",
              strokeWeight: 3,
            },
          });
          // Small delay so user sees the drop before we navigate
          window.setTimeout(() => onSelect?.({ lat, lng }), 250);
        });
      })
      .catch((e) => console.error(e));
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      markerRef.current?.setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`relative aspect-square w-full max-w-[640px] mx-auto rounded-[36px] overflow-hidden ${className}`}
    >
      <div
        className="absolute -inset-8 rounded-full blur-3xl opacity-60 pointer-events-none"
        style={{
          background: "radial-gradient(circle, oklch(0.68 0.19 249 / 0.35), transparent 60%)",
        }}
      />
      <div ref={el} className="absolute inset-0 bg-[#050d24]" />
      {/* Inner shadow + vignette */}
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_120px_oklch(0_0_0/0.7)]" />

      {/* Corner UI */}
      <div className="pointer-events-none absolute inset-0 p-4 flex flex-col justify-between">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-accent glass rounded-full px-3 py-1.5 self-start">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          Live · Kenya
        </div>
        <div className="self-end glass rounded-full px-3 py-1.5 text-[11px] text-muted-foreground flex items-center gap-2">
          <MapPin className="h-3 w-3 text-accent" />
          Click anywhere to inspect
        </div>
      </div>

      {!ready && (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground text-sm">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading 3D Kenya…
          </div>
        </div>
      )}

      {hint && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 glass-strong rounded-full px-4 py-2 text-xs text-foreground flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-accent" />
          Loading intelligence for {hint.lat.toFixed(3)}, {hint.lng.toFixed(3)}…
        </div>
      )}
    </div>
  );
}
