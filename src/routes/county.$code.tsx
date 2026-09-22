import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Landmark,
  TrendingUp,
  BookOpen,
  Info,
  Vote,
  Download,
  Loader2,
} from "lucide-react";
import countiesData from "@/data/kenya-counties.json";
import { buildCountyProfile, COUNTY_DATA_SOURCES } from "@/lib/county-profile";
import { DENSITY_PROVENANCE } from "@/lib/county-metrics";
import { HoloTile } from "@/components/halisia/ds/holo-tile";
import { CountyEmblem } from "@/components/halisia/county-emblem";
import { CountyPoliticsPanel } from "@/components/halisia/county-politics-panel";
import { TERM_CAVEAT } from "@/lib/county-politics";
import { LeafletLayersMap } from "@/components/halisia/leaflet-layers-map";
import { CountyEvidenceStrip } from "@/components/halisia/county-evidence-strip";
import { generateCountyProfilePdf } from "@/lib/pdf-county-profile";
import { SaveButton } from "@/components/halisia/save-button";

/**
 * County profile page.
 *
 * This page used to run to sixteen sections — economic, social, cultural,
 * security, infrastructure, health, education, environment, land, housing,
 * investment — each showing 0-100 scores and a paragraph of analysis. Not one
 * of those scores was measured. They came from a sine hash of the county code,
 * and the paragraphs beside them ("Kenya Power grid coverage, county water
 * schemes and Safaricom/Airtel 4G footprint") were the same generic text on
 * all 47 pages. An "AI Executive Summary" told the reader HALISIA scored the
 * county N/100, and a "data confidence" badge in the hero was computed from
 * the invented numbers.
 *
 * All of it is removed. What is left is the published record — the census
 * figures, the gazetted area, the IEBC constituency and ward counts, the
 * elected leadership and the 2022 turnout, the county's economic activities
 * and landmarks, and a real map. It is a much shorter page. Every line on it
 * can be followed to a source.
 */

type Feature = { properties: { code: number; name: string; lat: number; lng: number } };
const FEATURES = (countiesData as { features: Feature[] }).features;

export const Route = createFileRoute("/county/$code")({
  loader: ({ params }) => {
    const code = parseInt(params.code, 10);
    const feat = FEATURES.find((f) => f.properties.code === code);
    if (!feat) throw notFound();
    const p = feat.properties;
    const profile = buildCountyProfile(code, { lat: p.lat, lng: p.lng });
    if (!profile) throw notFound();
    return { profile };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "County profile — HALISIA AI" }, { name: "robots", content: "noindex" }],
      };
    }
    const p = loaderData.profile;
    const title = `${p.facts.name} County — HALISIA AI county record`;
    const desc =
      `${p.facts.name} County, Kenya (code ${p.facts.code}). ` +
      `Population ${p.facts.population2019.toLocaleString()} at the 2019 census, ` +
      `${p.facts.areaKm2.toLocaleString()} km², ${p.facts.constituencies} constituencies, ` +
      `${p.facts.wards} wards. Published sources only.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
      ],
    };
  },
  notFoundComponent: CountyNotFound,
  errorComponent: CountyError,
  component: CountyPage,
});

function CountyNotFound() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-32 text-center">
        <h1 className="text-3xl font-semibold">County not found</h1>
        <p className="mt-3 text-muted-foreground">
          That county code isn't part of Kenya's 47-county register.
        </p>
        <Link
          to="/"
          search={{ compare: "" }}
          className="mt-6 inline-flex items-center gap-2 glass rounded-full px-4 py-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back to counties
        </Link>
      </div>
    </div>
  );
}

function CountyError() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-32 text-center">
        <h1 className="text-3xl font-semibold">Something went wrong</h1>
        <p className="mt-3 text-muted-foreground">Refresh to try again.</p>
      </div>
    </div>
  );
}

const SECTION_NAV = [
  { id: "sec-record", label: "The record" },
  { id: "sec-map", label: "Location & map" },
  { id: "sec-admin", label: "Administration" },
  { id: "sec-economy", label: "Economy" },
  { id: "sec-political", label: "Political record" },
  { id: "sec-landmarks", label: "Landmarks" },
  { id: "sec-references", label: "Sources" },
];

function CountyPage() {
  const { profile } = Route.useLoaderData();
  const { facts, latLng, density } = profile;
  const [pdf, setPdf] = useState<{
    pct: number;
    stage: string;
    busy: boolean;
    error: string | null;
  }>({ pct: 0, stage: "", busy: false, error: null });

  const handleDownload = async () => {
    setPdf({ pct: 0, stage: "Preparing", busy: true, error: null });
    try {
      await generateCountyProfilePdf(profile, (pct, stage) =>
        setPdf({ pct, stage, busy: pct < 100, error: null }),
      );
    } catch (e) {
      setPdf({ pct: 0, stage: "", busy: false, error: (e as Error).message ?? "Failed" });
    }
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 pt-24 pb-16">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/"
            hash="counties"
            search={{ compare: "" }}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> All counties
          </Link>
          <div className="flex items-center gap-3">
            {pdf.busy && (
              <div
                data-testid="county-pdf-progress"
                role="status"
                aria-live="polite"
                className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground"
              >
                <div
                  className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pdf.pct}
                >
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${pdf.pct}%` }}
                  />
                </div>
                <span>
                  {pdf.stage} · {pdf.pct}%
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={handleDownload}
              disabled={pdf.busy}
              data-testid="download-county-pdf"
              aria-label={`Download ${facts.name} county PDF record`}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-[#071E3D] shadow-lg shadow-accent/20 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {pdf.busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {pdf.busy ? "Generating…" : "Download PDF record"}
            </button>
            <SaveButton
              kind="county"
              ref_={String(facts.code)}
              label={`${facts.name} County`}
              latitude={latLng.lat}
              longitude={latLng.lng}
            />
          </div>
        </div>
        {pdf.error && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
          >
            Couldn't generate PDF: {pdf.error}
          </div>
        )}

        {/* HERO */}
        <header className="mt-6 glass-strong rounded-3xl overflow-hidden border border-white/10">
          <div className="relative h-56 md:h-72 bg-gradient-to-br from-[var(--h-ivory,#f7f3ea)] via-[#FFFDF8] to-[#F1ECE0] overflow-hidden">
            <div
              aria-hidden
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 30%, rgba(20,123,53,0.14), transparent 48%), radial-gradient(circle at 80% 70%, rgba(192,138,46,0.16), transparent 48%)",
              }}
            />
            <div className="absolute top-4 left-4">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground ring-1 ring-foreground/10 shadow-md">
                {String(facts.code).padStart(2, "0")}
              </span>
            </div>
            <div className="absolute inset-0 p-6 md:p-8 flex flex-col items-center justify-end text-center">
              <CountyEmblem code={facts.code} name={facts.name} size={128} priority />
              <div className="mt-3 text-[11px] uppercase tracking-[0.3em] text-accent">
                County {String(facts.code).padStart(3, "0")} · {facts.region}
              </div>
              <h1 className="mt-1 text-3xl md:text-5xl font-bold tracking-wide uppercase">
                {facts.name}
              </h1>
              <div className="mt-1 text-sm text-muted-foreground">
                HQ: {facts.headquarters} · {latLng.lat.toFixed(3)}°, {latLng.lng.toFixed(3)}°
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-foreground/10">
            <ProfileFact label="Population (2019)" value={facts.population2019.toLocaleString()} />
            <ProfileFact
              label="Density"
              value={density != null ? `${density.toLocaleString()} /km²` : "Not recorded"}
            />
            <ProfileFact label="Area" value={`${facts.areaKm2.toLocaleString()} km²`} />
            <ProfileFact label="Constituencies" value={String(facts.constituencies)} />
            <ProfileFact label="Wards" value={String(facts.wards)} />
          </div>
        </header>

        {/* STICKY IN-PAGE NAV */}
        <nav aria-label="County profile sections" className="sticky top-16 z-20 mt-6 -mx-2 px-2">
          <div className="glass-strong rounded-full border border-white/10 px-2 py-2 overflow-x-auto no-scrollbar">
            <ul className="flex items-center gap-1 whitespace-nowrap">
              {SECTION_NAV.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="inline-flex items-center rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-white/10 transition"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* THE RECORD */}
        <Section id="sec-record" title="The record" icon={Info}>
          <p className="text-base md:text-lg leading-relaxed text-foreground/90">
            {profile.summary}
          </p>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
            <span className="text-foreground font-medium">What this page does not hold.</span>{" "}
            HALISIA has no livability, growth, water-reliability, healthcare, education, security or
            investment score for any Kenyan county, and does not publish one. Figures on this page
            come from the 2019 census, the IEBC register and OpenStreetMap, and nothing else is
            shown. HALISIA does not assert title, boundary or ownership over any parcel.
          </div>
        </Section>

        {/* LOCATION & INTERACTIVE MAP */}
        <Section id="sec-map" title="Location & map" icon={MapPin}>
          <div className="grid md:grid-cols-[1fr_2fr] gap-4">
            <div className="space-y-3">
              <Definition label="Headquarters">{facts.headquarters}</Definition>
              <Definition label="Region">{facts.region}</Definition>
              <Definition label="Coordinates">
                {latLng.lat.toFixed(4)}°, {latLng.lng.toFixed(4)}°
              </Definition>
              <Definition label="Area">
                {facts.areaKm2.toLocaleString()} km²
                {density != null ? ` · ${density.toLocaleString()} people/km²` : ""}
              </Definition>
              <p className="text-xs text-muted-foreground">
                Boundaries and basemap from OpenStreetMap. The marker is the county centroid, not a
                parcel or an address. Use the layer control to switch between street, satellite and
                terrain.
              </p>
            </div>
            <LeafletLayersMap
              lat={latLng.lat}
              lng={latLng.lng}
              label={`${facts.name} County · ${facts.headquarters}`}
            />
          </div>
        </Section>

        {/* ADMINISTRATION */}
        <Section id="sec-admin" title="Administration" icon={Building2}>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            <Definition label="Governor elected 2022">{facts.governor}</Definition>
            <Definition label="Senator elected 2022">{facts.senator}</Definition>
            <Definition label="Constituencies">{String(facts.constituencies)}</Definition>
            <Definition label="County wards">{String(facts.wards)}</Definition>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Constituency and ward counts are from the IEBC register. The names are the August 2022
            election result — {TERM_CAVEAT} The county is governed by a County Executive Committee
            and a County Assembly under the Constitution of Kenya, 2010.
          </p>
        </Section>

        {/* ECONOMY */}
        <Section id="sec-economy" title="Economic activities" icon={TrendingUp}>
          <div className="flex flex-wrap gap-2">
            {facts.economy.map((e: string) => (
              <span key={e} className="rounded-full glass px-3 py-1 text-sm">
                {e}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            The principal activities recorded for this county. HALISIA does not hold county GDP,
            employment or sector-growth figures, so none are shown and no sector is ranked.
          </p>
        </Section>

        {/* POLITICAL RECORD */}
        <Section id="sec-political" title="Political record" icon={Vote}>
          <CountyPoliticsPanel code={facts.code} />
        </Section>

        {/* LANDMARKS */}
        <Section id="sec-landmarks" title="Landmarks" icon={BookOpen}>
          <ul className="flex flex-wrap gap-2">
            {facts.landmarks.map((l: string) => (
              <li
                key={l}
                className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-sm"
              >
                {l}
              </li>
            ))}
          </ul>
        </Section>

        {/* SOURCES */}
        <Section id="sec-references" title="Sources" icon={Landmark}>
          <div className="mb-4">
            <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
              Map panels — OpenStreetMap, with an Esri fallback when a tile is unavailable
            </div>
            <CountyEvidenceStrip lat={latLng.lat} lng={latLng.lng} countyName={facts.name} />
          </div>
          <ul className="grid md:grid-cols-2 gap-2 text-sm">
            {COUNTY_DATA_SOURCES.map((s) => (
              <li key={s.url} className="glass rounded-2xl p-3">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-medium text-foreground hover:text-accent"
                >
                  {s.label}
                </a>
                <div className="mt-1 text-xs text-muted-foreground">{s.used}</div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">{DENSITY_PROVENANCE}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Public open data, reproduced without interpretation. Verify with a licensed professional
            before any commercial decision.
          </p>
        </Section>

        <div className="mt-10 text-center text-xs text-muted-foreground">
          HALISIA AI · county record · code {facts.code} ·{" "}
          <MapPin className="inline h-3 w-3" /> {latLng.lat.toFixed(3)}°, {latLng.lng.toFixed(3)}°
        </div>
      </div>
    </div>
  );
}

// ---------- Small presentational helpers ----------

function ProfileFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#FFFDF8] px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function Section({
  id,
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  id?: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <HoloTile
      variant="hero"
      id={id}
      title={title}
      icon={Icon as never}
      defaultOpen={defaultOpen}
      className="mt-10"
      data-testid="county-section"
    >
      {children}
    </HoloTile>
  );
}

function Definition({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}
