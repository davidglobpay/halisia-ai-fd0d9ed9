import { SignInPrompt } from "@/components/halisia/sign-in-prompt";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { AIOrb } from "@/components/halisia/ai-orb";
import { IntelligenceDashboard } from "@/components/halisia/intelligence-dashboard";
import {
  MapView,
  type MapLocation,
  type MapTypeId,
  type MapTheme,
  type OverlayId,
} from "@/components/halisia/map-view";
import { SearchBar } from "@/components/halisia/search-bar";
import { MapFrame } from "@/components/halisia/map-frame";
import { useMyLocation } from "@/hooks/use-my-location";
import { geocodeAddress } from "@/lib/geocode.functions";
import { reverseGeocode } from "@/lib/reverse-geocode.functions";
import { generateLocationDossier } from "@/lib/pdf-dossier";
import { classifyMapError } from "@/lib/static-map-cache";
import { PassportLinks } from "@/components/halisia/land-passport/passport-links";
import { MAP_CONTEXT_LAYERS } from "@/lib/map-evidence";
import {
  Layers,
  Satellite,
  Ruler,
  Bookmark,
  MapPinned,
  Mountain,
  Sun,
  Moon,
  Bike,
  Bus,
  TrafficCone,
  Check,
  FileDown,
  Loader2,
  Share2,
  Waves,
  TrendingUp,
  LocateFixed,
  MousePointer2,
} from "lucide-react";

const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/explore")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Explore — HALISIA AI" },
      {
        name: "description",
        content: "Search any location in Kenya and see an AI-scored land intelligence dashboard.",
      },
      { property: "og:title", content: "Explore — HALISIA AI" },
      {
        property: "og:description",
        content: "AI-scored land intelligence for any place in Kenya.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: searchSchema,
  component: Explore,
});

const DEFAULT: MapLocation & { address: string } = {
  lat: -1.286389,
  lng: 36.817223,
  label: "Nairobi",
  address: "Nairobi, Kenya",
};

function formatCoordQuery(lat: number, lng: number) {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

function parseCoordQuery(value: string) {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function Explore() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  // radiusM is how far out this position could be, in metres. It is set only
  // where a real uncertainty exists — a geocoder match, or a GPS fix carrying
  // its own accuracy. A point the user clicked on the map has no uncertainty
  // to show, so it stays undefined and no ring is drawn.
  const [loc, setLoc] = useState<{
    lat: number;
    lng: number;
    address: string;
    radiusM?: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapType, setMapType] = useState<MapTypeId>("roadmap");
  const [theme, setTheme] = useState<MapTheme>("dark");
  const [overlays, setOverlays] = useState<OverlayId[]>([]);
  const [layersOpen, setLayersOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfStage, setPdfStage] = useState<string>("");
  const [pdfPct, setPdfPct] = useState<number>(0);
  const [geoStage, setGeoStage] = useState<string>("");
  const [simulationEnabled, setSimulationEnabled] = useState(false);
  const [simInput, setSimInput] = useState(formatCoordQuery(DEFAULT.lat, DEFAULT.lng));
  const [simError, setSimError] = useState<string | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const handledQueryRef = useRef<string | null>(null);
  const stopWatchRef = useRef<(() => void) | null>(null);
  const { watch, simulate, watching, simulated, error: liveLocationError } = useMyLocation();

  const toggleOverlay = (id: OverlayId) =>
    setOverlays((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  useEffect(() => {
    setClientReady(true);
  }, []);

  const inspectPoint = useCallback(async (lat: number, lng: number) => {
    setLoc({ lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
    setLoading(true);
    setGeoStage("Reverse-geocoding pin…");
    try {
      const res = await reverseGeocode({ data: { lat, lng } });
      if (res.ok) setLoc({ lat, lng, address: res.address });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setGeoStage("");
    }
  }, []);

  const stopLiveTracking = () => {
    stopWatchRef.current?.();
    stopWatchRef.current = null;
  };

  const selectCoordinates = async (lat: number, lng: number, reverse = true) => {
    const query = formatCoordQuery(lat, lng);
    handledQueryRef.current = query;
    setSimInput(query);
    navigate({ to: "/explore", search: { q: query }, replace: true });
    if (reverse) await inspectPoint(lat, lng);
    else setLoc({ lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
  };

  const runSearch = useCallback(
    async (query: string) => {
      setLoading(true);
      setError(null);
      try {
        // Detect "lat,lng" coordinate queries (from My Location or manual input)
        const coord = query.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
        if (coord) {
          const lat = parseFloat(coord[1]);
          const lng = parseFloat(coord[2]);
          if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
            setLoading(false);
            await inspectPoint(lat, lng);
            return;
          }
        }
        const res = await geocodeAddress({ data: { query } });
        if (!res.ok) {
          setError(`Couldn't find “${query}” in Kenya. Try a nearby town or road.`);
        } else {
          setLoc({ lat: res.lat, lng: res.lng, address: res.address, radiusM: res.radiusM });
        }
      } catch (e) {
        console.error(e);
        setError("Search failed. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [inspectPoint],
  );

  useEffect(() => {
    const next = q?.trim();
    if (!next) return;
    if (handledQueryRef.current === next) {
      handledQueryRef.current = null;
      return;
    }
    void runSearch(next);
  }, [q, runSearch]);

  useEffect(() => () => stopLiveTracking(), []);

  const active = loc ?? DEFAULT;

  const applySimulatedInput = () => {
    const parsed = parseCoordQuery(simInput);
    if (!parsed) {
      setSimError("Enter valid latitude and longitude, for example -1.292100,36.821900.");
      return;
    }
    setSimError(null);
    stopLiveTracking();
    setSimulationEnabled(true);
    simulate(parsed);
    void selectCoordinates(parsed.lat, parsed.lng);
  };

  const startLiveTracking = () => {
    setSimError(null);
    setSimulationEnabled(false);
    stopLiveTracking();
    const stop = watch((next) => {
      const query = formatCoordQuery(next.lat, next.lng);
      handledQueryRef.current = query;
      setSimInput(query);
      navigate({ to: "/explore", search: { q: query }, replace: true });
      setLoc({
        lat: next.lat,
        lng: next.lng,
        address: `My live location${next.accuracy ? ` · ±${Math.round(next.accuracy)} m` : ""}`,
        radiusM: next.accuracy ?? null,
      });
    });
    stopWatchRef.current = stop;
  };

  const handleMarkerDrag = ({ lat, lng }: { lat: number; lng: number }) => {
    stopLiveTracking();
    setSimulationEnabled(true);
    simulate({ lat, lng });
    void selectCoordinates(lat, lng);
  };

  const downloadDossier = async () => {
    setDownloading(true);
    setPdfError(null);
    setPdfStage("Starting…");
    setPdfPct(0);
    try {
      const result = await generateLocationDossier({
        lat: active.lat,
        lng: active.lng,
        address: active.address,
        shareUrl:
          typeof window !== "undefined"
            ? `${window.location.origin}/report?lat=${active.lat}&lng=${active.lng}&address=${encodeURIComponent(active.address)}`
            : undefined,
        onProgress: (pct, stage) => {
          setPdfPct(pct);
          setPdfStage(stage);
        },
      });
      if (result.mapsFailed > 0) {
        const c = classifyMapError(result.lastError);
        setPdfError(
          `PDF saved without ${result.mapsFailed}/${result.mapsRequested} map thumbnails. ${c.title}. ${c.hint}`,
        );
      }
    } catch (e) {
      console.error(e);
      setPdfPct(0);
      setPdfError("Couldn't generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
      setPdfStage("");
    }
  };

  return (
    <div className="min-h-screen" data-testid="explore-page" data-hydrated={clientReady}>
      <div className="pt-24 pb-10 mx-auto max-w-[1400px] px-4">
        <SignInPrompt feature="Address search and place details" className="mb-4" />
        <div className="max-w-3xl">
          <SearchBar
            size="lg"
            loading={loading}
            placeholder="Search a town, road, plot number, coordinates…"
            onSearch={(query) => {
              const next = query.trim();
              navigate({ to: "/explore", search: { q: next } });
              if (next === q?.trim()) void runSearch(next);
            }}
            onUseMyLocation={({ lat, lng }) => {
              void selectCoordinates(lat, lng);
            }}
          />
          <div
            data-testid="sim-location-panel"
            className="mt-3 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center"
          >
            <button
              type="button"
              data-testid="simulation-toggle"
              aria-pressed={simulationEnabled}
              onClick={() => {
                const next = !simulationEnabled;
                setSimulationEnabled(next);
                if (next) {
                  stopLiveTracking();
                  setSimInput(formatCoordQuery(active.lat, active.lng));
                  simulate({ lat: active.lat, lng: active.lng });
                }
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition ${
                simulationEnabled
                  ? "bg-accent/20 text-accent"
                  : "glass text-muted-foreground hover:text-foreground"
              }`}
            >
              <MousePointer2 className="h-3.5 w-3.5" /> Simulated pin
            </button>
            <label className="min-w-0">
              <span className="sr-only">Simulated latitude and longitude</span>
              <input
                value={simInput}
                onChange={(event) => setSimInput(event.target.value)}
                inputMode="decimal"
                aria-label="Simulated latitude and longitude"
                className="h-10 w-full rounded-full border border-white/10 bg-black/15 px-3 text-xs outline-none placeholder:text-muted-foreground focus:border-accent"
                placeholder="-1.292100,36.821900"
              />
            </label>
            <button
              type="button"
              data-testid="set-simulated-location"
              onClick={applySimulatedInput}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-medium hover:bg-white/15"
            >
              <MapPinned className="h-3.5 w-3.5 text-accent" /> Set
            </button>
            <button
              type="button"
              data-testid="start-live-location"
              onClick={watching ? stopLiveTracking : startLiveTracking}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full glass px-3 text-xs font-medium hover:bg-white/10"
            >
              <LocateFixed className="h-3.5 w-3.5 text-accent" />
              {watching ? "Stop live" : "Live GPS"}
            </button>
            {(simError || liveLocationError || simulationEnabled || simulated || watching) && (
              <div className="sm:col-span-4 text-[11px] text-muted-foreground" role="status">
                {simError ||
                  liveLocationError ||
                  (watching
                    ? "Live location tracking is updating the intelligence point."
                    : simulationEnabled || simulated
                      ? "Drag the cyan pin or type coordinates to preview location dynamics."
                      : "")}
              </div>
            )}
          </div>
          {error && <div className="mt-3 text-sm text-amber-glow">{error}</div>}
        </div>

        <div className="mt-6 grid lg:grid-cols-[1fr_420px] gap-4">
          {/* MAP */}
          <div className="glass-strong rounded-3xl p-2 relative">
            <MapFrame
              mobileAspect="aspect-[4/3] max-h-[58svh]"
              desktopAspect="md:aspect-[16/10] lg:aspect-[4/3]"
              className="rounded-[22px]"
              onLocateMe={({ lat, lng }) => void selectCoordinates(lat, lng)}
            >
              <MapView
                center={{ lat: active.lat, lng: active.lng }}
                marker={{ lat: active.lat, lng: active.lng, label: active.address }}
                zoom={14}
                mapType={mapType}
                theme={theme}
                overlays={overlays}
                accuracyRadiusM={loc?.radiusM ?? null}
                onMapClick={({ lat, lng }) => void selectCoordinates(lat, lng)}
                markerDraggable={simulationEnabled}
                onMarkerDrag={handleMarkerDrag}
                className="absolute inset-0 rounded-[22px]"
              />
            </MapFrame>
            {/* Overlay controls */}
            <div className="pointer-events-none absolute inset-0 p-4 flex flex-col justify-between">
              <div className="pointer-events-auto flex flex-wrap items-start gap-2 self-start">
                <div className="flex items-center gap-1 glass rounded-full p-1">
                  {[
                    { id: "roadmap" as const, icon: MapPinned, label: "Map" },
                    { id: "satellite" as const, icon: Satellite, label: "Satellite" },
                    { id: "hybrid" as const, icon: Layers, label: "Hybrid" },
                    { id: "terrain" as const, icon: Mountain, label: "Terrain" },
                  ].map((t) => {
                    const active = mapType === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setMapType(t.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition ${active ? "bg-white/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        <t.icon className="h-3.5 w-3.5" /> {t.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1 glass rounded-full p-1">
                  <button
                    onClick={() => setTheme("light")}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${theme === "light" ? "bg-white/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Sun className="h-3.5 w-3.5" /> Light
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${theme === "dark" ? "bg-white/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Moon className="h-3.5 w-3.5" /> Dark
                  </button>
                </div>

                <div className="relative">
                  <button
                    onClick={() => setLayersOpen((v) => !v)}
                    className={`glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${overlays.length ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Layers className="h-3.5 w-3.5" /> Layers
                    {overlays.length > 0 && (
                      <span className="ml-1 rounded-full bg-accent/25 px-1.5 py-0.5 text-[10px] text-accent">
                        {overlays.length}
                      </span>
                    )}
                  </button>
                  {layersOpen && (
                    <div className="absolute left-0 mt-2 w-56 rounded-2xl glass-strong p-2 shadow-2xl z-10">
                      {[
                        { id: "traffic" as const, icon: TrafficCone, label: "Traffic" },
                        { id: "transit" as const, icon: Bus, label: "Transit" },
                        { id: "bicycling" as const, icon: Bike, label: "Bicycling" },
                        {
                          id: "slope" as const,
                          icon: TrendingUp,
                          label: MAP_CONTEXT_LAYERS.slope.label,
                        },
                        {
                          id: "drainage" as const,
                          icon: Waves,
                          label: MAP_CONTEXT_LAYERS.drainage.label,
                        },
                      ].map((l) => {
                        const on = overlays.includes(l.id);
                        return (
                          <button
                            key={l.id}
                            onClick={() => toggleOverlay(l.id)}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-foreground hover:bg-white/10"
                          >
                            <l.icon className="h-3.5 w-3.5 text-accent" />
                            <span className="flex-1 text-left">{l.label}</span>
                            {on && <Check className="h-3.5 w-3.5 text-accent" />}
                          </button>
                        );
                      })}
                      <div className="mt-1 border-t border-white/10 pt-2 px-3 pb-1 text-[10px] text-muted-foreground">
                        Terrain hillshade © Esri · Mapped watercourses © Esri Hydro Reference.
                        <p>{MAP_CONTEXT_LAYERS.slope.limitation}</p>
                        <p>{MAP_CONTEXT_LAYERS.drainage.limitation}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {geoStage && (
              <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 glass-strong rounded-full px-4 py-2 text-xs text-foreground inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> {geoStage}
              </div>
            )}
          </div>

          {/* SIDE PANEL */}
          <div className="lg:sticky lg:top-24 pr-1">
            <div
              className="mb-3 glass rounded-2xl px-4 py-2.5 text-xs text-muted-foreground"
              data-testid="active-address"
            >
              <span className="uppercase tracking-widest text-accent text-[10px] mr-2">
                Inspecting
              </span>
              {active.address}
            </div>
            <button
              onClick={downloadDossier}
              disabled={downloading}
              className="mb-3 w-full glass-strong rounded-2xl px-4 py-3 text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-white/10 transition disabled:opacity-60"
              data-testid="download-dossier"
            >
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span
                    data-testid="download-dossier-progress"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    {pdfStage || "Building dossier…"} · {pdfPct}%
                  </span>
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4 text-accent" /> Download PDF dossier
                </>
              )}
            </button>
            {!downloading && pdfPct === 100 && (
              <div
                role="status"
                aria-live="polite"
                data-testid="download-dossier-progress"
                className="mb-2 text-xs text-muted-foreground"
              >
                PDF saved · 100%
              </div>
            )}
            {(downloading || pdfPct === 100) && (
              <div
                className="mb-2 h-1 w-full rounded-full bg-white/5 overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pdfPct}
                data-testid="download-dossier-bar"
              >
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                  style={{ width: `${pdfPct}%` }}
                />
              </div>
            )}
            {pdfError && <div className="mb-2 text-xs text-amber-glow">{pdfError}</div>}
            <ShareLinkButton lat={active.lat} lng={active.lng} address={active.address} />
            {loc ? (
              <PassportLinks
                className="mb-3"
                target={{
                  lat: loc.lat,
                  lng: loc.lng,
                  label: loc.address,
                  source: "Explore search / map selection",
                  status: "approximate",
                }}
              />
            ) : (
              <p className="mb-3 text-[11px] text-muted-foreground">
                Showing the default Nairobi view. Search or pick a point to open a Land Passport.
              </p>
            )}
            <IntelligenceDashboard lat={active.lat} lng={active.lng} address={active.address} />
          </div>
        </div>
      </div>

      <AIOrb context={`${active.address} (${active.lat}, ${active.lng})`} />
    </div>
  );
}

function ShareLinkButton({ lat, lng, address }: { lat: number; lng: number; address: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = `${window.location.origin}/report?lat=${lat}&lng=${lng}&address=${encodeURIComponent(address)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copy this link:", url);
    }
  };
  return (
    <button
      onClick={copy}
      className="mb-3 w-full glass rounded-2xl px-4 py-2.5 text-xs font-medium inline-flex items-center justify-center gap-2 hover:bg-white/10 transition"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-accent" /> Share link copied
        </>
      ) : (
        <>
          <Share2 className="h-3.5 w-3.5 text-accent" /> Copy shareable report link
        </>
      )}
    </button>
  );
}
