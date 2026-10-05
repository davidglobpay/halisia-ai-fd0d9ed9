import { useMemo } from "react";
import { Vote, Users2, Landmark, ExternalLink, ShieldAlert, Timer } from "lucide-react";
import {
  getCountyPolitics,
  PARTY_COLORS,
  POLITICS_SOURCES,
  TERM_CAVEAT,
  type ElectionCycle,
  type Leader,
} from "@/lib/county-politics";

/**
 * The county political record.
 *
 * This panel previously carried a "Public Opinion — Composite Research Index"
 * with four 0-100 scores and a turnout-correlation chart, and a party
 * vote-share bar. Neither had data behind it: the scores were arithmetic on a
 * per-code jitter term, and the vote-share bar showed the same 55/32/8/5 split
 * for all 47 counties. Both are removed. So are the "frequently discussed
 * public issues" lists, which were written per region and displayed as
 * findings about the county on screen.
 *
 * What remains is the gazetted record — who holds each seat, on which party,
 * which party won each cycle, and the turnout the IEBC published for 2022.
 */
export function CountyPoliticsPanel({ code }: { code: number }) {
  const politics = useMemo(() => getCountyPolitics(code), [code]);
  if (!politics) return null;

  return (
    <div className="space-y-6" data-testid="county-politics">
      <Disclaimer needsVerification={politics.needsVerification} />

      {/* Leadership */}
      <div>
        <SubHead icon={Users2} label="Elected in August 2022, for the 2022 – 2027 term" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          <LeaderCard leader={politics.leadership.governor} />
          <LeaderCard leader={politics.leadership.senator} />
          <CoalitionCard coalition={politics.coalition} />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          {TERM_CAVEAT} Deputy Governor, Woman Representative and Members of Parliament are matters
          of public record but are not held here — look them up in the IEBC candidate register and
          the Parliament of Kenya directories linked below.
        </p>
      </div>

      {/* Election history */}
      <div>
        <SubHead icon={Vote} label="Gubernatorial results by cycle" />
        <div className="mt-3 grid md:grid-cols-3 gap-3">
          {politics.history.map((h) => (
            <ElectionCard key={h.year} cycle={h} />
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Winning party per cycle, from IEBC gazette notices. Turnout is shown only for 2022, the
          one year for which this dataset holds a county figure; the winner's vote share is not held
          here at all. Read both from the IEBC results portal.
        </p>
      </div>

      {/* Timeline */}
      <div>
        <SubHead icon={Timer} label="County political timeline" />
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

      {/* Summary — a statement of the record, not an interpretation of it */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Summary of the record
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground/90">{politics.summary}</p>
      </div>

      {/* Sources */}
      <div>
        <SubHead icon={Landmark} label="Where this comes from" />
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
        <span className="text-foreground font-medium">The 2022 record, not today's roll.</span>{" "}
        Names, parties, winning cycles and turnout come from IEBC gazette notices and the Parliament
        and Senate directories, as they stood after the August 2022 election. HALISIA holds no
        polling, no sentiment estimate and no forecast for any county, and publishes none.
        {needsVerification && (
          <>
            {" "}
            <span className="text-amber-glow">
              A party field for this county is not encoded here — check the IEBC register.
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
        {leader.role} elected 2022
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
        Winning coalition, 2022
      </div>
      <div className="mt-1 text-base font-semibold">{coalition}</div>
      <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full" style={{ width: "100%", background: color, opacity: 0.75 }} />
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground">
        The coalition the winning party belonged to in 2022.
      </div>
    </div>
  );
}

function ElectionCard({ cycle }: { cycle: ElectionCycle }) {
  const color = PARTY_COLORS[cycle.party as keyof typeof PARTY_COLORS] ?? PARTY_COLORS.Unknown;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {cycle.year} · Gubernatorial
      </div>
      <div className="mt-1 text-sm font-medium">
        {cycle.governor ?? "Winner not held in this dataset"}
      </div>
      <div
        className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px]"
        style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {cycle.party}
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        {cycle.turnoutPct != null ? `Turnout ${cycle.turnoutPct}% (IEBC)` : "Turnout not held here"}
      </div>
    </div>
  );
}
