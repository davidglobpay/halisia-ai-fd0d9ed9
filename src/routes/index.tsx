import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  Quote,
  Star,
} from "lucide-react";
import { KenyaCountyMap } from "@/components/halisia/kenya-county-map";
import { SearchBar } from "@/components/halisia/search-bar";
import { AIOrb } from "@/components/halisia/ai-orb";
import { DataPipeline } from "@/components/halisia/data-pipeline";
import { ScoreDrivers } from "@/components/halisia/score-drivers";
import {
  PulseWindow,
  CountyListSection,
  CountyComparisonSection,
  MarketplaceSection,
  ContributorAndDashboardSection,
} from "@/components/halisia/landing-sections";
import { recordSearchConversion } from "@/lib/analytics";
import halisiaSymbol from "@/assets/brand/halisia-mark.png.asset.json";
import halisiaWordmark from "@/assets/brand/halisia-lockup.png.asset.json";

export const Route = createFileRoute("/")({
  validateSearch: (s) => z.object({ compare: fallback(z.string(), "").default("") }).parse(s),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  return <LandingBody navigate={navigate} />;
}

/**
 * Cinematic hero stage. The intro film never auto-plays on first load: the
 * poster frame is shown instead and the visitor opts in. On save-data,
 * slow connections, reduced-motion or blocked autoplay we stay on the still.
 */
function HeroStage({ children }: { children?: ReactNode }) {
  return (
    <div className="relative w-full overflow-hidden aspect-[3/4] sm:aspect-[16/10] md:aspect-[21/9] max-h-[92vh]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,oklch(0.34_0.09_240)_0%,oklch(0.19_0.06_255)_45%,oklch(0.13_0.04_260)_100%)]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,30,61,0.55)_0%,rgba(7,30,61,0.2)_38%,rgba(7,30,61,0.7)_100%)]"
      />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(1 0 0 / 0.35) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.35) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
        }}
      />
      <div className="absolute inset-0 flex flex-col justify-end sm:justify-center">
        <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:pb-0">{children}</div>
      </div>
    </div>
  );
}

function LandingBody({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <div className="min-h-screen">
      {/* HERO — static cinematic stage (videos removed) */}
      <section className="relative pt-20 md:pt-24 overflow-hidden">
        <HeroStage>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="mx-auto flex max-w-3xl flex-col items-center text-center"
          >
            {/* Cinematic 3D hero logo — layered halo, chromatic aberration
                shadows, and a slow parallax tilt for depth. */}
            <div className="relative mb-6 flex items-center justify-center [perspective:1200px]">
              {/* Outer halo */}
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 blur-3xl opacity-90 animate-pulse"
                style={{
                  background:
                    "radial-gradient(closest-side, oklch(0.78 0.17 210 / 0.65), oklch(0.55 0.18 260 / 0.35) 55%, transparent 75%)",
                }}
              />
              {/* Rotating conic aura */}
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 blur-2xl opacity-40 animate-[spin_18s_linear_infinite]"
                style={{
                  background:
                    "conic-gradient(from 0deg, oklch(0.78 0.16 210 / 0.6), oklch(0.72 0.19 45 / 0.35), oklch(0.55 0.18 260 / 0.55), oklch(0.78 0.16 210 / 0.6))",
                  borderRadius: "50%",
                }}
              />
              <img
                src={halisiaSymbol.url}
                alt="HALISIA.AI"
                width={200}
                height={200}
                decoding="async"
                fetchPriority="high"
                className="relative h-28 w-28 sm:h-36 sm:w-36 md:h-44 md:w-44 object-contain [transform:rotateX(6deg)] drop-shadow-[0_10px_28px_oklch(0.15_0.05_260/0.75)] [filter:drop-shadow(0_0_18px_oklch(0.78_0.17_210/0.55))_drop-shadow(0_0_36px_oklch(0.55_0.18_260/0.35))]"
              />
              {/* Specular highlight sweep */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-40 rounded-full"
                style={{
                  background:
                    "linear-gradient(120deg, transparent 40%, rgba(255,255,255,0.35) 50%, transparent 60%)",
                }}
              />
            </div>
            <img
              src={halisiaWordmark.url}
              alt="HALISIA.AI — Land Intelligence Engine"
              width={653}
              height={237}
              decoding="async"
              className="mb-5 h-auto w-[min(340px,72vw)] object-contain drop-shadow-[0_8px_24px_oklch(0.14_0.05_260/0.75)]"
            />
            <div className="mb-4 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-white/75">
              <span className="h-px w-8 bg-white/30" />
              Kenya · Beta · Land Intelligence
              <span className="h-px w-8 bg-white/30" />
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-semibold leading-[1.02] tracking-tight text-white [text-shadow:0_2px_30px_oklch(0.14_0.05_260/0.7)]">
              <span className="text-gradient">Understand Every</span>
              <br />
              County.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base md:text-lg text-white/85 leading-relaxed [text-shadow:0_1px_16px_oklch(0.14_0.05_260/0.8)]">
              Land. People. Infrastructure. Risk. Opportunity.
              <br className="hidden sm:inline" /> Powered by Artificial Intelligence.
            </p>

            <div className="mx-auto mt-6 w-full max-w-xl">
              <SearchBar
                size="lg"
                placeholder="Search a county, town, parcel, LR number, ward, or coordinates…"
                onSearch={(q) => {
                  recordSearchConversion();
                  navigate({ to: "/explore", search: { q } });
                }}
              />
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Link
                  to="/"
                  hash="counties"
                  search={{ compare: "" }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[oklch(0.77_0.14_220)] to-[oklch(0.44_0.13_250)] text-primary-foreground px-4 py-2 text-xs font-semibold shadow-[0_10px_30px_-10px_oklch(0.77_0.14_220/0.7)] hover:scale-[1.03] transition"
                >
                  Explore Counties <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to="/explore"
                  className="inline-flex items-center gap-1.5 rounded-full glass border border-white/20 px-4 py-2 text-xs font-medium text-white hover:bg-white/10 transition"
                >
                  View Intelligence Dashboard
                </Link>
                <Link
                  to="/spatial"
                  search={{ parcel: "" }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-4 py-2 text-xs font-semibold text-white hover:bg-[#D4AF37]/25 transition"
                >
                  Spatial AR Studio
                </Link>
                <a
                  href="#how"
                  className="inline-flex items-center gap-1.5 rounded-full glass border border-white/20 px-4 py-2 text-xs font-medium text-white hover:bg-white/10 transition"
                >
                  Watch Demo
                </a>
              </div>
              <div className="mt-3 hidden sm:flex flex-wrap justify-center gap-2 text-xs text-white/80">
                <span className="mr-1">Popular:</span>
                {["Kilimani", "Kiambu Road", "Nyali", "Naivasha", "Ruiru"].map((t) => (
                  <button
                    key={t}
                    onClick={() => navigate({ to: "/explore", search: { q: t } })}
                    className="glass rounded-full px-3 py-1 hover:text-white transition"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 hidden md:flex items-center justify-center gap-6 text-xs text-white/75">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-accent" /> Confidence-scored
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" /> Community-verified
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-accent" /> Never legal advice
              </div>
            </div>
          </motion.div>
        </HeroStage>
      </section>

      {/* HALISIA PULSE WINDOW */}
      <PulseWindow />

      {/* COUNTY INTELLIGENCE MAP */}
      <KenyaCountyMap />

      {/* COUNTY DIRECTORY + COMPARISON */}
      <CountyListSection />
      <CountyComparisonSection />

      {/* MARKETPLACE LISTINGS */}
      <MarketplaceSection />

      {/* CONTRIBUTOR PLATFORM + DASHBOARD */}
      <ContributorAndDashboardSection />

      <div className="mx-auto max-w-7xl px-4 pt-8">
        <div className="text-[11px] uppercase tracking-[0.25em] text-accent">
          How the HALISIA AI engine works
        </div>
      </div>

      {/* INTELLIGENCE PILLARS */}
      <section id="intelligence" className="py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-4">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-[0.25em] text-accent">
              Intelligence Engine
            </div>
            <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight">
              Every location, translated into{" "}
              <span className="text-gradient">signals you can trust</span>.
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              We fuse satellite data, infrastructure records, environmental models and community
              observations — then let AI structure them into a profile with reasoning and
              uncertainty.
            </p>
          </div>

          <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PILLARS.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: i * 0.06 }}
                className="glass rounded-3xl p-6 relative overflow-hidden"
              >
                <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full blur-3xl opacity-30 bg-gradient-to-br from-primary to-accent" />
                <div className="h-11 w-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <p.icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{p.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section id="trust" className="py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-4 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-accent">
              Trust before automation
            </div>
            <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight">
              AI that shows its work — and its uncertainty.
            </h2>
            <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
              Every score comes with evidence, confidence level and what we don't yet know. We won't
              tell you a plot is “safe” or “legal” — we'll show you what we found and recommend when
              to bring in a surveyor, lawyer or local expert.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {[
                "Reasoning shown",
                "Confidence Low/Med/High",
                "Sources cited",
                "Community-weighted",
              ].map((t) => (
                <span key={t} className="glass rounded-full px-3.5 py-1.5 text-xs">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {TRUST.map((t, i) => (
              <motion.div
                key={t.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="glass rounded-2xl p-4"
              >
                <div className="text-3xl font-semibold tracking-tight text-gradient">{t.stat}</div>
                <div className="mt-1 text-sm text-muted-foreground">{t.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

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

      <DataPipeline />
      <ScoreDrivers />

      {/* TESTIMONIALS */}
      <section id="voices" className="py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-[0.25em] text-accent">Field voices</div>
            <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight">
              Built with buyers, builders, and diaspora investors.
            </h2>
          </div>
          <div className="mt-14 grid md:grid-cols-3 gap-4">
            {VOICES.map((v, i) => (
              <motion.div
                key={v.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass rounded-3xl p-6 flex flex-col"
              >
                <Quote className="h-5 w-5 text-accent" />
                <p className="mt-3 text-sm leading-relaxed text-foreground/90 flex-1">
                  "{v.quote}"
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-semibold text-primary-foreground">
                    {v.name
                      .split(" ")
                      .map((s) => s[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{v.name}</div>
                    <div className="text-[11px] text-muted-foreground">{v.role}</div>
                  </div>
                  <div className="ml-auto flex items-center gap-0.5 text-amber-glow">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star key={s} className="h-3 w-3 fill-current" />
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING / CTA */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-5xl px-4">
          <div className="glass-strong rounded-[36px] p-10 md:p-16 text-center relative overflow-hidden">
            <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl opacity-40 bg-primary" />
            <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full blur-3xl opacity-40 bg-accent" />
            <Sparkles className="h-8 w-8 text-accent mx-auto" />
            <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight">
              Start with any place in Kenya.
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Free intelligence profile for every location. Premium reports include deeper
              environmental, legal-context and construction feasibility signals with cited sources.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link
                to="/explore"
                data-testid="launch-cta"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium px-6 py-3 shadow-[0_10px_40px_-10px_oklch(0.68_0.19_249)]"
              >
                Launch HALISIA <ArrowRight className="h-4 w-4" />
              </Link>
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
              "radial-gradient(60% 90% at 50% 100%, oklch(0.55 0.16 220 / 0.28), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-14">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 blur-2xl opacity-70"
                style={{
                  background:
                    "radial-gradient(closest-side, oklch(0.75 0.16 210 / 0.55), transparent 70%)",
                }}
              />
              <img
                src={halisiaSymbol.url}
                alt="HALISIA — Land Intelligence"
                width={72}
                height={72}
                loading="lazy"
                decoding="async"
                className="h-16 w-16 object-contain drop-shadow-[0_0_18px_oklch(0.75_0.16_210/0.6)]"
              />
            </div>
            <div className="text-sm font-semibold tracking-[0.32em] text-white/90">
              H A L I S I A
            </div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-accent">
              Land · Intelligence · Platform
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <Link to="/explore" className="hover:text-white transition">
                Explore
              </Link>
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
            </div>
            <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground w-full">
              <div>© {new Date().getFullYear()} HALISIA AI · Land Intelligence Platform</div>
              <div>Built for Kenya. Designed for anywhere.</div>
            </div>
          </div>
        </div>
      </footer>

      <Link
        to="/explore"
        preload="intent"
        className="fixed z-50 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-5 py-3 text-sm font-semibold shadow-[0_8px_32px_-8px_oklch(0.68_0.19_249)] hover:brightness-110 hover:scale-105 transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background left-4 sm:left-6 bottom-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-6"
        aria-label="Launch HALISIA intelligence workspace"
        title="Launch HALISIA app"
      >
        <span className="hidden xs:inline sm:inline">Launch app</span>
        <span className="sm:hidden">Launch</span>
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>

      <AIOrb />
    </div>
  );
}

const PILLARS = [
  {
    icon: Layers,
    title: "Infrastructure",
    body: "Roads, water, power, fibre — mapped and scored with source confidence.",
  },
  {
    icon: Waves,
    title: "Environmental risk",
    body: "Flooding, terrain, elevation and long-rain vulnerability, modelled per parcel.",
  },
  {
    icon: ShieldCheck,
    title: "Safety & stability",
    body: "Perceived safety and community context, weighted by contributor reputation.",
  },
  {
    icon: Users,
    title: "Community intelligence",
    body: "Photos, voice notes, and stories from people who actually live nearby.",
  },
  {
    icon: Brain,
    title: "AI reasoning",
    body: "Every score explains why. Uncertainty is a first-class citizen.",
  },
  {
    icon: MapPinned,
    title: "Investment signals",
    body: "Growth corridors, price trend, development pipeline — never as absolute truth.",
  },
];

const TRUST = [
  { stat: "40+", label: "signal categories per location" },
  { stat: "3-tier", label: "confidence on every score" },
  { stat: "Kenya", label: "first · global by design" },
  { stat: "0", label: "hidden auto-decisions" },
];

const STEPS = [
  {
    icon: Search,
    title: "Search or drop a pin",
    body: "Any town, road, plot number, or lat/lng in Kenya. The 3D map takes you there.",
  },
  {
    icon: MousePointerClick,
    title: "See live intelligence",
    body: "Real Google Maps signals — elevation, air quality, schools, hospitals, transit — plus an AI reading with strengths, watch-outs, and next steps.",
  },
  {
    icon: FileText,
    title: "Download the dossier",
    body: "A printable PDF with map evidence and analysis. Share with your surveyor, lawyer, family, or investor.",
  },
];

const VOICES = [
  {
    name: "Achieng O.",
    role: "First-time buyer · Kiambu",
    quote:
      "I was about to wire the deposit for a plot that turned out to be in a seasonal flood line. HALISIA showed the elevation and long-rains context in one screen.",
  },
  {
    name: "Brian K.",
    role: "Diaspora investor · Houston",
    quote:
      "I can't fly home for every viewing. Pulling up the same intelligence my cousin sees on the ground makes the conversation honest, fast, and quantitative.",
  },
  {
    name: "Wanjiru M.",
    role: "Small developer · Ruaka",
    quote:
      "The confidence bands are the killer feature. It doesn't pretend to know everything — it tells me exactly where to spend my next site visit.",
  },
];
