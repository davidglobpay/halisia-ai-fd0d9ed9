import { MapContainer, Marker, Popup, ScaleControl, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { esriTileTemplate } from "@/lib/esri-tiles";

const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const SimulatedIcon = L.divIcon({
  className: "halisia-simulated-marker",
  html: '<span data-testid="simulated-map-pin" style="display:block;width:28px;height:28px;border-radius:999px;background:#62E9FF;border:4px solid #ffffff;box-shadow:0 0 0 8px rgba(98,233,255,.22),0 12px 28px rgba(0,0,0,.38);cursor:grab"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function MapClickBridge({
  onMapClick,
}: {
  onMapClick?: (loc: { lat: number; lng: number }) => void;
}) {
  useMapEvents({
    click: (event) => onMapClick?.({ lat: event.latlng.lat, lng: event.latlng.lng }),
  });
  return null;
}

export default function MapFallback({
  lat,
  lng,
  label,
  theme = "dark",
  mapType = "roadmap",
  draggable = false,
  tileRetryKey = 0,
  onMarkerDrag,
  onMapClick,
  onTileError,
}: {
  lat: number;
  lng: number;
  label?: string;
  theme?: "dark" | "light";
  mapType?: "roadmap" | "satellite" | "hybrid" | "terrain";
  draggable?: boolean;
  tileRetryKey?: number;
  onMarkerDrag?: (loc: { lat: number; lng: number }) => void;
  onMapClick?: (loc: { lat: number; lng: number }) => void;
  onTileError?: () => void;
}) {
  // Retain a conservative native cap; Leaflet upscales beyond it.
  const maxNative = mapType === "terrain" ? 17 : 19;
  const url =
    mapType === "satellite" || mapType === "hybrid"
      ? esriTileTemplate("World_Imagery")
      : mapType === "terrain"
        ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
        : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
  const attribution =
    mapType === "satellite" || mapType === "hybrid"
      ? "Tiles © Esri, Maxar, Earthstar Geographics"
      : "Tiles © Esri and contributors";
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={13}
      zoomControl
      scrollWheelZoom
      className="absolute inset-0 h-full w-full"
      key={`${lat.toFixed(4)}-${lng.toFixed(4)}-${mapType}-${theme}`}
    >
      <TileLayer
        key={`${tileRetryKey}-${url}`}
        url={url}
        attribution={attribution}
        maxNativeZoom={maxNative}
        maxZoom={21}
        eventHandlers={{ tileerror: () => onTileError?.() }}
      />
      <ScaleControl position="bottomleft" />
      <MapClickBridge onMapClick={onMapClick} />
      <Marker
        position={[lat, lng]}
        draggable={draggable}
        icon={draggable ? SimulatedIcon : DefaultIcon}
        eventHandlers={
          draggable
            ? {
                dragend: (event) => {
                  const marker = event.target as L.Marker;
                  const next = marker.getLatLng();
                  onMarkerDrag?.({ lat: next.lat, lng: next.lng });
                },
              }
            : undefined
        }
      >
        <Popup>
          <div className="text-xs">
            <div className="font-semibold">{label ?? "Selected point"}</div>
            <div className="opacity-70">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </div>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
