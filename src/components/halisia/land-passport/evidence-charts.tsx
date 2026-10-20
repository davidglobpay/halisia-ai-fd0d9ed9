import type { Wave4Intel } from "@/lib/wave4-intel.functions";
import type { GeotechIntel } from "@/lib/geotech.functions";

type Point = { label: string; value: number | null };
/** SVG series retain missing values as gaps, with a complete accessible table. */
export function EvidenceSeries({
  title,
  points,
  unit,
  bars = false,
}: {
  title: string;
  points: Point[];
  unit: string;
  bars?: boolean;
}) {
  const valid = points.filter((p) => p.value != null && Number.isFinite(p.value));
  if (!valid.length) return null;
  const low = bars
    ? Math.min(0, ...valid.map((p) => p.value!))
    : Math.min(...valid.map((p) => p.value!));
  const high = Math.max(...valid.map((p) => p.value!));
  const span = high - low || 1;
  const x = (i: number) => 40 + (i * 420) / Math.max(1, points.length - 1);
  const y = (v: number) => 150 - ((v - low) * 110) / span;
  const baseline = y(0);
  return (
    <figure className="my-3 rounded-xl bg-muted/40 p-3" aria-label={title}>
      <figcaption className="text-xs font-semibold">
        {title} · {unit}
      </figcaption>
      <svg
        viewBox="0 0 500 190"
        role="img"
        aria-label={`${title}. Values in ${unit}; missing samples are gaps.`}
        className="w-full"
      >
        <line x1="40" x2="460" y1="150" y2="150" stroke="currentColor" opacity=".3" />
        <text x="3" y="40" fontSize="11" fill="currentColor">
          {high.toFixed(1)}
        </text>
        <text x="3" y="154" fontSize="11" fill="currentColor">
          {low.toFixed(1)}
        </text>
        {points.map((p, i) =>
          p.value == null || !Number.isFinite(p.value) ? null : (
            <g key={i}>
              {bars ? (
                <rect
                  x={x(i) - 7}
                  y={Math.min(y(p.value), baseline)}
                  width="14"
                  height={Math.max(1, Math.abs(baseline - y(p.value)))}
                  fill="#147b35"
                />
              ) : (
                <>
                  {i > 0 && points[i - 1].value != null && Number.isFinite(points[i - 1].value) && (
                    <line
                      x1={x(i - 1)}
                      x2={x(i)}
                      y1={y(points[i - 1].value!)}
                      y2={y(p.value)}
                      stroke="#147b35"
                      strokeWidth="2.5"
                    />
                  )}
                  <circle cx={x(i)} cy={y(p.value)} r="3" fill="#147b35" />
                </>
              )}
              {(i % Math.max(1, Math.ceil(points.length / 6)) === 0 || i === points.length - 1) && (
                <text x={x(i)} y="174" textAnchor="middle" fill="currentColor" fontSize="10">
                  {p.label}
                </text>
              )}
            </g>
          ),
        )}
      </svg>
      <details className="text-xs">
        <summary className="cursor-pointer py-2">Read chart values</summary>
        <table className="w-full">
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">{unit}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <th scope="row">{p.label}</th>
                <td>
                  {p.value != null && Number.isFinite(p.value)
                    ? p.value.toFixed(1)
                    : "Not returned"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export function ClimateEvidence({ id, data }: { id: string; data?: Wave4Intel | null }) {
  if (id === "weather" && data?.weather?.points.length)
    return (
      <div>
        <p className="mt-3 text-xs text-muted-foreground">
          MET Norway forecast · issued {data.weather.updatedAt ?? "time not supplied"} · times in
          Kenya (UTC+3)
        </p>
        <EvidenceSeries
          title="Temperature forecast"
          unit="°C"
          points={data.weather.points.map((p) => ({
            label: new Date(p.time).toLocaleTimeString("en-KE", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Africa/Nairobi",
            }),
            value: p.temperatureC,
          }))}
        />
        <EvidenceSeries
          title="Rain in the following hour"
          unit="mm / hour"
          bars
          points={data.weather.points.map((p) => ({
            label: new Date(p.time).toLocaleTimeString("en-KE", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Africa/Nairobi",
            }),
            value: p.rainfallMm,
          }))}
        />
        <EvidenceSeries
          title="Wind forecast"
          unit="m/s"
          points={data.weather.points.map((p) => ({
            label: new Date(p.time).toLocaleTimeString("en-KE", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Africa/Nairobi",
            }),
            value: p.windMS,
          }))}
        />
      </div>
    );
  const monthly = data?.climate.monthly;
  if ((id === "rain" || id === "temp") && monthly?.length)
    return (
      <div>
        <p className="mt-3 text-xs text-muted-foreground">
          {data?.climate.source} · {data?.climate.period} · regional model
        </p>
        <EvidenceSeries
          title={id === "rain" ? "Monthly rainfall climatology" : "Monthly temperature climatology"}
          unit={id === "rain" ? "mm / month" : "°C"}
          bars={id === "rain"}
          points={monthly.map((p) => ({
            label: p.month,
            value: id === "rain" ? p.rainfallMm : p.temperatureC,
          }))}
        />
      </div>
    );
  return null;
}

export function PhysicalEvidence({ id, data }: { id: string; data?: GeotechIntel | null }) {
  if ((id === "soil" || id === "subsoil") && data?.soilLayers.length)
    return (
      <figure
        className="my-3 rounded-xl bg-muted/40 p-3"
        aria-label="Regional soil profile by model depth"
      >
        <figcaption className="text-xs font-semibold">
          Soil cutaway · regional model, not a borehole log
        </figcaption>
        <svg
          viewBox={`0 0 500 ${70 + data.soilLayers.length * 55}`}
          role="img"
          aria-label="Soil composition by returned depth band"
          className="w-full"
        >
          {data.soilLayers.map((s, i) => (
            <g key={s.depth}>
              <rect
                x="10"
                y={20 + i * 55}
                width="130"
                height="52"
                fill={["#876344", "#a57b52", "#bc9768", "#76533d"][i % 4]}
              />
              <text x="20" y={50 + i * 55} fill="white" fontSize="15">
                {s.depth}
              </text>
              <text x="155" y={40 + i * 55} fill="currentColor" fontSize="13">
                {s.texture}
              </text>
              <text x="155" y={60 + i * 55} fill="currentColor" fontSize="12">
                Sand {s.sandPct.toFixed(0)}% · silt {s.siltPct.toFixed(0)}% · clay{" "}
                {s.clayPct.toFixed(0)}%
              </text>
            </g>
          ))}
          <text x="10" y={50 + data.soilLayers.length * 55} fill="currentColor" fontSize="11">
            Bedrock and water-table depth not measured; no depth plotted.
          </text>
        </svg>
        <p className="text-xs text-muted-foreground">
          ISRIC SoilGrids 250 m model. Equal-height bands explain the returned depth intervals;
          drawing is not to vertical scale.
        </p>
      </figure>
    );
  const t = data?.terrain;
  if (
    (id === "slope" || id === "landform") &&
    data?.terrainMeasured &&
    t &&
    Number.isFinite(t.slopePct)
  ) {
    const angle = (Math.atan(t.slopePct / 100) * 180) / Math.PI;
    const rise = Math.min(110, Math.max(0, t.slopePct * 2));
    return (
      <figure className="my-3 rounded-xl bg-muted/40 p-3" aria-label="Regional slope explanation">
        <figcaption className="text-xs font-semibold">
          Slope cutaway · {t.slopePct.toFixed(1)}% / {angle.toFixed(1)}°
        </figcaption>
        <svg
          viewBox="0 0 500 200"
          role="img"
          aria-label={`Schematic regional slope ${angle.toFixed(1)} degrees; modelled aspect ${t.aspectLabel}`}
          className="w-full"
        >
          <path d={`M40 150 L440 ${150 - rise} L440 170 L40 170 Z`} fill="#b79b73" />
          <line x1="40" x2="440" y1="150" y2="150" stroke="#147b35" strokeDasharray="5 5" />
          <text x="40" y="190" fill="currentColor" fontSize="12">
            100 m horizontal → {t.slopePct.toFixed(1)} m rise
          </text>
          <text x="40" y="30" fill="currentColor" fontSize="13">
            Modelled downslope aspect: {t.aspectLabel} ({t.aspectDeg}°)
          </text>
        </svg>
        <p className="text-xs text-muted-foreground">
          ASTER regional grid · elevation range {t.minM.toFixed(0)}–{t.maxM.toFixed(0)} m. Schematic
          with vertical exaggeration; not the exact site profile.
        </p>
      </figure>
    );
  }
  return null;
}
