import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import type { LocationIntel } from "@/lib/location-intel.functions";

function HeatOverlay({ points }: { points: Array<[number, number, number]> }) {
  const map = useMap();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<any>(null);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layer = (L as any).heatLayer(points, {
      radius: 30,
      blur: 22,
      maxZoom: 17,
      gradient: {
        0.2: "#2D8CFF",
        0.4: "#62E9FF",
        0.6: "#5AF0A5",
        0.8: "#FFC65C",
        1.0: "#FF5A6E",
      },
    });
    layer.addTo(map);
    ref.current = layer;
    return () => {
      layer.remove();
    };
  }, [map, points]);
  return null;
}

export default function HeatmapMap({
  lat,
  lng,
  intel,
}: {
  lat: number;
  lng: number;
  intel: LocationIntel | undefined;
}) {
  const points: Array<[number, number, number]> = [];
  if (intel) {
    const weights: Record<string, number> = {
      schools: 0.8,
      hospitals: 1.0,
      groceries: 0.7,
      transit: 0.9,
      restaurants: 0.5,
      banks: 0.6,
    };
    (Object.keys(intel.categories) as Array<keyof typeof intel.categories>).forEach((k) => {
      intel.categories[k].forEach((p) => {
        if (p.location) points.push([p.location.lat, p.location.lng, weights[k] ?? 0.6]);
      });
    });
  }

  return (
    <div className="absolute inset-0">
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        scrollWheelZoom
        className="h-full w-full"
        key={`${lat.toFixed(4)}-${lng.toFixed(4)}`}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="© OpenStreetMap · © CARTO"
          maxNativeZoom={20}
          maxZoom={21}
        />
        {points.length > 0 && <HeatOverlay points={points} />}
        <Marker position={[lat, lng]}>
          <Popup>
            <div className="text-xs">
              <div className="font-semibold">Selected point</div>
              <div className="opacity-70">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </div>
              <div className="opacity-70 mt-1">{points.length} amenities heat-mapped</div>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
      <div className="pointer-events-none absolute bottom-3 left-3 glass rounded-lg px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        Amenity density heatmap · {points.length} points
      </div>
    </div>
  );
}
