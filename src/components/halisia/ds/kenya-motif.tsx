import { cn } from "@/lib/utils";

export interface KenyaMotifProps {
  /** "grid" = surveyor grid + contour lines, "shield" = Maasai shield chevrons. */
  variant?: "grid" | "shield";
  className?: string;
}

/**
 * KenyaMotif — decorative, non-interactive identity texture. Controlled
 * geometry only: survey grid, contour arcs and shield chevrons at very low
 * opacity. No neon, no animation.
 */
export function KenyaMotif({ variant = "grid", className }: KenyaMotifProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]",
        variant === "grid" ? "kenya-motif" : "kenya-motif-shield",
        className,
      )}
    />
  );
}

export default KenyaMotif;
