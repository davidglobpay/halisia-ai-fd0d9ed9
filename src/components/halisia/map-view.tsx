/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { loadGoogleMaps, resetGoogleMapsLoader } from "@/lib/google-maps-loader";

export type MapTypeId = "roadmap" | "satellite" | "hybrid" | "terrain";
export type MapTheme = "dark" | "light";
export type OverlayId = "traffic" | "transit" | "bicycling";

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

  useEffect(() => {
    let cancelled = false;
    loadMaps()
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
      })
      .catch((e) => console.error(e));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.panTo(center);
    mapRef.current.setZoom(zoom);
  }, [center.lat, center.lng, zoom]);

  // Theme + mapType
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    m.setOptions({
      styles: theme === "light" ? HALISIA_LIGHT : HALISIA_STYLE,
      backgroundColor: theme === "light" ? "#f5f7fb" : "#0a1735",
    });
    m.setMapTypeId(mapType);
  }, [theme, mapType]);

  // Click to inspect anywhere
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !window.google?.maps) return;
    clickListenerRef.current?.remove();
    if (!onMapClick) return;
    clickListenerRef.current = m.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    });
    return () => clickListenerRef.current?.remove();
  }, [onMapClick]);

  // Built-in Google overlays (traffic/transit/bicycling)
  useEffect(() => {
    const m = mapRef.current;
    const g = window.google;
    if (!m || !g?.maps) return;
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
  }, [overlays]);

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
      <div
        ref={el}
        className={`absolute inset-0 ${theme === "light" ? "bg-[#f5f7fb]" : "bg-[#0a1735]"}`}
      />
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_120px_oklch(0_0_0/0.6)]" />
    </div>
  );
}
