import { useEffect, useState } from "react";

const SESSION_KEY = "halisia:globe-intro:v1";

/**
 * Globe → Africa → Kenya fly-in.
 *
 * Plays once per browser session, the first time a map view mounts: a gold
 * graticule globe rotates toward Africa, then the camera pushes through to
 * the Kenya silhouette before handing over to the live map underneath.
 * Purely decorative — it never blocks pointer input for long and is skipped
 * entirely under Reduce Motion.
 */
export function GlobeIntro({ label = "Kenya" }: { label?: string }) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    try {
      if (window.sessionStorage.getItem(SESSION_KEY)) return;
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* private mode — play once anyway */
    }
    setPlaying(true);
    const t = window.setTimeout(() => setPlaying(false), 3500);
    return () => window.clearTimeout(t);
  }, []);

  if (!playing) return null;

  return (
    <div
      aria-hidden="true"
      data-testid="globe-intro"
      className="pointer-events-none absolute inset-0 z-[600] grid place-items-center overflow-hidden rounded-[22px] bg-[var(--h-ivory,#f7f3ea)]"
    >
      <svg
        viewBox="0 0 200 200"
        className="halisia-globe-intro h-[70%] w-[70%]"
        role="presentation"
      >
        <g className="halisia-globe-intro-spin" style={{ transformOrigin: "100px 100px" }}>
          <circle
            cx="100"
            cy="100"
            r="78"
            fill="none"
            stroke="var(--h-gold, #c08a2e)"
            strokeOpacity="0.55"
            strokeWidth="0.8"
          />
          {[18, 36, 54, 68].map((r) => (
            <ellipse
              key={r}
              cx="100"
              cy="100"
              rx={r}
              ry="78"
              fill="none"
              stroke="var(--h-gold, #c08a2e)"
              strokeOpacity="0.28"
              strokeWidth="0.6"
            />
          ))}
          {[-52, -26, 0, 26, 52].map((dy) => (
            <ellipse
              key={dy}
              cx="100"
              cy={100 + dy}
              rx={Math.sqrt(Math.max(1, 78 * 78 - dy * dy))}
              ry="4"
              fill="none"
              stroke="var(--h-gold, #c08a2e)"
              strokeOpacity="0.2"
              strokeWidth="0.6"
            />
          ))}
          {/* Africa mass, then the Kenya lozenge the camera lands on */}
          <path
            d="M96 46c10 2 18 8 22 16 5 10 2 20-2 29-4 10-4 20-9 29-5 10-13 18-19 27-4 6-11 7-15 2-5-6-3-15-6-22-4-9-12-16-13-26-1-11 6-21 13-29 8-9 17-19 29-26z"
            fill="var(--h-forest, #102d1a)"
            fillOpacity="0.1"
            stroke="var(--h-forest, #102d1a)"
            strokeOpacity="0.35"
            strokeWidth="0.7"
          />
          <path
            d="M112 92l10 3 4 8-6 9-9 6-8-4-3-9 4-9z"
            fill="var(--h-green, #147b35)"
            fillOpacity="0.35"
            stroke="var(--h-green, #147b35)"
            strokeWidth="0.9"
          />
        </g>
      </svg>
      <span className="absolute bottom-6 font-display text-[11px] uppercase tracking-[0.4em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
