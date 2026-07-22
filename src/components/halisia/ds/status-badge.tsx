import type { ReactNode } from "react";
import {
  ShieldCheck,
  Sparkles,
  Landmark,
  Users,
  Crown,
  BadgePlus,
  RefreshCw,
  Clock,
  XCircle,
} from "lucide-react";

export type StatusKind =
  | "verified"
  | "ai"
  | "government"
  | "community"
  | "premium"
  | "new"
  | "updated"
  | "pending"
  | "expired";

const map: Record<
  StatusKind,
  { label: string; icon: React.ElementType; tone: string; ring: string }
> = {
  verified: { label: "Verified", icon: ShieldCheck, tone: "text-emerald-glow", ring: "border-emerald-glow/40 bg-emerald-glow/10" },
  ai: { label: "AI Generated", icon: Sparkles, tone: "text-accent", ring: "border-accent/40 bg-accent/10" },
  government: { label: "Government", icon: Landmark, tone: "text-cyan-glow", ring: "border-cyan-glow/40 bg-cyan-glow/10" },
  community: { label: "Community", icon: Users, tone: "text-foreground/80", ring: "border-white/20 bg-white/5" },
  premium: { label: "Premium", icon: Crown, tone: "text-amber-glow", ring: "border-amber-glow/40 bg-amber-glow/10" },
  new: { label: "New", icon: BadgePlus, tone: "text-emerald-glow", ring: "border-emerald-glow/40 bg-emerald-glow/10" },
  updated: { label: "Updated", icon: RefreshCw, tone: "text-accent", ring: "border-accent/40 bg-accent/10" },
  pending: { label: "Pending", icon: Clock, tone: "text-amber-glow", ring: "border-amber-glow/40 bg-amber-glow/10" },
  expired: { label: "Expired", icon: XCircle, tone: "text-destructive", ring: "border-destructive/40 bg-destructive/10" },
};

/** Canonical status pill used across the platform. */
export function StatusBadge({
  kind,
  children,
  className = "",
}: {
  kind: StatusKind;
  children?: ReactNode;
  className?: string;
}) {
  const cfg = map[kind];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${cfg.tone} ${cfg.ring} ${className}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {children ?? cfg.label}
    </span>
  );
}