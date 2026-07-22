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
} from "lucide-react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useMyLocation } from "@/hooks/use-my-location";
import countiesGeo from "@/data/kenya-counties.json";

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
const COUNTY_NAMES: string[] = (
  (countiesGeo as { features?: CountyFeature[] }).features ?? []
)
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
  const { request, loading: locating } = useMyLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Hide on report/logo-qa/auth routes where a floating overlay would obscure content.
  const hidden =
    pathname.startsWith("/report") ||
    pathname.startsWith("/logo-qa") ||
    pathname === "/title-deed";

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
        .forEach((n) =>
          list.push({ kind: "county", label: n, sub: "County · Kenya", query: n }),
        );
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
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (hidden) return null;

  const commit = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setRecent((prev) => {
      const next = [trimmed, ...prev.filter((r) => r !== trimmed)].slice(0, 8);
      return next;
    });
    setOpen(false);
    setQ("");
    navigate({ to: "/explore", search: { q: trimmed } });
  };

  const useMyLoc = async () => {
    const v = await request();
    if (v) commit(`${v.lat.toFixed(6)},${v.lng.toFixed(6)}`);
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
      onSelect: () => commit(s.query),
    }),
  );
  if (!q.trim()) {
    saved.forEach((s, i) =>
      rows.push({
        key: `sv-${i}`,
        kind: "saved",
        label: s,
        sub: "Saved search",
        onSelect: () => commit(s),
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
          onSelect: () => commit(r),
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
            setOpen(true);
            inputRef.current?.focus();
          }}
          role="combobox"
          aria-expanded={open}
          aria-owns="floating-search-listbox"
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
            onFocus={() => setOpen(true)}
            onKeyDown={onKey}
            placeholder="Search anywhere in Kenya — town, road, coordinates, or ask a question…"
            aria-autocomplete="list"
            aria-controls="floating-search-listbox"
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
              void useMyLoc();
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
            id="floating-search-listbox"
            role="listbox"
            aria-label="Search suggestions"
            className="absolute left-0 right-0 sm:top-full sm:mt-2 bottom-full mb-2 sm:bottom-auto sm:mb-0 glass-strong rounded-2xl border border-white/10 overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] max-h-[60vh] overflow-y-auto"
          >
            {rows.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                Try a town, road, plot number, or coordinates like{" "}
                <code className="text-foreground/80">-1.2921, 36.8219</code>.
              </div>
            ) : (
              <ul className="py-1.5">
                {rows.map((r, i) => {
                  const Icon = iconFor(r.kind);
                  const isActive = i === active;
                  return (
                    <li
                      key={r.key}
                      role="option"
                      aria-selected={isActive}
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
            <div className="border-t border-white/10 px-3 py-1.5 text-[10px] text-muted-foreground flex items-center gap-3">
              <span>
                ↑ ↓ navigate · <kbd>Enter</kbd> select · <kbd>Esc</kbd> close
              </span>
              <span className="ml-auto hidden sm:inline">
                <kbd>⌘K</kbd> from anywhere
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}