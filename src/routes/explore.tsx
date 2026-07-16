import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AIOrb } from "@/components/halisia/ai-orb";
import { IntelligenceDashboard } from "@/components/halisia/intelligence-dashboard";
import {
  MapView,
  type MapLocation,
  type MapTypeId,
  type MapTheme,
  type OverlayId,
} from "@/components/halisia/map-view";
import { Navbar } from "@/components/halisia/navbar";
import { SearchBar } from "@/components/halisia/search-bar";
import { geocodeAddress } from "@/lib/geocode.functions";
import { reverseGeocode } from "@/lib/reverse-geocode.functions";
import { generateLocationDossier } from "@/lib/pdf-dossier";
import { classifyMapError } from "@/lib/static-map-cache";
import {
  Layers,
  Satellite,
  Ruler,
  Bookmark,
  MapPinned,
  Mountain,
  Sun,
  Moon,
  Bike,
  Bus,
  TrafficCone,
  Check,
  FileDown,
  Loader2,
  Share2,
} from "lucide-react";

const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore — HALISIA AI" },
      {
        name: "description",
        content: "Search any location in Kenya and see an AI-scored land intelligence dashboard.",
      },
      { property: "og:title", content: "Explore — HALISIA AI" },
      {
        property: "og:description",
        content: "AI-scored land intelligence for any place in Kenya.",
      },
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
  const [mapType, setMapType] = useState<MapTypeId>("roadmap");
  const [theme, setTheme] = useState<MapTheme>("dark");
  const [overlays, setOverlays] = useState<OverlayId[]>([]);
  const [layersOpen, setLayersOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfStage, setPdfStage] = useState<string>("");
  const [geoStage, setGeoStage] = useState<string>("");

  const toggleOverlay = (id: OverlayId) =>
    setOverlays((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const inspectPoint = async (lat: number, lng: number) => {
    setLoc({ lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
    setLoading(true);
    setGeoStage("Reverse-geocoding pin…");
    try {
      const res = await reverseGeocode({ data: { lat, lng } });
      if (res.ok) setLoc({ lat, lng, address: res.address });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setGeoStage("");
    }
  };

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

  const downloadDossier = async () => {
    setDownloading(true);
    setPdfError(null);
    setPdfStage("Fetching evidence maps…");
    try {
      // Micro-stage updates so users see progress rather than a spinner freeze.
      const stageTimer = window.setTimeout(
        () => setPdfStage("Rendering intelligence pages…"),
        1200,
      );
      const stageTimer2 = window.setTimeout(() => setPdfStage("Compiling PDF…"), 2600);
      const result = await generateLocationDossier({
        lat: active.lat,
        lng: active.lng,
        address: active.address,
        shareUrl:
          typeof window !== "undefined"
            ? `${window.location.origin}/report?lat=${active.lat}&lng=${active.lng}&address=${encodeURIComponent(active.address)}`
            : undefined,
      });
      window.clearTimeout(stageTimer);
      window.clearTimeout(stageTimer2);
      if (result.mapsFailed > 0) {
        const c = classifyMapError(result.lastError);
        setPdfError(
          `PDF saved without ${result.mapsFailed}/${result.mapsRequested} map thumbnails. ${c.title}. ${c.hint}`,
        );
      }
    } catch (e) {
      console.error(e);
      setPdfError("Couldn't generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
      setPdfStage("");
    }
  };

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
          {error && <div className="mt-3 text-sm text-amber-glow">{error}</div>}
        </div>

        <div className="mt-6 grid lg:grid-cols-[1fr_420px] gap-4">
          {/* MAP */}
          <div className="glass-strong rounded-3xl p-2 relative">
            <MapView
              center={{ lat: active.lat, lng: active.lng }}
              marker={{ lat: active.lat, lng: active.lng, label: active.address }}
              zoom={14}
              mapType={mapType}
              theme={theme}
              overlays={overlays}
              onMapClick={({ lat, lng }) => void inspectPoint(lat, lng)}
              className="rounded-[22px] h-[70vh] min-h-[520px]"
            />
            {/* Overlay controls */}
            <div className="pointer-events-none absolute inset-0 p-4 flex flex-col justify-between">
              <div className="pointer-events-auto flex flex-wrap items-start gap-2 self-start">
                <div className="flex items-center gap-1 glass rounded-full p-1">
                  {[
                    { id: "roadmap" as const, icon: MapPinned, label: "Map" },
                    { id: "satellite" as const, icon: Satellite, label: "Satellite" },
                    { id: "hybrid" as const, icon: Layers, label: "Hybrid" },
                    { id: "terrain" as const, icon: Mountain, label: "Terrain" },
                  ].map((t) => {
                    const active = mapType === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setMapType(t.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition ${active ? "bg-white/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        <t.icon className="h-3.5 w-3.5" /> {t.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1 glass rounded-full p-1">
                  <button
                    onClick={() => setTheme("light")}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${theme === "light" ? "bg-white/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Sun className="h-3.5 w-3.5" /> Light
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${theme === "dark" ? "bg-white/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Moon className="h-3.5 w-3.5" /> Dark
                  </button>
                </div>

                <div className="relative">
                  <button
                    onClick={() => setLayersOpen((v) => !v)}
                    className={`glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${overlays.length ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Layers className="h-3.5 w-3.5" /> Layers
                    {overlays.length > 0 && (
                      <span className="ml-1 rounded-full bg-accent/25 px-1.5 py-0.5 text-[10px] text-accent">
                        {overlays.length}
                      </span>
                    )}
                  </button>
                  {layersOpen && (
                    <div className="absolute left-0 mt-2 w-56 rounded-2xl glass-strong p-2 shadow-2xl z-10">
                      {[
                        { id: "traffic" as const, icon: TrafficCone, label: "Traffic" },
                        { id: "transit" as const, icon: Bus, label: "Transit" },
                        { id: "bicycling" as const, icon: Bike, label: "Bicycling" },
                      ].map((l) => {
                        const on = overlays.includes(l.id);
                        return (
                          <button
                            key={l.id}
                            onClick={() => toggleOverlay(l.id)}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-foreground hover:bg-white/10"
                          >
                            <l.icon className="h-3.5 w-3.5 text-accent" />
                            <span className="flex-1 text-left">{l.label}</span>
                            {on && <Check className="h-3.5 w-3.5 text-accent" />}
                          </button>
                        );
                      })}
                      <div className="mt-1 border-t border-white/10 pt-2 px-3 pb-1 text-[10px] text-muted-foreground">
                        Slope / flood / drainage overlays coming next.
                      </div>
                    </div>
                  )}
                </div>
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
            {geoStage && (
              <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 glass-strong rounded-full px-4 py-2 text-xs text-foreground inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> {geoStage}
              </div>
            )}
          </div>

          {/* SIDE PANEL */}
          <div className="lg:sticky lg:top-24 pr-1">
            <div
              className="mb-3 glass rounded-2xl px-4 py-2.5 text-xs text-muted-foreground"
              data-testid="active-address"
            >
              <span className="uppercase tracking-widest text-accent text-[10px] mr-2">
                Inspecting
              </span>
              {active.address}
            </div>
            <button
              onClick={downloadDossier}
              disabled={downloading}
              className="mb-3 w-full glass-strong rounded-2xl px-4 py-3 text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-white/10 transition disabled:opacity-60"
              data-testid="download-dossier"
            >
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {pdfStage || "Building dossier…"}
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4 text-accent" /> Download PDF dossier
                </>
              )}
            </button>
            {downloading && (
              <div className="mb-2 h-1 w-full rounded-full bg-white/5 overflow-hidden">
                <div className="h-full w-1/3 bg-gradient-to-r from-primary to-accent animate-[pulse_1.4s_ease-in-out_infinite]" />
              </div>
            )}
            {pdfError && <div className="mb-2 text-xs text-amber-glow">{pdfError}</div>}
            <ShareLinkButton lat={active.lat} lng={active.lng} address={active.address} />
            <IntelligenceDashboard lat={active.lat} lng={active.lng} address={active.address} />
          </div>
        </div>
      </div>

      <AIOrb context={`${active.address} (${active.lat}, ${active.lng})`} />
    </div>
  );
}

function ShareLinkButton({ lat, lng, address }: { lat: number; lng: number; address: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = `${window.location.origin}/report?lat=${lat}&lng=${lng}&address=${encodeURIComponent(address)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copy this link:", url);
    }
  };
  return (
    <button
      onClick={copy}
      className="mb-3 w-full glass rounded-2xl px-4 py-2.5 text-xs font-medium inline-flex items-center justify-center gap-2 hover:bg-white/10 transition"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-accent" /> Share link copied
        </>
      ) : (
        <>
          <Share2 className="h-3.5 w-3.5 text-accent" /> Copy shareable report link
        </>
      )}
    </button>
  );
}
