/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, MapPin, Loader2, RefreshCw } from "lucide-react";
import { loadGoogleMaps, resetGoogleMapsLoader } from "@/lib/google-maps-loader";

// Kenya viewport
const KENYA_CENTER = { lat: 0.5, lng: 37.9 };
const KENYA_BOUNDS = {
  north: 5.5,
  south: -4.8,
  east: 42.0,
  west: 33.9,
};

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
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [mapError, setMapError] = useState<string | null>(null);
  const [hint, setHint] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setMapError(null);
    loadGoogleMaps()
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
      .catch((e) => {
        console.error(e);
        if (!cancelled) setMapError("Google Maps could not open. Check your connection and retry.");
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      markerRef.current?.setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAttempt]);

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

      {mapError && (
        <div
          role="alert"
          className="absolute inset-0 grid place-items-center bg-[#050d24]/95 p-6 text-center"
        >
          <div>
            <AlertTriangle className="mx-auto h-6 w-6 text-amber-glow" />
            <div className="mt-3 text-sm text-foreground">{mapError}</div>
            <button
              onClick={() => {
                resetGoogleMapsLoader();
                setLoadAttempt((n) => n + 1);
              }}
              className="mt-4 inline-flex items-center gap-2 glass rounded-full px-4 py-2 text-xs hover:bg-white/10"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry map
            </button>
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
