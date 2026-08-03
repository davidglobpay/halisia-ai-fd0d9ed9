import { forwardRef, type HTMLAttributes, type ElementType } from "react";
import { cn } from "@/lib/utils";

export type Elevation = 1 | 2 | 3;
export type EdgeTone = "none" | "green" | "red" | "gold" | "silver";

const elevClass: Record<Elevation, string> = {
  1: "elev-1",
  2: "elev-2",
  3: "elev-3",
};

const edgeClass: Record<EdgeTone, string> = {
  none: "",
  green: "edge-green",
  red: "edge-red",
  gold: "edge-gold",
  silver: "edge-silver",
};

const padClass = {
  none: "",
  sm: "p-3 sm:p-4",
  md: "p-4 sm:p-5",
  lg: "p-6 sm:p-8",
} as const;

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  /** Elevation level from the Halisia design system (1 = quiet, 3 = premium). */
  elevation?: Elevation;
  /** Restrained luminous edge. Use sparingly — one accent per view. */
  edge?: EdgeTone;
  padding?: keyof typeof padClass;
  /** Adds the Kenya geometric motif as a non-interactive texture. */
  motif?: boolean;
  /** Hover lift + press feedback (respects Reduce Motion globally). */
  interactive?: boolean;
  as?: ElementType;
}

/**
 * Surface — the single glass container primitive. Every panel, card and tile
 * in Halisia should be a Surface so blur, radius, border and motion stay
 * identical across screens.
 */
export const Surface = forwardRef<HTMLElement, SurfaceProps>(function Surface(
  {
    elevation = 2,
    edge = "none",
    padding = "md",
    motif = false,
    interactive = false,
    as,
    className,
    children,
    ...rest
  },
  ref,
) {
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag
      ref={ref}
      data-elevation={elevation}
      className={cn(
        elevClass[elevation],
        edgeClass[edge],
        padClass[padding],
        motif && "kenya-motif",
        interactive && "motion-lift cursor-pointer active:scale-[0.995]",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
});

export default Surface;
