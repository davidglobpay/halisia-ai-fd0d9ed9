import { useState } from "react";
import { Search, Loader2, LocateFixed } from "lucide-react";
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
  const { request, loading: locating, error: locError } = useMyLocation();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) onSearch(q.trim());
  };
  const useMe = async () => {
    const v = await request();
    if (!v) return;
    if (onUseMyLocation) onUseMyLocation({ lat: v.lat, lng: v.lng });
    else onSearch(`${v.lat.toFixed(6)},${v.lng.toFixed(6)}`);
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
        disabled={locating}
        title="Use my current location"
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
        className={`${size === "lg" ? "px-5 h-11 text-sm" : "px-4 h-9 text-xs"} rounded-full font-medium bg-gradient-to-r from-primary to-accent text-primary-foreground disabled:opacity-50 flex items-center gap-2 shadow-[0_10px_30px_-10px_oklch(0.68_0.19_249/0.9)]`}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Analyze
      </button>
    </form>
    {locError && (
      <div className="mt-2 text-[11px] text-amber-glow px-3" role="status">{locError}</div>
    )}
    </div>
  );
}
