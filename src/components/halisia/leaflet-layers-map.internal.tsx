import { useEffect, useRef, useState } from "react";
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
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { getWave4Overlays, type Wave4Overlays } from "@/lib/wave4-overlays.functions";
import { Ruler, Hexagon, PenLine, Download, Trash2 } from "lucide-react";
import { usePersistedState } from "@/hooks/use-persisted-state";

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
    max: 19,
  },
  {
    id: "carto-dark",
    name: "Carto Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "© OpenStreetMap · © CARTO",
    max: 20,
  },
  {
    id: "carto-light",
    name: "Carto Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "© OpenStreetMap · © CARTO",
    max: 20,
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
          {BASEMAPS.map((b) => (
            <LayersControl.BaseLayer key={b.id} name={b.name} checked={b.id === "esri-sat"}>
              <TileLayer
                url={b.url}
                attribution={b.attribution}
                maxNativeZoom={b.max ?? 19}
                maxZoom={21}
              />
            </LayersControl.BaseLayer>
          ))}
          <LayersControl.Overlay name="Labels & roads" checked={showLabels}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
              attribution="Labels © CARTO"
              maxNativeZoom={20}
              maxZoom={21}
              eventHandlers={{ add: () => setShowLabels(true), remove: () => setShowLabels(false) }}
            />
          </LayersControl.Overlay>
          <LayersControl.Overlay name="Slope · hillshade">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}"
              attribution="Hillshade © Esri"
              maxNativeZoom={16}
              maxZoom={21}
              opacity={0.28}
            />
          </LayersControl.Overlay>
          <LayersControl.Overlay name="Drainage · hydro">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Hydro_Reference_Overlay/MapServer/tile/{z}/{y}/{x}"
              attribution="Hydro © Esri"
              maxNativeZoom={13}
              maxZoom={21}
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
              maxNativeZoom={19}
              maxZoom={21}
            />
          </LayersControl.Overlay>
          <LayersControl.Overlay name="OpenSeaMap">
            <TileLayer
              url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
              attribution="© OpenSeaMap"
              maxNativeZoom={18}
              maxZoom={21}
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
        <MapTools />
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

// -- Interactive measurement / drawing tools ---------------------------------

type Tool = "none" | "distance" | "area" | "draw";
type Pt = [number, number];

function haversineM(a: Pt, b: Pt) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}
function polylineLength(pts: Pt[]) {
  let m = 0;
  for (let i = 1; i < pts.length; i++) m += haversineM(pts[i - 1], pts[i]);
  return m;
}
function polygonAreaM2(pts: Pt[]) {
  // Spherical excess (Shoelace on projected mercator is close enough here).
  if (pts.length < 3) return 0;
  const R = 6378137;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const [lat1, lng1] = pts[i];
    const [lat2, lng2] = pts[(i + 1) % pts.length];
    sum +=
      (((lng2 - lng1) * Math.PI) / 180) *
      (2 + Math.sin((lat1 * Math.PI) / 180) + Math.sin((lat2 * Math.PI) / 180));
  }
  return Math.abs((sum * R * R) / 2);
}
function fmtDist(m: number) {
  return m < 1000 ? `${m.toFixed(0)} m` : `${(m / 1000).toFixed(2)} km`;
}
function fmtArea(m2: number) {
  return m2 < 10000 ? `${m2.toFixed(0)} m²` : `${(m2 / 10000).toFixed(2)} ha`;
}

function MapTools() {
  const map = useMap();
  const [tool, setTool] = usePersistedState<Tool>("halisia:mapTool", "none");
  const [pts, setPts] = useState<Pt[]>([]);
  const [readout, setReadout] = useState<string>("");
  const layerRef = useRef<L.LayerGroup | null>(null);
  if (!layerRef.current) layerRef.current = L.layerGroup().addTo(map);

  // Re-render leaflet drawings when points change.
  useEffect(() => {
    const g = layerRef.current!;
    g.clearLayers();
    if (pts.length === 0) {
      setReadout("");
      return;
    }
    pts.forEach((p) => L.circleMarker(p, { radius: 4, color: "#62e9ff", weight: 2 }).addTo(g));
    if (tool === "area" || tool === "draw") {
      if (pts.length >= 2) {
        const poly = L.polygon(pts, {
          color: "#d4a017",
          weight: 2,
          fillOpacity: 0.15,
        }).addTo(g);
        if (tool === "area" && pts.length >= 3) {
          const a = polygonAreaM2(pts);
          poly.bindTooltip(fmtArea(a), { permanent: true, direction: "center" }).openTooltip();
          setReadout(fmtArea(a));
        }
      }
    } else if (tool === "distance" && pts.length >= 2) {
      const line = L.polyline(pts, { color: "#62e9ff", weight: 2 }).addTo(g);
      const d = polylineLength(pts);
      line
        .bindTooltip(fmtDist(d), { permanent: true, direction: "top", sticky: true })
        .openTooltip();
      setReadout(fmtDist(d));
    }
  }, [pts, tool]);

  // Click handling.
  useMapEvents({
    click(e) {
      if (tool === "none") return;
      setPts((prev) => [...prev, [e.latlng.lat, e.latlng.lng] as Pt]);
    },
    dblclick() {
      if (tool !== "none") setTool("none");
    },
  });

  const clear = () => {
    setPts([]);
    setReadout("");
  };
  const pick = (t: Tool) => {
    setTool((cur) => (cur === t ? "none" : t));
    setPts([]);
  };
  const exportGeoJSON = () => {
    if (pts.length === 0) return;
    const isPoly = tool === "area" || tool === "draw";
    const feature = isPoly
      ? {
          type: "Feature" as const,
          properties: { tool, areaM2: polygonAreaM2(pts) },
          geometry: {
            type: "Polygon" as const,
            coordinates: [pts.concat([pts[0]]).map(([la, ln]) => [ln, la])],
          },
        }
      : {
          type: "Feature" as const,
          properties: { tool, lengthM: polylineLength(pts) },
          geometry: {
            type: "LineString" as const,
            coordinates: pts.map(([la, ln]) => [ln, la]),
          },
        };
    const fc = { type: "FeatureCollection" as const, features: [feature] };
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `halisia-features-${Date.now()}.geojson`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const btn = (active: boolean) =>
    `inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
      active
        ? "border-accent/60 bg-accent/20 text-accent"
        : "border-white/10 bg-black/40 text-foreground/80 hover:bg-white/10"
    }`;

  return (
    <div
      className="leaflet-top leaflet-left"
      data-testid="map-tools"
      style={{ pointerEvents: "auto" }}
    >
      <div className="leaflet-control leaflet-bar !border-none !bg-transparent !shadow-none">
        <div
          className="glass rounded-xl p-1.5 flex flex-col gap-1 min-w-[140px]"
          role="toolbar"
          aria-label="Map measurement and drawing tools"
        >
          <button
            type="button"
            onClick={() => pick("distance")}
            className={btn(tool === "distance")}
            data-testid="tool-distance"
            aria-pressed={tool === "distance"}
            aria-label="Measure distance"
          >
            <Ruler className="h-3 w-3" /> Distance
          </button>
          <button
            type="button"
            onClick={() => pick("area")}
            className={btn(tool === "area")}
            data-testid="tool-area"
            aria-pressed={tool === "area"}
            aria-label="Measure area"
          >
            <Hexagon className="h-3 w-3" /> Area
          </button>
          <button
            type="button"
            onClick={() => pick("draw")}
            className={btn(tool === "draw")}
            data-testid="tool-draw"
            aria-pressed={tool === "draw"}
            aria-label="Draw polygon"
          >
            <PenLine className="h-3 w-3" /> Draw polygon
          </button>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={exportGeoJSON}
              className={btn(false) + " flex-1"}
              data-testid="tool-export"
              disabled={pts.length === 0}
              aria-label="Export drawings as GeoJSON"
            >
              <Download className="h-3 w-3" /> Export
            </button>
            <button
              type="button"
              onClick={clear}
              className={btn(false)}
              data-testid="tool-clear"
              disabled={pts.length === 0}
              aria-label="Clear drawings"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          {tool !== "none" && (
            <div className="text-[10px] text-muted-foreground px-1" aria-live="polite">
              {tool === "distance" ? "Click to add points; double-click to finish." : null}
              {tool === "area" ? "Click 3+ points; double-click to finish." : null}
              {tool === "draw" ? "Click to draw; double-click to finish." : null}
            </div>
          )}
          {readout && (
            <div
              className="text-[11px] font-semibold tabular-nums text-accent px-1"
              data-testid="tool-readout"
              aria-live="polite"
            >
              {readout}
            </div>
          )}
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
