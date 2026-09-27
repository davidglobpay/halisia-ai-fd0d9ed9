import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ChevronDown, Download, Loader2, Newspaper } from "lucide-react";
import { MapView } from "@/components/halisia/map-view";
import { StreetViewPanel } from "@/components/halisia/land-passport/street-view-panel";
import { LocationStatusCard } from "@/components/halisia/land-passport/location-status";
import { PassportLinks } from "@/components/halisia/land-passport/passport-links";
import { EvidenceRow } from "@/components/halisia/land-passport/evidence-row";
import { EvidenceLedger } from "@/components/halisia/land-passport/evidence-ledger";
import { PassportSummaryStrip } from "@/components/halisia/land-passport/summary-strip";
import { AiInterpretation } from "@/components/halisia/land-passport/ai-interpretation";
import { CoverageFreshness } from "@/components/halisia/land-passport/coverage-freshness";
import { getGeotechIntel } from "@/lib/geotech.functions";
import { getWave4Intel } from "@/lib/wave4-intel.functions";
import {
  CHAPTERS,
  buildPassportEvidence,
  evidenceDigest,
  type ChapterId,
} from "@/lib/passport-evidence";
import { getLocationIntel, type LocationIntel } from "@/lib/location-intel.functions";
import { reverseGeocode } from "@/lib/reverse-geocode.functions";
import { runIntelligenceEngine } from "@/lib/intelligence-engine";
import { getCountyFacts } from "@/lib/kenya-county-facts";
import { fetchFeed, relativeTime } from "@/lib/pulse";
import {
  STATUS_META,
  compareCounty,
  countyByName,
  countyForPoint,
  locationConfidence,
  validateCoordinate,
  type LocationStatus,
} from "@/lib/location-validation";

const STATUSES = [
  "verified_geometry",
  "verified_coordinate",
  "approximate",
  "administrative",
  "user_provided",
  "ai_inferred",
] as const;

const searchSchema = z.object({
  lat: fallback(z.number(), NaN).default(NaN),
  lng: fallback(z.number(), NaN).default(NaN),
  ref: fallback(z.string(), "").default(""),
  label: fallback(z.string(), "").default(""),
  source: fallback(z.string(), "").default(""),
  status: fallback(z.enum(STATUSES), "approximate").default("approximate"),
  gt: fallback(z.string(), "").default(""),
  county: fallback(z.string(), "").default(""),
  noloc: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/passport")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Land Passport — HALISIA AI" },
      {
        name: "description",
        content:
          "One evidence-labelled profile for a Kenyan location: position confidence, county, terrain, access, habitability, investment signals and data gaps.",
      },
      { property: "og:title", content: "Land Passport — HALISIA AI" },
      {
        property: "og:description",
        content:
          "Evidence-labelled land intelligence for any point in Kenya, with honest data gaps.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PassportPage,
});

type Tag = "source" | "ai" | "official" | "user" | "gap";
const TAG: Record<Tag, string> = {
  source: "Source data",
  ai: "HALISIA interpretation",
  official: "Official data",
  user: "User-provided",
  gap: "Not available",
};

function Section({
  n,
  title,
  tag,
  children,
  open = false,
}: {
  n: number;
  title: string;
  tag: Tag;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details open={open} className="group rounded-2xl border border-foreground/10 bg-card/80">
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-muted-foreground">
            {String(n).padStart(2, "0")}
          </span>
          <span className="font-display text-base">{title}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="rounded-full border border-foreground/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            {TAG[tag]}
          </span>
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </span>
      </summary>
      <div className="border-t border-foreground/10 px-4 py-3 text-sm">{children}</div>
    </details>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right text-foreground break-words min-w-0">{v ?? "—"}</span>
    </div>
  );
}

function nearest(list: { name: string; distanceKm?: number }[] | undefined) {
  const p = list?.[0];
  if (!p) return null;
  return `${p.name}${p.distanceKm != null ? ` · ${p.distanceKm.toFixed(1)} km` : ""}`;
}

type Concept = {
  name: string;
  why: string[];
  assume: string;
  constraints: string;
  infra: string;
  users: string;
};

function concepts(intel: LocationIntel | undefined): Concept[] {
  if (!intel) return [];
  const c = intel.categories;
  const civic = c.schools.length + c.hospitals.length;
  const commerce = c.groceries.length + c.restaurants.length + c.banks.length;
  const out: Concept[] = [];
  const common = "Zoning, title, soil and utility capacity are unconfirmed.";
  if (civic >= 3)
    out.push({
      name: "Residential (maisonettes / apartments)",
      why: [`${c.schools.length} schools and ${c.hospitals.length} health facilities found nearby`],
      assume: "Residential use is permitted and water/power can be connected.",
      constraints: common,
      infra: "Access road, water connection, sewer or septic, power.",
      users: "Households and renters working in nearby centres.",
    });
  if (commerce >= 6)
    out.push({
      name: "Commercial / retail or mixed-use",
      why: [`${commerce} shops, restaurants and banks found nearby`],
      assume: "Frontage to a trafficked road and commercial zoning.",
      constraints: common,
      infra: "Parking, loading access, three-phase power.",
      users: "Retail tenants, service businesses, local shoppers.",
    });
  if (c.transit.length >= 2 && commerce >= 6)
    out.push({
      name: "Transit-oriented mixed-use",
      why: [`${c.transit.length} transit stops nearby`],
      assume: "Higher density is allowed by the county plan.",
      constraints: common,
      infra: "Pedestrian access, drainage for larger footprint.",
      users: "Commuters, small offices, ground-floor retail.",
    });
  if (civic + commerce < 4)
    out.push({
      name: "Agricultural or low-density use",
      why: ["Few services found within the search radius"],
      assume: "Soil and water suit the crop or livestock planned.",
      constraints: `${common} Remote from services.`,
      infra: "Farm access road, borehole or water rights.",
      users: "Farmers, agribusiness, rural homesteads.",
    });
  return out;
}

function PassportPage() {
  const s = Route.useSearch();
  const check = validateCoordinate(s.lat, s.lng);
  const fetchIntel = useServerFn(getLocationIntel);
  const fetchRev = useServerFn(reverseGeocode);
  const [mode, setMode] = useState<"map" | "satellite" | "street">("satellite");
  const ok = check.ok && check.lat != null && check.lng != null;
  const lat = check.lat ?? 0;
  const lng = check.lng ?? 0;

  const intelQ = useQuery({
    queryKey: ["passport-intel", lat, lng],
    queryFn: () => fetchIntel({ data: { lat, lng } }),
    enabled: ok,
    staleTime: 10 * 60_000,
    retry: 1,
  });
  const revQ = useQuery({
    queryKey: ["passport-rev", lat, lng],
    queryFn: () => fetchRev({ data: { lat, lng } }),
    enabled: ok,
    staleTime: 60 * 60_000,
    retry: 1,
  });
  const fetchGeo = useServerFn(getGeotechIntel);
  const fetchW4 = useServerFn(getWave4Intel);
  const geoQ = useQuery({
    queryKey: ["passport-geo", lat, lng],
    queryFn: () => fetchGeo({ data: { lat, lng } }),
    enabled: ok,
    staleTime: 30 * 60_000,
    retry: 1,
  });
  const w4Q = useQuery({
    queryKey: ["passport-w4", lat, lng],
    queryFn: () => fetchW4({ data: { lat, lng } }),
    enabled: ok,
    staleTime: 15 * 60_000,
    retry: 1,
  });
  const [openedAt, setOpenedAt] = useState("");
  useEffect(() => setOpenedAt(new Date().toISOString()), [lat, lng]);
  const county = ok ? countyForPoint(lat, lng) : null;
  const facts = county ? getCountyFacts(county.code) : null;
  const newsQ = useQuery({
    queryKey: ["passport-news", county?.name],
    queryFn: () => fetchFeed({ county: county!.name, limit: 5, sort: "latest" }),
    enabled: !!county,
    staleTime: 15 * 60_000,
  });

  if (!ok && (s.ref || s.label || s.county)) {
    const named = countyByName(s.county);
    return (
      <div className="mx-auto max-w-xl px-4 py-12" data-testid="passport-limited">
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Land Passport · limited
        </p>
        <h1 className="mt-1 font-display text-2xl">{s.label || s.ref || "Unnamed listing"}</h1>
        {s.ref && s.ref !== s.label && (
          <p className="mt-1 font-mono text-xs text-muted-foreground">{s.ref}</p>
        )}
        <div
          role="status"
          className="mt-4 rounded-2xl border border-white/10 bg-card/70 p-4 text-sm"
        >
          <p className="font-semibold">Location not available</p>
          <p className="mt-1 text-muted-foreground">{s.noloc || check.issues[0]}</p>
          <p className="mt-2 text-muted-foreground">
            Without a map position HALISIA cannot show the map, Street View, terrain, access,
            habitability, nearby services or investment signals for this listing. Nothing here
            confirms the parcel's position, boundary or ownership.
          </p>
          {s.source && (
            <p className="mt-2 text-xs text-muted-foreground">Listing source: {s.source}</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            County stated by the listing: {s.county || "not stated"}
            {s.county && !named ? " (not matched to a Kenyan county)" : ""}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {named && (
            <Link
              to="/county/$code"
              params={{ code: String(named.code) }}
              className="rounded-full bg-primary px-4 py-2 text-xs text-primary-foreground"
            >
              County Intelligence · {named.name}
            </Link>
          )}
          <Link
            to="/explore"
            className="rounded-full border border-foreground/20 px-4 py-2 text-xs"
          >
            Pick the point on a map
          </Link>
        </div>
      </div>
    );
  }

  if (!ok) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center" data-testid="passport-invalid">
        <h1 className="font-display text-2xl">Land Passport cannot open</h1>
        <p className="mt-2 text-sm text-muted-foreground">{check.issues[0]}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Search a place or pick a point on the map to create a passport.
        </p>
        <Link
          to="/explore"
          className="mt-4 inline-block rounded-full bg-primary px-4 py-2 text-xs text-primary-foreground"
        >
          Go to Explore
        </Link>
      </div>
    );
  }

  const status = s.status as LocationStatus;
  const intel = intelQ.data;
  const engine = runIntelligenceEngine(intel);
  const mod = (id: string) => engine.modules.find((m) => m.id === id);
  const admin = revQ.data?.admin;
  const discrepancy = compareCounty({ lat, lng }, s.county, s.source || "Pin");
  const locConf = locationConfidence(status, s.gt);
  const measured = engine.modules.filter((m) => m.status === "measured").length;
  const completeness = Math.round((measured / engine.modules.length) * 100);
  const providersOk = intel
    ? Object.values(intel.providers).filter((p) => p.status === "ok").length
    : 0;
  const cats = intel?.categories;
  const ideas = concepts(intel);
  const intelFailed = intelQ.isError;

  const gaps = [
    !STATUS_META[status].exact && "Surveyed parcel geometry and beacon coordinates",
    "Official ownership / title search (Ardhisasa is not connected to HALISIA)",
    "Encumbrances, caveats and charges on the title",
    "Laboratory soil or geotechnical test for this plot",
    "Current utility connection status (water, power, sewer)",
    "Recent verified market transaction prices",
    "County zoning and planning-approval status",
    "Flood modelling (elevation alone is not a flood assessment)",
    !intel?.elevation?.meters && "Elevation reading",
    intelFailed && "Live amenity and environment data (request failed on this visit)",
  ].filter(Boolean) as string[];

  const qs = (q: { isLoading: boolean; isError: boolean }) =>
    q.isLoading ? ("loading" as const) : q.isError ? ("error" as const) : ("ok" as const);
  const ev = buildPassportEvidence({
    lat,
    lng,
    ref: s.ref,
    positionLabel: STATUS_META[status].label,
    positionExact: STATUS_META[status].exact,
    locationConfidencePct: locConf,
    sourceLabel: s.source,
    countyName: county?.name ?? null,
    admin: admin
      ? { subCounty: admin.subCounty, ward: admin.ward, locality: admin.locality }
      : null,
    facts,
    intel,
    intelState: qs(intelQ),
    geotech: geoQ.data,
    geoState: qs(geoQ),
    wave4: w4Q.data,
    w4State: qs(w4Q),
    retrievedAt: openedAt || "This visit",
  });
  const byChapter = (id: ChapterId) => ev.items.filter((x) => x.chapter === id);
  const placeName =
    s.ref || s.label || revQ.data?.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-28 pt-6" data-testid="land-passport-page">
      <Link
        to="/explore"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Explore
      </Link>
      <header className="mt-3">
        <div className="text-[11px] uppercase tracking-[0.3em] text-accent">Land Passport</div>
        <h1 className="mt-1 font-display text-3xl break-words">
          {s.ref || s.label || revQ.data?.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {[admin?.ward, admin?.subCounty, county ? `${county.name} County` : null, "Kenya"]
            .filter(Boolean)
            .join(" → ")}
        </p>
        <PassportLinks className="mt-3" target={{ lat, lng, ref: s.ref, status }} />
      </header>

      <PassportSummaryStrip
        positionLabel={STATUS_META[status].label}
        locationPct={locConf}
        county={county?.name ?? null}
        available={ev.summary.available}
        total={ev.summary.total}
        coveragePct={ev.summary.coveragePct}
        refreshed={openedAt ? `${openedAt.slice(11, 16)} UTC` : "—"}
      />

      <div className="mt-5 overflow-hidden rounded-3xl border border-foreground/10">
        <div className="flex gap-1 border-b border-foreground/10 bg-card p-1" role="tablist">
          {(["map", "satellite", "street"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-[40px] flex-1 rounded-full text-xs font-semibold capitalize ${
                mode === m ? "bg-primary text-primary-foreground" : "hover:bg-foreground/5"
              }`}
            >
              {m === "street" ? "Street View" : m}
            </button>
          ))}
        </div>
        <div className="relative h-[300px]">
          {mode === "street" ? (
            <StreetViewPanel lat={lat} lng={lng} className="absolute inset-0" />
          ) : (
            <MapView
              center={{ lat, lng }}
              zoom={STATUS_META[status].exact ? 17 : 14}
              marker={{ lat, lng, label: STATUS_META[status].label }}
              mapType={mode === "satellite" ? "hybrid" : "roadmap"}
              theme="light"
            />
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <AiInterpretation
          digest={evidenceDigest(ev.items)}
          place={placeName}
          coveragePct={ev.summary.coveragePct}
        />
        <button
          type="button"
          data-testid="passport-pdf"
          onClick={async () => {
            const { downloadPassportPdf } = await import("@/lib/passport-pdf");
            downloadPassportPdf({
              place: placeName,
              locationLine: [
                admin?.ward,
                admin?.subCounty,
                county ? `${county.name} County` : null,
                "Kenya",
              ]
                .filter(Boolean)
                .join(", "),
              positionLabel: STATUS_META[status].label,
              items: ev.items,
              ledger: ev.ledger,
              coveragePct: ev.summary.coveragePct,
              generatedAt: `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
            });
          }}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          <Download className="h-4 w-4" /> Download Passport PDF
        </button>
        <CoverageFreshness items={ev.items} />
        <EvidenceLedger entries={ev.ledger} />
        <Section n={1} title="Identity & position" tag="source" open>
          <Row k="Location status" v={STATUS_META[status].label} />
          <Row k="County" v={county ? `${county.name} (code ${county.code})` : "No county match"} />
          <Row
            k="Sub-county"
            v={admin?.subCounty ?? (revQ.isLoading ? "Loading…" : "Not reported")}
          />
          <Row k="Ward / area" v={admin?.ward ?? "Not reported"} />
          <Row k="Nearest town / centre" v={admin?.locality ?? "Not reported"} />
          <Row k="Parcel polygon" v={STATUS_META[status].exact ? "See source" : "Not available"} />
          <Row k="Area" v="Not available without survey data" />
          <Row k="Source" v={s.source || "Not stated"} />
          <Row k="Opened" v={openedAt || "—"} />
          <ul className="mt-2">
            {byChapter("identity").map((it) => (
              <EvidenceRow key={it.id} item={it} />
            ))}
          </ul>
          <LocationStatusCard
            status={status}
            geocodeType={s.gt || null}
            source={s.source || "Not stated"}
            discrepancies={discrepancy ? [discrepancy] : []}
            issues={check.issues}
          />
        </Section>

        <Section n={2} title="Administrative context" tag="official">
          <ul className="mb-2">
            {byChapter("admin").map((it) => (
              <EvidenceRow key={it.id} item={it} />
            ))}
          </ul>
          {facts ? (
            <>
              <Row k="County government" v={`${facts.name} County · Governor ${facts.governor}`} />
              <Row k="Headquarters" v={facts.headquarters} />
              <Row k="Population (2019 census)" v={facts.population2019.toLocaleString("en-KE")} />
              <Row k="Area" v={`${facts.areaKm2.toLocaleString("en-KE")} km²`} />
              <Row k="Constituencies / wards" v={`${facts.constituencies} / ${facts.wards}`} />
              <Row k="Main economic activities" v={facts.economy.join(", ")} />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Sources: KNBS 2019 census, IEBC boundaries, county records. Projects, budgets and
                security data are not held yet — open the county page for everything HALISIA has.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No county profile matched this point.</p>
          )}
        </Section>

        {CHAPTERS.slice(2).map((ch, idx) => (
          <Section
            key={ch.id}
            n={idx + 3}
            title={ch.title}
            tag={
              ch.id === "trust" ? "gap" : ch.id === "build" || ch.id === "market" ? "ai" : "source"
            }
            open={ch.id === "trust"}
          >
            <p className="text-[11px] text-muted-foreground">{ch.blurb}</p>
            <ul className="mt-1">
              {byChapter(ch.id).map((it) => (
                <EvidenceRow key={it.id} item={it} />
              ))}
            </ul>
            {ch.id === "build" && ideas.length > 0 && (
              <div className="mt-3 space-y-3">
                <div className="text-xs font-medium">Indicative development concepts</div>
                {ideas.map((c) => (
                  <div key={c.name} className="rounded-xl border border-foreground/10 p-3 text-xs">
                    <div className="font-medium text-foreground">{c.name}</div>
                    <Row k="Why it may fit" v={c.why.join("; ")} />
                    <Row k="Assumes" v={c.assume} />
                    <Row k="Constraints" v={c.constraints} />
                    <Row k="Infrastructure" v={c.infra} />
                    <Row k="Still needed" v="Zoning letter, survey, soil test" />
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground">
                  Suggestions only — not planning approval.
                </p>
              </div>
            )}
            {ch.id === "build" && geoQ.data?.disclaimer && (
              <p className="mt-2 text-[11px] text-muted-foreground">{geoQ.data.disclaimer}</p>
            )}
            {ch.id === "market" && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Not a forecast. HALISIA does not predict prices or guarantee returns. Scores with
                low coverage are withheld rather than guessed.
              </p>
            )}
            {ch.id === "trust" && (
              <>
                <div className="mt-3 text-xs">
                  <div className="font-medium">Verification ladder</div>
                  <ul
                    className="mt-1 space-y-0.5 text-muted-foreground"
                    data-testid="verification-ladder"
                  >
                    <li>Source listed: {s.source ? "yes — " + s.source : "no source stated"}</li>
                    <li>
                      Data completeness: {ev.summary.coveragePct}% of passport facts available
                    </li>
                    <li>Documents reviewed: no</li>
                    <li>Evidence verified: no</li>
                    <li>Regulator verified: no</li>
                  </ul>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  <a
                    href="https://ardhisasa.lands.go.ke"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent"
                  >
                    Open Ardhisasa (official) →
                  </a>
                  <Link to="/financing" className="text-accent">
                    Open financing tools →
                  </Link>
                </div>
                <div className="mt-4 text-xs font-medium">
                  Local news ({county?.name ?? "county"})
                </div>
                {newsQ.isLoading ? (
                  <Loading />
                ) : !newsQ.data?.length ? (
                  <p className="text-xs text-muted-foreground">
                    No recent stories in HALISIA Pulse.
                  </p>
                ) : (
                  <ul className="mt-1 space-y-2">
                    {newsQ.data.map((a) => (
                      <li key={a.id}>
                        <Link
                          to="/pulse/$id"
                          params={{ id: a.id }}
                          className="flex gap-2 text-xs hover:text-accent"
                        >
                          <Newspaper className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>
                            {a.title}{" "}
                            <span className="text-muted-foreground">
                              · {a.sourceName ?? "Source"} · {relativeTime(a.publishedAt)}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 text-xs font-medium">What HALISIA does not yet know</div>
                <ul className="list-disc pl-4 text-xs" data-testid="passport-gaps">
                  {gaps.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </>
            )}
          </Section>
        ))}
      </div>
    </div>
  );
}

function List({
  title,
  items,
}: {
  title: string;
  items: (string | false | null | undefined | 0)[];
}) {
  const real = items.filter(Boolean) as string[];
  return (
    <div>
      <div className="font-medium">{title}</div>
      <ul className="mt-0.5 list-disc pl-4 text-muted-foreground">
        {real.length ? (
          real.map((i) => <li key={i}>{i}</li>)
        ) : (
          <li>None identified from available data</li>
        )}
      </ul>
    </div>
  );
}

function Loading() {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading live data…
    </span>
  );
}

function Failed() {
  return (
    <p className="text-xs text-amber-glow">
      Live data could not be fetched (provider unavailable or rate-limited). Reload in a minute.
    </p>
  );
}
