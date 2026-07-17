import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  ArrowLeft,
  Building2,
  Users,
  MapPin,
  Landmark,
  TrendingUp,
  ShieldCheck,
  Stethoscope,
  GraduationCap,
  Leaf,
  Home,
  Wrench,
  Sparkles,
  Trees,
  Camera,
  BookOpen,
  Info,
} from "lucide-react";
import { Navbar } from "@/components/halisia/navbar";
import countiesData from "@/data/kenya-counties.json";
import { buildCountyProfile, COUNTY_DATA_SOURCES } from "@/lib/county-profile";
import { KENYA_COAT_OF_ARMS } from "@/lib/kenya-county-facts";
import { METRIC_LABELS, formatMetric, type CountyMetric } from "@/lib/county-metrics";

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
    const title = `${p.facts.name} County — HALISIA AI intelligence profile`;
    const desc = `AI-scored profile of ${p.facts.name} County, Kenya (code ${p.facts.code}). Population ${p.facts.population2019.toLocaleString()}, ${p.facts.constituencies} constituencies, ${p.facts.wards} wards. Overall score ${p.scores.overall}/100.`;
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
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-32 text-center">
        <h1 className="text-3xl font-semibold">County not found</h1>
        <p className="mt-3 text-muted-foreground">
          That county code isn't part of Kenya's 47-county register.
        </p>
        <Link
          to="/"
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
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-32 text-center">
        <h1 className="text-3xl font-semibold">Something went wrong</h1>
        <p className="mt-3 text-muted-foreground">Refresh to try again.</p>
      </div>
    </div>
  );
}

const SECTION_NAV = [
  { id: "sec-summary", label: "AI Summary" },
  { id: "sec-dashboard", label: "Dashboard" },
  { id: "sec-overview", label: "Overview" },
  { id: "sec-economic", label: "Economic" },
  { id: "sec-political", label: "Political" },
  { id: "sec-social", label: "Social" },
  { id: "sec-cultural", label: "Cultural" },
  { id: "sec-security", label: "Security" },
  { id: "sec-infra", label: "Infrastructure" },
  { id: "sec-health", label: "Health" },
  { id: "sec-education", label: "Education" },
  { id: "sec-environment", label: "Environment" },
  { id: "sec-land", label: "Land" },
  { id: "sec-housing", label: "Housing" },
  { id: "sec-investment", label: "Investment" },
  { id: "sec-recs", label: "Recommendations" },
  { id: "sec-references", label: "References" },
  { id: "sec-media", label: "Media" },
];

function CountyPage() {
  const { profile } = Route.useLoaderData();
  const { facts, latLng, scores, metrics, density } = profile;

  const staticMapSrc = useMemo(() => {
    // Public OSM static-map tile (no key) — good enough for a hero header thumb.
    // We keep it in-view for a print-friendly, always-available preview.
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${latLng.lat},${latLng.lng}&zoom=8&size=1200x360&maptype=mapnik&markers=${latLng.lat},${latLng.lng},red-pushpin`;
  }, [latLng]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 pt-24 pb-16">
        <Link
          to="/"
          hash="counties"
          search={{ compare: "" }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All counties
        </Link>

        {/* HERO */}
        <header className="mt-6 glass-strong rounded-3xl overflow-hidden border border-white/10">
          <div className="relative h-56 md:h-72 bg-[#0a1735]">
            <img
              src={staticMapSrc}
              alt={`Map of ${facts.name} County centred at ${latLng.lat.toFixed(2)}°, ${latLng.lng.toFixed(2)}°`}
              className="absolute inset-0 h-full w-full object-cover opacity-70"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a1735] via-[#0a1735]/40 to-transparent" />
            <div className="absolute inset-0 p-6 md:p-8 flex items-end">
              <div className="flex items-center gap-4 w-full">
                <img
                  src={KENYA_COAT_OF_ARMS}
                  alt="Kenya coat of arms"
                  referrerPolicy="no-referrer"
                  className="h-16 w-16 md:h-20 md:w-20 drop-shadow-glow bg-white/10 rounded-xl p-1.5"
                />
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-[0.25em] text-accent">
                    County {String(facts.code).padStart(3, "0")} · {facts.region}
                  </div>
                  <h1 className="mt-1 text-3xl md:text-5xl font-semibold tracking-tight">
                    {facts.name} County
                  </h1>
                  <div className="mt-1 text-sm text-muted-foreground">
                    HQ: {facts.headquarters} · {latLng.lat.toFixed(3)}°, {latLng.lng.toFixed(3)}°
                  </div>
                </div>
                <HeroConfidenceBadge pct={profile.confidencePct} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-px bg-white/5">
            <ProfileFact label="Population (2019)" value={facts.population2019.toLocaleString()} />
            <ProfileFact label="Density" value={`${density.toLocaleString()} /km²`} />
            <ProfileFact label="Area" value={`${facts.areaKm2.toLocaleString()} km²`} />
            <ProfileFact label="Constituencies" value={String(facts.constituencies)} />
            <ProfileFact label="Wards" value={String(facts.wards)} />
            <ProfileFact label="Overall score" value={`${scores.overall}/100`} accent />
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

        {/* AI SUMMARY */}
        <Section id="sec-summary" title="AI Executive Summary" icon={Sparkles}>
          <p className="text-base md:text-lg leading-relaxed text-foreground/90">
            {profile.aiSummary}
          </p>
          <ConfidenceBar pct={profile.confidencePct} />
          <div className="mt-6 grid md:grid-cols-2 gap-4">
            <ListCard title="Strengths" items={profile.strengths} tone="ok" />
            <ListCard title="Weaknesses" items={profile.weaknesses} tone="warn" />
            <ListCard title="Opportunities" items={profile.opportunities} tone="ok" />
            <ListCard title="Key risks" items={profile.risks} tone="warn" />
          </div>
        </Section>

        {/* 14. DASHBOARD SCORES */}
        <Section id="sec-dashboard" title="County Dashboard" icon={TrendingUp}>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <ScoreTile label="Economic" value={scores.economic} />
            <ScoreTile label="Infrastructure" value={scores.infrastructure} />
            <ScoreTile label="Governance" value={scores.governance} />
            <ScoreTile label="Healthcare" value={scores.healthcare} />
            <ScoreTile label="Education" value={scores.education} />
            <ScoreTile label="Environment" value={scores.environment} />
            <ScoreTile label="Security" value={scores.security} />
            <ScoreTile label="Habitability" value={scores.habitability} />
            <ScoreTile label="Investment" value={scores.investment} />
            <ScoreTile label="Tourism" value={scores.tourism} />
            <ScoreTile label="Development readiness" value={scores.developmentReadiness} />
            <ScoreTile label="Overall" value={scores.overall} accent />
          </div>
        </Section>

        {/* 1. OVERVIEW */}
        <Section id="sec-overview" title="1 · County Overview" icon={Building2}>
          <div className="grid md:grid-cols-2 gap-6">
            <Definition label="Administrative Structure">
              {facts.constituencies} constituencies · {facts.wards} wards · headquartered at{" "}
              {facts.headquarters}. Governed by a County Executive Committee and a County Assembly
              under the Constitution of Kenya, 2010.
            </Definition>
            <Definition label="Geographic Characteristics">
              Located in the {facts.region} region, covering {facts.areaKm2.toLocaleString()} km²
              with a population density of ~{density.toLocaleString()} people/km².
            </Definition>
            <Definition label="Major Urban Centres">
              {[facts.headquarters, ...facts.landmarks.slice(0, 2)].join(", ")}.
            </Definition>
            <Definition label="Strategic Importance">
              Anchors {facts.economy.slice(0, 2).join(" and ").toLowerCase()} value chains for the
              wider {facts.region} region.
            </Definition>
          </div>
          <PhotoEvidenceRow
            items={[
              `${facts.headquarters} headquarters`,
              `${facts.name} skyline / aerial`,
              `${facts.name} county map`,
              facts.landmarks[0] ?? `${facts.name} landmark`,
              "Administrative offices",
            ]}
          />
        </Section>

        {/* 2. ECONOMIC */}
        <Section id="sec-economic" title="2 · Economic Analysis" icon={TrendingUp}>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs uppercase tracking-widest text-accent">Main activities</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {facts.economy.map((e: string) => (
                  <span key={e} className="rounded-full glass px-3 py-1 text-xs">
                    {e}
                  </span>
                ))}
              </div>
              <div className="mt-4 text-xs uppercase tracking-widest text-accent">
                Priority investment sectors
              </div>
              <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground space-y-1">
                {profile.prioritySectors.map((s: string) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MiniScore label="Economic growth" value={scores.economic} />
              <MiniScore label="Business climate" value={scores.governance} />
              <MiniScore label="Investment" value={scores.investment} />
              <MiniScore label="Employment" value={scores.economic - 4} />
            </div>
          </div>
          <PhotoEvidenceRow
            items={["CBD", "Markets", "Industrial areas", "Farms", "Business centres"]}
          />
        </Section>

        {/* 3. POLITICAL */}
        <Section id="sec-political" title="3 · Political & Governance" icon={Landmark}>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            <Definition label="Governor">{facts.governor}</Definition>
            <Definition label="Senator">{facts.senator}</Definition>
            <Definition label="Constituencies">{facts.constituencies}</Definition>
            <Definition label="County wards">{facts.wards}</Definition>
          </div>
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <Definition label="CIDP highlights">
              Focus areas typically include water &amp; sanitation, health, roads, agriculture value
              addition, ECDE and digital transformation.
            </Definition>
            <Definition label="Flagship projects">
              County flagship projects prioritise{" "}
              {profile.prioritySectors.slice(0, 2).join(" and ")}, informed by the Council of
              Governors development framework.
            </Definition>
          </div>
        </Section>

        {/* 4. SOCIAL */}
        <Section id="sec-social" title="4 · Social Analysis" icon={Users}>
          <div className="grid md:grid-cols-3 gap-3">
            <MiniScore label="Community wellbeing" value={scores.habitability} />
            <MiniScore label="Social development" value={scores.education} />
            <MiniScore
              label="Human development"
              value={Math.round((scores.education + scores.healthcare) / 2)}
            />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Urbanisation is concentrated around {facts.headquarters}, with a youth-heavy demographic
            pyramid consistent with national KNBS trends.
          </p>
        </Section>

        {/* 5. CULTURAL */}
        <Section id="sec-cultural" title="5 · Cultural Analysis" icon={BookOpen}>
          <p className="text-sm text-muted-foreground">
            Home to communities with deep cultural heritage. Notable assets include{" "}
            {facts.landmarks.slice(0, 3).join(", ")}. Traditional livelihoods overlap the county's
            modern economy in {facts.economy.slice(0, 2).join(" and ").toLowerCase()}.
          </p>
        </Section>

        {/* 6. SECURITY */}
        <Section id="sec-security" title="6 · Security Analysis" icon={ShieldCheck}>
          <div className="grid md:grid-cols-3 gap-3">
            <MiniScore label="Public safety" value={scores.security} />
            <MiniScore
              label="Disaster preparedness"
              value={Math.round((scores.security + scores.governance) / 2)}
            />
            <MiniScore label="Environmental risk" value={100 - scores.environment} invert />
          </div>
        </Section>

        {/* 7. INFRASTRUCTURE */}
        <Section id="sec-infra" title="7 · Infrastructure Analysis" icon={Wrench}>
          <div className="grid md:grid-cols-3 gap-3">
            <MiniScore label="Accessibility" value={scores.infrastructure} />
            <MiniScore
              label="Connectivity"
              value={Math.round((scores.infrastructure + scores.investment) / 2)}
            />
            <MiniScore label="Infrastructure development" value={scores.developmentReadiness} />
          </div>
          <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <Definition label="Transport">
              National &amp; county roads network with feeder links to key markets; regional
              airstrips where present; SGR/MGR access from adjacent counties.
            </Definition>
            <Definition label="Utilities">
              Kenya Power grid coverage, county water schemes and Safaricom/Airtel 4G footprint;
              growing fibre backbone via KENET/NOFBI.
            </Definition>
          </div>
        </Section>

        {/* 8. HEALTH */}
        <Section id="sec-health" title="8 · Healthcare Analysis" icon={Stethoscope}>
          <MiniScore label="Healthcare accessibility" value={scores.healthcare} />
          <p className="mt-3 text-sm text-muted-foreground">
            Tiered from Level 5/6 referral facilities through county hospitals, health centres and
            dispensaries, complemented by faith-based and private providers.
          </p>
        </Section>

        {/* 9. EDUCATION */}
        <Section id="sec-education" title="9 · Education Analysis" icon={GraduationCap}>
          <MiniScore label="Education accessibility" value={scores.education} />
          <p className="mt-3 text-sm text-muted-foreground">
            Universities, TVETs and colleges alongside secondary and primary schools per the KICD
            framework and CBC roll-out.
          </p>
        </Section>

        {/* 10. ENVIRONMENT */}
        <Section id="sec-environment" title="10 · Environmental Analysis" icon={Leaf}>
          <div className="grid md:grid-cols-3 gap-3">
            <MiniScore label="Environmental sustainability" value={scores.environment} />
            <MiniScore
              label="Climate resilience"
              value={Math.round((scores.environment + scores.security) / 2)}
            />
            <MiniScore label="Water reliability" value={metrics.water} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Terrain, rivers and forests characterise the county's natural capital; climate patterns
            follow Kenya Meteorological Department bulletins.
          </p>
        </Section>

        {/* 11. LAND */}
        <Section id="sec-land" title="11 · Land &amp; Development" icon={Trees}>
          <div className="grid md:grid-cols-2 gap-3">
            <MiniScore label="Development potential" value={scores.developmentReadiness} />
            <MiniScore label="Land suitability" value={metrics.livability} />
          </div>
        </Section>

        {/* 12. HOUSING */}
        <Section id="sec-housing" title="12 · Housing &amp; Habitability" icon={Home}>
          <div className="grid md:grid-cols-3 gap-3">
            <MiniScore label="Habitability" value={scores.habitability} />
            <MiniScore
              label="Quality of life"
              value={Math.round((scores.habitability + scores.education) / 2)}
            />
            <MiniScore
              label="Family friendliness"
              value={Math.round((scores.habitability + scores.security) / 2)}
            />
          </div>
        </Section>

        {/* 13. INVESTMENT */}
        <Section id="sec-investment" title="13 · Investment Analysis" icon={Sparkles}>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            <MiniScore label="Investment attractiveness" value={scores.investment} />
            <MiniScore
              label="Return potential"
              value={Math.round((scores.investment + scores.economic) / 2)}
            />
            <MiniScore
              label="Growth potential"
              value={Math.round((scores.economic + scores.developmentReadiness) / 2)}
            />
            <MiniScore
              label="Risk rating"
              value={100 - Math.round((scores.security + scores.environment) / 2)}
              invert
            />
          </div>
        </Section>

        {/* 15. RECOMMENDATIONS */}
        <Section id="sec-recs" title="Strategic Recommendations" icon={Sparkles}>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
            {profile.recommendations.map((r: string) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
          <p className="mt-4 text-sm">
            <span className="font-semibold text-foreground">Development outlook:</span>{" "}
            <span className="text-muted-foreground">{profile.outlook}</span>
          </p>
        </Section>

        {/* 16. REFERENCES */}
        <Section id="sec-references" title="16 · References &amp; Evidence" icon={Info}>
          <ul className="grid md:grid-cols-2 gap-2 text-sm">
            {COUNTY_DATA_SOURCES.map((s) => (
              <li
                key={s.url}
                className="glass rounded-2xl p-3 flex items-start justify-between gap-3"
              >
                <div>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-medium text-foreground hover:text-accent"
                  >
                    {s.label}
                  </a>
                  <div className="text-xs text-muted-foreground">Last verified: {s.verified}</div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            AI-generated intelligence derived from public open data. Only publicly licensed or
            permissioned imagery is used; verify with a licensed professional before commercial
            decisions.
          </p>
        </Section>

        {/* 17. MEDIA */}
        <Section id="sec-media" title="17 · Photo &amp; Media Evidence Library" icon={Camera}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[
              "Administrative buildings",
              "Aerial / satellite",
              "Road network",
              "Healthcare facilities",
              "Educational institutions",
              "Markets",
              "Industrial areas",
              "Tourist attractions",
              "Cultural sites",
              "Environmental features",
              "Housing developments",
              "Utility infrastructure",
            ].map((label) => (
              <div
                key={label}
                className="aspect-[4/3] glass rounded-2xl p-3 flex flex-col justify-end text-xs text-muted-foreground border border-white/5"
              >
                <Camera className="h-4 w-4 text-accent mb-2" />
                <div className="font-medium text-foreground">{label}</div>
                <div>Pending verified upload</div>
              </div>
            ))}
          </div>
        </Section>

        <div className="mt-10 text-center text-xs text-muted-foreground">
          HALISIA AI · county intelligence profile · code {facts.code} ·{" "}
          <MapPin className="inline h-3 w-3" /> {latLng.lat.toFixed(3)}°, {latLng.lng.toFixed(3)}°
        </div>
      </div>
    </div>
  );
}

// ---------- Small presentational helpers ----------

function ProfileFact({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-[#0a1735] px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${accent ? "text-gradient" : ""}`}>{value}</div>
    </div>
  );
}

function Section({
  id,
  title,
  icon: Icon,
  children,
}: {
  id?: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="mt-10 glass rounded-3xl p-5 md:p-7 border border-white/5 scroll-mt-32"
    >
      <div className="flex items-center gap-2 text-accent text-xs uppercase tracking-[0.25em]">
        <Icon className="h-4 w-4" />
        <span>{title}</span>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function HeroConfidenceBadge({ pct }: { pct: number }) {
  const tone =
    pct >= 80
      ? "from-emerald-400/80 to-accent"
      : pct >= 60
        ? "from-accent to-cyan-glow"
        : "from-amber-glow to-amber-500";
  return (
    <div
      className="hidden md:flex flex-col items-center justify-center rounded-2xl bg-white/10 backdrop-blur border border-white/15 px-4 py-3 shrink-0"
      aria-label={`Data confidence ${pct} percent`}
    >
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
        Data confidence
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className={`text-3xl font-semibold bg-gradient-to-br ${tone} bg-clip-text text-transparent`}
        >
          {pct}
        </span>
        <span className="text-xs text-muted-foreground">%</span>
      </div>
      <div className="mt-1 h-1 w-16 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
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

function MiniScore({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const clamped = Math.max(0, Math.min(100, value));
  const good = invert ? clamped < 40 : clamped > 70;
  const mid = invert ? clamped < 60 : clamped > 55;
  const color = good ? "bg-emerald-400" : mid ? "bg-accent" : "bg-amber-glow";
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{clamped}/100</div>
      <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className={`${color} h-full`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

function ScoreTile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-4 border ${
        accent ? "bg-accent/10 border-accent/40" : "bg-white/5 border-white/10"
      }`}
    >
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 text-3xl font-semibold ${accent ? "text-gradient" : ""}`}>
        {value}
        <span className="text-sm text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

function ConfidenceBar({ pct }: { pct: number }) {
  return (
    <div className="mt-4 flex items-center gap-3 text-xs">
      <span className="text-muted-foreground uppercase tracking-widest">Data confidence</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden max-w-xs">
        <div className="bg-accent h-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-foreground font-medium">{pct}%</span>
    </div>
  );
}

function ListCard({ title, items, tone }: { title: string; items: string[]; tone: "ok" | "warn" }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
      <div
        className={`text-xs uppercase tracking-widest ${
          tone === "ok" ? "text-accent" : "text-amber-glow"
        }`}
      >
        {title}
      </div>
      <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
        {items.map((it) => (
          <li key={it} className="flex gap-2">
            <span className={tone === "ok" ? "text-accent" : "text-amber-glow"}>•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PhotoEvidenceRow({ items }: { items: string[] }) {
  return (
    <div className="mt-6">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        Required photo evidence
      </div>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
        {items.map((it) => (
          <div
            key={it}
            className="rounded-xl border border-dashed border-white/15 px-2.5 py-3 text-muted-foreground bg-white/[0.02]"
          >
            {it}
          </div>
        ))}
      </div>
    </div>
  );
}
