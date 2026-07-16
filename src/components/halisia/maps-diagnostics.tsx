import { useEffect, useState } from "react";
import {
  subscribeMapDiagnostics,
  classifyMapError,
  fetchStaticMapCached,
  type MapDiagnostics,
} from "@/lib/static-map-cache";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, ExternalLink } from "lucide-react";

function timeAgo(ts: number | null) {
  if (!ts) return "never";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

export function MapsDiagnostics({ lat, lng }: { lat: number; lng: number }) {
  const [d, setD] = useState<MapDiagnostics | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => subscribeMapDiagnostics(setD), []);

  if (!d) return null;
  const err = classifyMapError(d.lastError);

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    const r = await fetchStaticMapCached({ lat, lng, layer: "roadmap-light", zoom: 12 });
    setTestResult(r.ok ? "Success — thumbnail fetched." : `Failed: ${r.error}${"status" in r && r.status ? ` (HTTP ${r.status})` : ""}`);
    setTesting(false);
  };

  const jsBadge =
    d.jsStatus === "ready"
      ? { icon: CheckCircle2, color: "text-emerald-glow", label: "Maps JS: Ready" }
      : d.jsStatus === "error"
        ? { icon: AlertTriangle, color: "text-destructive", label: "Maps JS: Error" }
        : { icon: Activity, color: "text-cyan-glow", label: `Maps JS: ${d.jsStatus}` };
  const JsIcon = jsBadge.icon;

  return (
    <section
      aria-label="Google Maps diagnostics"
      data-testid="maps-diagnostics"
      className="glass rounded-2xl border border-white/10 p-5 space-y-4"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-glow" aria-hidden="true" />
          <h3 className="text-sm font-semibold tracking-wide">Google Maps diagnostics</h3>
        </div>
        <button
          type="button"
          onClick={runTest}
          disabled={testing}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs hover:bg-white/10 disabled:opacity-50"
          aria-label="Test Static Maps API"
        >
          <RefreshCw className={`h-3 w-3 ${testing ? "animate-spin" : ""}`} aria-hidden="true" />
          {testing ? "Testing…" : "Test now"}
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className={`flex items-center gap-2 ${jsBadge.color}`}>
          <JsIcon className="h-4 w-4" aria-hidden="true" />
          <span>{jsBadge.label}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="font-mono">Static: {d.attempts} attempts · {d.hits} cached · {d.failures} failed</span>
        </div>
        <div className="text-muted-foreground">
          Last success: <span className="text-foreground">{timeAgo(d.lastSuccessAt)}</span>
        </div>
        <div className="text-muted-foreground">
          Last error: <span className="text-foreground">{timeAgo(d.lastErrorAt)}</span>
        </div>
      </div>

      {d.jsError ? (
        <p className="text-xs text-destructive" role="alert">
          Maps JS: {d.jsError}
        </p>
      ) : null}

      {d.lastError ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs space-y-2"
        >
          <div className="flex items-center gap-2 font-semibold text-amber-glow">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {err.title}
          </div>
          <p className="text-muted-foreground leading-relaxed">{err.hint}</p>
          {err.actionable ? (
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-cyan-glow hover:underline"
            >
              Open Google Cloud credentials
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-emerald-glow">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          No static-map errors detected.
        </div>
      )}

      {testResult ? (
        <p className="text-xs text-muted-foreground" role="status">
          {testResult}
        </p>
      ) : null}
    </section>
  );
}