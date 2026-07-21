import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Activity,
  Building2,
  GraduationCap,
  HeartPulse,
  Landmark,
  Leaf,
  Mountain,
  ShoppingBasket,
  Sparkles,
  Store,
  TrainFront,
  Wind,
  Loader2,
  MapPin,
  ShieldAlert,
  CheckCircle2,
  ArrowRight,
  CloudSun,
  Layers as LayersIcon,
  Globe2,
  Flame,
  History,
  HardHat,
  Database,
} from "lucide-react";
import { getLocationIntel, type LocationIntel } from "@/lib/location-intel.functions";
import { generateNarrative, type NarrativeOutput } from "@/lib/ai-narrative.functions";
import { WeatherPanel } from "@/components/halisia/weather-panel";
import { LeafletLayersMap } from "@/components/halisia/leaflet-layers-map";
import { CesiumGlobe } from "@/components/halisia/cesium-globe";
import { HeatmapMap } from "@/components/halisia/heatmap-map";
import { TimelinePanel } from "@/components/halisia/timeline-panel";
import { GeotechPanel } from "@/components/halisia/geotech-panel";
import { getGeotechIntel } from "@/lib/geotech.functions";
import { NotificationsBell } from "@/components/halisia/notifications-bell";
import { MapsDiagnostics } from "@/components/halisia/maps-diagnostics";
import { Wave4Panel } from "@/components/halisia/wave4-panel";
import { Terrain3D } from "@/components/halisia/terrain-3d";
import { useDevMode } from "@/hooks/use-dev-mode";

type TabId =
  | "overview"
  | "weather"
  | "environment"
  | "amenities"
  | "layers"
  | "heatmap"
  | "globe"
  | "terrain3d"
  | "timeline"
  | "geotech"
  | "evidence"
  | "wave4"
  | "ai";

type WaveId = "core" | "wave1" | "wave2" | "wave3" | "wave4";
const WAVE_META: Record<WaveId, { label: string; hint: string }> = {
  core: { label: "Core", hint: "Base intelligence" },
  wave1: { label: "Wave 1", hint: "GIS · Weather · Charts" },
  wave2: { label: "Wave 2", hint: "3D · Heatmap · Timeline" },
  wave3: { label: "Wave 3", hint: "AI Geotechnical" },
  wave4: { label: "Wave 4", hint: "Open public data · Kenya" },
};
const TABS: Array<{ id: TabId; label: string; icon: React.ElementType; wave: WaveId }> = [
  { id: "overview", label: "Overview", icon: Activity, wave: "core" },
  { id: "environment", label: "Environment", icon: Leaf, wave: "core" },
  { id: "amenities", label: "Amenities", icon: Store, wave: "core" },
  { id: "evidence", label: "Evidence", icon: MapPin, wave: "core" },
  { id: "ai", label: "AI", icon: Sparkles, wave: "core" },
  { id: "weather", label: "Weather", icon: CloudSun, wave: "wave1" },
  { id: "layers", label: "GIS", icon: LayersIcon, wave: "wave1" },
  { id: "globe", label: "Globe", icon: Globe2, wave: "wave2" },
  { id: "terrain3d", label: "Terrain 3D", icon: Mountain, wave: "wave2" },
  { id: "heatmap", label: "Heatmap", icon: Flame, wave: "wave2" },
  { id: "timeline", label: "Timeline", icon: History, wave: "wave2" },
  { id: "geotech", label: "Geotech", icon: HardHat, wave: "wave3" },
  { id: "wave4", label: "Public data", icon: Database, wave: "wave4" },
];

function aqiTone(aqi: number | null | undefined) {
  if (aqi == null) return "text-muted-foreground";
  if (aqi >= 80) return "text-emerald-glow";
  if (aqi >= 60) return "text-cyan-glow";
  if (aqi >= 40) return "text-amber-glow";
  return "text-destructive";
}

function fmtDist(km?: number) {
  if (km == null) return "";
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export function IntelligenceDashboard({
  lat,
  lng,
  address,
}: {
  lat: number;
  lng: number;
  address: string;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const queryClient = useQueryClient();

  // Wave 3 auto-launch: prefetch AI Geotechnical Intelligence as soon as
  // a new location is resolved (search, map pin, GPS, or LR-number flow),
  // so opening the tab shows results instantly.
  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ["geotech", lat.toFixed(4), lng.toFixed(4)],
      queryFn: () => getGeotechIntel({ data: { lat, lng } }),
      staleTime: 15 * 60 * 1000,
    });
  }, [queryClient, lat, lng]);

  const intelQ = useQuery<LocationIntel>({
    queryKey: ["intel", lat.toFixed(4), lng.toFixed(4)],
    queryFn: () => getLocationIntel({ data: { lat, lng } }),
    staleTime: 5 * 60 * 1000,
  });
  const devMode = useDevMode();

  const counts = intelQ.data
    ? {
        schools: intelQ.data.categories.schools.length,
        hospitals: intelQ.data.categories.hospitals.length,
        groceries: intelQ.data.categories.groceries.length,
        transit: intelQ.data.categories.transit.length,
        restaurants: intelQ.data.categories.restaurants.length,
        banks: intelQ.data.categories.banks.length,
      }
    : null;

  const narrativeQ = useQuery<NarrativeOutput>({
    queryKey: ["narrative", lat.toFixed(4), lng.toFixed(4), counts],
    enabled: !!counts,
    queryFn: () =>
      generateNarrative({
        data: {
          address,
          lat,
          lng,
          elevationM: intelQ.data?.elevation?.meters ?? null,
          airQuality: intelQ.data?.airQuality
            ? {
                aqi: intelQ.data.airQuality.universalAqi,
                category: intelQ.data.airQuality.category,
                dominant: intelQ.data.airQuality.dominant,
              }
            : null,
          counts: counts!,
        },
      }),
    staleTime: 10 * 60 * 1000,
  });

  const livability = narrativeQ.data?.livability ?? null;

  return (
    <div className="space-y-3">
      {/* Header card */}
      <div className="glass-strong rounded-2xl p-4 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full blur-3xl opacity-40 bg-gradient-to-br from-primary to-accent" />
        <div className="flex items-start gap-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Location intelligence
          </div>
          <div className="ml-auto -mt-1 -mr-1">
            <NotificationsBell
              lat={lat}
              lng={lng}
              aqi={intelQ.data?.airQuality?.universalAqi ?? null}
            />
          </div>
        </div>
        <div className="mt-1 text-lg font-semibold leading-tight line-clamp-2">{address}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {lat.toFixed(4)}, {lng.toFixed(4)}
          {intelQ.data?.elevation?.meters != null && (
            <> · {intelQ.data.elevation.meters.toFixed(0)} m elev.</>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-glow/15 text-emerald-glow px-2.5 py-1 text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-glow animate-pulse" />
            Livability {livability != null ? `· ${livability}` : "…"}
          </span>
          {narrativeQ.data && (
            <span className="text-[11px] text-muted-foreground">
              AI confidence: {narrativeQ.data.confidence}
            </span>
          )}
          {intelQ.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />}
        </div>

        {/* Photo strip */}
        {intelQ.data?.photos && intelQ.data.photos.length > 0 && (
          <div className="mt-3 -mx-1 flex gap-1.5 overflow-x-auto pb-1">
            {intelQ.data.photos.slice(0, 6).map((src, i) => (
              <img
                key={i}
                src={src}
                alt="Area evidence"
                loading="lazy"
                className="h-16 w-24 flex-none rounded-lg object-cover border border-white/10"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tabs grouped by wave */}
      <div className="space-y-1.5">
        {(Object.keys(WAVE_META) as WaveId[]).map((wave) => {
          const items = TABS.filter((t) => t.wave === wave);
          if (!items.length) return null;
          const meta = WAVE_META[wave];
          return (
            <div key={wave} className="glass rounded-2xl p-1.5">
              <div className="flex items-center justify-between px-1.5 pt-0.5 pb-1">
                <span className="text-[9px] uppercase tracking-[0.18em] text-accent font-semibold">
                  {meta.label}
                </span>
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  {meta.hint}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {items.map((t) => {
                  const active = t.id === tab;
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[11px] transition ${
                        active
                          ? "bg-white/15 text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      data-testid={`tab-${t.id}`}
                      aria-label={`${meta.label} · ${t.label}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-3"
      >
        {tab === "overview" && (
          <OverviewTab intel={intelQ.data} loading={intelQ.isLoading} narrative={narrativeQ.data} />
        )}
        {tab === "weather" && <WeatherPanel lat={lat} lng={lng} />}
        {tab === "environment" && <EnvironmentTab intel={intelQ.data} loading={intelQ.isLoading} />}
        {tab === "amenities" && <AmenitiesTab intel={intelQ.data} loading={intelQ.isLoading} />}
        {tab === "layers" && (
          <div className="space-y-2">
            <LeafletLayersMap lat={lat} lng={lng} label={address} />
            <div className="text-[11px] text-muted-foreground px-1">
              Multi-source GIS: Esri satellite, OpenStreetMap, Carto dark/light, OpenTopoMap relief,
              OpenRailway & OpenSeaMap overlays. Toggle basemaps and overlays via the top right
              control.
            </div>
          </div>
        )}
        {tab === "heatmap" && (
          <div className="space-y-2">
            <HeatmapMap lat={lat} lng={lng} intel={intelQ.data} />
            <div className="text-[11px] text-muted-foreground px-1">
              Density heatmap of nearby amenities (Google Places). Warmer colours = more services
              concentrated within a short walk.
            </div>
          </div>
        )}
        {tab === "globe" && (
          <div className="space-y-2">
            <CesiumGlobe lat={lat} lng={lng} label={address} />
            <div className="text-[11px] text-muted-foreground px-1">
              True 3D globe rendered with CesiumJS. Drag to orbit, scroll to zoom, right-click to
              tilt.
            </div>
          </div>
        )}
        {tab === "terrain3d" && (
          <div className="space-y-2">
            <Terrain3D lat={lat} lng={lng} height="h-72" variant="expanded" />
            <div className="text-[11px] text-muted-foreground px-1">
              Isometric 3D slope &amp; contour projection over a 9×9 elevation grid (~18 km²)
              sampled from Open-Topo-Data ASTER 30m. Hover any tile to inspect its elevation and
              precise coordinates; use Refresh to re-sample.
            </div>
          </div>
        )}
        {tab === "timeline" && <TimelinePanel lat={lat} lng={lng} />}
        {tab === "geotech" && <GeotechPanel lat={lat} lng={lng} address={address} />}
        {tab === "wave4" && <Wave4Panel lat={lat} lng={lng} />}
        {tab === "evidence" && (
          <div className="space-y-3">
            {devMode && <MapsDiagnostics lat={lat} lng={lng} />}
            <EvidenceTab intel={intelQ.data} />
          </div>
        )}
        {tab === "ai" && (
          <AITab narrative={narrativeQ.data} loading={narrativeQ.isLoading || intelQ.isLoading} />
        )}
      </motion.div>
    </div>
  );
}

/* ----------------- TABS ----------------- */

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  tone: string;
}) {
  return (
    <div className="glass rounded-2xl p-3 relative overflow-hidden">
      <div
        className={`absolute -top-6 -right-6 h-20 w-20 rounded-full opacity-30 blur-2xl bg-gradient-to-br ${tone}`}
      />
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-accent" />
        </div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
      </div>
      <div className="mt-2 text-xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function OverviewTab({
  intel,
  loading,
  narrative,
}: {
  intel?: LocationIntel;
  loading: boolean;
  narrative?: NarrativeOutput;
}) {
  if (loading || !intel) return <SkeletonGrid n={6} />;
  const c = intel.categories;
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <StatTile
          label="Schools ≤3km"
          value={String(c.schools.length)}
          sub={c.schools[0]?.name}
          icon={GraduationCap}
          tone="from-primary to-accent"
        />
        <StatTile
          label="Healthcare ≤3km"
          value={String(c.hospitals.length)}
          sub={c.hospitals[0]?.name}
          icon={HeartPulse}
          tone="from-cyan-glow to-emerald-glow"
        />
        <StatTile
          label="Groceries ≤3km"
          value={String(c.groceries.length)}
          sub={c.groceries[0]?.name}
          icon={ShoppingBasket}
          tone="from-emerald-glow to-primary"
        />
        <StatTile
          label="Transit ≤3km"
          value={String(c.transit.length)}
          sub={c.transit[0]?.name}
          icon={TrainFront}
          tone="from-accent to-cyan-glow"
        />
        <StatTile
          label="Elevation"
          value={intel.elevation?.meters != null ? `${intel.elevation.meters.toFixed(0)} m` : "—"}
          sub="Google Elevation API"
          icon={Mountain}
          tone="from-amber-glow to-primary"
        />
        <StatTile
          label="Air quality"
          value={intel.airQuality?.universalAqi != null ? `${intel.airQuality.universalAqi}` : "—"}
          sub={intel.airQuality?.category ?? "Universal AQI"}
          icon={Wind}
          tone="from-cyan-glow to-primary"
        />
      </div>
      {narrative && narrative.paragraphs[0] && (
        <div className="glass rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-widest text-accent">AI read</div>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">
            {narrative.paragraphs[0]}
          </p>
        </div>
      )}
    </>
  );
}

function EnvironmentTab({ intel, loading }: { intel?: LocationIntel; loading: boolean }) {
  if (loading || !intel) return <SkeletonGrid n={3} />;
  const aqi = intel.airQuality?.universalAqi;
  const aqiText = aqi != null ? `${aqi} · ${intel.airQuality?.category ?? "—"}` : "No data";
  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <Wind className={`h-4 w-4 ${aqiTone(aqi)}`} />
          <div className="text-sm font-medium">Air quality (Universal AQI)</div>
        </div>
        <div className={`mt-2 text-3xl font-semibold tracking-tight ${aqiTone(aqi)}`}>
          {aqiText}
        </div>
        {intel.airQuality?.dominant && (
          <div className="mt-1 text-xs text-muted-foreground">
            Dominant pollutant: {intel.airQuality.dominant}
          </div>
        )}
        <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-destructive via-amber-glow to-emerald-glow"
            style={{ width: `${Math.min(100, Math.max(0, aqi ?? 0))}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>Hazardous</span>
          <span>Excellent</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <StatTile
          label="Elevation"
          value={intel.elevation?.meters != null ? `${intel.elevation.meters.toFixed(0)} m` : "—"}
          sub={
            intel.elevation?.resolution
              ? `±${intel.elevation.resolution.toFixed(0)} m resolution`
              : undefined
          }
          icon={Mountain}
          tone="from-amber-glow to-primary"
        />
        <StatTile
          label="Flood proxy"
          value={
            intel.elevation?.meters != null
              ? intel.elevation.meters < 20
                ? "Elevated risk"
                : intel.elevation.meters < 100
                  ? "Moderate"
                  : "Low"
              : "—"
          }
          sub="Derived from elevation only"
          icon={ShieldAlert}
          tone="from-destructive to-amber-glow"
        />
      </div>
      <div className="text-[11px] text-muted-foreground px-1">
        Live from Google Maps Platform (Air Quality + Elevation APIs). Flood proxy is a rough
        elevation-based hint — field verification in long rains still recommended.
      </div>
    </div>
  );
}

function CategoryList({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: React.ElementType;
  items: LocationIntel["categories"]["schools"];
}) {
  if (!items.length) return null;
  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-6 w-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
          <Icon className="h-3.5 w-3.5 text-accent" />
        </div>
        <div className="text-xs font-medium">{title}</div>
        <div className="ml-auto text-[10px] text-muted-foreground">{items.length}</div>
      </div>
      <ul className="space-y-1.5">
        {items.slice(0, 5).map((p) => (
          <li key={p.id} className="flex items-start gap-2 text-xs">
            <span className="mt-1 h-1 w-1 rounded-full bg-accent" />
            <span className="flex-1 truncate">{p.name}</span>
            {p.rating != null && (
              <span className="text-[10px] text-amber-glow">★ {p.rating.toFixed(1)}</span>
            )}
            <span className="text-[10px] text-muted-foreground">{fmtDist(p.distanceKm)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AmenitiesTab({ intel, loading }: { intel?: LocationIntel; loading: boolean }) {
  if (loading || !intel) return <SkeletonGrid n={4} />;
  const c = intel.categories;
  const empty =
    !c.schools.length &&
    !c.hospitals.length &&
    !c.groceries.length &&
    !c.transit.length &&
    !c.restaurants.length &&
    !c.banks.length;
  if (empty)
    return (
      <div className="glass rounded-2xl p-4 text-sm text-muted-foreground">
        No amenities returned by Google Places for this area. Try zooming out or picking a nearby
        town.
      </div>
    );
  return (
    <div className="space-y-2.5">
      <CategoryList title="Schools" icon={GraduationCap} items={c.schools} />
      <CategoryList title="Healthcare" icon={HeartPulse} items={c.hospitals} />
      <CategoryList title="Groceries" icon={ShoppingBasket} items={c.groceries} />
      <CategoryList title="Transit" icon={TrainFront} items={c.transit} />
      <CategoryList title="Restaurants & cafés" icon={Store} items={c.restaurants} />
      <CategoryList title="Banks & ATMs" icon={Landmark} items={c.banks} />
    </div>
  );
}

function EvidenceTab({ intel }: { intel?: LocationIntel }) {
  if (!intel)
    return (
      <div className="glass rounded-2xl p-4 text-sm text-muted-foreground">Loading photos…</div>
    );
  if (!intel.photos.length)
    return (
      <div className="glass rounded-2xl p-4 text-sm text-muted-foreground">
        No Google Places photos are available for the amenities near this point. The map itself is
        your best visual reference.
      </div>
    );
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {intel.photos.map((src, i) => (
          <img
            key={i}
            src={src}
            alt="Nearby location"
            loading="lazy"
            className="w-full h-32 object-cover rounded-xl border border-white/10"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        ))}
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        Photos courtesy of Google Places contributors. They depict venues near this point, not the
        parcel itself.
      </div>
    </div>
  );
}

function AITab({ narrative, loading }: { narrative?: NarrativeOutput; loading: boolean }) {
  if (loading || !narrative)
    return (
      <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-accent" />
        HALISIA AI is analysing this location…
      </div>
    );

  const updated = new Date(narrative.lastUpdated || Date.now());
  const updatedLabel = updated.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-3">
      {/* Executive summary header */}
      <div className="glass-strong rounded-2xl p-4 relative overflow-hidden">
        <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full blur-3xl opacity-30 bg-accent" />
        <div className="flex items-center gap-2">
          <div className="text-[10px] uppercase tracking-widest text-accent">
            HALISIA AI · Executive summary
          </div>
          <span className="ml-auto text-[10px] text-muted-foreground">Updated {updatedLabel}</span>
        </div>
        <div className="mt-1 text-base font-semibold tracking-tight">{narrative.headline}</div>
        {narrative.overview && (
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{narrative.overview}</p>
        )}

        {/* Confidence bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>Confidence</span>
            <span className="text-foreground/80">
              {narrative.confidencePct}% · {narrative.confidence}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-glow to-emerald-glow transition-all"
              style={{ width: `${narrative.confidencePct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Key findings */}
      {narrative.keyFindings.length > 0 && (
        <SectionCard title="Key findings" icon={Sparkles} tone="text-accent">
          <ul className="space-y-1.5">
            {narrative.keyFindings.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                <span className="mt-2 h-1 w-1 rounded-full bg-accent" />
                <span className="flex-1">{f}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Strengths & Weaknesses with WHY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <WhyList
          title="Strengths"
          icon={CheckCircle2}
          tone="text-emerald-glow"
          items={narrative.strengths}
        />
        <WhyList
          title="Weaknesses"
          icon={ShieldAlert}
          tone="text-amber-glow"
          items={narrative.weaknesses}
        />
      </div>

      {/* Suitability scores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ScoreCard
          title="Family suitability"
          score={narrative.familySuitability.score}
          note={narrative.familySuitability.note}
        />
        <ScoreCard
          title="Business suitability"
          score={narrative.businessSuitability.score}
          note={narrative.businessSuitability.note}
        />
      </div>

      {/* Advice columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SectionCard title="Recommendations" icon={ArrowRight} tone="text-cyan-glow">
          <BulletList items={narrative.recommendations} tone="bg-cyan-glow" />
        </SectionCard>
        <SectionCard title="Construction advice" icon={HardHat} tone="text-amber-glow">
          <BulletList items={narrative.constructionAdvice} tone="bg-amber-glow" />
        </SectionCard>
        <SectionCard title="Investment advice" icon={Landmark} tone="text-emerald-glow">
          <BulletList items={narrative.investmentAdvice} tone="bg-emerald-glow" />
        </SectionCard>
      </div>

      {/* Environmental notes + Future outlook */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SectionCard title="Environmental notes" icon={Leaf} tone="text-emerald-glow">
          <BulletList items={narrative.environmentalNotes} tone="bg-emerald-glow" />
        </SectionCard>
        <SectionCard title="Future outlook" icon={Activity} tone="text-cyan-glow">
          <p className="text-sm leading-relaxed text-foreground/90">
            {narrative.futureOutlook || "—"}
          </p>
        </SectionCard>
      </div>

      {/* Watch-outs & Verify-next kept for backward-compat */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SectionCard title="Watch-outs" icon={ShieldAlert} tone="text-amber-glow">
          <BulletList items={narrative.watchouts} tone="bg-amber-glow" />
        </SectionCard>
        <SectionCard title="Verify next" icon={ArrowRight} tone="text-cyan-glow">
          <BulletList items={narrative.nextSteps} tone="bg-cyan-glow" />
        </SectionCard>
      </div>

      {/* Data sources */}
      {narrative.dataSources.length > 0 && (
        <SectionCard title="Data sources used" icon={Database} tone="text-muted-foreground">
          <div className="flex flex-wrap gap-1.5">
            {narrative.dataSources.map((s, i) => (
              <span
                key={i}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-foreground/80"
              >
                {s}
              </span>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="text-[11px] text-muted-foreground px-1">
        AI narrative is informational, not legal advice. Always verify title, survey, and zoning
        with a licensed professional.
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  tone,
  children,
}: {
  title: string;
  icon: React.ElementType;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className={`flex items-center gap-2 text-xs font-medium ${tone}`}>
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function BulletList({ items, tone }: { items: string[]; tone: string }) {
  if (!items?.length)
    return <div className="text-[11px] text-muted-foreground">No items provided.</div>;
  return (
    <ul className="space-y-1.5">
      {items.map((x, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
          <span className={`mt-2 h-1 w-1 rounded-full ${tone}`} />
          <span className="flex-1">{x}</span>
        </li>
      ))}
    </ul>
  );
}

function WhyList({
  title,
  icon: Icon,
  tone,
  items,
}: {
  title: string;
  icon: React.ElementType;
  tone: string;
  items: { point: string; why: string }[];
}) {
  if (!items?.length) return null;
  return (
    <div className="glass rounded-2xl p-4">
      <div className={`flex items-center gap-2 text-xs font-medium ${tone}`}>
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      <ul className="mt-2 space-y-2.5">
        {items.map((x, i) => (
          <li key={i} className="text-sm text-foreground/90">
            <div className="font-medium leading-snug">{x.point}</div>
            {x.why && (
              <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                <span className="text-foreground/70">Why: </span>
                {x.why}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScoreCard({ title, score, note }: { title: string; score: number; note: string }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{title}</div>
        <div className="text-lg font-semibold tracking-tight">{pct}</div>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-glow transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {note && <div className="mt-2 text-[12px] text-muted-foreground leading-snug">{note}</div>}
    </div>
  );
}

function ThreeList({
  title,
  icon: Icon,
  tone,
  items,
}: {
  title: string;
  icon: React.ElementType;
  tone: string;
  items: string[];
}) {
  if (!items?.length) return null;
  return (
    <div className="glass rounded-2xl p-4">
      <div className={`flex items-center gap-2 text-xs font-medium ${tone}`}>
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.map((x, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
            <span className={`mt-2 h-1 w-1 rounded-full ${tone.replace("text-", "bg-")}`} />
            <span className="flex-1">{x}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SkeletonGrid({ n }: { n: number }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="glass rounded-2xl p-3 h-24 animate-pulse">
          <div className="h-8 w-8 rounded-xl bg-white/10" />
          <div className="mt-2 h-4 w-20 rounded bg-white/10" />
          <div className="mt-2 h-3 w-16 rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}

// Suppress unused import warning for icons kept for future amenity categories.
void Building2;
