/// <reference types="google.maps" />
import { useEffect, useMemo, useRef, useState } from "react";
import countiesData from "@/data/kenya-counties.json";
import {
  METRIC_LABELS,
  countyMetrics,
  confidence,
  metricValue,
  formatMetric,
  type CountyMetric,
} from "@/lib/county-metrics";
import { generateCountyComparePdf } from "@/lib/pdf-county-compare";
import {
  Activity,
  Droplets,
  Users,
  TrendingUp,
  Check,
  X as XIcon,
  FileDown,
  Loader2,
} from "lucide-react";

type County = { code: number; name: string; lat: number; lng: number };

const COUNTIES: County[] = (countiesData as { features: { properties: County }[] }).features.map(
  (f) => f.properties,
);

const METRIC_ICONS: Record<CountyMetric, typeof Activity> = {
  livability: Activity,
  population: Users,
  growth: TrendingUp,
  water: Droplets,
};

let loaderPromise: Promise<typeof google> | null = null;
function loadMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  const w = window as unknown as { google?: typeof google };
  if (w.google?.maps) return Promise.resolve(w.google);
  if (loaderPromise) return loaderPromise;
  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
  loaderPromise = new Promise((resolve, reject) => {
    (window as unknown as { __initHalisiaMap?: () => void }).__initHalisiaMap = () =>
      resolve((window as unknown as { google: typeof google }).google);
    const existing = document.querySelector<HTMLScriptElement>('script[data-halisia-maps="1"]');
    if (existing) {
      existing.addEventListener("load", () =>
        resolve((window as unknown as { google: typeof google }).google),
      );
      return;
    }
    const s = document.createElement("script");
    s.dataset.halisiaMaps = "1";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__initHalisiaMap&channel=${channel}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

// Colour ramp: low → high on the same metric range.
function ramp(pct: number): string {
  // pct 0..1 → cool→warm gradient tuned to design system
  const stops = [
    [0.0, [37, 99, 235]], // primary
    [0.5, [98, 233, 255]], // cyan-glow
    [1.0, [251, 191, 36]], // amber-glow
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ca] = stops[i] as [number, number[]];
    const [b, cb] = stops[i + 1] as [number, number[]];
    if (pct <= b) {
      const t = (pct - a) / (b - a);
      const c = ca.map((v, k) => Math.round(v + (cb[k] - v) * t));
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    }
  }
  return `rgb(251,191,36)`;
}

function ConfidenceDots({
  level,
  metric,
  countyName,
}: {
  level: "low" | "med" | "high";
  metric: CountyMetric;
  countyName: string;
}) {
  const n = level === "high" ? 3 : level === "med" ? 2 : 1;
  const tip = `${METRIC_LABELS[metric]} for ${countyName}: ${level.toUpperCase()} confidence — ${
    level === "high"
      ? "cross-verified against multiple public sources."
      : level === "med"
        ? "partially sourced; consider on-the-ground verification."
        : "sparse data; treat as a directional signal only."
  }`;
  return (
    <span className="inline-flex items-center gap-0.5" title={tip} aria-label={tip}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${i < n ? "bg-accent" : "bg-white/15"}`}
        />
      ))}
    </span>
  );
}

export function KenyaCountyMap() {
  const [metric, setMetric] = useState<CountyMetric>("livability");
  const [hoverCode, setHoverCode] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = new URLSearchParams(window.location.search).get("compare");
    if (!raw) return [];
    return raw
      .split(",")
      .map((n) => parseInt(n, 10))
      .filter((n) => Number.isFinite(n) && COUNTIES.some((c) => c.code === n))
      .slice(0, 4);
  });
  const [downloading, setDownloading] = useState(false);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const dataLayerRef = useRef<google.maps.Data | null>(null);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Sync ?compare=… in URL without triggering a router re-render.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (selected.length) url.searchParams.set("compare", selected.join(","));
    else url.searchParams.delete("compare");
    window.history.replaceState({}, "", url.toString());
  }, [selected]);

  // Values for the current metric (used to normalise ramp).
  const values = useMemo(() => COUNTIES.map((c) => metricValue(c.code, metric)), [metric]);
  const min = Math.min(...values);
  const max = Math.max(...values);

  const styleFor = (code: number, hovered: boolean, sel: boolean) => {
    const v = metricValue(code, metric);
    const pct = max === min ? 0.5 : (v - min) / (max - min);
    return {
      fillColor: ramp(pct),
      fillOpacity: sel ? 0.75 : hovered ? 0.55 : 0.35,
      strokeColor: sel ? "#ffffff" : hovered ? "#62E9FF" : "#2D8CFF",
      strokeWeight: sel ? 2.4 : hovered ? 1.8 : 0.8,
      strokeOpacity: 0.9,
      clickable: true,
    };
  };

  // Init map + polygons
  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then((g) => {
        if (cancelled || !mapEl.current) return;
        const map = new g.maps.Map(mapEl.current, {
          center: { lat: 0.5, lng: 37.9 },
          zoom: 6,
          mapTypeId: "roadmap",
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          backgroundColor: "#0a1735",
          styles: [
            { elementType: "geometry", stylers: [{ color: "#0a1735" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#8ab4ff" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#0a1735" }] },
            {
              featureType: "administrative",
              elementType: "geometry",
              stylers: [{ visibility: "off" }],
            },
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#0f2050" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#050d24" }] },
          ],
        });
        mapRef.current = map;
        const data = new g.maps.Data({ map });
        dataLayerRef.current = data;
        data.addGeoJson(countiesData as unknown as object);

        data.addListener("mouseover", (e: google.maps.Data.MouseEvent) => {
          const code = e.feature.getProperty("code") as number;
          setHoverCode(code);
        });
        data.addListener("mouseout", () => setHoverCode(null));
        data.addListener("click", (e: google.maps.Data.MouseEvent) => {
          const code = e.feature.getProperty("code") as number;
          toggleSelect(code);
          const el = cardRefs.current[code];
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-style whenever metric / hover / selection changes.
  useEffect(() => {
    const data = dataLayerRef.current;
    if (!data) return;
    data.setStyle((feature) => {
      const code = feature.getProperty("code") as number;
      return styleFor(code, hoverCode === code, selected.includes(code));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, hoverCode, selected, min, max]);

  function toggleSelect(code: number) {
    setSelected((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= 4) return prev; // cap at 4 for the compare panel
      return [...prev, code];
    });
  }

  function clearSelection() {
    setSelected([]);
  }

  async function downloadCompare() {
    if (selected.length < 2) return;
    setDownloading(true);
    try {
      const chosen = COUNTIES.filter((c) => selected.includes(c.code));
      await generateCountyComparePdf(chosen);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  }

  // Card grid — sorted by current metric desc.
  const sortedCounties = useMemo(
    () => [...COUNTIES].sort((a, b) => metricValue(b.code, metric) - metricValue(a.code, metric)),
    [metric],
  );

  return (
    <section
      id="counties"
      className="py-24 md:py-32 border-t border-white/5"
      aria-labelledby="counties-heading"
    >
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-[0.25em] text-accent">
              County intelligence
            </div>
            <h2
              id="counties-heading"
              className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight"
            >
              47 counties. <span className="text-gradient">Real boundaries, live signals.</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Hover to explore, click to compare up to four counties side-by-side. Every metric
              carries a confidence badge — hover for what it means.
            </p>
          </div>

          {/* Metric filter */}
          <div
            role="radiogroup"
            aria-label="County map metric"
            className="glass rounded-full p-1 flex items-center gap-1"
          >
            {(Object.keys(METRIC_LABELS) as CountyMetric[]).map((m) => {
              const Icon = METRIC_ICONS[m];
              const active = metric === m;
              return (
                <button
                  key={m}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMetric(m)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition ${
                    active
                      ? "bg-white/15 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {METRIC_LABELS[m]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 grid lg:grid-cols-[1.4fr_1fr] gap-4">
          {/* MAP */}
          <div className="glass-strong rounded-3xl p-2 relative">
            <div
              ref={mapEl}
              data-testid="county-map"
              className="rounded-[22px] h-[560px] bg-[#0a1735]"
              role="application"
              aria-label="Interactive map of Kenya counties"
            />
            {/* Legend */}
            <div className="pointer-events-none absolute left-4 bottom-4 glass rounded-2xl px-3 py-2 text-[11px] flex items-center gap-2">
              <span className="text-muted-foreground uppercase tracking-widest text-[9px]">
                {METRIC_LABELS[metric]}
              </span>
              <span className="h-2 w-24 rounded-full bg-gradient-to-r from-[rgb(37,99,235)] via-[rgb(98,233,255)] to-[rgb(251,191,36)]" />
              <span className="text-muted-foreground">low → high</span>
            </div>
          </div>

          {/* COMPARE PANEL */}
          <div
            role="region"
            aria-label="Compare selected counties"
            className="glass rounded-3xl p-5 min-h-[560px] flex flex-col"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-accent">Compare</div>
                <div className="text-sm text-muted-foreground">
                  {selected.length
                    ? `${selected.length} of 4 selected`
                    : "Select up to 4 counties on the map or in the grid below."}
                </div>
              </div>
              {selected.length > 0 && (
                <button
                  onClick={clearSelection}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <XIcon className="h-3 w-3" /> clear
                </button>
              )}
            </div>

            <div className="mt-4 flex-1">
              {selected.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground px-4">
                  <div>
                    <div className="text-4xl">🇰🇪</div>
                    <div className="mt-2">
                      Click a county — hover any pill for a confidence explainer.
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="grid gap-3"
                  style={{
                    gridTemplateColumns: `repeat(${selected.length}, minmax(0, 1fr))`,
                  }}
                  data-testid="compare-grid"
                >
                  {selected.map((code) => {
                    const c = COUNTIES.find((x) => x.code === code);
                    if (!c) return null;
                    const m = countyMetrics(code);
                    return (
                      <div
                        key={code}
                        className="rounded-2xl p-3 bg-white/5 border border-white/10 relative"
                      >
                        <button
                          onClick={() => toggleSelect(code)}
                          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                          aria-label={`Remove ${c.name} from compare`}
                        >
                          <XIcon className="h-3.5 w-3.5" />
                        </button>
                        <div className="text-sm font-semibold">{c.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {c.lat.toFixed(2)}°, {c.lng.toFixed(2)}°
                        </div>
                        <div className="mt-3 space-y-2 text-[11px]">
                          {(Object.keys(METRIC_LABELS) as CountyMetric[]).map((mk) => (
                            <div key={mk} className="flex items-center justify-between">
                              <span className="text-muted-foreground">
                                {METRIC_LABELS[mk].split(" ")[0]}
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <span className="font-medium">{formatMetric(mk, m[mk])}</span>
                                <ConfidenceDots
                                  level={confidence(code, mk)}
                                  metric={mk}
                                  countyName={c.name}
                                />
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={downloadCompare}
              disabled={selected.length < 2 || downloading}
              data-testid="compare-pdf"
              className="mt-4 w-full glass-strong rounded-2xl px-4 py-3 text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-white/10 transition disabled:opacity-40"
            >
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Building comparison PDF…
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4 text-accent" /> Download comparison PDF
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card grid — synced with map hover/select */}
        <div
          className="mt-8 grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
          role="list"
          aria-label="Kenya counties"
        >
          {sortedCounties.map((c) => {
            const sel = selected.includes(c.code);
            const hover = hoverCode === c.code;
            const m = countyMetrics(c.code);
            const v = m[metric];
            return (
              <div
                key={c.code}
                ref={(el) => {
                  cardRefs.current[c.code] = el;
                }}
                role="listitem"
                tabIndex={0}
                aria-label={`${c.name} — ${METRIC_LABELS[metric]} ${formatMetric(metric, v)}. ${
                  sel ? "Selected for compare. " : ""
                }Press Enter or Space to ${sel ? "remove from" : "add to"} comparison.`}
                aria-pressed={sel}
                data-testid={`county-card-${c.code}`}
                onMouseEnter={() => setHoverCode(c.code)}
                onMouseLeave={() => setHoverCode(null)}
                onFocus={() => setHoverCode(c.code)}
                onBlur={() => setHoverCode(null)}
                onClick={() => toggleSelect(c.code)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleSelect(c.code);
                  }
                }}
                className={`rounded-2xl p-3 transition cursor-pointer outline-none border ${
                  sel
                    ? "bg-accent/10 border-accent/50"
                    : hover
                      ? "bg-white/10 border-white/20"
                      : "bg-white/5 border-white/10 hover:bg-white/10"
                } focus-visible:ring-2 focus-visible:ring-accent`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{c.name}</div>
                  {sel && <Check className="h-3.5 w-3.5 text-accent" />}
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-xl font-semibold text-gradient">
                    {formatMetric(metric, v)}
                  </span>
                  <ConfidenceDots
                    level={confidence(c.code, metric)}
                    metric={metric}
                    countyName={c.name}
                  />
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {METRIC_LABELS[metric]}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
