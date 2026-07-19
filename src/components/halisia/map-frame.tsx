import { useRouter } from "@tanstack/react-router";
import { ArrowLeft, RotateCw } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { MyLocationButton } from "./my-location-button";

/**
 * Standard responsive wrapper for every map in the app.
 *
 * Mobile-first: renders at a phone-friendly portrait aspect (default 3/4) so
 * maps fit any phone screen without user adjustments. On tablets and desktops
 * it opens up to 16/9. Callers can override with `mobileAspect` / `desktopAspect`.
 *
 * Also renders an optional glassy back button ("Back") that pops router history
 * so viewers can quickly return from a map view to the previous location.
 */
export function MapFrame({
  children,
  showBack = true,
  backLabel = "Back",
  mobileAspect = "aspect-[3/4]",
  desktopAspect = "md:aspect-[16/9]",
  className = "",
  onLocateMe,
  onReload,
}: {
  children: ReactNode;
  showBack?: boolean;
  backLabel?: string;
  mobileAspect?: string;
  desktopAspect?: string;
  className?: string;
  onLocateMe?: (loc: { lat: number; lng: number; accuracy?: number }) => void;
  onReload?: () => void;
}) {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCanGoBack(window.history.length > 1);
  }, []);

  return (
    <div
      data-testid="map-frame"
      className={`relative w-full ${mobileAspect} ${desktopAspect} md:min-h-[420px] rounded-2xl overflow-hidden border border-white/10 bg-[#050d24] ${className}`}
    >
      {children}
      {showBack && canGoBack && (
        <button
          type="button"
          onClick={() => router.history.back()}
          data-testid="map-back-button"
          className="absolute top-3 left-3 z-[401] inline-flex items-center gap-1.5 rounded-full glass-strong border border-white/15 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg hover:bg-white/10 transition"
          aria-label="Go back to previous view"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </button>
      )}
      {onLocateMe && <MyLocationButton onLocate={onLocateMe} className="absolute top-3 right-3" />}
      {onReload && (
        <button
          type="button"
          onClick={async () => {
            setReloading(true);
            try {
              await onReload();
            } finally {
              setTimeout(() => setReloading(false), 600);
            }
          }}
          data-testid="map-reload-button"
          className={`absolute z-[401] inline-flex items-center gap-1.5 rounded-full glass-strong border border-white/15 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg hover:bg-white/10 transition ${
            onLocateMe ? "top-14 right-3" : "top-3 right-3"
          }`}
          aria-label="Reload map tiles"
          title="Reload map"
        >
          <RotateCw className={`h-3.5 w-3.5 text-accent ${reloading ? "animate-spin" : ""}`} />
          Reload
        </button>
      )}
    </div>
  );
}
