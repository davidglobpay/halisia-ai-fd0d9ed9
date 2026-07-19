import { useEffect, useState } from "react";
import { Activity, X } from "lucide-react";
import { reportLovableError } from "../../lib/lovable-error-reporting";

/**
 * Lightweight runtime perf monitor.
 * Tracks rolling FPS via requestAnimationFrame and network latency via
 * PerformanceObserver 'resource' entries. Surfaces a degraded-mode notice
 * (dismissable) when FPS < 30 or median network latency > 1500ms sustained.
 *
 * Zero-cost when the user prefers reduced motion or is on a hidden tab.
 */
export function PerfMonitor() {
  const [fps, setFps] = useState(60);
  const [latency, setLatency] = useState(0);
  const [degraded, setDegraded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    let last = performance.now();
    let frames = 0;
    const samples: number[] = [];
    const tick = (now: number) => {
      frames += 1;
      if (now - last >= 1000) {
        const f = Math.round((frames * 1000) / (now - last));
        setFps(f);
        samples.push(f);
        if (samples.length > 5) samples.shift();
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;
    const durations: number[] = [];
    const obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.duration > 0) durations.push(e.duration);
      }
      if (durations.length > 20) durations.splice(0, durations.length - 20);
      if (durations.length) {
        const sorted = [...durations].sort((a, b) => a - b);
        setLatency(Math.round(sorted[Math.floor(sorted.length / 2)]));
      }
    });
    try {
      obs.observe({ entryTypes: ["resource"] });
    } catch {
      /* ignore */
    }
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const bad = (fps > 0 && fps < 30) || latency > 1500;
    if (bad && !degraded) {
      setDegraded(true);
      reportLovableError(new Error("perf_degraded"), {
        boundary: "perf_monitor",
        fps,
        latency,
      });
    } else if (!bad && degraded) {
      setDegraded(false);
    }
  }, [fps, latency, degraded]);

  return (
    <>
      {degraded && !dismissed && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-16 left-3 z-50 max-w-xs rounded-lg border border-amber-400/40 bg-black/70 px-3 py-2 text-xs text-amber-100 shadow-xl backdrop-blur"
        >
          <div className="flex items-start gap-2">
            <Activity aria-hidden className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="font-medium">Degraded mode</div>
              <div className="opacity-80">
                {fps < 30 ? `Rendering at ~${fps}fps. ` : ""}
                {latency > 1500 ? `Network ~${latency}ms. ` : ""}
                Some animations may pause.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss degraded-mode notice"
              className="rounded p-0.5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2E8]"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Hide performance stats" : "Show performance stats"}
        aria-expanded={open}
        title="Performance"
        className="fixed bottom-3 right-3 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/80 shadow-lg backdrop-blur transition hover:bg-black/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2E8]"
      >
        <Activity className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Performance stats"
          className="fixed bottom-16 right-3 z-50 rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-[11px] font-mono text-white/85 shadow-xl backdrop-blur"
        >
          <div>FPS: {fps}</div>
          <div>Network median: {latency}ms</div>
          <div className={degraded ? "text-amber-300" : "text-emerald-300"}>
            {degraded ? "degraded" : "healthy"}
          </div>
        </div>
      )}
    </>
  );
}