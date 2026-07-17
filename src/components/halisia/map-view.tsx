/// <reference types="google.maps" />
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { loadGoogleMaps, resetGoogleMapsLoader } from "@/lib/google-maps-loader";

const MapFallback = lazy(() => import("./map-fallback.internal"));

export type MapTypeId = "roadmap" | "satellite" | "hybrid" | "terrain";
export type MapTheme = "dark" | "light";
export type OverlayId = "traffic" | "transit" | "bicycling" | "slope" | "drainage";

const HALISIA_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#0a1735" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a1735" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ab4ff" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#c9e1ff" }],
  },
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

// Minimal, clean light palette — Apple-Maps-like.
const HALISIA_LIGHT: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f7fb" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#3a4a66" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#5a6b85" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#dff0e2" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e2e6ee" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#ffd77a" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#e8b850" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#e6e9f2" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#bcdcf5" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d7ba8" }] },
];

export type MapLocation = { lat: number; lng: number; label?: string };

export function MapView({
  center = { lat: -1.286389, lng: 36.817223 },
  zoom = 12,
  marker,
  className = "",
  mapType = "roadmap",
  theme = "dark",
  overlays = [],
  onMapClick,
}: {
  center?: MapLocation;
  zoom?: number;
  marker?: MapLocation | null;
  className?: string;
  mapType?: MapTypeId;
  theme?: MapTheme;
  overlays?: OverlayId[];
  onMapClick?: (loc: { lat: number; lng: number }) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const overlayRefs = useRef<
    Partial<
      Record<OverlayId, google.maps.MVCObject & { setMap: (m: google.maps.Map | null) => void }>
    >
  >({});
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [authFailed, setAuthFailed] = useState<boolean>(
    typeof window !== "undefined" && !!window.__halisiaMapsAuthFailed,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const on = () => setAuthFailed(true);
    window.addEventListener("halisia:maps-auth-failed", on);
    return () => window.removeEventListener("halisia:maps-auth-failed", on);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMapReady(false);
    setMapError(null);
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !el.current) return;
        mapRef.current = new g.maps.Map(el.current, {
          center,
          zoom,
          styles: theme === "light" ? HALISIA_LIGHT : HALISIA_STYLE,
          mapTypeId: mapType,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          backgroundColor: theme === "light" ? "#f5f7fb" : "#0a1735",
          tilt: 45,
        });
        setMapReady(true);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setMapError("Google Maps could not open. Check your connection and retry.");
      });
    return () => {
      cancelled = true;
      clickListenerRef.current?.remove();
      markerRef.current?.setMap(null);
      Object.values(overlayRefs.current).forEach((layer) => layer?.setMap(null));
      overlayRefs.current = {};
    };
  }, [loadAttempt]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    mapRef.current.panTo(center);
    mapRef.current.setZoom(zoom);
  }, [mapReady, center.lat, center.lng, zoom]);

  // Theme + mapType
  useEffect(() => {
    const m = mapRef.current;
    if (!mapReady || !m) return;
    m.setOptions({
      styles: theme === "light" ? HALISIA_LIGHT : HALISIA_STYLE,
      backgroundColor: theme === "light" ? "#f5f7fb" : "#0a1735",
    });
    m.setMapTypeId(mapType);
  }, [mapReady, theme, mapType]);

  // Click to inspect anywhere
  useEffect(() => {
    const m = mapRef.current;
    if (!mapReady || !m || !window.google?.maps) return;
    clickListenerRef.current?.remove();
    if (!onMapClick) return;
    clickListenerRef.current = m.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    });
    return () => clickListenerRef.current?.remove();
  }, [mapReady, onMapClick]);

  // Built-in Google overlays (traffic/transit/bicycling)
  useEffect(() => {
    const m = mapRef.current;
    const g = window.google;
    if (!mapReady || !m || !g?.maps) return;
    const wanted = new Set(overlays);
    const ensure = (
      id: OverlayId,
      make: () => google.maps.MVCObject & { setMap: (m: google.maps.Map | null) => void },
    ) => {
      const has = overlayRefs.current[id];
      if (wanted.has(id) && !has) {
        const layer = make();
        layer.setMap(m);
        overlayRefs.current[id] = layer;
      } else if (!wanted.has(id) && has) {
        has.setMap(null);
        delete overlayRefs.current[id];
      }
    };
    ensure("traffic", () => new g.maps.TrafficLayer());
    ensure("transit", () => new g.maps.TransitLayer());
    ensure("bicycling", () => new g.maps.BicyclingLayer());
    ensure(
      "slope",
      () =>
        new g.maps.ImageMapType({
          name: "Slope",
          tileSize: new g.maps.Size(256, 256),
          opacity: 0.55,
          getTileUrl: (c: google.maps.Point, z: number) =>
            `https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/${z}/${c.y}/${c.x}`,
        }) as unknown as google.maps.MVCObject & {
          setMap: (m: google.maps.Map | null) => void;
        },
    );
    ensure(
      "drainage",
      () =>
        new g.maps.ImageMapType({
          name: "Drainage",
          tileSize: new g.maps.Size(256, 256),
          opacity: 0.9,
          getTileUrl: (c: google.maps.Point, z: number) =>
            `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Hydro_Reference_Overlay/MapServer/tile/${z}/${c.y}/${c.x}`,
        }) as unknown as google.maps.MVCObject & {
          setMap: (m: google.maps.Map | null) => void;
        },
    );
  }, [mapReady, overlays]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) return;
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
  }, [mapReady, marker?.lat, marker?.lng, marker?.label]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        ref={el}
        className={`absolute inset-0 ${theme === "light" ? "bg-[#f5f7fb]" : "bg-[#0a1735]"}`}
      />
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_120px_oklch(0_0_0/0.6)]" />
      {(mapError || authFailed) && (
        <div className="absolute inset-0" data-testid="map-fallback-osm">
          <Suspense fallback={null}>
            <MapFallback
              lat={(marker ?? center).lat}
              lng={(marker ?? center).lng}
              label={marker?.label}
              theme={theme}
              mapType={mapType}
            />
          </Suspense>
          <div
            role="status"
            className="pointer-events-none absolute top-2 left-2 glass rounded-full px-3 py-1 text-[10px] uppercase tracking-widest text-amber-glow"
          >
            OSM fallback · Google Maps unavailable
          </div>
          <button
            onClick={() => {
              resetGoogleMapsLoader();
              setMapError(null);
              setAuthFailed(false);
              if (typeof window !== "undefined") window.__halisiaMapsAuthFailed = false;
              setLoadAttempt((n) => n + 1);
            }}
            className="absolute top-2 right-2 glass rounded-full px-3 py-1 text-[11px] hover:bg-white/10 inline-flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" /> Retry Google
          </button>
        </div>
      )}
      {!mapReady && !mapError && !authFailed && (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground text-sm">
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-accent" /> Opening map…
          </div>
        </div>
      )}
    </div>
  );
}
