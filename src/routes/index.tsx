import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { fallback } from "@tanstack/zod-adapter";
import { motion } from "framer-motion";
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
import { Navbar } from "@/components/halisia/navbar";
import { SearchBar } from "@/components/halisia/search-bar";
import { AIOrb } from "@/components/halisia/ai-orb";
import { HeroVideoCarousel } from "@/components/halisia/hero-video-carousel";
import halisiaLogo from "@/assets/halisia-logo.png.asset.json";

export const Route = createFileRoute("/")({
  validateSearch: (s) => z.object({ compare: fallback(z.string(), "").default("") }).parse(s),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* HERO — cinematic video carousel */}
      <section className="relative pt-20 md:pt-24 overflow-hidden">
        <HeroVideoCarousel>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="mx-auto flex max-w-3xl flex-col items-center text-center"
          >
            {/* Centered logo with outer glow, transparent background */}
            <div className="relative mb-6 flex items-center justify-center">
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 blur-3xl opacity-80"
                style={{
                  background:
                    "radial-gradient(closest-side, oklch(0.75 0.16 210 / 0.55), oklch(0.55 0.18 260 / 0.35) 60%, transparent 75%)",
                }}
              />
              <img
                src={halisiaLogo.url}
                alt="HALISIA"
                width={168}
                height={168}
                decoding="async"
                fetchPriority="high"
                className="h-24 w-24 sm:h-32 sm:w-32 md:h-40 md:w-40 object-contain drop-shadow-[0_0_28px_oklch(0.75_0.16_210/0.7)]"
              />
            </div>
            <div className="mb-4 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-white/75">
              <span className="h-px w-8 bg-white/30" />
              Kenya · Beta · Land Intelligence
              <span className="h-px w-8 bg-white/30" />
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-semibold leading-[1.02] tracking-tight text-white [text-shadow:0_2px_30px_oklch(0.14_0.05_260/0.7)]">
              <span className="text-gradient">Understand a place</span>
              <br />
              before you commit.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base md:text-lg text-white/85 leading-relaxed [text-shadow:0_1px_16px_oklch(0.14_0.05_260/0.8)]">
              HALISIA turns any location into trusted, human-centered intelligence — infrastructure,
              environmental risk, community context and investment signals, with confidence you can
              weigh.
            </p>

            <div className="mx-auto mt-6 w-full max-w-xl">
              <SearchBar
                size="lg"
                placeholder="Try “Karen, Nairobi” or “Diani beach”"
                onSearch={(q) => navigate({ to: "/explore", search: { q } })}
              />
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
        </HeroVideoCarousel>
      </section>

      {/* COUNTY INTELLIGENCE MAP */}
      <KenyaCountyMap />

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

      <footer className="py-10 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>© {new Date().getFullYear()} HALISIA AI · Land Intelligence Platform</div>
          <div>Built for Kenya. Designed for anywhere.</div>
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
