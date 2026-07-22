import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Search,
  Clock,
  Star,
  MapPin,
  Sparkles,
  X,
  LocateFixed,
  Loader2,
  StarOff,
  ShieldAlert,
  RefreshCw,
  AlertCircle,
  BarChart3,
  Check,
  Database,
} from "lucide-react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useMyLocation } from "@/hooks/use-my-location";
import countiesGeo from "@/data/kenya-counties.json";
import { track } from "@/lib/analytics";
import { useAnalyticsConsent } from "@/hooks/use-analytics-consent";

const POPULAR_AREAS = [
  "Kilimani",
  "Karen",
  "Westlands",
  "Runda",
  "Lavington",
  "Kileleshwa",
  "Muthaiga",
  "Gigiri",
  "Ngong",
  "Kitengela",
  "Ruaka",
  "Syokimau",
  "Diani",
  "Nyali",
  "Naivasha",
  "Nanyuki",
  "Malindi",
  "Eldoret",
  "Kisumu",
  "Nakuru",
  "Thika",
];

/** Curated search prompts shown when the panel opens with an empty query. */
const CURATED_PROMPTS: { label: string; query: string; hint: string }[] = [
  { label: "Kilimani, Nairobi", query: "Kilimani", hint: "Urban residential" },
  { label: "Karen residential plot", query: "Karen, Nairobi", hint: "Low-density suburb" },
  { label: "Naivasha lakefront", query: "Naivasha", hint: "Weekend / farm" },
  { label: "Kajiado farmland", query: "Kajiado", hint: "Agri / ranch" },
  { label: "Diani beachfront", query: "Diani", hint: "Coastal invest" },
  { label: "Mombasa CBD", query: "Mombasa", hint: "Coastal city" },
];

const NL_HINTS = [
  "flood",
  "safe",
  "cheap",
  "affordable",
  "near",
  "best",
  "quiet",
  "school",
  "hospital",
  "invest",
  "family",
  "commute",
  "hills",
  "farm",
];

type Suggestion =
  | { kind: "county"; label: string; query: string; sub: string }
  | { kind: "area"; label: string; query: string; sub: string }
  | { kind: "coord"; label: string; query: string; sub: string; lat: number; lng: number }
  | { kind: "nl"; label: string; query: string; sub: string };

function parseCoords(v: string) {
  const m = v.trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

type CountyFeature = { properties?: { name?: string; code?: number } };
const COUNTY_NAMES: string[] = ((countiesGeo as { features?: CountyFeature[] }).features ?? [])
  .map((f) => f?.properties?.name)
  .filter((n): n is string => typeof n === "string")
  .sort();

function isNaturalLanguage(q: string) {
  const words = q.trim().toLowerCase().split(/\s+/);
  if (words.length < 2) return false;
  return NL_HINTS.some((k) => words.includes(k));
}

export function FloatingSearch() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = usePersistedState<string[]>("halisia:recentSearches", []);
  const [saved, setSaved] = usePersistedState<string[]>("halisia:savedSearches", []);
  const { request, loading: locating, error: locError, location: myLoc } = useMyLocation();
  const [permission, setPermission] = useState<
    "unknown" | "prompt" | "granted" | "denied" | "unsupported"
  >("unknown");
  const [showManual, setShowManual] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [cacheHit, setCacheHit] = useState<{ ageMs: number } | null>(null);
  const [consent, setConsent] = useAnalyticsConsent();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = "floating-search-listbox";

  // Hide on report/logo-qa/auth routes where a floating overlay would obscure content.
  const hidden =
    pathname.startsWith("/report") || pathname.startsWith("/logo-qa") || pathname === "/title-deed";

  // Probe geolocation permission (Permissions API is optional).
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (!("geolocation" in navigator)) {
      setPermission("unsupported");
      return;
    }
    const perms = (
      navigator as Navigator & {
        permissions?: { query: (d: { name: PermissionName }) => Promise<PermissionStatus> };
      }
    ).permissions;
    if (!perms?.query) return;
    let status: PermissionStatus | null = null;
    perms
      .query({ name: "geolocation" as PermissionName })
      .then((s) => {
        status = s;
        setPermission(s.state as typeof permission);
        s.onchange = () => setPermission(s.state as typeof permission);
      })
      .catch(() => {});
    return () => {
      if (status) status.onchange = null;
    };
  }, []);

  const suggestions = useMemo<Suggestion[]>(() => {
    const term = q.trim().toLowerCase();
    const list: Suggestion[] = [];
    const coord = parseCoords(q);
    if (coord) {
      list.push({
        kind: "coord",
        label: `${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}`,
        sub: "Analyse these coordinates",
        query: `${coord.lat.toFixed(6)},${coord.lng.toFixed(6)}`,
        lat: coord.lat,
        lng: coord.lng,
      });
    }
    if (term) {
      COUNTY_NAMES.filter((n) => n.toLowerCase().includes(term))
        .slice(0, 5)
        .forEach((n) => list.push({ kind: "county", label: n, sub: "County · Kenya", query: n }));
      POPULAR_AREAS.filter((n) => n.toLowerCase().includes(term))
        .slice(0, 5)
        .forEach((n) => list.push({ kind: "area", label: n, sub: "Neighborhood", query: n }));
      if (isNaturalLanguage(q)) {
        list.push({
          kind: "nl",
          label: q,
          sub: "Natural-language search — analysed by HALISIA AI",
          query: q,
        });
      }
    } else {
      COUNTY_NAMES.slice(0, 5).forEach((n) =>
        list.push({ kind: "county", label: n, sub: "County · Kenya", query: n }),
      );
    }
    return list;
  }, [q]);

  // Lightweight client-side cache for suggestion lookups. Even though matching
  // runs in-memory here, we memoize the last-25 keyed results so future work
  // that hits an API (Places/geocoder) can reuse this path — and we surface a
  // "cached" chip so users know when the UI stayed responsive offline.
  const cacheRef = useRef<Map<string, { at: number; results: Suggestion[] }>>(new Map());
  useEffect(() => {
    const key = q.trim().toLowerCase();
    if (!key) {
      setCacheHit(null);
      return;
    }
    const hit = cacheRef.current.get(key);
    if (hit) {
      const ageMs = Date.now() - hit.at;
      setCacheHit({ ageMs });
      track({ name: "search_cache_hit", query: key, ageMs });
    } else {
      cacheRef.current.set(key, { at: Date.now(), results: suggestions });
      // Trim to last 25 entries.
      if (cacheRef.current.size > 25) {
        const firstKey = cacheRef.current.keys().next().value;
        if (firstKey) cacheRef.current.delete(firstKey);
      }
      setCacheHit(null);
    }
  }, [q, suggestions]);

  useEffect(() => {
    setActive(0);
  }, [q, open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        track({ name: "search_open", source: "shortcut" });
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Keep the active option in view for keyboard users. Must run before any
  // early return to keep hook order stable across renders.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`#fs-opt-${active}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  if (hidden) return null;

  const commit = (
    query: string,
    meta: { kind?: string; via?: "geolocation" | "suggestion" | "manual" } = {},
  ) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setRecent((prev) => {
      const next = [trimmed, ...prev.filter((r) => r !== trimmed)].slice(0, 8);
      return next;
    });
    setOpen(false);
    setQ("");
    track({
      name: "search_location_selected",
      kind: meta.kind ?? "text",
      query: trimmed,
      via: meta.via ?? "manual",
    });
    track({ name: "report_requested", query: trimmed, source: "floating-search" });
    navigate({ to: "/explore", search: { q: trimmed } });
  };

  const handleUseMyLocation = async () => {
    track({ name: "search_geolocation", status: "requested" });
    if (permission === "unsupported") {
      track({ name: "search_geolocation", status: "unavailable" });
      setShowManual(true);
      return;
    }
    const v = await request();
    if (v) {
      track({ name: "search_geolocation", status: "granted" });
      // Guard against wildly imprecise fixes (accuracy > 2km): keep the search
      // open, surface a note, and offer the manual-entry escape hatch.
      if (typeof v.accuracy === "number" && v.accuracy > 2000) {
        setShowManual(true);
        return;
      }
      commit(`${v.lat.toFixed(6)},${v.lng.toFixed(6)}`, { kind: "coord", via: "geolocation" });
    } else {
      const denied = /denied/i.test(locError ?? "");
      track({
        name: "search_geolocation",
        status: denied ? "denied" : "error",
        message: locError ?? undefined,
      });
      setShowManual(true);
    }
  };

  const submitManual = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
    commit(`${lat.toFixed(6)},${lng.toFixed(6)}`, { kind: "coord", via: "manual" });
  };

  const toggleSaved = (item: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSaved((prev) =>
      prev.includes(item) ? prev.filter((s) => s !== item) : [item, ...prev].slice(0, 12),
    );
  };

  const rows: {
    key: string;
    kind: string;
    label: string;
    sub: string;
    onSelect: () => void;
    right?: React.ReactNode;
  }[] = [];
  suggestions.forEach((s, i) =>
    rows.push({
      key: `s-${i}`,
      kind: s.kind,
      label: s.label,
      sub: s.sub,
      onSelect: () => commit(s.query, { kind: s.kind, via: "suggestion" }),
    }),
  );
  if (!q.trim()) {
    saved.forEach((s, i) =>
      rows.push({
        key: `sv-${i}`,
        kind: "saved",
        label: s,
        sub: "Saved search",
        onSelect: () => commit(s, { kind: "saved", via: "suggestion" }),
        right: (
          <button
            type="button"
            aria-label={`Unsave ${s}`}
            onClick={(e) => toggleSaved(s, e)}
            className="p-1 rounded hover:bg-white/10"
          >
            <StarOff className="h-3.5 w-3.5 text-amber-glow" />
          </button>
        ),
      }),
    );
    recent
      .filter((r) => !saved.includes(r))
      .forEach((r, i) =>
        rows.push({
          key: `r-${i}`,
          kind: "recent",
          label: r,
          sub: "Recent",
          onSelect: () => commit(r, { kind: "recent", via: "suggestion" }),
          right: (
            <button
              type="button"
              aria-label={`Save ${r}`}
              onClick={(e) => toggleSaved(r, e)}
              className="p-1 rounded hover:bg-white/10"
            >
              <Star className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          ),
        }),
      );
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(rows.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(Math.max(0, rows.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = rows[active];
      if (target) target.onSelect();
      else commit(q);
    }
  };

  const iconFor = (kind: string) => {
    if (kind === "county" || kind === "area") return MapPin;
    if (kind === "coord") return LocateFixed;
    if (kind === "nl") return Sparkles;
    if (kind === "saved") return Star;
    return Clock;
  };

  const geoStatus = locating
    ? { tone: "info" as const, icon: Loader2, text: "Locating you…", spin: true }
    : permission === "denied"
      ? {
          tone: "warn" as const,
          icon: ShieldAlert,
          text: "Location blocked. Enable it in your browser settings, or type an area / coordinates.",
        }
      : permission === "unsupported"
        ? {
            tone: "warn" as const,
            icon: AlertCircle,
            text: "This device can't share location. Type an area or coordinates instead.",
          }
        : locError
          ? { tone: "error" as const, icon: AlertCircle, text: locError }
          : null;

  return (
    <div
      className="fixed z-40 left-1/2 -translate-x-1/2 bottom-4 sm:bottom-auto sm:top-4 w-[min(680px,calc(100vw-1.5rem))]"
      role="search"
      aria-label="Floating intelligent search"
    >
      <div ref={boxRef} className="relative">
        <div
          className="glass-strong rounded-full flex items-center gap-2 pl-3 pr-1.5 py-1.5 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.6)] focus-within:ring-2 focus-within:ring-accent/60"
          onClick={() => {
            if (!open) track({ name: "search_open", source: "floating" });
            setOpen(true);
            inputRef.current?.focus();
          }}
          role="combobox"
          aria-expanded={open}
          aria-owns={listboxId}
          aria-controls={listboxId}
          aria-haspopup="listbox"
        >
          <Search className="h-4 w-4 text-accent shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              if (!open) track({ name: "search_open", source: "floating" });
              setOpen(true);
            }}
            onKeyDown={onKey}
            placeholder="Search anywhere in Kenya — town, road, coordinates, or ask a question…"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-activedescendant={open && rows[active] ? `fs-opt-${active}` : undefined}
            aria-label="Search Kenya by town, road, coordinates, or question"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground min-w-0"
          />
          {q && (
            <button
              type="button"
              aria-label="Clear query"
              onClick={(e) => {
                e.stopPropagation();
                setQ("");
                inputRef.current?.focus();
              }}
              className="p-1 rounded-full hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleUseMyLocation();
            }}
            disabled={locating}
            aria-label="Use my location"
            title="Use my current location"
            className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-60"
          >
            {locating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
            ) : (
              <LocateFixed className="h-3.5 w-3.5 text-accent" />
            )}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              commit(q);
            }}
            disabled={!q.trim()}
            className="h-8 px-4 rounded-full text-xs font-medium bg-gradient-to-r from-primary to-accent text-primary-foreground disabled:opacity-50"
          >
            Analyze
          </button>
        </div>

        {open && (
          <div
            id={`${listboxId}-panel`}
            className="absolute left-0 right-0 sm:top-full sm:mt-2 bottom-full mb-2 sm:bottom-auto sm:mb-0 glass-strong rounded-2xl border border-white/10 overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] max-h-[60vh] overflow-y-auto"
          >
            {(cacheHit || (myLoc?.accuracy && !locating)) && (
              <div
                role="status"
                aria-live="polite"
                className="px-3 py-1.5 flex flex-wrap items-center gap-2 text-[11px] border-b border-white/10 bg-white/[0.03] text-muted-foreground"
              >
                {cacheHit && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-0.5">
                    <Database className="h-3 w-3 text-accent" aria-hidden="true" />
                    Cached · {Math.max(1, Math.round(cacheHit.ageMs / 1000))}s old
                  </span>
                )}
                {myLoc?.accuracy && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-0.5"
                    title="GPS reported accuracy radius"
                  >
                    <BarChart3 className="h-3 w-3 text-accent" aria-hidden="true" />
                    Location ±{Math.round(myLoc.accuracy)} m
                    <span
                      className={
                        myLoc.accuracy < 50
                          ? "text-emerald-300"
                          : myLoc.accuracy < 500
                            ? "text-amber-200"
                            : "text-red-300"
                      }
                    >
                      {myLoc.accuracy < 50 ? "high" : myLoc.accuracy < 500 ? "medium" : "low"}
                    </span>
                  </span>
                )}
              </div>
            )}
            {geoStatus && (
              <div
                role="status"
                aria-live="polite"
                className={`px-3 py-2 flex items-center gap-2 text-xs border-b border-white/10 ${
                  geoStatus.tone === "error"
                    ? "text-red-300 bg-red-500/10"
                    : geoStatus.tone === "warn"
                      ? "text-amber-200 bg-amber-500/10"
                      : "text-accent bg-white/5"
                }`}
              >
                <geoStatus.icon
                  className={`h-3.5 w-3.5 shrink-0 ${geoStatus.spin ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                <span className="flex-1">{geoStatus.text}</span>
                {(geoStatus.tone === "error" || permission === "denied") && !locating && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleUseMyLocation();
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 hover:bg-white/10"
                    >
                      <RefreshCw className="h-3 w-3" aria-hidden="true" /> Retry
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowManual((s) => !s);
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 hover:bg-white/10"
                    >
                      Enter manually
                    </button>
                  </>
                )}
              </div>
            )}
            {showManual && (
              <div className="px-3 py-2 border-b border-white/10 bg-white/[0.02]">
                <div className="text-[11px] text-muted-foreground mb-1.5">
                  Enter coordinates manually (WGS84 decimal degrees)
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    aria-label="Latitude"
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    placeholder="-1.2921"
                    inputMode="decimal"
                    className="flex-1 min-w-24 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-accent/60"
                  />
                  <input
                    aria-label="Longitude"
                    value={manualLng}
                    onChange={(e) => setManualLng(e.target.value)}
                    placeholder="36.8219"
                    inputMode="decimal"
                    className="flex-1 min-w-24 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-accent/60"
                  />
                  <button
                    type="button"
                    onClick={submitManual}
                    className="h-7 px-3 rounded-full text-[11px] font-medium bg-gradient-to-r from-primary to-accent text-primary-foreground"
                  >
                    Analyze
                  </button>
                </div>
              </div>
            )}
            {rows.length === 0 ? (
              !q.trim() ? (
                <div className="p-4">
                  <div className="text-[11px] uppercase tracking-widest text-[oklch(0.78_0.14_85)] font-medium mb-2.5">
                    Try one of these
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CURATED_PROMPTS.map((p) => (
                      <button
                        key={p.query}
                        type="button"
                        onClick={() => commit(p.query, { kind: "curated", via: "suggestion" })}
                        className="group inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-foreground hover:border-[oklch(0.78_0.14_85/0.45)] hover:bg-white/[0.06] transition"
                      >
                        <MapPin className="h-3 w-3 text-[oklch(0.78_0.14_85)]" aria-hidden="true" />
                        <span>{p.label}</span>
                        <span className="text-[10px] text-muted-foreground">· {p.hint}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 text-[11px] text-muted-foreground">
                    Or type a county, town, plot, or coordinates like{" "}
                    <code className="text-foreground/80">-1.2921, 36.8219</code>.
                  </div>
                </div>
              ) : (
              <div className="p-5 text-sm text-muted-foreground flex flex-col items-center text-center gap-2">
                <Search className="h-5 w-5 text-accent" aria-hidden="true" />
                <>
                    <div className="text-foreground/90 font-medium">
                      No matches for “{q.trim()}”
                    </div>
                    <div>
                      Try a county, town, road, or coordinates like{" "}
                      <code className="text-foreground/80">-1.2921, 36.8219</code>.
                    </div>
                    <button
                      type="button"
                      onClick={() => commit(q, { via: "manual" })}
                      className="mt-1 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-accent px-3 py-1 text-xs font-medium text-primary-foreground"
                    >
                      <Sparkles className="h-3 w-3" aria-hidden="true" /> Analyze anyway
                    </button>
                  </>
              </div>
              )
            ) : (
              <ul
                ref={listRef}
                id={listboxId}
                role="listbox"
                aria-label="Search suggestions"
                className="py-1.5"
              >
                {rows.map((r, i) => {
                  const Icon = iconFor(r.kind);
                  const isActive = i === active;
                  return (
                    <li
                      key={r.key}
                      id={`fs-opt-${i}`}
                      role="option"
                      aria-selected={isActive}
                      aria-label={`${r.label} — ${r.sub}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={r.onSelect}
                      className={`px-3 py-2 flex items-center gap-2.5 cursor-pointer text-sm ${
                        isActive ? "bg-white/10" : "hover:bg-white/5"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 ${
                          r.kind === "nl"
                            ? "text-accent"
                            : r.kind === "saved"
                              ? "text-amber-glow"
                              : "text-muted-foreground"
                        } shrink-0`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{r.label}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{r.sub}</div>
                      </div>
                      {r.right}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="border-t border-white/10 px-3 py-1.5 text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                ↑ ↓ navigate · <kbd>Enter</kbd> select · <kbd>Esc</kbd> close
              </span>
              <span className="ml-auto flex items-center gap-2">
                {consent === "unset" ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span>Help us improve?</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConsent(true);
                      }}
                      className="rounded-full border border-white/15 px-2 py-0.5 hover:bg-white/10 text-foreground"
                    >
                      Allow analytics
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConsent(false);
                      }}
                      className="rounded-full border border-white/10 px-2 py-0.5 hover:bg-white/10"
                    >
                      No thanks
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConsent(consent !== "granted");
                    }}
                    aria-pressed={consent === "granted"}
                    aria-label={
                      consent === "granted"
                        ? "Analytics on — click to opt out"
                        : "Analytics off — click to opt in"
                    }
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 hover:bg-white/10"
                  >
                    {consent === "granted" ? (
                      <Check className="h-3 w-3 text-emerald-300" aria-hidden="true" />
                    ) : (
                      <X className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                    )}
                    Analytics {consent === "granted" ? "on" : "off"}
                  </button>
                )}
              </span>
              <span className="hidden sm:inline">
                <kbd>⌘K</kbd> from anywhere
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
