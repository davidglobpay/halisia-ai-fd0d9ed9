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
