import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Archive, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import {
  fetchIngestionLogs,
  fetchProviderHealth,
  fetchPulseSources,
  fetchPulseStats,
  relativeTime,
} from "@/lib/pulse";
import {
  archivePulseArticles,
  recomputePulseTrending,
  runPulseIngestion,
} from "@/lib/pulse.functions";
import { adminRpc, type AdminStatus } from "@/lib/admin";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/pulse/admin")({
  component: PulseAdmin,
  head: () => ({
    meta: [
      { title: "Pulse control room — HALISIA news pipeline admin" },
      {
        name: "description",
        content:
          "Monitor Pulse provider health, RSS and API status, imported articles, duplicates, failures and refresh cadence.",
      },
      { property: "og:title", content: "HALISIA Pulse control room" },
      { property: "og:description", content: "Operations dashboard for the Pulse news pipeline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="elev-1 rounded-2xl border border-white/10 p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gradient">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function statusTone(status: string) {
  if (status === "active") return "border-emerald-400/50 text-emerald-300";
  if (status === "degraded") return "border-amber-glow/60 text-amber-glow";
  if (status === "awaiting_api_key") return "border-white/20 text-muted-foreground";
  return "border-destructive/50 text-destructive";
}

function PulseAdmin() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const roles = useQuery({
    queryKey: ["admin-status", user?.id],
    queryFn: () => adminRpc<AdminStatus>("halisia_admin_status"),
    enabled: !!user,
  });
  const isAdmin = roles.data?.ready === true;

  const stats = useQuery({ queryKey: ["pulse-stats"], queryFn: fetchPulseStats, enabled: isAdmin });
  const health = useQuery({
    queryKey: ["pulse-health"],
    queryFn: fetchProviderHealth,
    enabled: isAdmin,
  });
  const logs = useQuery({
    queryKey: ["pulse-logs"],
    queryFn: () => fetchIngestionLogs(25),
    enabled: isAdmin,
  });
  const sources = useQuery({
    queryKey: ["pulse-sources"],
    queryFn: fetchPulseSources,
    enabled: isAdmin,
  });

  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: ["pulse-stats"] });
    void qc.invalidateQueries({ queryKey: ["pulse-health"] });
    void qc.invalidateQueries({ queryKey: ["pulse-logs"] });
    void qc.invalidateQueries({ queryKey: ["pulse-sources"] });
  };

  const run = async (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    setMessage(null);
    try {
      setMessage(await fn());
      refreshAll();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  };

  if (loading || (user && roles.isLoading)) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 text-sm text-muted-foreground">
        Checking access…
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-xl font-semibold">Pulse control room</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This dashboard requires an authorized administrator account and verified MFA.
        </p>
        <Link to="/admin" className="mt-4 block text-sm text-primary underline">Verify access in master admin</Link>
        <Link to="/pulse" className="mt-4 inline-block text-sm text-accent hover:underline">
          Back to the Pulse feed
        </Link>
      </main>
    );
  }

  const s = stats.data;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-accent">
            <Activity className="h-3.5 w-3.5" /> Pulse control room
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">News pipeline operations</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Last refresh {s?.lastRefreshAt ? relativeTime(s.lastRefreshAt) : "not yet run"} ·
            scheduled every 10 minutes, hourly with AI, nightly archive.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!!busy}
            onClick={() =>
              run("ingest", async () => {
                const r = await runPulseIngestion({ data: { useAi: true } });
                return `Ingestion complete — ${r.totalInserted} new articles.`;
              })
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 text-xs font-medium text-accent disabled:opacity-50"
          >
            {busy === "ingest" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Run ingestion
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() =>
              run("trend", async () => {
                const r = await recomputePulseTrending();
                return `Trending recomputed for ${r.scored} articles.`;
              })
            }
            className="elev-1 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-xs disabled:opacity-50"
          >
            <TrendingUp className="h-3.5 w-3.5" /> Recompute trending
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() =>
              run("archive", async () => {
                const r = await archivePulseArticles({ data: { days: 45 } });
                return `Archived ${r.archived} stale articles.`;
              })
            }
            className="elev-1 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-xs disabled:opacity-50"
          >
            <Archive className="h-3.5 w-3.5" /> Archive old
          </button>
        </div>
      </header>

      {message && (
        <p role="status" className="mt-4 rounded-xl border border-white/10 p-3 text-xs">
          {message}
        </p>
      )}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Articles live"
          value={s?.activeArticles ?? "—"}
          hint={`${s?.totalArticles ?? 0} total`}
        />
        <Stat label="Imported (24h)" value={s?.last24h ?? "—"} />
        <Stat label="AI enriched" value={s?.withAi ?? "—"} hint="with impact analysis" />
        <Stat label="Archived" value={s?.archivedArticles ?? "—"} hint="beyond retention" />
        <Stat label="Fetched (7d)" value={s?.fetched7d ?? "—"} hint="API + RSS requests" />
        <Stat label="Inserted (7d)" value={s?.inserted7d ?? "—"} />
        <Stat label="Duplicates removed (7d)" value={s?.duplicates7d ?? "—"} />
        <Stat label="Failed imports (7d)" value={s?.failed7d ?? "—"} />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Provider health</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(health.data ?? []).map((p) => (
            <div key={p.provider} className="elev-1 rounded-2xl border border-white/10 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold capitalize">{p.provider}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${statusTone(p.status)}`}
                >
                  {p.status.replace(/_/g, " ")}
                </span>
              </div>
              <dl className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                <div className="flex justify-between">
                  <dt>Last OK</dt>
                  <dd>{p.lastOkAt ? relativeTime(p.lastOkAt) : "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Latency</dt>
                  <dd>{p.latencyMs != null ? `${p.latencyMs} ms` : "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Requests today</dt>
                  <dd>{p.requestsToday}</dd>
                </div>
              </dl>
              {p.lastError && (
                <p className="mt-2 line-clamp-3 text-[11px] text-destructive">{p.lastError}</p>
              )}
            </div>
          ))}
          {!health.data?.length && (
            <p className="text-xs text-muted-foreground">No provider telemetry yet.</p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">RSS & API sources</h2>
        <div className="elev-1 mt-3 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-[12px]">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="p-3">Source</th>
                <th className="p-3">Provider</th>
                <th className="p-3">Status</th>
                <th className="p-3">Cadence</th>
                <th className="p-3">Last fetched</th>
              </tr>
            </thead>
            <tbody>
              {(sources.data ?? []).map((src) => (
                <tr key={src.id} className="border-t border-white/5">
                  <td className="p-3">{src.name}</td>
                  <td className="p-3 capitalize">{src.provider}</td>
                  <td className="p-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] ${statusTone(src.status)}`}
                    >
                      {src.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="p-3">{src.refreshMinutes} min</td>
                  <td className="p-3">
                    {src.lastFetchedAt ? relativeTime(src.lastFetchedAt) : "—"}
                  </td>
                </tr>
              ))}
              {!sources.data?.length && (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={5}>
                    No sources registered.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Recent ingestion runs</h2>
        <div className="elev-1 mt-3 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-[12px]">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="p-3">Started</th>
                <th className="p-3">Provider</th>
                <th className="p-3">Fetched</th>
                <th className="p-3">Inserted</th>
                <th className="p-3">Duplicates</th>
                <th className="p-3">Failed</th>
                <th className="p-3">Result</th>
              </tr>
            </thead>
            <tbody>
              {(logs.data ?? []).map((l) => (
                <tr key={l.id} className="border-t border-white/5">
                  <td className="p-3">{relativeTime(l.startedAt)}</td>
                  <td className="p-3 capitalize">{l.provider}</td>
                  <td className="p-3">{l.fetchedCount}</td>
                  <td className="p-3">{l.insertedCount}</td>
                  <td className="p-3">{l.duplicateCount}</td>
                  <td className="p-3">{l.failedCount}</td>
                  <td className="p-3">
                    {l.ok ? (
                      <span className="text-emerald-300">OK</span>
                    ) : (
                      <span className="text-destructive">{l.errorMessage ?? "Failed"}</span>
                    )}
                  </td>
                </tr>
              ))}
              {!logs.data?.length && (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={7}>
                    No ingestion runs recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Link to="/pulse" className="mt-8 inline-block text-xs text-accent hover:underline">
        Back to the Pulse feed
      </Link>
    </main>
  );
}

