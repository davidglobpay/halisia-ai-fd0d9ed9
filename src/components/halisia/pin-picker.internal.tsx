import { useEffect, useState } from "react";
import { LeafletDock } from "@/components/halisia/map-controls/leaflet-dock";
import {
  SIMPLE_BASEMAPS,
  basemapGroup,
  type SimpleBasemap,
} from "@/components/halisia/map-controls/leaflet-basemaps";
import { retryTileOnPublicHost } from "@/lib/esri-tiles";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";

const Icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom() < 12 ? 13 : map.getZoom());
  }, [lat, lng, map]);
  return null;
}

function ClickCatcher({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

export default function PinPickerInternal({
  lat,
  lng,
  onPick,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const center: [number, number] = [lat ?? -1.286389, lng ?? 36.817223];
  const [basemap, setBasemap] = useState<SimpleBasemap>("map");
  const base = SIMPLE_BASEMAPS[basemap];
  return (
    <MapContainer
      center={center}
      zoom={lat != null ? 14 : 6}
      zoomControl={false}
      className="absolute inset-0 h-full w-full"
    >
      <TileLayer
        key={basemap}
        url={base.url}
        attribution={base.attribution}
        maxNativeZoom={base.maxNativeZoom}
        maxZoom={21}
        eventHandlers={{ tileerror: retryTileOnPublicHost }}
      />
      <LeafletDock
        testId="pin-picker-dock"
        home={{ center, zoom: lat != null ? 16 : 6 }}
        homeLabel={lat != null ? "Back to the pin" : "Back to the start"}
        layers={[basemapGroup(basemap, setBasemap)]}
      />
      <ClickCatcher onPick={onPick} />
      {lat != null && lng != null && (
        <>
          <Marker
            position={[lat, lng]}
            icon={Icon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const p = (e.target as L.Marker).getLatLng();
                onPick(p.lat, p.lng);
              },
            }}
          />
          <Recenter lat={lat} lng={lng} />
        </>
      )}
    </MapContainer>
  );
}
