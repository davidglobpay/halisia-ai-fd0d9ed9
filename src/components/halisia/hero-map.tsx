import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { MapView, type MapTypeId } from "@/components/halisia/map-view";
import { StreetViewPanel } from "@/components/halisia/land-passport/street-view-panel";
import { PassportLinks } from "@/components/halisia/land-passport/passport-links";
import { geocodeAddress } from "@/lib/geocode.functions";
import { classifyGeocode, STATUS_META, type LocationStatus } from "@/lib/location-validation";
import { GlobeIntro } from "@/components/halisia/globe-intro";

type Mode = "map" | "satellite" | "street";
type Picked = {
  lat: number;
  lng: number;
  label: string;
  status: LocationStatus;
  gt?: string;
  source: string;
  /**
   * How far out the match could be, in metres. Carried only for a geocoded
   * result, where Google returns a viewport we can measure. A point clicked on
   * the map is exactly where the user put it, so it has no radius and draws
   * no ring.
   */
  radiusM?: number | null;
};

/** Landing hero map: search, pan/zoom, click a point, Map / Satellite / Street View. */
export function HeroMap() {
  const [mode, setMode] = useState<Mode>("map");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await geocodeAddress({ data: { query: q } });
      if (!r.ok) setErr("No match in Kenya. Try a town, road or estate name.");
      else
        setPicked({
          lat: r.lat,
          lng: r.lng,
          label: r.address,
          status: classifyGeocode(r.types),
          gt: r.locationType,
          source: "Google Geocoding",
          radiusM: r.radiusM,
        });
    } catch {
      setErr("Search is unavailable right now. You can still click the map to choose a point.");
    } finally {
      setBusy(false);
    }
  };

  const mapType: MapTypeId = mode === "satellite" ? "hybrid" : "roadmap";
  const center = picked ?? { lat: -1.2921, lng: 36.8219 };

  return (
    <section id="hero-map" className="mx-auto max-w-7xl px-4 py-8" data-testid="hero-map">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-accent">Live map</div>
          <h2 className="font-display text-2xl">Pick any point in Kenya</h2>
        </div>
        <div
          role="tablist"
          aria-label="Map mode"
          className="inline-flex rounded-full border border-foreground/15 p-1"
        >
          {(["map", "satellite", "street"] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-[40px] rounded-full px-4 text-xs font-semibold capitalize transition ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-foreground/5"
              }`}
            >
              {m === "street" ? "Street View" : m}
            </button>
          ))}
        </div>
      </div>
      <form onSubmit={search} className="mb-3 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a town, road or estate…"
          aria-label="Search map"
          className="min-h-[44px] flex-1 min-w-0 rounded-full border border-foreground/15 bg-card px-4 text-sm"
        />
        <button
          className="min-h-[44px] rounded-full bg-primary px-4 text-primary-foreground"
          aria-label="Search"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </button>
      </form>
      {err && <p className="mb-2 text-xs text-amber-glow">{err}</p>}
      <div className="relative h-[360px] sm:h-[440px] overflow-hidden rounded-3xl border border-foreground/10">
        <GlobeIntro finalLabel="Nairobi" />
        {mode === "street" ? (
          picked ? (
            <StreetViewPanel lat={picked.lat} lng={picked.lng} className="absolute inset-0" />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
              Search or click the map first to choose a point for Street View.
            </div>
          )
        ) : (
          <MapView
            center={center}
            zoom={picked ? 14 : 11}
            marker={picked ? { lat: picked.lat, lng: picked.lng, label: picked.label } : null}
            accuracyRadiusM={picked?.radiusM ?? null}
            mapType={mapType}
            theme="light"
            onMapClick={(p) =>
              setPicked({
                ...p,
                label: `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`,
                status: "user_provided",
                source: "Point you chose on the map",
              })
            }
          />
        )}
      </div>
      {picked && (
        <div
          className="mt-3 rounded-2xl border border-foreground/10 bg-card/80 p-3 text-xs"
          data-testid="hero-map-selection"
        >
          <div className="font-medium text-foreground">{picked.label}</div>
          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)} · {STATUS_META[picked.status].label}
          </div>
          <PassportLinks
            className="mt-2"
            compact
            target={{
              lat: picked.lat,
              lng: picked.lng,
              label: picked.label,
              source: picked.source,
              status: picked.status,
              gt: picked.gt,
            }}
          />
        </div>
      )}
    </section>
  );
}
