import { formatDateTime } from "@/lib/format-datetime";
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
import { HoloTile } from "@/components/halisia/ds/holo-tile";
import { Terrain3D } from "@/components/halisia/terrain-3d";
import { useDevMode } from "@/hooks/use-dev-mode";
import { PlaceCard } from "@/components/halisia/place-card";
import { GeotechRisksInline } from "@/components/halisia/geotech-risks-inline";
import { HeroSummary } from "@/components/halisia/hero-summary";
import { ExecutiveSummary } from "@/components/halisia/executive-summary";
import { LandIntelligenceScore } from "@/components/halisia/land-intelligence-score";
import { getWave4Intel, type Wave4Intel } from "@/lib/wave4-intel.functions";
import { ReadAloud } from "@/components/halisia/read-aloud";

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
const TABS: Array<{
  id: TabId;
  label: string;
  icon: React.ElementType;
  wave: WaveId;
}> = [
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

/**
 * Build what the Listen button reads out.
 *
 * Every sentence here is assembled from a value that is actually on screen.
 * Nothing is rounded up into a claim the tiles do not make: where a reading is
 * missing the summary says so rather than skipping it silently, because "no
 * measurement" is itself the honest finding and the tiles already show it that
 * way. The result is capped below the 4,000-character limit the speech server
 * function enforces, so a long narrative is trimmed at a sentence boundary
 * instead of being refused outright.
 */
function spokenSummary(args: {
  address: string;
  lat: number;
  lng: number;
  intel: LocationIntel | undefined;
  narrative: NarrativeOutput | undefined;
  counts: { [k: string]: number } | null;
}): string {
  const { address, lat, lng, intel, narrative, counts } = args;
  const parts: string[] = [];

  parts.push(`Location intelligence for ${address}.`);
  parts.push(`Coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)}.`);

  const elev = intel?.elevation?.meters;
  if (elev != null)
    parts.push(`Ground elevation ${Math.round(elev)} metres, from the Google Elevation API.`);
  else parts.push("Ground elevation has not been measured for this point.");

  const aq = intel?.airQuality;
  if (aq?.universalAqi != null) {
    parts.push(
      `Air quality index ${aq.universalAqi}${aq.category ? `, ${aq.category}` : ""}` +
        `${aq.dominant ? `, with ${aq.dominant} the dominant pollutant` : ""}, read live from the Google Air Quality API.`,
    );
  } else {
    parts.push("No live air quality reading is available for this point.");
  }

  if (counts) {
    const named = [
      [counts.schools, "schools"],
      [counts.hospitals, "health facilities"],
      [counts.groceries, "shops"],
      [counts.transit, "transit stops"],
      [counts.restaurants, "restaurants"],
      [counts.banks, "banks"],
    ] as const;
    const found = named.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`);
    const none = named.filter(([n]) => n === 0).map(([, label]) => label);
    if (found.length) parts.push(`Within about three kilometres: ${found.join(", ")}.`);
    if (none.length) parts.push(`None mapped nearby for ${none.join(", ")}.`);
  }

  if (narrative?.headline) parts.push(narrative.headline);
  if (narrative?.overview) parts.push(narrative.overview);
  if (narrative?.keyFindings?.length) {
    parts.push(`Key findings. ${narrative.keyFindings.slice(0, 6).join(". ")}.`);
  }
  if (narrative?.watchouts?.length) {
    parts.push(`Watch outs. ${narrative.watchouts.slice(0, 4).join(". ")}.`);
  }
  if (narrative?.confidencePct != null) {
    parts.push(`Overall confidence in this written read, ${narrative.confidencePct} percent.`);
  }

  parts.push(
    "This is a reading of public data. It is not a title search, a survey, or legal advice, and it asserts nothing about ownership or boundaries.",
  );

  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  if (text.length <= 3900) return text;
  // Trim to the last complete sentence inside the limit.
  const cut = text.slice(0, 3900);
  const stop = cut.lastIndexOf(". ");
  return stop > 0 ? cut.slice(0, stop + 1) : cut;
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
  const wave4Q = useQuery<Wave4Intel>({
    queryKey: ["wave4", lat.toFixed(3), lng.toFixed(3)],
    queryFn: () => getWave4Intel({ data: { lat, lng } }),
    staleTime: 15 * 60 * 1000,
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

  const narrativeReady = narrativeQ.data != null;

  return (
    <div className="space-y-3">
      {/* Level-1 hero: overall AI score + animated gauge dashboard */}
      <HeroSummary
        address={address}
        lat={lat}
        lng={lng}
        intel={intelQ.data}
        narrative={narrativeQ.data}
        wave4={wave4Q.data}
      />

      {/* AI Executive Summary — simple / professional / technical */}
      <ExecutiveSummary narrative={narrativeQ.data} intel={intelQ.data} />

      {/* Unified Land Intelligence Score — 10-module decision engine */}
      <LandIntelligenceScore
        narrative={narrativeQ.data}
        intel={intelQ.data}
        address={address}
        lat={lat}
        lng={lng}
        wave4={wave4Q.data}
      />

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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {narrativeReady ? "Written read ready" : "Reading this location…"}
          </span>
          {intelQ.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />}
          <ReadAloud
            text={spokenSummary({
              address,
              lat,
              lng,
              intel: intelQ.data,
              narrative: narrativeQ.data,
              counts,
            })}
            label="Listen to this read"
          />
        </div>

        {/* Photo strip */}
        {intelQ.data?.photos && intelQ.data.photos.length > 0 && (
          <div className="mt-3 flex max-w-full gap-1.5 overflow-x-auto pb-1">
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

      {/* Wave dynamics as holographic tiles with collapsible horizontal detail rails */}
      <div className="space-y-2">
        {(Object.keys(WAVE_META) as WaveId[]).map((wave) => {
          const items = TABS.filter((t) => t.wave === wave);
          if (!items.length) return null;
          const meta = WAVE_META[wave];
          const activeHere = items.some((t) => t.id === tab);
          return (
            <HoloTile
              key={wave}
              eyebrow={meta.label}
              title={meta.hint}
              defaultOpen
              data-testid={`wave-tile-${wave}`}
              className={activeHere ? "holo-lit" : undefined}
            >
              <ul className="scrollbar-none flex snap-x snap-mandatory items-stretch gap-2 overflow-x-auto pb-1">
                {items.map((t) => {
                  const active = t.id === tab;
                  const Icon = t.icon;
                  return (
                    <li key={t.id} className="shrink-0 snap-start">
                      <button
                        onClick={() => setTab(t.id)}
                        aria-pressed={active}
                        className={`focus-ring inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-[11px] transition ${
                          active
                            ? "border-accent/50 bg-accent/15 text-foreground"
                            : "border-white/10 text-muted-foreground hover:text-foreground"
                        }`}
                        data-testid={`tab-${t.id}`}
                        aria-label={`${meta.label} · ${t.label}`}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{t.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </HoloTile>
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
          <>
            <OverviewTab
              intel={intelQ.data}
              loading={intelQ.isLoading}
              narrative={narrativeQ.data}
            />
            <GeotechRisksInline lat={lat} lng={lng} />
          </>
        )}
        {tab === "weather" && <WeatherPanel lat={lat} lng={lng} />}
        {tab === "environment" && <EnvironmentTab intel={intelQ.data} loading={intelQ.isLoading} />}
        {tab === "amenities" && (
          <>
            <AmenitiesTab intel={intelQ.data} loading={intelQ.isLoading} />
            <GeotechRisksInline lat={lat} lng={lng} />
          </>
        )}
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

/**
 * Magnitude as pips, one per item.
 *
 * A count of nearby schools has no maximum, so a progress bar would have to
 * invent a denominator and every bar would then be asserting a target nobody
 * set. Pips show how many there are and imply no ceiling. Past twelve the row
 * stops and says how many more, because a hundred dots is not information.
 */
function Pips({ n }: { n: number }) {
  const shown = Math.min(n, 12);
  if (n <= 0) {
    return <span className="text-[10px] text-muted-foreground">none mapped</span>;
  }
  return (
    <span className="inline-flex items-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: shown }).map((_, i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-accent/70" />
      ))}
      {n > shown && <span className="ml-1 text-[10px] text-muted-foreground">+{n - shown}</span>}
    </span>
  );
}

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  count,
  source,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  tone: string;
  /** When the value is a count of things, draw it as pips as well. */
  count?: number;
  /** Where the number came from. Printed in small caps under the tile. */
  source?: string;
}) {
  return (
    <div className="glass relative min-w-0 overflow-hidden rounded-2xl p-3">
      <div
        className={`absolute -top-6 -right-6 h-20 w-20 rounded-full opacity-30 blur-2xl bg-gradient-to-br ${tone}`}
      />
      <div className="flex min-w-0 items-center gap-2">
        <div className="h-8 w-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-accent" />
        </div>
        <div className="min-w-0 truncate text-[11px] text-muted-foreground">{label}</div>
      </div>
      <div className="mt-2 min-w-0 truncate text-xl font-semibold tabular-nums tracking-tight">
        {value}
      </div>
      {count != null && (
        <div className="mt-1.5 min-w-0">
          <Pips n={count} />
        </div>
      )}
      {sub && (
        <div className="mt-0.5 min-w-0 truncate text-[11px] text-muted-foreground">{sub}</div>
      )}
      {source && (
        <div className="mt-1.5 truncate text-[9px] uppercase tracking-[0.12em] text-accent/80">
          {source}
        </div>
      )}
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
          count={c.schools.length}
          sub={c.schools[0]?.name}
          icon={GraduationCap}
          tone="from-primary to-accent"
          source="Google Places"
        />
        <StatTile
          label="Healthcare ≤3km"
          value={String(c.hospitals.length)}
          count={c.hospitals.length}
          sub={c.hospitals[0]?.name}
          icon={HeartPulse}
          tone="from-destructive to-accent"
          source="Google Places"
        />
        <StatTile
          label="Groceries ≤3km"
          value={String(c.groceries.length)}
          count={c.groceries.length}
          sub={c.groceries[0]?.name}
          icon={ShoppingBasket}
          tone="from-emerald-glow to-primary"
          source="Google Places"
        />
        <StatTile
          label="Transit ≤3km"
          value={String(c.transit.length)}
          count={c.transit.length}
          sub={c.transit[0]?.name}
          icon={TrainFront}
          tone="from-accent to-amber-glow"
          source="Google Places"
        />
        <StatTile
          label="Elevation"
          value={intel.elevation?.meters != null ? `${intel.elevation.meters.toFixed(0)} m` : "—"}
          sub="Height above sea level"
          icon={Mountain}
          tone="from-amber-glow to-primary"
          source="Google Elevation API"
        />
        <StatTile
          label="Air quality"
          value={intel.airQuality?.universalAqi != null ? `${intel.airQuality.universalAqi}` : "—"}
          sub={intel.airQuality?.category ?? "Universal AQI"}
          icon={Wind}
          tone="from-primary to-emerald-glow"
          source="Google Air Quality API \u00b7 read now"
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
          source="Google Elevation API"
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
          source="Not a flood study"
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
  // Pick the top-rated (min 5 reviews) as the AI recommendation.
  const bestId = items
    .filter((p) => (p.userRatingCount ?? 0) >= 5)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0]?.id;
  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-6 w-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
          <Icon className="h-3.5 w-3.5 text-accent" />
        </div>
        <div className="text-xs font-medium">{title}</div>
        <div className="ml-auto text-[10px] text-muted-foreground">{items.length}</div>
      </div>
      <ul className="space-y-2">
        {items.slice(0, 6).map((p) => (
          <PlaceCard key={p.id} place={p} isBest={p.id === bestId} />
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

  const updatedStamp = narrative.lastUpdated ? formatDateTime(narrative.lastUpdated) : "—";
  const updatedLabel = updatedStamp === "—" ? "Timestamp unavailable" : `Updated ${updatedStamp}`;

  return (
    <div className="space-y-3">
      {/* Executive summary header */}
      <div className="glass-strong rounded-2xl p-4 relative overflow-hidden">
        <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full blur-3xl opacity-30 bg-accent" />
        <div className="flex items-center gap-2">
          <div className="text-[10px] uppercase tracking-widest text-accent">
            HALISIA AI · Executive summary
          </div>
          <span className="ml-auto text-[10px] text-muted-foreground">{updatedLabel}</span>
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
