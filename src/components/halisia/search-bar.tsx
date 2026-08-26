import { useEffect, useState } from "react";
import { Search, Loader2, LocateFixed, MapPin } from "lucide-react";
import { useMyLocation } from "@/hooks/use-my-location";

export function SearchBar({
  onSearch,
  loading,
  placeholder = "Search a town, road, plot number, or coordinates…",
  size = "md",
  onUseMyLocation,
}: {
  onSearch: (q: string) => void;
  loading?: boolean;
  placeholder?: string;
  size?: "md" | "lg";
  onUseMyLocation?: (loc: { lat: number; lng: number }) => void;
}) {
  const [q, setQ] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const { request, simulate, loading: locating, error: locError } = useMyLocation();
  useEffect(() => setHydrated(true), []);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) onSearch(q.trim());
  };
  const useMe = async () => {
    const v = await request();
    if (!v) {
      // Permission denied / unsupported — surface the manual entry fallback so
      // "My location" stays useful.
      setShowManual(true);
      return;
    }
    if (onUseMyLocation) onUseMyLocation({ lat: v.lat, lng: v.lng });
    else onSearch(`${v.lat.toFixed(6)},${v.lng.toFixed(6)}`);
  };
  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const m = manual.trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
    if (!m) return;
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    simulate({ lat, lng });
    if (onUseMyLocation) onUseMyLocation({ lat, lng });
    else onSearch(`${lat.toFixed(6)},${lng.toFixed(6)}`);
  };
  return (
    <div className="w-full">
      <form
        onSubmit={submit}
        className={`glass-strong rounded-full flex items-center gap-2 ${size === "lg" ? "px-3 py-2" : "px-2.5 py-1.5"}`}
      >
        <div
          className={`${size === "lg" ? "h-11 w-11" : "h-9 w-9"} rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0`}
        >
          <Search className={`${size === "lg" ? "h-5 w-5" : "h-4 w-4"} text-accent`} />
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className={`flex-1 bg-transparent outline-none placeholder:text-muted-foreground ${size === "lg" ? "text-base py-1" : "text-sm"}`}
        />
        <button
          type="button"
          onClick={useMe}
          disabled={!hydrated || locating}
          title={hydrated ? "Use my current location" : "Loading location controls…"}
          aria-label="Use my current location"
          data-testid="search-my-location"
          className={`${size === "lg" ? "h-11 px-4 text-xs" : "h-9 px-3 text-[11px]"} shrink-0 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 text-foreground hover:bg-white/10 disabled:opacity-60 transition`}
        >
          {locating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
          ) : (
            <LocateFixed className="h-3.5 w-3.5 text-accent" />
          )}
          <span className="hidden sm:inline">My location</span>
        </button>
        <button
          type="submit"
          disabled={loading || !q.trim()}
          className={`${size === "lg" ? "px-5 h-11 text-sm" : "px-4 h-9 text-xs"} rounded-full font-medium bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-2 shadow-[0_10px_30px_-12px_rgba(16,45,26,0.55)] transition hover:brightness-110`}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Analyze
        </button>
      </form>
      {(locError || showManual) && (
        <div className="mt-2 px-3" role="status" aria-live="polite">
          {locError && (
            <div className="text-[11px] text-amber-glow mb-1.5">
              {locError} You can still enter coordinates manually below.
            </div>
          )}
          <form
            onSubmit={submitManual}
            className="glass rounded-full flex items-center gap-2 px-2 py-1"
          >
            <MapPin className="h-3.5 w-3.5 text-accent shrink-0 ml-1" aria-hidden="true" />
            <label htmlFor="manual-latlng" className="sr-only">
              Enter latitude and longitude
            </label>
            <input
              id="manual-latlng"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="lat, lng — e.g. -1.2921, 36.8219"
              inputMode="decimal"
              className="flex-1 bg-transparent outline-none text-[11px] placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              className="rounded-full bg-white/10 hover:bg-white/20 text-[11px] px-3 py-1"
            >
              Set
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
