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
  bearingCapacityKpa,
  shrinkSwellScore,
  groundwaterScore,
  foundationScore,
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

  if (q.isLoading || !q.data) {
    return (
      <div className="glass rounded-2xl p-6 text-xs text-muted-foreground inline-flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-accent" /> Sampling terrain, soils and
        climate…
      </div>
    );
  }
  if (q.error) {
    return (
      <div className="glass rounded-2xl p-4 text-xs text-amber-glow">
        Geotechnical data unavailable: {(q.error as Error).message}
      </div>
    );
  }
  const g = q.data;
  const usedSources = g.sources.filter((source) => source.used).map((source) => source.label);
  const narration = `Preliminary geotechnical intelligence for ${address}. ${g.geology.dominant}, ${g.terrain.landform}, at ${g.terrain.elevationM} metres elevation. Confidence ${g.confidence} percent. Sources used: ${usedSources.join(", ") || "none available"}. Limitation: ${g.disclaimer}`;
  const exportPdf = async () => {
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
          <div className="ml-auto text-[10px] text-muted-foreground">
            Confidence {g.confidence}/100
          </div>
        </div>
        <div className="mt-1 text-sm font-semibold">
          {g.geology.dominant} · {g.terrain.landform} at {g.terrain.elevationM} m
        </div>
        <div className="mt-2">
          <ListenButton text={narration} label="Listen to geotech summary" />
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-destructive via-amber-glow to-emerald-glow"
            style={{ width: `${g.confidence}%` }}
          />
        </div>
        <button
          onClick={exportPdf}
          disabled={exporting}
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
      <SubsurfaceCrossSection g={g} />
      <GeologySection g={g} />
      <GroundwaterSection g={g} />
      <FoundationSection g={g} />
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
          The ASTER 30 m elevation grid did not load for this point, so there is
          no measured ground here. Slope, aspect, relief, roughness, landform
          and drainage are withheld rather than estimated, and the geology,
          bedrock, groundwater and foundation sections below rest on the same
          missing data — treat all of them as unavailable, not as readings.
        </p>
      </Card>
    );
  return (
    <Card title="Terrain analysis" icon={Mountain} hint="ASTER 30m">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Elevation" value={`${t.elevationM} m`} />
        <Stat label="Slope" value={`${t.slopePct}%`} />
        <Stat label="Aspect" value={`${t.aspectLabel} · ${t.aspectDeg}°`} />
        <Stat label="Relief" value={`${t.reliefM} m`} />
        <Stat label="Roughness" value={`${t.roughness} m`} />
        <Stat label="Landform" value={t.landform} />
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="rounded-full bg-white/5 px-2 py-0.5">
          Erosion: <b className={eroseTone(t.erosionRisk)}>{t.erosionRisk}</b>
        </span>
        <span className="rounded-full bg-white/5 px-2 py-0.5">
          Natural drainage index: <b>{t.drainageIndex}/100</b>
        </span>
      </div>
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
                drainage: {L.drainage}
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
      <SubsurfaceIndicators layers={layers} />
    </Card>
  );
}

function SubsurfaceIndicators({ layers }: { layers: SoilLayer[] }) {
  const top = layers[0];
  if (!top) return null;
  const bear = bearingCapacityKpa(top);
  const ss = shrinkSwellScore(top);
  return (
    <div className="mt-3 grid grid-cols-2 gap-2" data-testid="subsurface-indicators">
      <div className="rounded-xl bg-black/25 border border-white/5 px-3 py-2" title={bear.note}>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Bearing capacity
        </div>
        <div className="text-sm font-semibold tabular-nums mt-0.5">
          {bear.low}–{bear.high} kPa
        </div>
      </div>
      <div className="rounded-xl bg-black/25 border border-white/5 px-3 py-2">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Shrink–swell
        </div>
        <div className="text-sm font-semibold mt-0.5">
          <span
            className={eroseTone(
              ss.band === "Severe" ? "High" : (ss.band as "Low" | "Moderate" | "High"),
            )}
          >
            {ss.band}
          </span>{" "}
          <span className="text-muted-foreground text-[10px] tabular-nums">({ss.score}/100)</span>
        </div>
      </div>
    </div>
  );
}

function SubsurfaceCrossSection({ g }: { g: GeotechIntel }) {
  const layers = g.soilLayers;
  const total = 6; // metres depicted
  return (
    <Card
      title="Estimated subsurface"
      icon={LayersIcon}
      hint={`Bedrock ${g.bedrock.minM}-${g.bedrock.maxM} m`}
    >
      <div className="flex gap-3">
        <div className="w-24 flex flex-col rounded-xl overflow-hidden border border-white/5">
          {layers.map((L, i) => (
            <div
              key={i}
              className="flex-1 flex items-center justify-center text-[10px] text-black/80"
              style={{ background: layerColour(L) }}
              title={L.texture}
            >
              {L.depth}
            </div>
          ))}
          <div
            className="flex-1 flex items-center justify-center text-[10px] text-white/90"
            style={{
              background: "repeating-linear-gradient(45deg,#3a3a3a 0 4px,#4a4a4a 4px 8px)",
            }}
          >
            Bedrock ~{g.bedrock.minM}-{g.bedrock.maxM} m
          </div>
        </div>
        <div className="flex-1 text-[11px] text-muted-foreground leading-relaxed">
          Estimated stratigraphy over the first {total} m: surface{" "}
          {layers[0]?.texture.toLowerCase() ?? "cover"}, transitioning to residual soils, with
          competent rock expected at{" "}
          <b className="text-foreground">
            {g.bedrock.minM}–{g.bedrock.maxM} m
          </b>{" "}
          depth. Excavation difficulty: <b>{g.bedrock.excavation}</b>.
        </div>
      </div>
    </Card>
  );
}

function layerColour(L: SoilLayer): string {
  if (L.texture.startsWith("Clay")) return "#d3a86a";
  if (L.texture.startsWith("Sand")) return "#e9d9a7";
  if (L.texture.startsWith("Silt")) return "#c9b088";
  return "#b8a075";
}

function GeologySection({ g }: { g: GeotechIntel }) {
  return (
    <Card
      title="Geological interpretation"
      icon={ShieldCheck}
      hint={`AI · ${g.geology.confidence}`}
    >
      <div className="text-sm font-semibold">{g.geology.dominant}</div>
      <div className="text-[11px] text-muted-foreground uppercase tracking-widest mt-0.5">
        Setting: {g.geology.setting}
      </div>
      <p className="mt-2 text-xs text-foreground/80 leading-relaxed">{g.geology.note}</p>
    </Card>
  );
}

function GroundwaterSection({ g }: { g: GeotechIntel }) {
  const gw = g.groundwater;
  return (
    <Card title="Groundwater indicators" icon={Droplets} hint="Preliminary">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Shallow groundwater" value={gw.shallowLikelihood} />
        <Stat label="Seasonal waterlogging" value={gw.seasonalWaterlogging} />
        <Stat
          label="Annual rainfall"
          value={gw.annualRainMm != null ? `${gw.annualRainMm} mm` : "—"}
        />
        <Stat label="Drainage class" value={g.soilLayers[0]?.drainage ?? "—"} />
      </div>
    </Card>
  );
}

function FoundationSection({ g }: { g: GeotechIntel }) {
  return (
    <Card title="Foundation comparison" icon={Building2} hint="Guidance only">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" data-testid="foundation-comparison">
        {g.foundations.map((f) => {
          const s = foundationScore(f, g);
          return (
            <div
              data-output-card
              key={f.type}
              className="rounded-xl bg-black/30 border border-white/5 px-3 py-2.5 flex flex-col"
              data-testid={`foundation-card-${f.type.toLowerCase()}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{f.type}</span>
                <span
                  className={`text-[10px] uppercase tracking-widest ${suitTone(f.suitability)}`}
                >
                  {f.suitability}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                {f.note}
              </p>
              <OutputVisual subject={`${f.type} foundation`} />
              <OutputTools label={`${f.type} foundation`} />
              <div className="mt-2 space-y-1">
                <MiniBar label="Load" value={s.loadCapacity} tone="#62e9ff" />
                <MiniBar label="Cost" value={s.costEfficiency} tone="#22c55e" />
                <MiniBar label="Fit" value={s.siteFit} tone="#d4a017" />
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground tabular-nums">
                {s.costLabel}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Final foundation design requires a professional site-specific geotechnical investigation.
      </p>
    </Card>
  );
}

function MiniBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground w-8">
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: tone }} />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground w-6 text-right">{value}</span>
    </div>
  );
}

function suitTone(s: string) {
  if (s === "Preferred") return "text-emerald-glow";
  if (s === "Possible") return "text-cyan-glow";
  if (s === "Cautious") return "text-amber-glow";
  return "text-destructive";
}

export function RiskSection({ g }: { g: GeotechIntel }) {
  const [open, setOpen] = useState<string | null>(g.risks[0]?.label ?? null);
  const gwScore = groundwaterScore(g);
  return (
    <Card
      title="Construction risks · mitigation & cost impact"
      icon={ShieldAlert}
      hint={`Groundwater ${gwScore}/100`}
    >
      <div className="space-y-2" data-testid="risk-cards">
        {g.risks.map((r) => {
          const isOpen = open === r.label;
          const band = r.costImpact.band;
          const bandTone =
            band === "Severe" || band === "High"
              ? "text-destructive"
              : band === "Moderate"
                ? "text-amber-glow"
                : "text-emerald-glow";
          const bandWidth =
            band === "Severe" ? 100 : band === "High" ? 75 : band === "Moderate" ? 50 : 25;
          return (
            <div
              key={r.label}
              className="rounded-xl bg-black/30 border border-white/5 overflow-hidden"
              data-testid={`risk-card-${r.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : r.label)}
                aria-expanded={isOpen}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03]"
              >
                <span className="text-sm font-medium flex-1">{r.label}</span>
                <span className={`text-[10px] uppercase tracking-widest ${eroseTone(r.level)}`}>
                  {r.level}
                </span>
                <span
                  className={`text-[10px] uppercase tracking-widest ${bandTone} ml-1`}
                  title={r.costImpact.note}
                >
                  {band} cost
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-white/5 px-3 py-2 space-y-2">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{r.note}</p>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1 mb-1">
                      <Wrench className="h-3 w-3 text-accent" /> What to do
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-foreground/85">
                      {r.mitigation.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1 mb-1">
                      <Coins className="h-3 w-3 text-amber-glow" /> Estimated cost impact
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-glow via-amber-glow to-destructive"
                        style={{ width: `${bandWidth}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                      KES {r.costImpact.rangeKESPerSqm[0].toLocaleString()}–
                      {r.costImpact.rangeKESPerSqm[1].toLocaleString()} / m² · {r.costImpact.note}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
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
