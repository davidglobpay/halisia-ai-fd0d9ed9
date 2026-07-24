import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "emerald" | "crimson" | "gold" | "silver";
type Size = "sm" | "md" | "lg";

const toneRing: Record<Tone, string> = {
  neutral: "",
  emerald:
    "shadow-[0_0_0_1px_rgba(34,197,94,0.25),0_0_40px_rgba(14,124,58,0.18)] hover:shadow-[0_0_0_1px_rgba(34,197,94,0.45),0_0_60px_rgba(14,124,58,0.28)]",
  crimson:
    "shadow-[0_0_0_1px_rgba(244,63,94,0.25),0_0_40px_rgba(200,16,46,0.18)] hover:shadow-[0_0_0_1px_rgba(244,63,94,0.45),0_0_60px_rgba(200,16,46,0.28)]",
  gold: "shadow-[0_0_0_1px_rgba(212,160,23,0.35),0_0_40px_rgba(212,160,23,0.22)] hover:shadow-[0_0_0_1px_rgba(212,160,23,0.55),0_0_60px_rgba(212,160,23,0.32)]",
  silver:
    "shadow-[0_0_0_1px_rgba(199,206,214,0.25),0_0_24px_rgba(199,206,214,0.18)] hover:shadow-[0_0_0_1px_rgba(199,206,214,0.4),0_0_36px_rgba(199,206,214,0.28)]",
};

const sizePad: Record<Size, string> = {
  sm: "p-3 sm:p-4",
  md: "p-4 sm:p-5",
  lg: "p-6 sm:p-8",
};

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  size?: Size;
  strong?: boolean;
  interactive?: boolean;
  as?: "div" | "section" | "article" | "aside";
  children?: ReactNode;
}

/**
 * GlassCard — unified glass surface for cards, dashboards, and content tiles.
 * Consistent blur, border, radius, and tone-based glow. Preserves any extra
 * className the caller passes.
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  {
    tone = "neutral",
    size = "md",
    strong = false,
    interactive = false,
    as = "div",
    className,
    children,
    ...rest
  },
  ref,
) {
  const Tag = as as "div";
  return (
    <Tag
      ref={ref}
      className={cn(
        strong ? "glass-strong" : "glass",
        sizePad[size],
        toneRing[tone],
        "transition-all duration-200 ease-out",
        interactive && "hover:-translate-y-0.5 hover:scale-[1.01] active:scale-[0.99]",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
});

/**
 * GlassPanel — full-bleed glass surface for modals, sheets, sidebars, and
 * dashboard shells. Same tokens as GlassCard, larger radius/padding by
 * default and stronger blur.
 */
export const GlassPanel = forwardRef<HTMLDivElement, GlassCardProps>(function GlassPanel(
  { tone = "neutral", size = "lg", strong = true, className, children, ...rest },
  ref,
) {
  return (
    <GlassCard
      ref={ref}
      tone={tone}
      size={size}
      strong={strong}
      className={cn("rounded-3xl", className)}
      {...rest}
    >
      {children}
    </GlassCard>
  );
});

export default GlassCard;