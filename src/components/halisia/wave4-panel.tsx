import { ListenButton } from "@/components/halisia/listen-button";
import { OutputTools, OutputVisual, OutputIcon } from "@/components/halisia/output-tools";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  MapPin,
  Building2,
  Ruler,
  Database,
  ShieldCheck,
  ExternalLink,
  CloudRain,
  Thermometer,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { useState } from "react";
import {
  getWave4Intel,
  OVERPASS_CATEGORY_LABELS,
  type Wave4Intel,
  type ScoreExplain,
} from "@/lib/wave4-intel.functions";
import { ProvenanceModal } from "@/components/halisia/provenance-modal";

type SubTab = "admin" | "public" | "invest" | "sources";

/**
 * The third tab was called "Investment" and led with "Investment score · NN /
 * 100 · composite" over a filled progress bar. The number came from
 * `0.35·access + 0.35·infra + 0.15·env + 0.15·dev`, where each input was a
 * count of OpenStreetMap features multiplied by an invented constant — and the
 * counts were capped at twelve per category before the arithmetic ran, so a
 * neighbourhood with twelve schools and one with two hundred came out the same.
 *
 * Calling that "Investment" was the worst part. HALISIA holds no price, rent,
 * yield, sale or approval for any point in Kenya. The tab now says what it
 * actually holds: what is mapped within three kilometres, and how far away.
 *
 * The `invest` id is kept so existing links and the end-to-end tests that drive
 * `wave4-tab-invest` still find it.
 */
const SUB_TABS: Array<{ id: SubTab; label: string; icon: React.ElementType }> = [
  { id: "admin", label: "Admin", icon: MapPin },
  { id: "public", label: "Public data", icon: Building2 },
  { id: "invest", label: "Within 3 km", icon: Ruler },
  { id: "sources", label: "Sources", icon: Database },
];

export function Wave4Panel({ lat, lng }: { lat: number; lng: number }) {
  const [sub, setSub] = useState<SubTab>("admin");
  const qc = useQueryClient();
  const q = useQuery<Wave4Intel>({
    queryKey: ["wave4", lat.toFixed(3), lng.toFixed(3)],
    queryFn: () => getWave4Intel({ data: { lat, lng } }),
    staleTime: 15 * 60 * 1000,
  });
  const [refreshing, setRefreshing] = useState(false);
  const doRefresh = async () => {
    setRefreshing(true);
    try {
      const fresh = await getWave4Intel({ data: { lat, lng, refresh: true } });
      qc.setQueryData(["wave4", lat.toFixed(3), lng.toFixed(3)], fresh);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <section className="space-y-3" data-testid="wave4-panel">
      <div className="glass rounded-2xl p-1.5">
        <div className="flex items-center justify-between px-1.5 pt-0.5 pb-1">
          <span className="text-[9px] uppercase tracking-[0.18em] text-amber-glow font-semibold">
            Wave 4
          </span>
          <div className="flex items-center gap-2">
            {q.data && (
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                Updated {new Date(q.data.generatedAt).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={doRefresh}
              disabled={refreshing}
              data-testid="wave4-refresh"
              className="inline-flex items-center gap-1 rounded-full glass px-2 py-0.5 text-[10px] hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {SUB_TABS.map((t) => {
            const Icon = t.icon;
            const active = t.id === sub;
            return (
              <button
                key={t.id}
                onClick={() => setSub(t.id)}
                data-testid={`wave4-tab-${t.id}`}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[11px] transition ${
                  active
                    ? "bg-white/15 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {q.isLoading || !q.data ? (
        <div className="glass rounded-2xl p-6 flex items-center justify-center text-xs text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          Fetching public open-data (OSM · Nominatim · Open-Meteo)…
        </div>
      ) : (
        <>
          {sub === "admin" && <AdminTab data={q.data} />}
          {sub === "public" && <PublicTab data={q.data} />}
          {sub === "invest" && <InvestTab data={q.data} />}
          {sub === "sources" && <SourcesTab data={q.data} />}
        </>
      )}

      <p className="text-[10px] leading-relaxed text-muted-foreground px-1">
        HALISIA is not an official land registry. Wave 4 uses only free, public and open datasets
        (OpenStreetMap, Nominatim, Open-Meteo). Administrative and cadastral records still require
        authorised access to Ministry of Lands / Ardhisasa / county GIS.
      </p>
    </section>
  );
}

/* ---------- Admin ---------- */

function AdminTab({ data }: { data: Wave4Intel }) {
  const rows: Array<[string, string | null]> = [
    ["County", data.admin.county],
    ["Constituency", data.admin.constituency],
    ["Ward", data.admin.ward],
    ["Town", data.admin.town],
    ["Village / Estate", data.admin.village],
  ];
  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-accent" />
        <div className="text-sm font-medium">Administrative profile</div>
      </div>
      <div className="text-xs text-muted-foreground leading-relaxed">
        {data.admin.displayName ?? "No address resolved via Nominatim."}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/5 bg-black/20 px-3 py-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {label}
            </div>
            <div className="text-sm font-medium mt-0.5 truncate">{value ?? "—"}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ClimateTile
          label="Rainfall (annual)"
          value={
            data.climate.annualRainfallMm != null
              ? `${Math.round(data.climate.annualRainfallMm)} mm`
              : "—"
          }
          icon={CloudRain}
        />
        <ClimateTile
          label="Mean temp"
          value={data.climate.meanTempC != null ? `${data.climate.meanTempC.toFixed(1)} °C` : "—"}
          sub={
            data.climate.tempMinC != null && data.climate.tempMaxC != null
              ? `${data.climate.tempMinC.toFixed(0)}–${data.climate.tempMaxC.toFixed(0)} °C range`
              : undefined
          }
          icon={Thermometer}
        />
      </div>
    </div>
  );
}

function ClimateTile({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2" data-output-card>
      <OutputTools label={label} />
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

/* ---------- Public ---------- */

function PublicTab({ data }: { data: Wave4Intel }) {
  const entries = Object.entries(data.facilities).filter(([, list]) => list.length > 0);
  if (!entries.length) {
    return (
      <div className="glass rounded-2xl p-4 text-xs text-muted-foreground">
        No public facilities returned by Overpass within 3&nbsp;km — try a more urban search point.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {entries.map(([key, list]) => (
        <div data-output-card key={key} className="glass rounded-2xl p-3">
          <OutputIcon subject={OVERPASS_CATEGORY_LABELS[key] ?? key} />
          <OutputTools label={OVERPASS_CATEGORY_LABELS[key] ?? key} />
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium">{OVERPASS_CATEGORY_LABELS[key] ?? key}</div>
            <div className="text-[10px] text-muted-foreground">{list.length}</div>
          </div>
          <ul className="space-y-1.5">
            {list.slice(0, 6).map((p) => (
              <li key={p.id} className="flex items-start gap-2 text-xs">
                <span className="mt-1 h-1 w-1 rounded-full bg-accent" />
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {p.distanceKm < 1
                    ? `${Math.round(p.distanceKm * 1000)} m`
                    : `${p.distanceKm.toFixed(1)} km`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ---------- Invest ---------- */

function InvestTab({ data }: { data: Wave4Intel }) {
  const items: Array<[string, keyof Wave4Intel["breakdown"]]> = [
    ["Accessibility", "accessibility"],
    ["Infrastructure", "infrastructure"],
    ["Environment", "environment"],
    ["Development potential", "development"],
  ];
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [prov, setProv] = useState<{
    key: keyof Wave4Intel["breakdown"];
    label: string;
  } | null>(null);
  // Totals across every category Overpass answered for, with how near they are.
  const buckets = Object.values(data.distanceBuckets);
  const close = buckets.reduce((t, b) => t + b.close, 0);
  const near = buckets.reduce((t, b) => t + b.near, 0);
  const far = buckets.reduce((t, b) => t + b.far, 0);
  const mapped = close + near + far;

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-4" data-testid="wave4-mapped-nearby">
        <div className="flex items-center gap-2">
          <Ruler className="h-4 w-4 text-emerald-glow" />
          <div className="text-sm font-medium">What is mapped within 3 km</div>
          <button
            onClick={() => setProv({ key: "investment", label: "Mapped within 3 km" })}
            className="ml-auto inline-flex items-center gap-1 rounded-full glass px-2 py-0.5 text-[10px] hover:bg-white/10"
            data-testid="wave4-provenance-investment"
          >
            <Info className="h-3 w-3" /> Provenance
          </button>
        </div>
        <div className="mt-2 flex items-end gap-3">
          <div className="text-4xl font-semibold tracking-tight text-emerald-glow tabular-nums">
            {mapped}
          </div>
          <div className="text-xs text-muted-foreground pb-1">
            features mapped nearby — no score, no ranking
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            ["Under 500 m", close],
            ["500 m – 1.5 km", near],
            ["Over 1.5 km", far],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-xl border border-white/5 bg-black/20 px-3 py-2"
            >
              <div className="text-lg font-semibold tabular-nums">{value}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {label}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Counted from OpenStreetMap. The search returns at most 60 features and keeps the 12
          nearest in each category, so a busy area is undercounted — a category showing 12 means
          twelve or more. Open the map at this point and you can count the same features yourself.
        </p>
        <ScoreDrill
          label="What was counted"
          explain={data.breakdown.investment}
          defaultOpen
          onProvenance={() => setProv({ key: "investment", label: "Mapped within 3 km" })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(([label, key]) => {
          const explain = data.breakdown[key];
          const open = openKey === key;
          return (
            <div data-output-card key={label} className="glass rounded-2xl p-3">
              <OutputIcon subject={label} />
              <ListenButton
                label={`Listen to ${label}`}
                text={`${label}. ${explain.factors.map((f) => (f.value == null ? `${f.label}: not returned` : `${f.label}: ${Math.round(f.value)} ${f.unit}`)).join(". ")}. ${explain.note} Mapping coverage here is ${explain.confidence}. Counted from public open data. No score and no valuation.`}
              />
              <button
                onClick={() => setOpenKey(open ? null : key)}
                className="w-full text-left"
                data-testid={`wave4-drill-${key}`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {label}
                  </div>
                  {open ? (
                    <ChevronUp className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
                {/* The mark out of 100 and its filled bar stood here. What the
                    card can show truthfully is the count it was built from —
                    and for climate, which is not a count, nothing at all. */}
                {key === "environment" ? (
                  <>
                    {/* A missing reading is an em dash, never a zero. The
                        archive returning nothing is not a temperature. */}
                    <div className="mt-1 text-2xl font-semibold tabular-nums">
                      {explain.factors[0]?.value != null
                        ? `${Math.round(explain.factors[0].value * 10) / 10}°`
                        : "—"}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {explain.factors[0]?.value != null
                        ? "mean temperature, 2010–2020"
                        : "climate archive returned nothing"}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">
                      {explain.factors.reduce((t, f) => t + (f.value ?? 0), 0)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">mapped within 3 km</div>
                  </>
                )}
              </button>
              {open && (
                <ScoreDrill
                  label="Breakdown"
                  explain={explain}
                  onProvenance={() => setProv({ key, label })}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="text-[11px] text-muted-foreground px-1 leading-relaxed">
        These are counts of features mapped in OpenStreetMap within 3&nbsp;km, and climate normals
        from the Open-Meteo archive (EC-Earth3P-HR, 2010–2020). They are not weighted, combined or
        ranked, and HALISIA publishes no investment figure: it holds no price, rent, yield, sale or
        planning approval for this point. A mapped facility is not proof that it is open, staffed or
        able to serve you.
      </div>
      <ProvenanceModal
        open={!!prov}
        onClose={() => setProv(null)}
        title={prov ? `${prov.label} · how it was computed` : ""}
        explain={prov ? data.breakdown[prov.key] : data.breakdown.investment}
        sources={data.sources}
        contextNote="HALISIA is not an official land registry. Wave 4 aggregates free, public open datasets — verify authoritative records with the Ministry of Lands / Ardhisasa / county GIS."
      />
    </div>
  );
}

function ScoreDrill({
  label,
  explain,
  defaultOpen = false,
  onProvenance,
}: {
  label: string;
  explain: ScoreExplain;
  defaultOpen?: boolean;
  onProvenance?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-3 rounded-xl border border-white/5 bg-black/20 p-2.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        <span>{label}</span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {/* A monospace line printed the arithmetic — "25 + transit·6 + fuel·4"
              — which showed the working without the working meaning anything.
              In its place: what was counted, and where. */}
          <div className="text-[10px] leading-relaxed text-cyan-glow">{explain.method}</div>
          <ul className="space-y-1">
            {explain.factors.map((f) => (
              <li key={f.label} className="flex items-start justify-between gap-2 text-[11px]">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="text-right tabular-nums">
                  {f.value == null ? "—" : Math.round(f.value * 10) / 10}{" "}
                  <span className="text-[10px] text-muted-foreground">{f.unit}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-start justify-between gap-2 pt-1 text-[10px]">
            <span className="text-muted-foreground">{explain.note}</span>
            <span
              className={
                explain.confidence === "high"
                  ? "text-emerald-glow"
                  : explain.confidence === "medium"
                    ? "text-amber-glow"
                    : "text-muted-foreground"
              }
            >
              mapping coverage: {explain.confidence}
            </span>
          </div>
          {onProvenance && (
            <button
              onClick={onProvenance}
              className="mt-1 inline-flex items-center gap-1 rounded-full glass px-2 py-0.5 text-[10px] hover:bg-white/10"
              data-testid="wave4-open-provenance"
            >
              <Info className="h-3 w-3 text-accent" /> View dataset provenance
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Sources ---------- */

function SourcesTab({ data }: { data: Wave4Intel }) {
  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-emerald-glow" />
        <div className="text-sm font-medium">Data sources & compliance</div>
      </div>
      <ul className="space-y-1.5">
        {data.sources.map((s) => (
          <li
            key={s.url}
            className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-xs"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${s.used ? "bg-emerald-glow" : "bg-white/25"}`}
              aria-label={s.used ? "Live" : "Planned"}
            />
            <span className="flex-1 truncate">{s.label}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
              {s.used ? "Live" : "Planned"}
            </span>
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="text-cyan-glow hover:underline inline-flex items-center gap-1"
            >
              Open <ExternalLink className="h-3 w-3" />
            </a>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Live sources feed this dashboard on every search. Planned sources are
        not connected: no code queries them, nothing on this page uses them, and
        listing them here is a statement of intent rather than of capability.
      </p>
    </div>
  );
}
