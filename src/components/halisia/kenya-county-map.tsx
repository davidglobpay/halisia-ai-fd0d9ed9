/// <reference types="google.maps" />
import { useEffect, useMemo, useRef, useState } from "react";
import countiesData from "@/data/kenya-counties.json";
import { loadGoogleMaps, resetGoogleMapsLoader } from "@/lib/google-maps-loader";
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
  AlertTriangle,
  RefreshCw,
  Link as LinkIcon,
  Info,
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

// Session-scoped cache for the parsed GeoJSON. The file is bundled, but reusing
// the same parsed object across re-mounts avoids re-parsing on tab switches.
let cachedGeoJson: object | null = null;
function getCountiesGeoJson(): object {
  if (cachedGeoJson) return cachedGeoJson;
  if (typeof window !== "undefined") {
    try {
      const cached = window.sessionStorage.getItem("halisia:counties:v1");
      if (cached) {
        cachedGeoJson = JSON.parse(cached);
        return cachedGeoJson as object;
      }
    } catch {
      /* ignore */
    }
  }
  cachedGeoJson = countiesData as unknown as object;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem("halisia:counties:v1", JSON.stringify(cachedGeoJson));
    } catch {
      /* quota exceeded — safe to ignore */
    }
  }
  return cachedGeoJson;
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
  const [selected, setSelected] = useState<number[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate ?compare=… from URL after mount so SSR markup matches the client.
  useEffect(() => {
    setHydrated(true);
    const raw = new URLSearchParams(window.location.search).get("compare");
    if (!raw) return;
    const initial = raw
      .split(",")
      .map((n) => parseInt(n, 10))
      .filter((n) => Number.isFinite(n) && COUNTIES.some((c) => c.code === n))
      .slice(0, 4);
    if (initial.length) setSelected(initial);
  }, []);
  const [downloading, setDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showConfidence, setShowConfidence] = useState(false);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const dataLayerRef = useRef<google.maps.Data | null>(null);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Sync ?compare=… in URL without triggering a router re-render.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hydrated) return;
    const url = new URL(window.location.href);
    if (selected.length) url.searchParams.set("compare", selected.join(","));
    else url.searchParams.delete("compare");
    window.history.replaceState({}, "", url.toString());
  }, [selected, hydrated]);

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
  useEffect(
    () => {
      let cancelled = false;
      setMapReady(false);
      setMapError(null);
      loadGoogleMaps()
        .then((g: typeof google) => {
          if (cancelled || !mapEl.current) return;
          setMapError(null);
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
          data.addGeoJson(getCountiesGeoJson());

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
          setMapReady(true);
        })
        .catch((err: unknown) => {
          console.error(err);
          if (!cancelled)
            setMapError("Couldn't load Google Maps. Check your connection and retry.");
        });
      return () => {
        cancelled = true;
        dataLayerRef.current?.setMap(null);
        dataLayerRef.current = null;
        mapRef.current = null;
      };
    },
    [loadAttempt],
  );

  // Re-style whenever metric / hover / selection changes.
  useEffect(() => {
    const data = dataLayerRef.current;
    if (!mapReady || !data) return;
    data.setStyle((feature) => {
      const code = feature.getProperty("code") as number;
      return styleFor(code, hoverCode === code, selected.includes(code));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, metric, hoverCode, selected, min, max]);

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
    setPdfError(null);
    try {
      const chosen = COUNTIES.filter((c) => selected.includes(c.code));
      await generateCountyComparePdf(chosen);
    } catch (e) {
      console.error(e);
      setPdfError(
        !navigator.onLine
          ? "You're offline. Reconnect and retry the download."
          : "Couldn't build the comparison PDF. Retry, or reduce the number of counties.",
      );
    } finally {
      setDownloading(false);
    }
  }

  async function copyShareLink() {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (selected.length) url.searchParams.set("compare", selected.join(","));
    else url.searchParams.delete("compare");
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback: select the URL into a temporary input
      const ta = document.createElement("textarea");
      ta.value = url.toString();
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } finally {
        document.body.removeChild(ta);
      }
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
            <button
              onClick={() => setShowConfidence((v) => !v)}
              aria-expanded={showConfidence}
              aria-controls="confidence-definitions"
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-accent hover:text-foreground transition"
            >
              <Info className="h-3.5 w-3.5" />
              {showConfidence ? "Hide" : "Show"} confidence definitions
            </button>
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

        {showConfidence && (
          <div
            id="confidence-definitions"
            role="region"
            aria-label="Confidence dot definitions"
            className="mt-6 glass rounded-3xl p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-accent">
                  Confidence definitions
                </div>
                <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
                  Three dots = cross-verified, two = partial, one = directional. Each metric is
                  scored independently against its own sources.
                </p>
              </div>
              <button
                onClick={() => setShowConfidence(false)}
                aria-label="Close confidence definitions"
                className="text-muted-foreground hover:text-foreground"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <dl className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {[
                {
                  m: "livability" as CountyMetric,
                  src: "Composite of infrastructure, amenity density, air quality and safety proxies.",
                  high: "All four sub-signals present and cross-checked with public datasets.",
                  med: "Two or three sub-signals present; some are county-level estimates.",
                  low: "Only one sub-signal available; treat as directional guidance.",
                },
                {
                  m: "population" as CountyMetric,
                  src: "KNBS 2019 census + projected growth from national statistics.",
                  high: "Census figure with recent (<2y) mid-year projection.",
                  med: "Census figure only, projected linearly.",
                  low: "Estimated from constituency roll-ups.",
                },
                {
                  m: "growth" as CountyMetric,
                  src: "YoY change from county GDP releases and building-approval proxies.",
                  high: "Government release + independent market data agree within 2pp.",
                  med: "Single source; last 12 months.",
                  low: "Modelled from national trend; no county-specific release.",
                },
                {
                  m: "water" as CountyMetric,
                  src: "WASREB reliability index + rainfall/borehole coverage.",
                  high: "WASREB score present and matches on-the-ground utility reporting.",
                  med: "WASREB score present but no utility corroboration.",
                  low: "Rainfall proxy only; no piped-supply data.",
                },
              ].map((row) => (
                <div key={row.m} className="rounded-2xl bg-white/5 border border-white/10 p-3">
                  <dt className="flex items-center justify-between text-foreground font-semibold">
                    <span>{METRIC_LABELS[row.m]}</span>
                  </dt>
                  <dd className="mt-1 text-muted-foreground">{row.src}</dd>
                  <dl className="mt-3 space-y-1.5">
                    {(
                      [
                        ["high", row.high],
                        ["med", row.med],
                        ["low", row.low],
                      ] as const
                    ).map(([lvl, txt]) => (
                      <div key={lvl} className="flex items-start gap-2">
                        <ConfidenceDots
                          level={lvl}
                          metric={row.m}
                          countyName={METRIC_LABELS[row.m]}
                        />
                        <span className="text-muted-foreground leading-snug">{txt}</span>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </dl>
          </div>
        )}

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
            {mapError && (
              <div
                role="alert"
                className="absolute inset-2 rounded-[22px] bg-[#0a1735]/95 flex items-center justify-center p-6 text-center"
              >
                <div>
                  <AlertTriangle className="h-6 w-6 text-amber-glow mx-auto" />
                  <div className="mt-3 text-sm">{mapError}</div>
                  <button
                    onClick={() => {
                      setMapError(null);
                      resetGoogleMapsLoader();
                      setLoadAttempt((n) => n + 1);
                    }}
                    className="mt-4 inline-flex items-center gap-2 glass rounded-full px-4 py-2 text-xs hover:bg-white/10"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Retry
                  </button>
                </div>
              </div>
            )}
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

            <div className="mt-4 space-y-2">
              {pdfError && (
                <div
                  role="alert"
                  className="rounded-2xl border border-amber-glow/40 bg-amber-glow/10 px-3 py-2 text-xs flex items-start gap-2"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-glow mt-0.5 shrink-0" />
                  <span className="flex-1">{pdfError}</span>
                  <button
                    onClick={downloadCompare}
                    className="inline-flex items-center gap-1 text-amber-glow hover:text-foreground font-medium"
                  >
                    <RefreshCw className="h-3 w-3" /> Retry
                  </button>
                </div>
              )}
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <button
                  onClick={downloadCompare}
                  disabled={selected.length < 2 || downloading}
                  data-testid="compare-pdf"
                  className="glass-strong rounded-2xl px-4 py-3 text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-white/10 transition disabled:opacity-40"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Building PDF…
                    </>
                  ) : (
                    <>
                      <FileDown className="h-4 w-4 text-accent" /> Download comparison PDF
                    </>
                  )}
                </button>
                <button
                  onClick={copyShareLink}
                  disabled={selected.length === 0}
                  data-testid="compare-share"
                  aria-label="Copy share link for this comparison"
                  className="glass rounded-2xl px-4 py-3 text-xs font-medium inline-flex items-center justify-center gap-1.5 hover:bg-white/10 transition disabled:opacity-40"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-accent" /> Copied
                    </>
                  ) : (
                    <>
                      <LinkIcon className="h-4 w-4" /> Share
                    </>
                  )}
                </button>
              </div>
            </div>
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
