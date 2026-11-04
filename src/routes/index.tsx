import { SignInPrompt } from "@/components/halisia/sign-in-prompt";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FeatureRail } from "@/components/halisia/feature-rail";
import { z } from "zod";
import { fallback } from "@tanstack/zod-adapter";
import { motion } from "framer-motion";
import { type ReactNode } from "react";
import {
  ArrowRight,
  Brain,
  Layers,
  MapPinned,
  ShieldCheck,
  Users,
  Waves,
  Sparkles,
  BadgeCheck,
  Search,
  MousePointerClick,
  FileText,
} from "lucide-react";
import { KenyaCountyMap } from "@/components/halisia/kenya-county-map";

import { AIOrb } from "@/components/halisia/ai-orb";
import { HoloStack } from "@/components/halisia/ds/holo-stack";

import {
  PulseWindow,
  CountyListSection,
  CountyComparisonSection,
  MarketplaceSection,
  ContributorAndDashboardSection,
} from "@/components/halisia/landing-sections";

import halisiaSymbol from "@/assets/brand/halisia-mark.png.asset.json";
import halisiaWordmark from "@/assets/brand/halisia-lockup.png.asset.json";
import { HeroMap } from "@/components/halisia/hero-map";
import {
  lowestOneOffKes,
  lowestBundleKes,
  lowestPaidPlanMonthlyKes,
  priceKes,
} from "@/lib/service-pricing";
import { previewQuote } from "@/lib/scout-pricing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HALISIA AI — Kenya land intelligence" },
      {
        name: "description",
        content:
          "Explore Kenyan locations, county context and sourced land intelligence, with evidence limitations clearly identified.",
      },
      { property: "og:title", content: "HALISIA AI — Kenya land intelligence" },
      {
        property: "og:description",
        content:
          "Explore Kenyan locations, county context and sourced land intelligence, with evidence limitations clearly identified.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s) => z.object({ compare: fallback(z.string(), "").default("") }).parse(s),
  component: Landing,
});

function Landing() {
  return <LandingBody />;
}

/**
 * Cinematic hero stage. The intro film never auto-plays on first load: the
 * poster frame is shown instead and the visitor opts in. On save-data,
 * slow connections, reduced-motion or blocked autoplay we stay on the still.
 */
function HeroStage({ children }: { children?: ReactNode }) {
  return (
    <div className="relative w-full overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,#FFFDF8_0%,#F7F3EA_45%,#EFE9DC_100%)]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(247,243,234,0.4)_0%,rgba(247,243,234,0)_38%,rgba(247,243,234,0.75)_100%)]"
      />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(16,45,26,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(16,45,26,0.5) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
        }}
      />
      <div className="relative z-10 flex min-h-[calc(100svh-5rem)] flex-col justify-center py-10 sm:py-14">
        <div className="mx-auto w-full max-w-7xl px-4">{children}</div>
      </div>
    </div>
  );
}

function LandingBody() {
  return (
    <div className="min-h-screen">
      {/* HERO — static cinematic stage (videos removed) */}
      <section
        aria-label="HALISIA cinematic hero"
        className="relative pt-20 md:pt-24 overflow-hidden"
      >
        <div className="relative z-10 mx-auto max-w-3xl px-4 pb-3">
          <SignInPrompt feature="Address search and land insights" />
        </div>
        <HeroStage>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="mx-auto flex max-w-3xl flex-col items-center text-center"
          >
            {/* Static brand mark with restrained depth. */}
            <div className="relative mb-4 flex items-center justify-center [perspective:1200px]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 blur-3xl opacity-50"
                style={{
                  background:
                    "radial-gradient(closest-side, rgba(192,138,46,0.35), rgba(20,123,53,0.18) 55%, transparent 75%)",
                }}
              />
              <img
                src={halisiaSymbol.url}
                alt="HALISIA.AI"
                width={200}
                height={200}
                decoding="async"
                fetchPriority="high"
                className="relative h-36 w-36 sm:h-44 sm:w-44 md:h-52 md:w-52 lg:h-60 lg:w-60 object-contain [transform:rotateX(6deg)] drop-shadow-[0_18px_44px_rgba(16,45,26,0.28)] [filter:drop-shadow(0_0_26px_rgba(192,138,46,0.42))_drop-shadow(0_0_54px_rgba(20,123,53,0.24))]"
              />
              {/* Specular highlight sweep */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-40 rounded-full"
                style={{
                  background:
                    "linear-gradient(120deg, transparent 40%, rgba(255,255,255,0.6) 50%, transparent 60%)",
                }}
              />
            </div>
            <img
              src={halisiaWordmark.url}
              alt="HALISIA.AI — Land Intelligence Engine"
              width={653}
              height={237}
              decoding="async"
              className="mb-5 h-auto w-[min(340px,72vw)] object-contain drop-shadow-[0_8px_24px_rgba(16,45,26,0.18)]"
            />
            <div className="mb-4 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
              <span className="h-px w-8 bg-foreground/20" />
              Kenya · Beta · Land Intelligence
              <span className="h-px w-8 bg-foreground/20" />
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-semibold leading-[1.02] tracking-tight text-foreground">
              <span className="text-gradient">Understand Every</span>
              <br />
              County.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base md:text-lg text-muted-foreground leading-relaxed">
              Land. People. Infrastructure. Risk. Opportunity.
              <br className="hidden sm:inline" /> Powered by Artificial Intelligence.
            </p>

            <div className="mx-auto mt-6 w-full max-w-xl">
              {/* The hero search bar handed off to /explore, which repeated the
                  map below. One search, attached to the map that answers it. */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Link
                  to="/"
                  hash="counties"
                  search={{ compare: "" }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-[#0E5A26] text-primary-foreground px-4 py-2 text-xs font-semibold shadow-[0_10px_30px_-10px_rgba(20,123,53,0.6)] hover:scale-[1.03] transition"
                >
                  Explore Counties <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <a
                  href="#hero-map"
                  className="inline-flex items-center gap-1.5 rounded-full glass border border-foreground/15 px-4 py-2 text-xs font-medium text-foreground hover:bg-foreground/5 transition"
                >
                  Pick a point on the map
                </a>
                <Link
                  to="/spatial"
                  search={{ parcel: "" }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent/12 px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent/20 transition"
                >
                  Spatial AR Studio
                </Link>
              </div>
            </div>

            <div className="mt-6 hidden md:flex items-center justify-center gap-6 text-xs text-white/75">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-accent" /> Confidence-scored
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" /> Community-contributed
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-accent" /> Never legal advice
              </div>
            </div>
          </motion.div>
        </HeroStage>
      </section>

      {/* HERO MAP — interactive map / satellite / Street View → Land Passport */}
      <HeroMap />

      {/* TOOLS RAIL — the paid entry points, straight after the search bar */}
      <FeatureRail />

      {/* MARKETPLACE LISTINGS */}
      <MarketplaceSection />

      {/* HALISIA PULSE WINDOW */}
      <PulseWindow />

      {/* COUNTY INTELLIGENCE MAP */}
      <KenyaCountyMap />

      {/* COUNTY DIRECTORY + COMPARISON */}
      <CountyListSection />
      <CountyComparisonSection />

      {/* CONTRIBUTOR PLATFORM + DASHBOARD */}
      <ContributorAndDashboardSection />

      <div className="mx-auto max-w-7xl px-4 pt-8">
        <div className="text-[11px] uppercase tracking-[0.25em] text-accent">
          How the HALISIA AI engine works
        </div>
      </div>

      {/* INTELLIGENCE PILLARS — holographic collapsible stack */}
      <HoloStack
        id="intelligence"
        eyebrow="Intelligence Engine"
        title={
          <>
            Every location, translated into{" "}
            <span className="text-gradient">signals you can trust</span>.
          </>
        }
        intro="Three things HALISIA can measure from public APIs, the gaps it names instead of guessing (title, zoning, utilities, safety and price), and who to ask next. Each reading carries its source and its confidence."
        items={PILLARS.map((p) => ({
          key: p.title,
          title: p.title,
          body: p.body,
          icon: p.icon,
          meta: "Signal group",
        }))}
      />

      {/* TRUST & AUTOMATION — holographic collapsible stack */}
      <HoloStack
        id="trust"
        eyebrow="Trust before automation"
        title="AI that shows its work — and its uncertainty."
        intro="Every score comes with evidence, a confidence level and what we don't yet know. We never call a plot safe or legal — we show what we found and when to bring in a professional."
        items={[
          ...TRUST.map((t) => ({
            key: t.label,
            title: t.stat,
            body: t.label,
            meta: "Guarantee",
          })),
          ...[
            "Reasoning shown",
            "Confidence Low/Med/High",
            "Sources cited",
            "Community-weighted",
          ].map((t) => ({ key: t, title: t, meta: "Principle" })),
        ]}
        itemClassName="w-[200px] sm:w-[220px]"
      />

      {/* HOW IT WORKS */}
      <section id="how" className="py-24 md:py-32 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-4">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-[0.25em] text-accent">Three steps</div>
            <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight">
              From a name on a signboard to a{" "}
              <span className="text-gradient">decision you can defend</span>.
            </h2>
          </div>
          <div className="mt-14 grid md:grid-cols-3 gap-4">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: i * 0.08 }}
                className="glass rounded-3xl p-6 relative overflow-hidden"
              >
                <div className="absolute top-4 right-5 text-5xl font-semibold text-white/5">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="h-11 w-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <s.icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PEOPLE — holographic collapsible stack */}
      <HoloStack
        id="voices"
        eyebrow="Use cases"
        title="How people use HALISIA."
        intro="Common situations the platform is built for."
        items={SCENARIOS.map((s) => ({
          key: s.title,
          title: s.title,
          meta: s.role,
          body: s.body,
        }))}
        itemClassName="w-[280px] sm:w-[320px]"
      />

      {/* PRICING / CTA */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-5xl px-4">
          <div className="glass-strong rounded-[36px] p-10 md:p-16 text-center relative overflow-hidden">
            <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl opacity-40 bg-primary" />
            <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full blur-3xl opacity-40 bg-accent" />
            <Sparkles className="h-8 w-8 text-accent mx-auto" />
            <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight">
              Start with any place in Kenya.
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Every location profile is free. Not for a trial period, and not only while HALISIA is
              in beta — nothing that is free today becomes paid. Reports bought one at a time start
              at {priceKes(lowestOneOffKes())}, packages at {priceKes(lowestBundleKes())}, and a
              plan at {priceKes(lowestPaidPlanMonthlyKes())} a month. Scout visits start at{" "}
              {priceKes(previewQuote({}, "easy", 0).totalKes)} before travel and access. Payment
              integration and live activation are pending.
            </p>
            <dl className="mt-6 grid gap-3 sm:grid-cols-3 max-w-2xl mx-auto text-left">
              {[
                {
                  k: "Looking around",
                  v: priceKes(0),
                  d: "Any place in Kenya, every source named.",
                },
                {
                  k: "One report",
                  v: "from " + priceKes(lowestOneOffKes()),
                  d: "No plan, no card on file.",
                },
                {
                  k: "A plan",
                  v: "from " + priceKes(lowestPaidPlanMonthlyKes()),
                  d: "A month. A year costs ten months.",
                },
              ].map((c) => (
                <div key={c.k} className="glass rounded-2xl p-4">
                  <dt className="text-xs text-muted-foreground">{c.k}</dt>
                  <dd className="mt-1 text-xl font-semibold text-primary">{c.v}</dd>
                  <dd className="mt-1 text-xs text-muted-foreground">{c.d}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
              <Link to="/pricing" className="glass rounded-full px-6 py-3 text-sm">
                See all prices
              </Link>
              <a
                href="#hero-map"
                data-testid="launch-cta"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium px-6 py-3 shadow-[0_10px_40px_-10px_rgba(20,123,53,0.55)]"
              >
                Start with a point <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#intelligence" className="glass rounded-full px-6 py-3 text-sm">
                How it works
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative mt-10 border-t border-white/5 overflow-hidden">
        {/* Ambient brand glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(60% 90% at 50% 100%, rgba(20,123,53,0.16), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-14">
          <p
            className="mx-auto mb-8 max-w-2xl text-center text-xs text-muted-foreground"
            data-testid="not-official-disclaimer"
          >
            HALISIA is not a title search, survey, valuation or government system, and has no
            connection to any land registry. It shows user-submitted information, open-data
            indicators and model inferences, each labelled with its source.
          </p>
          <div className="flex flex-col items-center text-center gap-4">
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 blur-2xl opacity-70"
                style={{
                  background:
                    "radial-gradient(closest-side, rgba(192,138,46,0.3), transparent 70%)",
                }}
              />
              <img
                src={halisiaWordmark.url}
                alt="HALISIA.AI — Land Intelligence Platform"
                width={653}
                height={237}
                loading="lazy"
                decoding="async"
                className="h-auto w-[min(280px,64vw)] object-contain drop-shadow-[0_6px_18px_rgba(16,45,26,0.18)]"
              />
            </div>

            <div className="text-[11px] uppercase tracking-[0.28em] text-accent">
              Land · Intelligence · Platform
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <Link to="/compare" search={{ codes: "" }} className="hover:text-white transition">
                Compare
              </Link>
              <Link to="/title-deed" className="hover:text-white transition">
                Title deed
              </Link>
              <a href="#intelligence" className="hover:text-white transition">
                Intelligence
              </a>
              <a href="#how" className="hover:text-white transition">
                How it works
              </a>
              <Link to="/privacy" className="hover:text-white transition">
                Privacy
              </Link>
            </div>
            <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground w-full">
              <div>© {new Date().getFullYear()} HALISIA AI · Land Intelligence Platform</div>
              <div>Built for Kenya. Designed for anywhere.</div>
            </div>
          </div>
        </div>
      </footer>

      <AIOrb />
    </div>
  );
}

const PILLARS = [
  {
    icon: Layers,
    title: "Amenity access",
    body: "Schools, health facilities, shops and transit stops mapped within about 3 km, counted from Google Places.",
  },
  {
    icon: Waves,
    title: "Environment",
    body: "A live air-quality reading, plus ground elevation as a coarse flood proxy. Not a flood study.",
  },
  {
    icon: MapPinned,
    title: "Construction context",
    body: "Elevation banded into a drainage and water-table signal. Bearing capacity still needs a soil test.",
  },
  {
    icon: Brain,
    title: "Reasoning shown",
    body: "Every reading explains why, names the API it came from, and states how confident it is.",
  },
  {
    icon: ShieldCheck,
    title: "What it will not say",
    body: "Title, zoning, utilities, safety and price are named as gaps — never scored from a proxy that happens to be nearby.",
  },
  {
    icon: Users,
    title: "Who to ask next",
    body: "Each gap comes with the office that closes it: Ardhisasa, Kenya Power, the county water board, your surveyor.",
  },
];

const TRUST = [
  { stat: "Cited", label: "every score names its sources" },
  { stat: "Ranked", label: "confidence stated on every output" },
  { stat: "Kenya", label: "first · global by design" },
  { stat: "Never", label: "we do not assert title, boundary or ownership" },
];
const STEPS = [
  {
    icon: Search,
    title: "Search or drop a pin",
    body: "Any town, road, place or lat/lng in Kenya. The 3D map takes you there. Have a title deed? Use the Title Deed tool.",
  },
  {
    icon: MousePointerClick,
    title: "Read the location profile",
    body: "Elevation, air quality, schools, hospitals and transit from the Google Maps Elevation API, the Google Air Quality API and Google Places, with a written read that names its sources and what it could not assess.",
  },
  {
    icon: FileText,
    title: "Download the dossier",
    body: "A printable PDF with map evidence and analysis. Share with your surveyor, lawyer, family, or investor.",
  },
];

/**
 * Illustrative scenarios — not testimonials. No named person, quote or rating
 * is claimed here, because we hold no verified customer statements.
 */
const SCENARIOS = [
  {
    title: "Before wiring a deposit",
    role: "First-time buyer",
    body: "Check elevation and long-rains context against the plot's pin before money moves, so a seasonal flood line shows up on screen rather than after the sale.",
  },
  {
    title: "Buying from abroad",
    role: "Diaspora investor",
    body: "Open the same location profile your family sees on the ground, so a remote conversation runs on shared evidence instead of description.",
  },
  {
    title: "Choosing where to spend a site visit",
    role: "Small developer",
    body: "Confidence bands mark what is thin, so the next trip targets the gaps rather than re-confirming what is already documented.",
  },
];
