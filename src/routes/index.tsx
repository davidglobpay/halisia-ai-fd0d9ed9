import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
} from "lucide-react";
import { Kenya3DMap } from "@/components/halisia/kenya-3d-map";
import { Navbar } from "@/components/halisia/navbar";
import { SearchBar } from "@/components/halisia/search-bar";
import { AIOrb } from "@/components/halisia/ai-orb";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* HERO */}
      <section className="relative pt-32 md:pt-40 pb-20 md:pb-32 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 grid lg:grid-cols-[1.05fr_1fr] gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 glass rounded-full pl-1 pr-3 py-1 text-xs text-muted-foreground mb-6">
              <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium">
                Kenya · Beta
              </span>
              Land intelligence, not listings.
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-semibold leading-[1.02] tracking-tight">
              <span className="text-gradient">Understand a place</span>
              <br />
              before you commit.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
              HALISIA turns any location into trusted, human-centered intelligence — infrastructure,
              environmental risk, community context and investment signals, with confidence you can
              weigh.
            </p>

            <div className="mt-8 max-w-xl">
              <SearchBar
                size="lg"
                placeholder="Try “Karen, Nairobi” or “Diani beach”"
                onSearch={(q) => navigate({ to: "/explore", search: { q } })}
              />
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="mr-1">Popular:</span>
                {["Kilimani", "Kiambu Road", "Nyali", "Naivasha", "Ruiru"].map((t) => (
                  <button
                    key={t}
                    onClick={() => navigate({ to: "/explore", search: { q: t } })}
                    className="glass rounded-full px-3 py-1 hover:text-foreground transition"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-10 flex items-center gap-6 text-xs text-muted-foreground">
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

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="relative"
          >
            <Kenya3DMap
              onSelect={({ lat, lng }) =>
                navigate({
                  to: "/explore",
                  search: { q: `${lat.toFixed(5)}, ${lng.toFixed(5)}` },
                })
              }
            />
            {/* Floating callouts */}
            <motion.div
              className="hidden md:block absolute top-6 -left-4 glass rounded-2xl p-3 max-w-[200px] animate-float"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
            >
              <div className="text-[10px] uppercase tracking-widest text-accent">Nairobi</div>
              <div className="text-sm mt-0.5">
                Livable score <span className="font-semibold">82</span>
              </div>
              <div className="text-[11px] text-muted-foreground">High infra · Medium flood</div>
            </motion.div>
            <motion.div
              className="hidden md:block absolute bottom-8 -right-2 glass rounded-2xl p-3 max-w-[220px] animate-float"
              style={{ animationDelay: "1.5s" }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.1 }}
            >
              <div className="text-[10px] uppercase tracking-widest text-cyan-glow">Mombasa</div>
              <div className="text-sm mt-0.5">
                Investment trend <span className="font-semibold">+11% YoY</span>
              </div>
              <div className="text-[11px] text-muted-foreground">Confidence: Medium</div>
            </motion.div>
          </motion.div>
        </div>

        {/* subtle grid glow behind */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(oklch(1 0 0 / 0.05) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.05) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />
      </section>

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

      {/* MAP PREVIEW BAND */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="glass-strong rounded-[36px] p-2 relative overflow-hidden">
            <div className="relative rounded-[28px] overflow-hidden border border-white/10 aspect-[16/9] bg-[#0a1735]">
              <div
                className="absolute inset-0 opacity-90"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 30% 30%, oklch(0.68 0.19 249 / 0.35), transparent 60%), radial-gradient(circle at 70% 70%, oklch(0.87 0.14 208 / 0.25), transparent 60%)",
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(oklch(1 0 0 / 0.06) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.06) 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />
              <div className="absolute inset-0 grid place-items-center">
                <Link
                  to="/explore"
                  className="glass-strong rounded-full px-5 py-3 text-sm font-medium inline-flex items-center gap-2 hover:brightness-110 transition"
                >
                  <MapPinned className="h-4 w-4 text-accent" />
                  Open the live map
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* floating chips */}
              {[
                { top: "18%", left: "22%", label: "Karen · 78" },
                { top: "40%", left: "58%", label: "Kilimani · 84" },
                { top: "62%", left: "34%", label: "Ruiru · 71" },
                { top: "30%", left: "80%", label: "Nyali · 76" },
              ].map((c, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 * i }}
                  className="absolute glass rounded-full text-xs px-3 py-1.5 flex items-center gap-1.5"
                  style={{ top: c.top, left: c.left }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                  {c.label}
                </motion.div>
              ))}
            </div>
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
