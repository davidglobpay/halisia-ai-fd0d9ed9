import { OutputTools, OutputVisual, OutputIcon } from "@/components/halisia/output-tools";
import { useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import { Cloud, Droplets, Loader2, Sun, Thermometer, Wind } from "lucide-react";
import { fetchOpenMeteo, wmoDescription, type OpenMeteoResponse } from "@/lib/weather";
import { Terrain3D } from "./terrain-3d";

export function WeatherPanel({ lat, lng }: { lat: number; lng: number }) {
  const q = useQuery<OpenMeteoResponse>({
    queryKey: ["open-meteo", lat.toFixed(3), lng.toFixed(3)],
    queryFn: ({ signal }) => fetchOpenMeteo(lat, lng, signal),
    staleTime: 15 * 60 * 1000,
  });

  if (q.isLoading || !q.data) {
    return (
      <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-accent" />
        Fetching live weather from Open-Meteo…
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="glass rounded-2xl p-4 text-sm text-amber-glow">
        Weather service unreachable. Try again in a moment.
      </div>
    );
  }

  const { current, daily, hourly } = q.data;

  const tempChart = {
    backgroundColor: "transparent",
    grid: { left: 32, right: 12, top: 16, bottom: 24 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: hourly.time.slice(0, 24).map((t) => t.slice(11, 16)),
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.15)" } },
      axisLabel: { color: "rgba(255,255,255,0.55)", fontSize: 10 },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: "rgba(255,255,255,0.55)",
        fontSize: 10,
        formatter: "{value}°",
      },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
    },
    series: [
      {
        name: "Temp",
        type: "line",
        smooth: true,
        showSymbol: false,
        data: hourly.temperature_2m.slice(0, 24),
        lineStyle: { width: 2, color: "#7dd3fc" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(125,211,252,0.45)" },
              { offset: 1, color: "rgba(125,211,252,0)" },
            ],
          },
        },
      },
    ],
  };

  const rainChart = {
    backgroundColor: "transparent",
    grid: { left: 32, right: 12, top: 16, bottom: 24 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: daily.time.map((t) => new Date(t).toLocaleDateString(undefined, { weekday: "short" })),
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.15)" } },
      axisLabel: { color: "rgba(255,255,255,0.55)", fontSize: 10 },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: "rgba(255,255,255,0.55)",
        fontSize: 10,
        formatter: "{value}mm",
      },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
    },
    series: [
      {
        type: "bar",
        data: daily.precipitation_sum,
        itemStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "#38bdf8" },
              { offset: 1, color: "#0ea5e9" },
            ],
          },
          borderRadius: [4, 4, 0, 0],
        },
      },
    ],
  };

  return (
    <div className="space-y-3" data-testid="weather-panel">
      <Terrain3D lat={lat} lng={lng} />
      <div className="glass-strong rounded-2xl p-4 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full blur-3xl opacity-40 bg-gradient-to-br from-cyan-glow to-primary" />
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Live weather · Open-Meteo
        </div>
        <div className="mt-1 flex items-end gap-3">
          <div className="text-4xl font-semibold tracking-tight">
            {Math.round(current.temperature_2m)}°C
          </div>
          <div className="text-xs text-muted-foreground pb-1.5">
            Feels {Math.round(current.apparent_temperature)}° ·{" "}
            {wmoDescription(current.weather_code)}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <Stat icon={Droplets} label="Humidity" value={`${current.relative_humidity_2m}%`} />
          <Stat icon={Wind} label="Wind" value={`${current.wind_speed_10m.toFixed(0)} km/h`} />
          <Stat icon={Cloud} label="Rain now" value={`${current.precipitation} mm`} />
        </div>
      </div>

      <div className="glass rounded-2xl p-3">
        <div className="flex items-center gap-2 mb-1">
          <Thermometer className="h-3.5 w-3.5 text-accent" />
          <div className="text-xs font-medium">Next 24 hours · temperature</div>
        </div>
        <div className="h-40">
          <ReactECharts option={tempChart} style={{ height: "100%", width: "100%" }} notMerge />
        </div>
      </div>

      <div className="glass rounded-2xl p-3">
        <div className="flex items-center gap-2 mb-1">
          <Droplets className="h-3.5 w-3.5 text-accent" />
          <div className="text-xs font-medium">7-day precipitation</div>
        </div>
        <div className="h-40">
          <ReactECharts option={rainChart} style={{ height: "100%", width: "100%" }} notMerge />
        </div>
      </div>

      <div className="glass rounded-2xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <Sun className="h-3.5 w-3.5 text-accent" />
          <div className="text-xs font-medium">7-day outlook</div>
        </div>
        <ul className="space-y-1.5">
          {daily.time.map((day, i) => (
            <li key={day} className="flex items-center gap-2 text-xs">
              <span className="w-12 text-muted-foreground">
                {new Date(day).toLocaleDateString(undefined, {
                  weekday: "short",
                })}
              </span>
              <span className="flex-1 truncate">{wmoDescription(daily.weather_code[i])}</span>
              <span className="text-amber-glow">UV {daily.uv_index_max[i]?.toFixed(0) ?? "—"}</span>
              <span className="tabular-nums">
                {Math.round(daily.temperature_2m_min[i])}° /{" "}
                <span className="font-medium">{Math.round(daily.temperature_2m_max[i])}°</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="text-[11px] text-muted-foreground px-1">
        Live from Open-Meteo · no API key required. Elevation model {q.data.elevation.toFixed(0)} m
        · timezone {q.data.timezone}.
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="glass rounded-xl p-2" data-output-card>
      <OutputTools label={label} />
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Icon className="h-3 w-3 text-accent" /> {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
