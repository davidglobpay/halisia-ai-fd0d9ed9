/// <reference types="google.maps" />
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    google: typeof google;
  }
}

let loaderPromise: Promise<typeof google> | null = null;
function loadMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loaderPromise) return loaderPromise;
  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
  loaderPromise = new Promise((resolve, reject) => {
    (window as unknown as { __initHalisiaMap?: () => void }).__initHalisiaMap = () => resolve(window.google);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__initHalisiaMap&channel=${channel}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

const HALISIA_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#0a1735" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a1735" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ab4ff" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#c9e1ff" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#7fb0ff" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#0f2a3d" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#132a55" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0a1a3a" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2d8cff" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#081b45" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#152a55" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#050d24" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#62e9ff" }] },
];

export type MapLocation = { lat: number; lng: number; label?: string };

export function MapView({
  center = { lat: -1.286389, lng: 36.817223 },
  zoom = 12,
  marker,
  className = "",
}: {
  center?: MapLocation;
  zoom?: number;
  marker?: MapLocation | null;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then((g) => {
        if (cancelled || !el.current) return;
        mapRef.current = new g.maps.Map(el.current, {
          center,
          zoom,
          styles: HALISIA_STYLE,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          backgroundColor: "#0a1735",
        });
      })
      .catch((e) => console.error(e));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.panTo(center);
    mapRef.current.setZoom(zoom);
  }, [center.lat, center.lng, zoom]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    markerRef.current?.setMap(null);
    if (marker) {
      markerRef.current = new window.google.maps.Marker({
        position: marker,
        map: mapRef.current,
        title: marker.label,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#62E9FF",
          fillOpacity: 1,
          strokeColor: "#2D8CFF",
          strokeWeight: 3,
        },
      });
    }
  }, [marker?.lat, marker?.lng, marker?.label]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div ref={el} className="absolute inset-0 bg-[#0a1735]" />
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_120px_oklch(0_0_0/0.6)]" />
    </div>
  );
}
