import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  MapPin,
  Building2,
  Gauge,
  TrendingUp,
  Database,
  ShieldCheck,
  ExternalLink,
  CloudRain,
  Thermometer,
} from "lucide-react";
import { useState } from "react";
import {
  getWave4Intel,
  OVERPASS_CATEGORY_LABELS,
  type Wave4Intel,
} from "@/lib/wave4-intel.functions";

type SubTab = "admin" | "public" | "invest" | "sources";

const SUB_TABS: Array<{ id: SubTab; label: string; icon: React.ElementType }> = [
  { id: "admin", label: "Admin", icon: MapPin },
  { id: "public", label: "Public data", icon: Building2 },
  { id: "invest", label: "Investment", icon: TrendingUp },
  { id: "sources", label: "Sources", icon: Database },
];

export function Wave4Panel({ lat, lng }: { lat: number; lng: number }) {
  const [sub, setSub] = useState<SubTab>("admin");
  const q = useQuery<Wave4Intel>({
    queryKey: ["wave4", lat.toFixed(3), lng.toFixed(3)],
    queryFn: () => getWave4Intel({ data: { lat, lng } }),
    staleTime: 15 * 60 * 1000,
  });

  return (
    <section className="space-y-3" data-testid="wave4-panel">
      <div className="glass rounded-2xl p-1.5">
        <div className="flex items-center justify-between px-1.5 pt-0.5 pb-1">
          <span className="text-[9px] uppercase tracking-[0.18em] text-amber-glow font-semibold">
            Wave 4
          </span>
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
            Open public data · Kenya
          </span>
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
    <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2">
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
        <div key={key} className="glass rounded-2xl p-3">
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
  const items: Array<[string, number]> = [
    ["Accessibility", data.scores.accessibility],
    ["Infrastructure", data.scores.infrastructure],
    ["Environment", data.scores.environment],
    ["Development potential", data.scores.development],
  ];
  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-emerald-glow" />
          <div className="text-sm font-medium">Investment score</div>
        </div>
        <div className="mt-2 flex items-end gap-3">
          <div className="text-4xl font-semibold tracking-tight text-emerald-glow">
            {data.scores.investment}
          </div>
          <div className="text-xs text-muted-foreground pb-1">/ 100 · composite</div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary via-accent to-emerald-glow transition-all"
            style={{ width: `${data.scores.investment}%` }}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(([label, v]) => (
          <div key={label} className="glass rounded-2xl p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {label}
            </div>
            <div className="mt-1 text-2xl font-semibold">{v}</div>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent"
                style={{ width: `${v}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-muted-foreground px-1 leading-relaxed">
        Composite = 0.35·access + 0.35·infra + 0.15·environment + 0.15·development. Derived from OSM
        facility density (3&nbsp;km) and Open-Meteo climate normals. AI-generated interpretation,
        not a valuation.
      </div>
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
        Live sources feed this dashboard on every search. Planned sources are wired through the
        modular connector layer and can be enabled without a redesign, in line with the Kenya Data
        Protection Act and applicable public-data terms.
      </p>
    </div>
  );
}
