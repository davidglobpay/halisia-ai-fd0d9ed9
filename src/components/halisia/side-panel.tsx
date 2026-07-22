import { type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

/**
 * Reusable sliding sidebar that keeps map / underlying content mounted.
 * Right-side drawer on desktop; bottom sheet on mobile.
 */
export function SidePanel({
  open,
  onOpenChange,
  title,
  description,
  width = "md",
  side,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  width?: "sm" | "md" | "lg" | "xl";
  side?: "right" | "bottom";
  children: ReactNode;
}) {
  // On mobile we default to bottom; on desktop right.
  const resolvedSide =
    side ??
    (typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches
      ? "bottom"
      : "right");

  const widthClass =
    resolvedSide === "right"
      ? {
          sm: "sm:!max-w-sm",
          md: "sm:!max-w-md",
          lg: "sm:!max-w-lg",
          xl: "sm:!max-w-xl",
        }[width]
      : "";

  const heightClass = resolvedSide === "bottom" ? "!h-[88vh] rounded-t-3xl" : "!h-full";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={resolvedSide}
        className={`glass-strong border-white/10 bg-[oklch(0.14_0.05_260/0.92)] backdrop-blur-2xl text-foreground ${widthClass} ${heightClass} overflow-y-auto`}
        aria-describedby={description ? undefined : "side-panel-desc"}
      >
        <SheetHeader className="text-left">
          <SheetTitle className="text-lg font-semibold tracking-tight">{title}</SheetTitle>
          <SheetDescription
            id={description ? undefined : "side-panel-desc"}
            className="text-xs text-muted-foreground"
          >
            {description ?? "Panel opens over the map — the map view stays live behind it."}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-3 pb-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}