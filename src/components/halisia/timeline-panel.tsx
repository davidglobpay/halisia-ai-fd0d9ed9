import { ListenButton } from "./listen-button";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import gsap from "gsap";
import { Loader2, Play, Pause, RotateCw } from "lucide-react";
import { fetchOpenMeteoArchive, type OpenMeteoArchive } from "@/lib/weather";

// Aggregate daily archive into monthly buckets.
function monthlyBuckets(a: OpenMeteoArchive) {
  const buckets = new Map<string, { tMin: number[]; tMax: number[]; precip: number }>();
  const { time, temperature_2m_max, temperature_2m_min, precipitation_sum } = a.daily;
  for (let i = 0; i < time.length; i++) {
    const key = time[i].slice(0, 7);
    let b = buckets.get(key);
    if (!b) {
      b = { tMin: [], tMax: [], precip: 0 };
      buckets.set(key, b);
    }
    if (Number.isFinite(temperature_2m_max[i])) b.tMax.push(temperature_2m_max[i]);
    if (Number.isFinite(temperature_2m_min[i])) b.tMin.push(temperature_2m_min[i]);
    if (Number.isFinite(precipitation_sum[i])) b.precip += precipitation_sum[i];
  }
  const months = Array.from(buckets.keys()).sort();
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return months.map((m) => {
    const b = buckets.get(m)!;
    return {
      month: m,
      tMax: +avg(b.tMax).toFixed(1),
      tMin: +avg(b.tMin).toFixed(1),
      precip: +b.precip.toFixed(1),
    };
  });
}

export function TimelinePanel({ lat, lng }: { lat: number; lng: number }) {
  const q = useQuery({
    queryKey: ["archive", lat.toFixed(3), lng.toFixed(3)],
    queryFn: () => fetchOpenMeteoArchive(lat, lng),
    staleTime: 60 * 60 * 1000,
  });

  const data = useMemo(() => (q.data ? monthlyBuckets(q.data) : []), [q.data]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (data.length) setIdx(data.length - 1);
  }, [data.length]);

  useEffect(() => {
    if (!playing || !data.length) return;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1 >= data.length ? 0 : i + 1));
    }, 750);
    return () => window.clearInterval(t);
  }, [playing, data.length]);

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
      );
    }
  }, [idx]);

  if (q.isLoading)
    return (
      <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-accent" />
        Loading 12 months of historical climate…
      </div>
    );

  if (q.isError || !data.length)
    return (
      <div className="glass rounded-2xl p-4 text-sm text-muted-foreground">
        Historical archive unavailable for this point right now.
      </div>
    );

  const current = data[Math.min(idx, data.length - 1)];
  const months = data.map((d) => d.month);

  const option = {
    grid: { top: 20, right: 20, bottom: 40, left: 40 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: months,
      axisLabel: {
        color: "#8FA1C7",
        fontSize: 10,
        formatter: (v: string) => v.slice(2),
      },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.15)" } },
    },
    yAxis: [
      {
        type: "value",
        name: "°C",
        nameTextStyle: { color: "#8FA1C7", fontSize: 10 },
        axisLabel: { color: "#8FA1C7", fontSize: 10 },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
      },
      {
        type: "value",
        name: "mm",
        nameTextStyle: { color: "#8FA1C7", fontSize: 10 },
        axisLabel: { color: "#8FA1C7", fontSize: 10 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: "Max °C",
        type: "line",
        smooth: true,
        showSymbol: false,
        data: data.map((d) => d.tMax),
        lineStyle: { color: "#FFC65C", width: 2 },
        areaStyle: { color: "rgba(255, 198, 92, 0.12)" },
      },
      {
        name: "Min °C",
        type: "line",
        smooth: true,
        showSymbol: false,
        data: data.map((d) => d.tMin),
        lineStyle: { color: "#62E9FF", width: 2 },
      },
      {
        name: "Rainfall (mm)",
        type: "bar",
        yAxisIndex: 1,
        data: data.map((d) => d.precip),
        itemStyle: { color: "rgba(45, 140, 255, 0.55)" },
      },
    ],
    markLine: {
      silent: true,
      symbol: "none",
      data: [
        {
          xAxis: months[idx],
          lineStyle: { color: "#5AF0A5", type: "solid", width: 2 },
        },
      ],
    },
  } as const;

  return (
    <div className="space-y-3">
      <div className="glass-strong rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-[10px] uppercase tracking-widest text-accent">
            Historical timeline · 12 months
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setPlaying((p) => !p)}
              className="glass rounded-full p-1.5 hover:bg-white/10"
              aria-label={playing ? "Pause playback" : "Play playback"}
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => setIdx(0)}
              className="glass rounded-full p-1.5 hover:bg-white/10"
              aria-label="Restart"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <ReactECharts option={option} style={{ height: 240 }} notMerge lazyUpdate />
        <input
          type="range"
          min={0}
          max={data.length - 1}
          value={idx}
          onChange={(e) => setIdx(parseInt(e.target.value, 10))}
          className="mt-3 w-full accent-[oklch(0.68_0.19_249)]"
          aria-label="Timeline scrubber"
        />
      </div>

      <div ref={cardRef} className="grid grid-cols-3 gap-2">
        <Tile label="Month" value={current.month} />
        <Tile label="Avg max" value={`${current.tMax}°C`} tone="text-amber-glow" />
        <Tile label="Rainfall" value={`${current.precip} mm`} tone="text-cyan-glow" />
      </div>
      <div className="text-[11px] text-muted-foreground px-1">
        Source: Open-Meteo historical reanalysis (ERA5). Aggregated to monthly means; use the
        scrubber or play to sweep the year.
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="glass rounded-xl p-3">
      <ListenButton
        label={`Listen to ${label}`}
        text={`${label}: ${value}. Open-Meteo historical weather.`}
      />
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold tracking-tight ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
