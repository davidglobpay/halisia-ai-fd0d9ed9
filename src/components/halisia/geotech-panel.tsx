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
} from "lucide-react";
import { getGeotechIntel, type GeotechIntel, type SoilLayer } from "@/lib/geotech.functions";
import { downloadGeotechPdf } from "@/lib/geotech-pdf";

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
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-accent" />
        <div className="text-sm font-medium">{title}</div>
        {hint && (
          <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-widest">
            {hint}
          </span>
        )}
      </div>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/25 border border-white/5 px-3 py-2">
      <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{label}</div>
      <div className="text-sm font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function TerrainSection({ g }: { g: GeotechIntel }) {
  const t = g.terrain;
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
      <TerrainProfile g={g} />
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

function TerrainProfile({ g }: { g: GeotechIntel }) {
  const t = g.terrain;
  // Simple synthetic transect from min to max lifting through mean.
  const points = useMemo(() => {
    const n = 24;
    const base = t.minM;
    const amp = t.reliefM;
    return Array.from({ length: n + 1 }, (_, i) => {
      const x = i / n;
      const bump = Math.sin(x * Math.PI) * (t.landform === "valley" ? -0.4 : 0.7);
      const wave = Math.sin(x * Math.PI * 3 + t.aspectDeg) * 0.15;
      const y = base + amp * Math.max(0, 0.35 + bump + wave);
      return { x, y };
    });
  }, [t]);
  const W = 320,
    H = 90;
  const yMin = Math.min(...points.map((p) => p.y));
  const yMax = Math.max(...points.map((p) => p.y));
  const span = Math.max(1, yMax - yMin);
  const path = points
    .map((p, i) => {
      const px = p.x * W;
      const py = H - ((p.y - yMin) / span) * (H - 10) - 4;
      return `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(" ");
  const fill = `${path} L${W},${H} L0,${H} Z`;
  return (
    <div className="mt-3 rounded-xl border border-white/5 bg-black/40 p-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
        Terrain profile transect
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24">
        <defs>
          <linearGradient id="terrainFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="hsl(var(--accent) / 0.6)" />
            <stop offset="1" stopColor="hsl(var(--accent) / 0.05)" />
          </linearGradient>
        </defs>
        <path d={fill} fill="url(#terrainFill)" />
        <path d={path} stroke="hsl(var(--accent))" strokeWidth={1.4} fill="none" />
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{t.minM} m</span>
        <span>along ~1 km transect</span>
        <span>{t.maxM} m</span>
      </div>
    </div>
  );
}

function SoilSection({ layers }: { layers: SoilLayer[] }) {
  if (!layers.length)
    return (
      <Card title="Soil profile" icon={LayersIcon}>
        <div className="text-xs text-muted-foreground">
          SoilGrids returned no data for this point.
        </div>
      </Card>
    );
  return (
    <Card title="Soil profile" icon={LayersIcon} hint="ISRIC SoilGrids v2.0">
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
            <div className="mt-2 h-2 rounded-full overflow-hidden flex">
              <div
                className="bg-amber-glow/80"
                style={{ width: `${L.clayPct}%` }}
                title={`Clay ${L.clayPct}%`}
              />
              <div
                className="bg-primary/70"
                style={{ width: `${L.siltPct}%` }}
                title={`Silt ${L.siltPct}%`}
              />
              <div
                className="bg-cyan-glow/80"
                style={{ width: `${L.sandPct}%` }}
                title={`Sand ${L.sandPct}%`}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
              <span>Clay {L.clayPct}%</span>
              <span>Silt {L.siltPct}%</span>
              <span>Sand {L.sandPct}%</span>
              <span>Org {L.organicPct}%</span>
              {L.bulkDensity != null && <span>ρ {L.bulkDensity} g/cm³</span>}
            </div>
          </div>
        ))}
      </div>
    </Card>
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
            style={{ background: "repeating-linear-gradient(45deg,#3a3a3a 0 4px,#4a4a4a 4px 8px)" }}
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
    <Card title="Foundation suitability" icon={Building2} hint="Guidance only">
      <div className="grid grid-cols-2 gap-2">
        {g.foundations.map((f) => (
          <div key={f.type} className="rounded-xl bg-black/30 border border-white/5 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{f.type}</span>
              <span className={`text-[10px] uppercase tracking-widest ${suitTone(f.suitability)}`}>
                {f.suitability}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{f.note}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Final foundation design requires a professional site-specific geotechnical investigation.
      </p>
    </Card>
  );
}

function suitTone(s: string) {
  if (s === "Preferred") return "text-emerald-glow";
  if (s === "Possible") return "text-cyan-glow";
  if (s === "Cautious") return "text-amber-glow";
  return "text-destructive";
}

function RiskSection({ g }: { g: GeotechIntel }) {
  return (
    <Card title="Construction risk indicators" icon={ShieldAlert}>
      <div className="grid grid-cols-2 gap-2">
        {g.risks.map((r) => (
          <div key={r.label} className="rounded-xl bg-black/30 border border-white/5 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{r.label}</span>
              <span
                className={`text-[10px] uppercase tracking-widest ${eroseTone(r.level as "Low" | "Moderate" | "High")}`}
              >
                {r.level}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{r.note}</p>
          </div>
        ))}
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
