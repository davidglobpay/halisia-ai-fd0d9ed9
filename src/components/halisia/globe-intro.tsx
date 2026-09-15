import { useCallback, useEffect, useState } from "react";
import { CesiumGlobe } from "@/components/halisia/cesium-globe";

const SESSION_KEY = "halisia:globe-intro:v2";

/**
 * Satellite globe → Africa → Kenya fly-in.
 *
 * Plays once per browser session and hands over to the county map. The streamed
 * imagery is provider-controlled and is not represented as live or cadastral.
 * Reduced-motion users skip the flight and see the map immediately.
 */
export function GlobeIntro({ label = "Kenya" }: { label?: string }) {
  const [playing, setPlaying] = useState(() => {
    if (typeof window === "undefined") return false;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
    try {
      return window.sessionStorage.getItem(SESSION_KEY) !== "1";
    } catch {
      return true;
    }
  });

  const finish = useCallback(() => setPlaying(false), []);

  useEffect(() => {
    if (!playing || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* private mode — the fail-safe still hands over to the map */
    }

    // Network/CDN failure must never leave the county map blocked.
    const fallback = window.setTimeout(finish, 9_000);
    return () => window.clearTimeout(fallback);
  }, [finish, playing]);

  if (!playing) return null;

  return (
    <div
      data-testid="globe-intro"
      className="absolute inset-0 z-[600] overflow-hidden rounded-[22px] bg-[#050d24]"
    >
      <CesiumGlobe
        lat={-0.0236}
        lng={37.9062}
        label={label}
        intro
        bare
        onFlightComplete={finish}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/65 to-transparent px-4 py-4 text-center">
        <div className="text-[10px] uppercase tracking-[0.32em] text-white/75">
          Earth · Africa · Kenya
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/75 to-transparent px-4 pb-8 pt-12 text-center">
        <div className="font-display text-sm text-white">{label}</div>
        <div className="mt-1 text-[9px] uppercase tracking-[0.22em] text-white/65">
          Satellite imagery · provider dates and coverage vary
        </div>
      </div>
    </div>
  );
}
