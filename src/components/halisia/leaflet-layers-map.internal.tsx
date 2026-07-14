import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, LayersControl, ScaleControl } from "react-leaflet";
import L from "leaflet";

const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const BASEMAPS: Array<{ id: string; name: string; url: string; attribution: string; max?: number }> = [
  {
    id: "osm",
    name: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
  },
  {
    id: "carto-dark",
    name: "Carto Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "© OpenStreetMap · © CARTO",
  },
  {
    id: "carto-light",
    name: "Carto Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "© OpenStreetMap · © CARTO",
  },
  {
    id: "esri-sat",
    name: "Esri Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles © Esri, Maxar, Earthstar Geographics",
    max: 19,
  },
  {
    id: "opentopo",
    name: "OpenTopoMap",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenTopoMap (CC-BY-SA)",
    max: 17,
  },
];

export default function LeafletLayersMap({
  lat,
  lng,
  label,
}: {
  lat: number;
  lng: number;
  label: string;
}) {
  const [showLabels, setShowLabels] = useState(true);
  return (
    <div className="relative h-[420px] rounded-2xl overflow-hidden border border-white/10">
      <MapContainer
        center={[lat, lng]}
        zoom={13}
        scrollWheelZoom
        className="h-full w-full"
        key={`${lat.toFixed(4)}-${lng.toFixed(4)}`}
      >
        <LayersControl position="topright">
          {BASEMAPS.map((b, i) => (
            <LayersControl.BaseLayer key={b.id} name={b.name} checked={i === 3}>
              <TileLayer url={b.url} attribution={b.attribution} maxZoom={b.max ?? 19} />
            </LayersControl.BaseLayer>
          ))}
          <LayersControl.Overlay name="Labels & roads" checked={showLabels}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
              attribution="Labels © CARTO"
              eventHandlers={{ add: () => setShowLabels(true), remove: () => setShowLabels(false) }}
            />
          </LayersControl.Overlay>
          <LayersControl.Overlay name="OpenRailway">
            <TileLayer
              url="https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png"
              attribution="© OpenRailwayMap"
            />
          </LayersControl.Overlay>
          <LayersControl.Overlay name="OpenSeaMap">
            <TileLayer
              url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
              attribution="© OpenSeaMap"
            />
          </LayersControl.Overlay>
        </LayersControl>
        <ScaleControl position="bottomleft" imperial={false} />
        <Marker position={[lat, lng]}>
          <Popup>
            <div className="text-xs">
              <div className="font-semibold">{label}</div>
              <div className="opacity-70">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </div>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}