import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { Crosshair, Minus, Plus } from "lucide-react";
import { MapControlDock, type DockAction, type LayerGroup } from "./map-control-dock";

/**
 * The shared floating controls for a react-leaflet map. Render it as a child
 * of <MapContainer>. Taps and scrolls on the controls never reach the map, so
 * pressing a button cannot drop a pin or pan the map.
 */
export function LeafletDock({
  home,
  homeLabel = "Back to the start",
  layers,
  layerFootnote,
  extraActions = [],
  testId = "leaflet-dock",
}: {
  /** Where "back" returns to: a point and zoom, or bounds. */
  home: { center: [number, number]; zoom: number } | { bounds: L.LatLngBoundsExpression };
  homeLabel?: string;
  layers?: LayerGroup[];
  layerFootnote?: ReactNode;
  extraActions?: DockAction[];
  testId?: string;
}) {
  const map = useMap();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useMemo(() => ({ current: map.getContainer() }), [map]);

  useEffect(() => {
    if (!hostRef.current) return;
    L.DomEvent.disableClickPropagation(hostRef.current);
    L.DomEvent.disableScrollPropagation(hostRef.current);
  }, []);
  useEffect(() => {
    const onFs = () => setTimeout(() => map.invalidateSize(), 150);
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("resize", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("resize", onFs);
    };
  }, [map]);

  return (
    <div ref={hostRef}>
      <MapControlDock
        testId={testId}
        zClass="z-[1000]"
        fullscreenTarget={containerRef}
        layers={layers}
        layerFootnote={layerFootnote}
        actions={[
          { id: "zoom-in", label: "Zoom in", icon: Plus, onClick: () => map.zoomIn() },
          { id: "zoom-out", label: "Zoom out", icon: Minus, onClick: () => map.zoomOut() },
          {
            id: "recenter",
            label: homeLabel,
            icon: Crosshair,
            onClick: () =>
              "bounds" in home ? map.fitBounds(home.bounds) : map.setView(home.center, home.zoom),
          },
          ...extraActions,
        ]}
      />
    </div>
  );
}

/** The two basemaps offered on simple Leaflet maps. */
export const SIMPLE_BASEMAPS = {
  map: {
    label: "Map",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
    maxNativeZoom: 19,
  },
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    maxNativeZoom: 19,
  },
} as const;

export type SimpleBasemap = keyof typeof SIMPLE_BASEMAPS;

export function basemapGroup(
  selected: SimpleBasemap,
  onChange: (b: SimpleBasemap) => void,
): LayerGroup {
  return {
    id: "basemap",
    title: "Map",
    kind: "single",
    options: (Object.keys(SIMPLE_BASEMAPS) as SimpleBasemap[]).map((id) => ({
      id,
      label: SIMPLE_BASEMAPS[id].label,
    })),
    selected: [selected],
    onChange: ([v]) => onChange((v as SimpleBasemap) ?? "map"),
  };
}
