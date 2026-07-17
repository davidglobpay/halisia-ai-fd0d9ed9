import { useMemo } from "react";
import {
  Vote,
  Users2,
  Landmark,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  Timer,
  BarChart3,
  Flag,
} from "lucide-react";
import {
  getCountyPolitics,
  PARTY_COLORS,
  POLITICS_SOURCES,
  type CountyPolitics,
  type ElectionCycle,
  type Leader,
  type PublicOpinion,
} from "@/lib/county-politics";

export function CountyPoliticsPanel({ code }: { code: number }) {
  const politics = useMemo(() => getCountyPolitics(code), [code]);
  if (!politics) return null;

  return (
    <div className="space-y-6" data-testid="county-politics">
      <Disclaimer needsVerification={politics.needsVerification} />

      {/* Leadership */}
      <div>
        <SubHead icon={Users2} label="Current Leadership (2022 – 2027)" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          <LeaderCard leader={politics.leadership.governor} />
          <LeaderCard leader={politics.leadership.senator} />
          <CoalitionCard coalition={politics.coalition} />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Deputy Governor, Woman Representative and Members of Parliament are matters of public
          record — verify names and party affiliations with the IEBC candidate register and
          Parliament of Kenya directories linked below.
        </p>
      </div>

      {/* Election history */}
      <div>
        <SubHead icon={Vote} label="Gubernatorial Election History" />
        <div className="mt-3 grid md:grid-cols-3 gap-3">
          {politics.history.map((h) => (
            <ElectionCard key={h.year} cycle={h} />
          ))}
        </div>
        <TurnoutChart history={politics.history} />
      </div>

      {/* Party landscape */}
      <div>
        <SubHead icon={Flag} label="Party Landscape — 2022 Gubernatorial (approximate)" />
        <PartyBar landscape={politics.partyLandscape} />
        <p className="mt-2 text-[11px] text-muted-foreground">
          Share values are directional buckets summarising publicly released IEBC results, not exact
          tallies. See the IEBC results portal for the official percentages.
        </p>
      </div>

      {/* Key issues + priorities */}
      <div className="grid md:grid-cols-2 gap-3">
        <IssueList
          title="Frequently discussed public issues"
          items={politics.keyIssues}
          tone="warn"
        />
        <IssueList
          title="Public development priorities"
          items={politics.developmentPriorities}
          tone="ok"
        />
      </div>

      {/* Timeline */}
      <div>
        <SubHead icon={Timer} label="County Political Timeline" />
        <ol className="mt-3 relative border-l border-white/10 pl-4 space-y-3">
          {politics.timeline.map((m) => (
            <li key={`${m.year}-${m.label}`} className="relative">
              <span className="absolute -left-[19px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_0_3px_rgba(0,0,0,0.4)]" />
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {m.year} · {m.kind}
              </div>
              <div className="text-sm">{m.label}</div>
            </li>
          ))}
        </ol>
      </div>

      {/* Public opinion (composite index, disclaimer-safe) */}
      <PublicOpinionSection opinion={politics.publicOpinion} />

      {/* AI summary */}
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent">
          <Sparkles className="h-4 w-4" /> AI Political Summary
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground/90">{politics.aiSummary}</p>
        <p className="mt-2 text-[10px] text-muted-foreground">
          AI-generated interpretation of publicly available records. Not a prediction, forecast,
          endorsement or representation of any individual's political views.
        </p>
      </div>

      {/* Sources */}
      <div>
        <SubHead icon={Landmark} label="Public Data Sources" />
        <ul className="mt-3 grid sm:grid-cols-2 gap-2">
          {POLITICS_SOURCES.map((s) => (
            <li key={s.url} className="rounded-xl bg-white/5 border border-white/10 p-3 text-xs">
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-foreground hover:text-accent"
              >
                {s.label} <ExternalLink className="h-3 w-3" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SubHead({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-accent" />
      <span>{label}</span>
    </div>
  );
}

function Disclaimer({ needsVerification }: { needsVerification: boolean }) {
  return (
    <div className="rounded-2xl border border-amber-glow/30 bg-amber-glow/5 p-3 text-[11px] text-muted-foreground flex gap-2">
      <ShieldAlert className="h-4 w-4 text-amber-glow shrink-0 mt-0.5" />
      <div>
        <span className="text-foreground font-medium">
          Research tool — not a prediction platform.
        </span>{" "}
        This dashboard aggregates publicly available information from the IEBC, Parliament of Kenya,
        Council of Governors and county CIDPs. It does not infer private political preferences,
        generate polling estimates, or forecast election outcomes.
        {needsVerification && (
          <>
            {" "}
            <span className="text-amber-glow">
              Some party fields for this county are not encoded — verify with the IEBC register.
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function LeaderCard({ leader }: { leader: Leader }) {
  const color = PARTY_COLORS[leader.party as keyof typeof PARTY_COLORS] ?? PARTY_COLORS.Unknown;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {leader.role}
      </div>
      <div className="mt-1 text-base font-semibold">{leader.name}</div>
      <div
        className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px]"
        style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {leader.party}
      </div>
      {leader.term && (
        <div className="mt-2 text-[10px] text-muted-foreground">Term: {leader.term}</div>
      )}
    </div>
  );
}

function CoalitionCard({ coalition }: { coalition: string }) {
  const color =
    coalition === "Kenya Kwanza" ? "#f6c94a" : coalition === "Azimio" ? "#ff8a3d" : "#94a3b8";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        Executive Coalition
      </div>
      <div className="mt-1 text-base font-semibold">{coalition}</div>
      <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full" style={{ width: "100%", background: color, opacity: 0.75 }} />
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground">
        Based on gazetted 2022 gubernatorial result.
      </div>
    </div>
  );
}

function ElectionCard({ cycle }: { cycle: ElectionCycle }) {
  const color = PARTY_COLORS[cycle.party as keyof typeof PARTY_COLORS] ?? PARTY_COLORS.Unknown;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {cycle.year} · General election
      </div>
      <div className="mt-1 text-sm font-medium">
        {cycle.governor ?? "Winner on public record — verify with IEBC"}
      </div>
      <div
        className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px]"
        style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {cycle.party}
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        Turnout: {cycle.turnoutPct != null ? `${cycle.turnoutPct}%` : "—"}
      </div>
    </div>
  );
}

function TurnoutChart({ history }: { history: ElectionCycle[] }) {
  const w = 320;
  const h = 80;
  const pad = 16;
  const xs = history.map((_, i) => pad + i * ((w - 2 * pad) / (history.length - 1)));
  const ys = history.map((c) => {
    const t = c.turnoutPct ?? 0;
    return h - pad - ((h - 2 * pad) * t) / 100;
  });
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
        <BarChart3 className="h-3.5 w-3.5 text-accent" /> Voter turnout trend (gubernatorial)
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 w-full max-w-md">
        <path d={path} fill="none" stroke="currentColor" className="text-accent" strokeWidth={2} />
        {xs.map((x, i) => (
          <g key={i}>
            <circle cx={x} cy={ys[i]} r={3} className="fill-accent" />
            <text
              x={x}
              y={h - 2}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize={9}
            >
              {history[i].year}
            </text>
            <text x={x} y={ys[i] - 6} textAnchor="middle" className="fill-foreground" fontSize={9}>
              {history[i].turnoutPct != null ? `${history[i].turnoutPct}%` : "—"}
            </text>
          </g>
        ))}
      </svg>
      <div className="text-[10px] text-muted-foreground">
        National reference: 2013 ≈ 86%, 2017 ≈ 78%, 2022 ≈ 65%.
      </div>
    </div>
  );
}

function PartyBar({ landscape }: { landscape: Array<{ party: string; sharePct: number }> }) {
  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full border border-white/10">
        {landscape.map((seg) => {
          const color =
            PARTY_COLORS[seg.party as keyof typeof PARTY_COLORS] ?? PARTY_COLORS.Unknown;
          return (
            <div
              key={seg.party}
              style={{ width: `${seg.sharePct}%`, background: color }}
              title={`${seg.party} ~${seg.sharePct}%`}
            />
          );
        })}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-1.5 text-[11px]">
        {landscape.map((seg) => {
          const color =
            PARTY_COLORS[seg.party as keyof typeof PARTY_COLORS] ?? PARTY_COLORS.Unknown;
          return (
            <li key={seg.party} className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: color }} />
              <span className="text-foreground">{seg.party}</span>
              <span className="ml-auto tabular-nums">~{seg.sharePct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function IssueList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "ok" | "warn";
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div
        className={`text-[11px] uppercase tracking-widest ${
          tone === "ok" ? "text-accent" : "text-amber-glow"
        }`}
      >
        {title}
      </div>
      <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
        {items.map((it) => (
          <li key={it} className="flex gap-2">
            <span className={tone === "ok" ? "text-accent" : "text-amber-glow"}>•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
