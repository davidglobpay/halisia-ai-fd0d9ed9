import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, BellRing, X, ShieldAlert, Cloud, Sun as SunIcon } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import { fetchOpenMeteo } from "@/lib/weather";

export interface HalisiaAlert {
  id: string;
  kind: "weather" | "air" | "info";
  title: string;
  body: string;
  ts: number;
}

export function NotificationsBell({
  lat,
  lng,
  aqi,
}: {
  lat?: number;
  lng?: number;
  aqi?: number | null;
}) {
  const { permission, request, notify } = useNotifications();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<HalisiaAlert[]>([]);
  const shownRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (lat == null || lng == null) return;
    let stopped = false;
    fetchOpenMeteo(lat, lng)
      .then((w) => {
        if (stopped) return;
        const next: HalisiaAlert[] = [];
        const rainToday = w.daily.precipitation_sum[0];
        const uv = w.daily.uv_index_max[0];
        if (rainToday >= 10) {
          next.push({
            id: `rain-${w.daily.time[0]}`,
            kind: "weather",
            title: "Heavy rain expected today",
            body: `About ${rainToday.toFixed(0)} mm forecast for ${w.daily.time[0]}. Watch for flooding on low-lying plots.`,
            ts: Date.now(),
          });
        }
        if (uv >= 8) {
          next.push({
            id: `uv-${w.daily.time[0]}`,
            kind: "weather",
            title: `Very high UV today (index ${uv.toFixed(0)})`,
            body: "Field visits should carry sun protection and hydration.",
            ts: Date.now(),
          });
        }
        if (aqi != null && aqi < 50) {
          next.push({
            id: `aqi-${Math.round(aqi)}`,
            kind: "air",
            title: "Air quality is poor here",
            body: `Universal AQI reads ${Math.round(aqi)}. Sensitive groups should limit prolonged outdoor exposure.`,
            ts: Date.now(),
          });
        }
        setAlerts(next);
        next.forEach((a) => {
          if (shownRef.current.has(a.id)) return;
          shownRef.current.add(a.id);
          notify(a.title, { body: a.body, tag: a.id, icon: "/favicon.ico" });
        });
      })
      .catch(() => undefined);
    return () => {
      stopped = true;
    };
  }, [lat, lng, aqi, notify]);

  const enabled = permission === "granted";
  const supported = permission !== "unsupported";

  return (
    <div className="relative">
      <button
        onClick={() => {
          if (!enabled && supported) void request();
          setOpen((o) => !o);
        }}
        className="relative glass rounded-full p-2 hover:bg-white/10 transition"
        aria-label={enabled ? "Open alerts" : "Enable alerts"}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {!supported ? (
          <BellOff className="h-4 w-4 text-muted-foreground" />
        ) : enabled ? (
          <BellRing className="h-4 w-4 text-accent" />
        ) : (
          <Bell className="h-4 w-4 text-muted-foreground" />
        )}
        {alerts.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-[10px] font-semibold text-white grid place-items-center">
            {alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="HALISIA alerts"
          className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] glass-strong rounded-2xl p-3 z-50 shadow-2xl border border-white/10"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="text-[10px] uppercase tracking-widest text-accent">HALISIA alerts</div>
            <button
              onClick={() => setOpen(false)}
              className="ml-auto p-1 rounded-full hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {!supported && (
            <div className="text-xs text-muted-foreground p-3">
              This browser does not support desktop notifications.
            </div>
          )}
          {supported && !enabled && (
            <div className="text-xs text-muted-foreground p-3">
              Enable notifications to be pinged when HALISIA detects flood, air-quality, or weather
              risks near the location you're inspecting.
              <button
                onClick={() => void request()}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent/20 text-accent px-3 py-1.5 hover:bg-accent/30"
              >
                Turn on alerts
              </button>
            </div>
          )}
          {enabled && alerts.length === 0 && (
            <div className="text-xs text-muted-foreground p-3">
              No active risks for the current point. HALISIA will notify you if this changes.
            </div>
          )}
          {enabled && alerts.length > 0 && (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {alerts.map((a) => (
                <li key={a.id} className="glass rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5">
                      {a.kind === "air" ? (
                        <ShieldAlert className="h-4 w-4 text-destructive" />
                      ) : a.kind === "weather" ? (
                        <Cloud className="h-4 w-4 text-cyan-glow" />
                      ) : (
                        <SunIcon className="h-4 w-4 text-amber-glow" />
                      )}
                    </span>
                    <div className="flex-1">
                      <div className="text-xs font-semibold">{a.title}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                        {a.body}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}