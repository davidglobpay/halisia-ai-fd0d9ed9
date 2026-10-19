import { geotechAvailability } from "@/lib/geotech-availability";
import { OutputTools, OutputVisual, OutputIcon } from "@/components/halisia/output-tools";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Droplets,
  FileDown,
  Layers as LayersIcon,
  Loader2,
  Mountain,
  ShieldAlert,
  ShieldCheck,
  Waves,
  Wrench,
  Coins,
} from "lucide-react";
import { getGeotechIntel, type GeotechIntel, type SoilLayer } from "@/lib/geotech.functions";
import { downloadGeotechPdf } from "@/lib/geotech-pdf";
import {
  SOIL_LAYER_KEYS,
  SOIL_LAYER_META,
  type SoilLayerKey,
  layerValue,
} from "@/lib/geotech-derive";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { ListenButton } from "@/components/halisia/listen-button";

/**
 * Wave 3 · AI Geotechnical Intelligence Module.
 * Preliminary subsurface assessment from free public datasets.
 */
export function GeotechPanel({ lat, lng, address }: { lat: number; lng: number; address: string }) {
  const q = useQuery<GeotechIntel>({
    queryKey: ["geotech", lat.toFixed(4), lng.toFixed(4)],
    queryFn: () => getGeotechIntel({ data: { lat, lng } }),
    staleTime: 15 * 60 * 1000,
  });
  const [exporting, setExporting] = useState(false);

  if (q.error) {
    return (
      <div className="glass rounded-2xl p-4 text-xs text-amber-glow">
        Geotechnical data unavailable: {(q.error as Error).message}
      </div>
    );
  }
  if (q.isLoading || !q.data) {
    return (
      <div className="glass rounded-2xl p-6 text-xs text-muted-foreground inline-flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-accent" /> Sampling terrain, soils and
        climate…
      </div>
    );
  }
  const g = q.data;
  const availability = geotechAvailability(g.terrainMeasured);
  const usedSources = g.sources.filter((source) => source.used).map((source) => source.label);
  const narration =
    availability.terrainDerivedAvailable && g.terrain
      ? `Preliminary geotechnical intelligence for ${address}. Regional elevation ${g.terrain.elevationM} metres. Groundwater, bedrock, erosion risk and foundation suitability are not assessed. Sources used: ${usedSources.join(", ") || "none available"}. Limitation: ${g.disclaimer}`
      : `Geotechnical intelligence for ${address}. ${availability.message} Sources used: ${usedSources.join(", ") || "none available"}. Limitation: ${g.disclaimer}`;
  const exportPdf = async () => {
    if (!availability.exportAvailable) return;
    setExporting(true);
    try {
      await downloadGeotechPdf(g, address);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="geotech-panel">
      <ComplianceBanner text={g.disclaimer} />

      {/* Header + confidence */}
      <div className="glass-strong rounded-2xl p-4 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl opacity-30 bg-gradient-to-br from-primary to-accent" />
        <div className="flex items-start gap-2">
          <div className="text-[10px] uppercase tracking-widest text-accent">
            AI Geotechnical Intelligence
          </div>
          <div className="ml-auto text-[10px] text-muted-foreground">Regional model data</div>
        </div>
        <div className="mt-1 text-sm font-semibold">
          {availability.terrainDerivedAvailable && g.terrain
            ? `Regional elevation ${g.terrain.elevationM} m`
            : "Terrain-derived interpretation unavailable"}
        </div>
        <div className="mt-2">
          <ListenButton text={narration} label="Listen to geotech summary" />
        </div>
        <button
          onClick={exportPdf}
          disabled={exporting || !availability.exportAvailable}
          className="mt-3 w-full glass rounded-xl px-3 py-2 text-xs font-medium inline-flex items-center justify-center gap-2 hover:bg-white/10 transition disabled:opacity-60"
          data-testid="geotech-export-pdf"
        >
          {exporting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Exporting…
            </>
          ) : (
            <>
              <FileDown className="h-3.5 w-3.5 text-accent" /> Export geotech PDF
            </>
          )}
        </button>
      </div>

      <TerrainSection g={g} />
      <SoilSection layers={g.soilLayers} />
      <RiskSection g={g} />
      <SourcesSection sources={g.sources} />
    </div>
  );
}

function ComplianceBanner({ text }: { text: string }) {
  return (
    <div
      className="rounded-2xl border border-amber-glow/30 bg-amber-glow/10 p-3 text-[11px] text-amber-glow flex gap-2"
      data-testid="geotech-disclaimer"
      role="note"
    >
      <AlertTriangle className="h-4 w-4 flex-none mt-0.5" />
      <p className="leading-relaxed">{text}</p>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
  hint,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="glass rounded-2xl p-4" data-output-card>
      <OutputTools label={title} />
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-accent" />
        <div className="text-sm font-medium">{title}</div>
        {hint && (
          <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-widest">
            {hint}
          </span>
        )}
      </div>
      <OutputVisual subject={title} />
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/25 border border-white/5 px-3 py-2" data-output-card>
      <OutputIcon subject={label} />
      <OutputTools label={label} />
      <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{label}</div>
      <div className="text-sm font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function TerrainSection({ g }: { g: GeotechIntel }) {
  const t = g.terrain;
  if (!g.terrainMeasured)
    return (
      <Card title="Terrain analysis" icon={Mountain} hint="No elevation grid">
        <p className="text-sm text-muted-foreground">
          The ASTER 30 m elevation grid did not load for this point, so there is no measured ground
          here. Slope, aspect, relief, roughness, landform and drainage are withheld rather than
          estimated, and the geology, bedrock, groundwater and foundation sections below rest on the
          same missing data — treat all of them as unavailable, not as readings.
        </p>
      </Card>
    );
  if (!t) return null;
  return (
    <Card title="Terrain analysis" icon={Mountain} hint="ASTER 30m">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Elevation" value={`${t.elevationM} m`} />
        <Stat label="Slope" value={`${t.slopePct}%`} />
        <Stat label="Aspect" value={`${t.aspectLabel} · ${t.aspectDeg}°`} />
        <Stat label="Relief" value={`${t.reliefM} m`} />
        <Stat label="Roughness" value={`${t.roughness} m`} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Regional elevation model only. Erosion risk, drainage and buildability are not assessed.
      </p>
    </Card>
  );
}

function eroseTone(l: "Low" | "Moderate" | "High") {
  return l === "High"
    ? "text-destructive"
    : l === "Moderate"
      ? "text-amber-glow"
      : "text-emerald-glow";
}

function SoilSection({ layers }: { layers: SoilLayer[] }) {
  const [active, setActive] = usePersistedState<Record<SoilLayerKey, boolean>>(
    "halisia:soilLayers",
    { clay: true, sand: true, silt: true, organic: false, density: false },
  );
  const toggle = (k: SoilLayerKey) => setActive((a) => ({ ...a, [k]: !a[k] }));
  if (!layers.length)
    return (
      <Card title="Soil profile" icon={LayersIcon}>
        <div className="text-xs text-muted-foreground">
          SoilGrids returned no data for this point.
        </div>
      </Card>
    );
  return (
    <Card title="Interactive soil profile" icon={LayersIcon} hint="ISRIC SoilGrids v2.0">
      <div
        className="flex flex-wrap gap-1.5 mb-2"
        role="toolbar"
        aria-label="Soil layer toggles"
        data-testid="soil-layer-toggles"
      >
        {SOIL_LAYER_KEYS.map((k) => {
          const meta = SOIL_LAYER_META[k];
          const on = active[k];
          return (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              aria-pressed={on}
              aria-label={`${meta.label} layer ${on ? "visible" : "hidden"}`}
              data-testid={`soil-toggle-${k}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
                on
                  ? "border-white/20 bg-white/10 text-foreground"
                  : "border-white/5 bg-white/[0.02] text-muted-foreground opacity-60"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: meta.color, opacity: on ? 1 : 0.35 }}
              />
              {meta.label}
            </button>
          );
        })}
      </div>
      <div className="space-y-2">
        {layers.map((L) => (
          <div key={L.depth} className="rounded-xl bg-black/30 border border-white/5 px-3 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">
                {L.depth}
                <span className="ml-2 text-muted-foreground">· {L.texture}</span>
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                Regional soil model
              </span>
            </div>
            {(active.clay || active.silt || active.sand) && (
              <div className="mt-2 h-2 rounded-full overflow-hidden flex bg-white/5">
                {active.clay && (
                  <div
                    style={{
                      width: `${L.clayPct}%`,
                      background: SOIL_LAYER_META.clay.color,
                    }}
                    title={`Clay ${L.clayPct}%`}
                  />
                )}
                {active.silt && (
                  <div
                    style={{
                      width: `${L.siltPct}%`,
                      background: SOIL_LAYER_META.silt.color,
                    }}
                    title={`Silt ${L.siltPct}%`}
                  />
                )}
                {active.sand && (
                  <div
                    style={{
                      width: `${L.sandPct}%`,
                      background: SOIL_LAYER_META.sand.color,
                    }}
                    title={`Sand ${L.sandPct}%`}
                  />
                )}
              </div>
            )}
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground tabular-nums">
              {SOIL_LAYER_KEYS.filter((k) => active[k]).map((k) => {
                const v = layerValue(L, k);
                if (v == null) return null;
                const meta = SOIL_LAYER_META[k];
                return (
                  <span key={k} data-testid={`soil-cell-${L.depth}-${k}`}>
                    <span style={{ color: meta.color }}>■</span> {meta.label} {v}
                    {meta.unit}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function RiskSection({ g }: { g: GeotechIntel }) {
  return (
    <Card title="Ground investigation needed" icon={ShieldAlert} hint="Not assessed">
      <p className="text-sm text-muted-foreground">
        Bedrock depth, groundwater, bearing capacity, erosion risk and foundation suitability have
        not been established. Regional soil and elevation models cannot establish these site
        conditions. A licensed geotechnical engineer should arrange sampling, testing and
        groundwater observations before structural design.
      </p>
      {!g.terrainMeasured && <p role="status">{geotechAvailability(false).message}</p>}
    </Card>
  );
}

function SourcesSection({ sources }: { sources: GeotechIntel["sources"] }) {
  return (
    <Card title="Data sources" icon={Waves}>
      <ul className="space-y-1.5">
        {sources.map((s) => (
          <li
            key={s.url}
            className="flex items-center gap-2 text-xs rounded-lg bg-black/20 border border-white/5 px-2.5 py-1.5"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${s.used ? "bg-emerald-glow" : "bg-white/25"}`}
            />
            <span className="flex-1">{s.label}</span>
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="text-cyan-glow hover:underline"
            >
              open
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
