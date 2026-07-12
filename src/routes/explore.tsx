import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AIOrb } from "@/components/halisia/ai-orb";
import { IntelligenceCards } from "@/components/halisia/intelligence-cards";
import { MapView, type MapLocation } from "@/components/halisia/map-view";
import { Navbar } from "@/components/halisia/navbar";
import { SearchBar } from "@/components/halisia/search-bar";
import { geocodeAddress } from "@/lib/geocode.functions";
import { Layers, Satellite, Ruler, Bookmark, MapPinned } from "lucide-react";

const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore — HALISIA AI" },
      { name: "description", content: "Search any location in Kenya and see an AI-scored land intelligence dashboard." },
      { property: "og:title", content: "Explore — HALISIA AI" },
      { property: "og:description", content: "AI-scored land intelligence for any place in Kenya." },
    ],
  }),
  validateSearch: searchSchema,
  component: Explore,
});

const DEFAULT: MapLocation & { address: string } = {
  lat: -1.286389,
  lng: 36.817223,
  label: "Nairobi",
  address: "Nairobi, Kenya",
};

function Explore() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const [loc, setLoc] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await geocodeAddress({ data: { query } });
      if (!res.ok) {
        setError(`Couldn't find “${query}” in Kenya. Try a nearby town or road.`);
      } else {
        setLoc({ lat: res.lat, lng: res.lng, address: res.address });
      }
    } catch (e) {
      console.error(e);
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (q && q.trim()) void runSearch(q);
  }, [q]);

  const active = loc ?? DEFAULT;

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-24 pb-10 mx-auto max-w-[1400px] px-4">
        <div className="max-w-3xl">
          <SearchBar
            size="lg"
            loading={loading}
            placeholder="Search a town, road, plot number, coordinates…"
            onSearch={(query) => {
              navigate({ to: "/explore", search: { q: query } });
              void runSearch(query);
            }}
          />
          {error && (
            <div className="mt-3 text-sm text-amber-glow">{error}</div>
          )}
        </div>

        <div className="mt-6 grid lg:grid-cols-[1fr_420px] gap-4">
          {/* MAP */}
          <div className="glass-strong rounded-3xl p-2 relative">
            <MapView
              center={{ lat: active.lat, lng: active.lng }}
              marker={{ lat: active.lat, lng: active.lng, label: active.address }}
              zoom={14}
              className="rounded-[22px] h-[70vh] min-h-[520px]"
            />
            {/* Overlay controls */}
            <div className="pointer-events-none absolute inset-0 p-4 flex flex-col justify-between">
              <div className="pointer-events-auto flex items-center gap-2 self-start glass rounded-full p-1">
                {[
                  { icon: MapPinned, label: "Map" },
                  { icon: Satellite, label: "Satellite" },
                  { icon: Layers, label: "Layers" },
                ].map((t, i) => (
                  <button key={t.label} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${i === 0 ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    <t.icon className="h-3.5 w-3.5" /> {t.label}
                  </button>
                ))}
              </div>
              <div className="pointer-events-auto self-end flex gap-2">
                <button className="glass rounded-full px-3 py-2 text-xs inline-flex items-center gap-1.5">
                  <Ruler className="h-3.5 w-3.5 text-accent" /> Measure
                </button>
                <button className="glass rounded-full px-3 py-2 text-xs inline-flex items-center gap-1.5">
                  <Bookmark className="h-3.5 w-3.5 text-accent" /> Save
                </button>
              </div>
            </div>
          </div>

          {/* SIDE PANEL */}
          <div className="lg:max-h-[calc(70vh+16px)] lg:overflow-y-auto pr-1 lg:sticky lg:top-24">
            <IntelligenceCards lat={active.lat} lng={active.lng} label={active.address} />
          </div>
        </div>
      </div>

      <AIOrb context={`${active.address} (${active.lat}, ${active.lng})`} />
    </div>
  );
}
