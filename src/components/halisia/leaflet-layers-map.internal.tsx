import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  LayersControl,
  ScaleControl,
  Polygon,
  Polyline,
  CircleMarker,
  Tooltip,
  LayerGroup,
} from "react-leaflet";
import L from "leaflet";
import { getWave4Overlays, type Wave4Overlays } from "@/lib/wave4-overlays.functions";

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

const BASEMAPS: Array<{
  id: string;
  name: string;
  url: string;
  attribution: string;
  max?: number;
}> = [
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
  const [overlays, setOverlays] = useState<Wave4Overlays | null>(null);
  useEffect(() => {
    let cancelled = false;
    getWave4Overlays({ data: { lat, lng } })
      .then((v) => !cancelled && setOverlays(v))
      .catch(() => !cancelled && setOverlays(null));
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  return (
    <div className="absolute inset-0">
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
          <LayersControl.Overlay name="Slope · hillshade" checked>
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}"
              attribution="Hillshade © Esri"
              opacity={0.55}
            />
          </LayersControl.Overlay>
          <LayersControl.Overlay name="Drainage · hydro">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Hydro_Reference_Overlay/MapServer/tile/{z}/{y}/{x}"
              attribution="Hydro © Esri"
            />
          </LayersControl.Overlay>
          {overlays && (
            <>
              <LayersControl.Overlay
                name={`Wave 4 · County boundary (${overlays.boundaries.county.length})`}
                checked
              >
                <LayerGroup>
                  {overlays.boundaries.county.map((r, i) => (
                    <Polygon
                      key={`c${i}`}
                      positions={r.coords}
                      pathOptions={{ color: "#f59e0b", weight: 2, fillOpacity: 0.03 }}
                    >
                      <Tooltip sticky>County · {r.name}</Tooltip>
                    </Polygon>
                  ))}
                </LayerGroup>
              </LayersControl.Overlay>
              <LayersControl.Overlay
                name={`Wave 4 · Ward boundary (${overlays.boundaries.ward.length})`}
              >
                <LayerGroup>
                  {overlays.boundaries.ward.map((r, i) => (
                    <Polygon
                      key={`w${i}`}
                      positions={r.coords}
                      pathOptions={{
                        color: "#22d3ee",
                        weight: 1.2,
                        dashArray: "4 3",
                        fillOpacity: 0.02,
                      }}
                    >
                      <Tooltip sticky>Ward · {r.name}</Tooltip>
                    </Polygon>
                  ))}
                </LayerGroup>
              </LayersControl.Overlay>
              <LayersControl.Overlay
                name={`Wave 4 · Drainage lines (${overlays.drainage.length})`}
                checked
              >
                <LayerGroup>
                  {overlays.drainage.map((r, i) => (
                    <Polyline
                      key={`d${i}`}
                      positions={r.coords}
                      pathOptions={{ color: "#38bdf8", weight: 1.6, opacity: 0.85 }}
                    >
                      <Tooltip sticky>{r.name}</Tooltip>
                    </Polyline>
                  ))}
                </LayerGroup>
              </LayersControl.Overlay>
              <LayersControl.Overlay
                name={`Wave 4 · Public facilities (${overlays.facilities.length})`}
                checked
              >
                <LayerGroup>
                  {overlays.facilities.map((f) => (
                    <CircleMarker
                      key={f.id}
                      center={[f.lat, f.lng]}
                      radius={5}
                      pathOptions={{
                        color: facilityColor(f.kind),
                        fillColor: facilityColor(f.kind),
                        fillOpacity: 0.85,
                        weight: 1,
                      }}
                    >
                      <Tooltip>
                        <div className="text-[11px]">
                          <div className="font-semibold capitalize">{f.kind.replace("_", " ")}</div>
                          <div>{f.label}</div>
                        </div>
                      </Tooltip>
                    </CircleMarker>
                  ))}
                </LayerGroup>
              </LayersControl.Overlay>
            </>
          )}
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
      <div className="pointer-events-none absolute bottom-2 right-2 glass rounded-xl px-3 py-2 text-[10px] text-foreground/90 space-y-1">
        <div className="uppercase tracking-widest text-muted-foreground">Legend</div>
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-4 bg-[#f59e0b]" />
          County boundary
        </div>
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-4 bg-[#22d3ee]" />
          Ward boundary
        </div>
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-4 bg-[#38bdf8]" />
          Drainage / river
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Facility
        </div>
      </div>
    </div>
  );
}

function facilityColor(kind: string) {
  if (kind === "hospital") return "#ef4444";
  if (kind === "school") return "#22c55e";
  if (kind === "police") return "#3b82f6";
  if (kind === "fire_station") return "#f97316";
  if (kind === "bank") return "#eab308";
  return "#a3e635";
}
