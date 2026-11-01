/// <reference types="google.maps" />
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AlertTriangle, Crosshair, Loader2, Minus, Plus, RefreshCw } from "lucide-react";
import { MapControlDock } from "@/components/halisia/map-controls/map-control-dock";
import { loadGoogleMaps, resetGoogleMapsLoader } from "@/lib/google-maps-loader";
import { MAP_CONTEXT_LAYERS } from "@/lib/map-evidence";

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
  mapType: mapTypeProp = "roadmap",
  theme: themeProp = "dark",
  overlays: overlaysProp = [],
  onMapTypeChange,
  onThemeChange,
  onOverlaysChange,
  controls = true,
  controlsTopClass = "top-14",
  onMapClick,
  markerDraggable = false,
  onMarkerDrag,
  accuracyRadiusM = null,
  polygon = null,
  polygonEditable = false,
  onPolygonChange,
  overlayPolygons = null,
}: {
  center?: MapLocation;
  zoom?: number;
  marker?: MapLocation | null;
  className?: string;
  mapType?: MapTypeId;
  theme?: MapTheme;
  overlays?: OverlayId[];
  /** Called when the user changes the basemap from the floating layer menu. */
  onMapTypeChange?: (t: MapTypeId) => void;
  onThemeChange?: (t: MapTheme) => void;
  onOverlaysChange?: (o: OverlayId[]) => void;
  /** Floating navigation and layer controls (default on). */
  controls?: boolean;
  /** Where the floating controls start, to clear other overlays in the corner. */
  controlsTopClass?: string;
  onMapClick?: (loc: { lat: number; lng: number }) => void;
  markerDraggable?: boolean;
  onMarkerDrag?: (loc: { lat: number; lng: number }) => void;
  /**
   * Draws an uncertainty ring around the marker, in metres. A pin on its own
   * reads as "a surveyor stood here"; a ring reads as "somewhere in this".
   * Null or omitted draws nothing, so every existing caller is unaffected.
   */
  accuracyRadiusM?: number | null;
  /**
   * A boundary the user has drawn, as a ring of points. Null draws nothing,
   * so every existing caller is unaffected.
   *
   * This is a sketch, never a survey. The styling says so deliberately: a
   * dashed-looking thin stroke and a light fill, nothing like the solid
   * confident line a cadastral layer would use.
   */
  polygon?: MapLocation[] | null;
  /** Lets the user drag vertices and midpoints. */
  polygonEditable?: boolean;
  /** Fires whenever the user moves, adds or deletes a vertex. */
  onPolygonChange?: (ring: { lat: number; lng: number }[]) => void;
  /**
   * Extra rings drawn under the editable one and never interactive — a
   * setback envelope, a tested building footprint. Each carries its own
   * colour so the three can be told apart at a glance.
   */
  overlayPolygons?: { ring: MapLocation[]; color: string; fillOpacity?: number }[] | null;
}) {
  // Layer state follows the props and can also be changed from the floating
  // layer menu; parents that pass on*Change handlers stay in control.
  const [mapType, setMapTypeLocal] = useState<MapTypeId>(mapTypeProp);
  const [theme, setThemeLocal] = useState<MapTheme>(themeProp);
  const [overlays, setOverlaysLocal] = useState<OverlayId[]>(overlaysProp);
  useEffect(() => setMapTypeLocal(mapTypeProp), [mapTypeProp]);
  useEffect(() => setThemeLocal(themeProp), [themeProp]);
  const overlaysKey = overlaysProp.join(",");
  useEffect(() => setOverlaysLocal(overlaysProp), [overlaysKey]);
  const rootRef = useRef<HTMLDivElement>(null);
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const accuracyRef = useRef<google.maps.Circle | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const overlayPolyRefs = useRef<google.maps.Polygon[]>([]);
  const polygonListenersRef = useRef<google.maps.MapsEventListener[]>([]);
  // Held in a ref so the path listeners always call the newest callback
  // without having to tear the polygon down and rebuild it on every render —
  // rebuilding mid-drag would drop the vertex the user is holding.
  const onPolygonChangeRef = useRef(onPolygonChange);
  onPolygonChangeRef.current = onPolygonChange;
  const markerDragListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const overlayRefs = useRef<
    Partial<
      Record<OverlayId, google.maps.MVCObject & { setMap: (m: google.maps.Map | null) => void }>
    >
  >({});
  const imageOverlayRefs = useRef<Partial<Record<OverlayId, google.maps.ImageMapType>>>({});
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [tileError, setTileError] = useState(false);
  const [tileRetryKey, setTileRetryKey] = useState(0);
  const [authFailed, setAuthFailed] = useState(false);
  const hasPositionClass = /\b(absolute|relative|fixed|sticky)\b/.test(className);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.__halisiaMapsAuthFailed) setAuthFailed(true);
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
          // The shared floating controls replace Google's zoom buttons.
          zoomControl: !controls,
          gestureHandling: "greedy",
          backgroundColor: theme === "light" ? "#f5f7fb" : "#0a1735",
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
      clickListenerRef.current = null;
      markerDragListenerRef.current?.remove();
      markerDragListenerRef.current = null;
      const activeMarker = markerRef.current;
      if (activeMarker) {
        window.google?.maps?.event?.clearInstanceListeners(activeMarker);
        activeMarker.setMap(null);
      }
      markerRef.current = null;
      accuracyRef.current?.setMap(null);
      accuracyRef.current = null;
      Object.values(overlayRefs.current).forEach((layer) => layer?.setMap(null));
      overlayRefs.current = {};
      const map = mapRef.current;
      if (map) {
        const overlayTypes = map.overlayMapTypes;
        Object.values(imageOverlayRefs.current).forEach((layer) => {
          if (!layer) return;
          const idx = overlayTypes.getArray().indexOf(layer);
          if (idx >= 0) overlayTypes.removeAt(idx);
        });
        window.google?.maps?.event?.clearInstanceListeners(map);
      }
      imageOverlayRefs.current = {};
      mapRef.current = null;
      setMapReady(false);
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
    return () => {
      clickListenerRef.current?.remove();
      clickListenerRef.current = null;
    };
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
    const ensureImage = (id: OverlayId, make: () => google.maps.ImageMapType) => {
      const has = imageOverlayRefs.current[id];
      if (wanted.has(id) && !has) {
        const layer = make();
        m.overlayMapTypes.push(layer);
        imageOverlayRefs.current[id] = layer;
      } else if (!wanted.has(id) && has) {
        const idx = m.overlayMapTypes.getArray().indexOf(has);
        if (idx >= 0) m.overlayMapTypes.removeAt(idx);
        delete imageOverlayRefs.current[id];
      }
    };
    ensureImage(
      "slope",
      () =>
        new g.maps.ImageMapType({
          name: MAP_CONTEXT_LAYERS.slope.label,
          tileSize: new g.maps.Size(256, 256),
          opacity: 0.55,
          getTileUrl: (c, z) =>
            `https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/${z}/${c.y}/${c.x}`,
        }),
    );
    ensureImage(
      "drainage",
      () =>
        new g.maps.ImageMapType({
          name: MAP_CONTEXT_LAYERS.drainage.label,
          tileSize: new g.maps.Size(256, 256),
          opacity: 0.9,
          getTileUrl: (c, z) =>
            `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Hydro_Reference_Overlay/MapServer/tile/${z}/${c.y}/${c.x}`,
        }),
    );
  }, [mapReady, overlays.join(",")]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) return;
    markerRef.current?.setMap(null);
    markerDragListenerRef.current?.remove();
    markerDragListenerRef.current = null;
    if (marker) {
      markerRef.current = new window.google.maps.Marker({
        position: marker,
        map: mapRef.current,
        title: marker.label,
        draggable: markerDraggable,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#62E9FF",
          fillOpacity: 1,
          strokeColor: "#2D8CFF",
          strokeWeight: 3,
        },
      });
      if (markerDraggable && onMarkerDrag) {
        markerDragListenerRef.current = markerRef.current.addListener("dragend", () => {
          const next = markerRef.current?.getPosition();
          if (!next) return;
          onMarkerDrag({ lat: next.lat(), lng: next.lng() });
        });
      }
    }
    return () => {
      markerDragListenerRef.current?.remove();
      markerDragListenerRef.current = null;
      const current = markerRef.current;
      if (current) {
        window.google?.maps?.event?.clearInstanceListeners(current);
        current.setMap(null);
      }
      markerRef.current = null;
    };
  }, [mapReady, marker?.lat, marker?.lng, marker?.label, markerDraggable, onMarkerDrag]);

  // Uncertainty ring. Drawn around the marker when a caller supplies a radius,
  // removed the moment it stops. A geocoded pin is the centre of an area, and
  // showing only the centre invites a buyer to treat it as a boundary.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) return;
    accuracyRef.current?.setMap(null);
    accuracyRef.current = null;
    if (!marker || accuracyRadiusM == null || !(accuracyRadiusM > 0)) return;
    accuracyRef.current = new window.google.maps.Circle({
      map: mapRef.current,
      center: { lat: marker.lat, lng: marker.lng },
      radius: accuracyRadiusM,
      strokeColor: "#c08a2e",
      strokeOpacity: 0.7,
      strokeWeight: 1.5,
      fillColor: "#c08a2e",
      fillOpacity: 0.1,
      clickable: false,
    });
    return () => {
      accuracyRef.current?.setMap(null);
      accuracyRef.current = null;
    };
  }, [mapReady, marker?.lat, marker?.lng, accuracyRadiusM]);

  // Read-only rings: the setback envelope and any tested footprint. Drawn at a
  // lower zIndex than the editable boundary so a vertex handle is never hidden
  // beneath a fill.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) return;
    for (const p of overlayPolyRefs.current) p.setMap(null);
    overlayPolyRefs.current = [];
    if (!overlayPolygons?.length) return;
    for (const spec of overlayPolygons) {
      if (!spec.ring || spec.ring.length < 3) continue;
      overlayPolyRefs.current.push(
        new window.google.maps.Polygon({
          map: mapRef.current,
          paths: spec.ring.map((p) => ({ lat: p.lat, lng: p.lng })),
          editable: false,
          clickable: false,
          strokeColor: spec.color,
          strokeOpacity: 0.9,
          strokeWeight: 1.5,
          fillColor: spec.color,
          fillOpacity: spec.fillOpacity ?? 0.1,
          zIndex: 1,
        }),
      );
    }
    return () => {
      for (const p of overlayPolyRefs.current) p.setMap(null);
      overlayPolyRefs.current = [];
    };
  }, [mapReady, JSON.stringify(overlayPolygons)]);

  // The drawn boundary. Rebuilt when the ring identity changes, not on every
  // render: a rebuild while the user is dragging a vertex would snatch it from
  // under the pointer.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) return;
    for (const l of polygonListenersRef.current) l.remove();
    polygonListenersRef.current = [];
    polygonRef.current?.setMap(null);
    polygonRef.current = null;
    if (!polygon || polygon.length < 3) return;

    const poly = new window.google.maps.Polygon({
      map: mapRef.current,
      paths: polygon.map((p) => ({ lat: p.lat, lng: p.lng })),
      editable: polygonEditable,
      strokeColor: "#c08a2e",
      strokeOpacity: 0.95,
      strokeWeight: 2,
      fillColor: "#c08a2e",
      fillOpacity: 0.12,
      clickable: false,
      zIndex: 2,
    });
    polygonRef.current = poly;

    if (polygonEditable) {
      const path = poly.getPath();
      const report = () => {
        const ring: { lat: number; lng: number }[] = [];
        for (let i = 0; i < path.getLength(); i++) {
          const pt = path.getAt(i);
          ring.push({ lat: pt.lat(), lng: pt.lng() });
        }
        onPolygonChangeRef.current?.(ring);
      };
      polygonListenersRef.current = [
        window.google.maps.event.addListener(path, "set_at", report),
        window.google.maps.event.addListener(path, "insert_at", report),
        window.google.maps.event.addListener(path, "remove_at", report),
      ];
    }

    return () => {
      for (const l of polygonListenersRef.current) l.remove();
      polygonListenersRef.current = [];
      polygonRef.current?.setMap(null);
      polygonRef.current = null;
    };
    // The ring is compared by value: a caller that rebuilds the array every
    // render would otherwise tear the polygon down on each one.
  }, [mapReady, polygonEditable, JSON.stringify(polygon)]);

  return (
    <div
      ref={rootRef}
      data-testid="map-view"
      onDoubleClick={() => {
        if (typeof window === "undefined") return;
        if (!(window as Window & { __halisiaEnableTestDrag?: boolean }).__halisiaEnableTestDrag) {
          return;
        }
        if (!markerDraggable) return;
        onMarkerDrag?.({ lat: center.lat + 0.001, lng: center.lng + 0.001 });
      }}
      className={`${hasPositionClass ? "" : "relative"} h-full w-full overflow-hidden ${className}`}
    >
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
              draggable={markerDraggable}
              tileRetryKey={tileRetryKey}
              onMarkerDrag={onMarkerDrag}
              onMapClick={onMapClick}
              onTileError={() => setTileError(true)}
            />
          </Suspense>
          <div
            data-testid="map-fallback-status"
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
          {tileError && (
            <div
              role="alert"
              data-testid="map-tile-fallback"
              className="pointer-events-auto absolute bottom-2 right-2 z-[700] max-w-[260px] rounded-2xl glass-strong border border-amber-glow/30 p-3 text-xs shadow-2xl"
            >
              <div className="flex items-start gap-2 text-amber-glow">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Some map tiles failed to load. Pan/zoom still works.</span>
              </div>
              <button
                type="button"
                data-testid="retry-map-tiles"
                onClick={() => {
                  setTileError(false);
                  setTileRetryKey((n) => n + 1);
                }}
                className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] text-foreground hover:bg-white/15"
              >
                <RefreshCw className="h-3 w-3" /> Retry map tiles
              </button>
            </div>
          )}
        </div>
      )}
      {controls && (
        <MapControlDock
          testId="map-dock"
          topOffsetClass={controlsTopClass}
          fullscreenTarget={rootRef}
          actions={[
            {
              id: "zoom-in",
              label: "Zoom in",
              icon: Plus,
              disabled: !mapReady,
              onClick: () => mapRef.current?.setZoom((mapRef.current.getZoom() ?? zoom) + 1),
            },
            {
              id: "zoom-out",
              label: "Zoom out",
              icon: Minus,
              disabled: !mapReady,
              onClick: () => mapRef.current?.setZoom((mapRef.current.getZoom() ?? zoom) - 1),
            },
            {
              id: "recenter",
              label: marker ? "Back to the pin" : "Back to the start",
              icon: Crosshair,
              disabled: !mapReady,
              onClick: () => {
                mapRef.current?.panTo(marker ?? center);
                mapRef.current?.setZoom(Math.max(zoom, marker ? 15 : zoom));
              },
            },
          ]}
          layers={[
            {
              id: "basemap",
              title: "Map",
              kind: "single",
              options: [
                { id: "roadmap", label: "Map" },
                { id: "satellite", label: "Satellite" },
                { id: "hybrid", label: "Satellite with labels" },
                { id: "terrain", label: "Terrain" },
              ],
              selected: [mapType],
              onChange: ([v]) => {
                const next = (v ?? "roadmap") as MapTypeId;
                setMapTypeLocal(next);
                onMapTypeChange?.(next);
              },
            },
            {
              id: "theme",
              title: "Map colours",
              kind: "single",
              options: [
                { id: "light", label: "Light" },
                {
                  id: "dark",
                  label: "Dark",
                  hint:
                    mapType === "satellite" || mapType === "hybrid"
                      ? "Applies to Map and Terrain"
                      : undefined,
                },
              ],
              selected: [theme],
              onChange: ([v]) => {
                const next = (v ?? "light") as MapTheme;
                setThemeLocal(next);
                onThemeChange?.(next);
              },
            },
            {
              id: "overlays",
              title: "Show on the map",
              kind: "multi",
              options: [
                { id: "traffic", label: "Traffic" },
                { id: "transit", label: "Public transport" },
                { id: "bicycling", label: "Cycling routes" },
                {
                  id: "slope",
                  label: MAP_CONTEXT_LAYERS.slope.label,
                  hint: MAP_CONTEXT_LAYERS.slope.limitation,
                },
                {
                  id: "drainage",
                  label: MAP_CONTEXT_LAYERS.drainage.label,
                  hint: MAP_CONTEXT_LAYERS.drainage.limitation,
                },
              ],
              selected: overlays,
              onChange: (v) => {
                const next = v as OverlayId[];
                setOverlaysLocal(next);
                onOverlaysChange?.(next);
              },
            },
          ]}
          layerFootnote={<>Map data © Google. Terrain hillshade and watercourses © Esri.</>}
        />
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
