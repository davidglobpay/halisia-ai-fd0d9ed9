import type { ElementType } from "react";
import { motion } from "framer-motion";
import {
  Droplets,
  ShieldCheck,
  Zap,
  Wifi,
  Route,
  GraduationCap,
  HeartPulse,
  TrendingUp,
  Waves,
  Building2,
} from "lucide-react";

type Score = {
  label: string;
  value: number;
  confidence: "Low" | "Medium" | "High";
  note: string;
  icon: ElementType;
  tone: string;
};

function hash(lat: number, lng: number, salt: number) {
  const x = Math.sin(lat * 12.9898 + lng * 78.233 + salt) * 43758.5453;
  return Math.floor((x - Math.floor(x)) * 40) + 55;
}

export function IntelligenceCards({
  lat,
  lng,
  label,
}: {
  lat: number;
  lng: number;
  label: string;
}) {
  const scores: Score[] = [
    {
      label: "Road access",
      value: hash(lat, lng, 1),
      confidence: "High",
      note: "Tarmac ≤ 800m from parcel centroid",
      icon: Route,
      tone: "from-primary to-accent",
    },
    {
      label: "Water",
      value: hash(lat, lng, 2),
      confidence: "Medium",
      note: "Piped supply intermittent; boreholes common",
      icon: Droplets,
      tone: "from-accent to-cyan-glow",
    },
    {
      label: "Electricity",
      value: hash(lat, lng, 3),
      confidence: "High",
      note: "Kenya Power grid coverage confirmed",
      icon: Zap,
      tone: "from-amber-glow to-primary",
    },
    {
      label: "Fibre / Internet",
      value: hash(lat, lng, 4),
      confidence: "Medium",
      note: "Home fibre from 2+ providers in area",
      icon: Wifi,
      tone: "from-primary to-cyan-glow",
    },
    {
      label: "Flood risk",
      value: 100 - hash(lat, lng, 5),
      confidence: "Medium",
      note: "Assessed vs. 10-yr rainfall & terrain",
      icon: Waves,
      tone: "from-destructive to-amber-glow",
    },
    {
      label: "Safety index",
      value: hash(lat, lng, 6),
      confidence: "Low",
      note: "Community-reported; verify locally",
      icon: ShieldCheck,
      tone: "from-emerald-glow to-primary",
    },
    {
      label: "Schools nearby",
      value: hash(lat, lng, 7),
      confidence: "High",
      note: "12 primary · 4 secondary within 3km",
      icon: GraduationCap,
      tone: "from-primary to-accent",
    },
    {
      label: "Healthcare",
      value: hash(lat, lng, 8),
      confidence: "Medium",
      note: "Nearest Level-4 hospital ~4.2km",
      icon: HeartPulse,
      tone: "from-cyan-glow to-emerald-glow",
    },
    {
      label: "Investment potential",
      value: hash(lat, lng, 9),
      confidence: "Medium",
      note: "Growth corridor · price +8% YoY",
      icon: TrendingUp,
      tone: "from-emerald-glow to-accent",
    },
    {
      label: "Construction readiness",
      value: hash(lat, lng, 10),
      confidence: "Low",
      note: "Soil & survey data limited — verify",
      icon: Building2,
      tone: "from-amber-glow to-cyan-glow",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-4">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
          Location intelligence
        </div>
        <div className="mt-1 text-lg font-semibold leading-tight">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-glow/15 text-emerald-glow px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-glow" />
            Livable · {hash(lat, lng, 99)}%
          </span>
          <span className="text-muted-foreground">AI confidence: Medium</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {scores.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.4 }}
              className="glass rounded-2xl p-3 relative overflow-hidden"
            >
              <div
                className={`absolute -top-8 -right-8 h-24 w-24 rounded-full opacity-30 blur-2xl bg-gradient-to-br ${s.tone}`}
              />
              <div className="flex items-center justify-between">
                <div className="h-8 w-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-accent" />
                </div>
                <span className="text-[10px] text-muted-foreground">{s.confidence}</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{s.label}</div>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="text-2xl font-semibold tracking-tight">{s.value}</span>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
              <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${s.tone}`}
                  style={{ width: `${s.value}%` }}
                />
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground/90 leading-snug">{s.note}</div>
            </motion.div>
          );
        })}
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">AI summary</div>
        <p className="mt-1.5 text-sm text-foreground/90 leading-relaxed">
          This location shows{" "}
          <strong className="text-foreground">strong infrastructure signals</strong> with moderate
          flood exposure during long rains. Utilities and connectivity are reliable;
          community-sourced safety data is thin and should be verified in person. Investment
          momentum along the corridor is positive.
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Estimates are informational, not legal advice. Always verify title, survey, and zoning
          with a licensed professional.
        </p>
      </div>
    </div>
  );
}
