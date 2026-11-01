import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON, ScaleControl } from "react-leaflet";
import { LeafletDock } from "@/components/halisia/map-controls/leaflet-dock";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import countiesData from "@/data/kenya-counties.json";
import { metricRampT, type CountyMetric } from "@/lib/county-metrics";

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

  // Shading position comes from the shared ramp in county-metrics, which is
  // logarithmic: Kenyan county densities span about 6 to 6,300 people per km²,
  // and a linear ramp collapses 45 of the 47 counties into one colour.
  const styleFor = (code: number, hovered: boolean, sel: boolean): L.PathOptions => {
    return {
      fillColor: ramp(metricRampT(code, metric)),
      fillOpacity: sel ? 0.6 : hovered ? 0.45 : 0.28,
      color: sel ? "#102D1A" : hovered ? "#147B35" : "#C08A2E",
      weight: sel ? 2.4 : hovered ? 1.8 : 0.9,
      opacity: 0.95,
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
  }, [metric, selected, hoverCode]);

  return (
    <MapContainer
      center={[0.5, 37.9]}
      zoom={6}
      zoomControl={false}
      scrollWheelZoom
      className="absolute inset-0 h-full w-full bg-[#F1ECE0]"
      style={{ background: "#F1ECE0" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxNativeZoom={20}
        maxZoom={21}
      />
      <LeafletDock
        testId="county-map-dock"
        home={{ center: [0.5, 37.9], zoom: 6 }}
        homeLabel="Show all of Kenya"
      />
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
