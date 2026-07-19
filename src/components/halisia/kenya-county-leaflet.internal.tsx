import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON, ZoomControl, ScaleControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import countiesData from "@/data/kenya-counties.json";
import { metricValue, type CountyMetric } from "@/lib/county-metrics";

function ramp(pct: number): string {
  const stops: Array<[number, [number, number, number]]> = [
    [0.0, [37, 99, 235]],
    [0.5, [98, 233, 255]],
    [1.0, [251, 191, 36]],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ca] = stops[i];
    const [b, cb] = stops[i + 1];
    if (pct <= b) {
      const t = (pct - a) / (b - a);
      const c = ca.map((v, k) => Math.round(v + (cb[k] - v) * t));
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    }
  }
  return `rgb(251,191,36)`;
}

type Props = {
  metric: CountyMetric;
  selected: number[];
  onToggle: (code: number) => void;
  onHover: (code: number | null) => void;
  hoverCode: number | null;
};

export default function KenyaCountyLeaflet({
  metric,
  selected,
  onToggle,
  onHover,
  hoverCode,
}: Props) {
  const layerRef = useRef<L.GeoJSON | null>(null);

  const { min, max } = useMemo(() => {
    const values = (countiesData as { features: { properties: { code: number } }[] }).features.map(
      (f) => metricValue(f.properties.code, metric),
    );
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [metric]);

  const styleFor = (code: number, hovered: boolean, sel: boolean): L.PathOptions => {
    const v = metricValue(code, metric);
    const pct = max === min ? 0.5 : (v - min) / (max - min);
    return {
      fillColor: ramp(pct),
      fillOpacity: sel ? 0.75 : hovered ? 0.55 : 0.35,
      color: sel ? "#ffffff" : hovered ? "#62E9FF" : "#2D8CFF",
      weight: sel ? 2.4 : hovered ? 1.8 : 0.8,
      opacity: 0.9,
    };
  };

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.eachLayer((child) => {
      const feat = (child as L.Path & { feature?: { properties: { code: number } } }).feature;
      const code = feat?.properties.code;
      if (typeof code === "number") {
        (child as L.Path).setStyle(styleFor(code, hoverCode === code, selected.includes(code)));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, selected, hoverCode, min, max]);

  return (
    <MapContainer
      center={[0.5, 37.9]}
      zoom={6}
      zoomControl={false}
      scrollWheelZoom
      className="absolute inset-0 h-full w-full bg-[#0a1735]"
      style={{ background: "#0a1735" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <ZoomControl position="topright" />
      <ScaleControl position="bottomleft" />
      <GeoJSON
        // @ts-expect-error - the bundled GeoJSON matches Feature<Polygon>
        data={countiesData}
        ref={(l) => {
          layerRef.current = l ?? null;
        }}
        style={(feat) => {
          const code = (feat?.properties as { code: number }).code;
          return styleFor(code, hoverCode === code, selected.includes(code));
        }}
        onEachFeature={(feature, layer) => {
          const code = (feature.properties as { code: number; name: string }).code;
          const name = (feature.properties as { code: number; name: string }).name;
          layer.bindTooltip(name, { direction: "top", sticky: true });
          layer.on({
            mouseover: () => onHover(code),
            mouseout: () => onHover(null),
            click: () => onToggle(code),
          });
        }}
      />
    </MapContainer>
  );
}
