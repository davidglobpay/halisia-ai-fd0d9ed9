import { useEffect, useState } from "react";

const SESSION_KEY = "halisia:globe-intro:v1";
const DURATION_MS = 3500;

/** Stage labels shown as the globe animation flies in, in timeline order. */
const STAGES = [
  { at: 0, label: "World" },
  { at: 0.24, label: "Africa" },
  { at: 0.48, label: "Kenya" },
  { at: 0.7, label: "Kenya · counties" },
  { at: 0.88, label: "Nairobi" },
] as const;

/**
 * Globe → continents → Africa → Kenya → counties → Nairobi fly-in.
 *
 * Plays once per browser session, the first time a map view mounts: a gold
 * graticule globe rotates and the camera pushes in through a fixed sequence
 * of labelled stages (World, Africa, Kenya, Kenya's counties, Nairobi)
 * before handing over to the live map underneath. Purely decorative — it
 * never blocks pointer input for long, is a single lightweight inline SVG
 * (no extra assets, no WebGL) so it costs nothing extra on mobile, and is
 * skipped entirely under Reduce Motion.
 */
export function GlobeIntro({
  label,
  finalLabel = "Kenya",
}: {
  label?: string;
  finalLabel?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      return;
    }
    try {
      if (window.sessionStorage.getItem(SESSION_KEY)) {
        return;
      }
    } catch {
      /* Private mode — play when visible anyway. */
    }

    setPlaying(true);
    setStageIndex(0);
    const timers = STAGES.slice(1).map((stage, i) =>
      window.setTimeout(() => setStageIndex(i + 1), Math.round(stage.at * DURATION_MS)),
    );
    const end = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* Session storage is optional. */
      }
      setPlaying(false);
    }, DURATION_MS);
    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(end);
    };
  }, []);

  if (!playing) return null;

  const currentLabel =
    STAGES[stageIndex].label === finalLabel ? finalLabel : (label ?? STAGES[stageIndex].label);

  return (
    <div
      aria-hidden="true"
      data-testid="globe-intro"
      data-stage={STAGES[stageIndex].label}
      className="halisia-globe-scene pointer-events-none absolute inset-0 z-[600] grid place-items-center overflow-hidden rounded-[22px] bg-background"
    >
      <div className="halisia-globe-stars absolute inset-0" />
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
          {/* Simplified continent silhouettes establish a whole-world view. */}
          <g className="halisia-globe-continents">
            <path d="M47 58l14-14 22-6 10 9-7 12-12 4-5 17-14 8-10-12z" />
            <path d="M72 91l14 8 4 22-8 31-10-10-5-28z" />
            <path d="M107 45l18-8 31 12 8 16-18 9-14 18-18-8-10-19z" />
            <path d="M147 122l16 4 8 14-11 13-17-8z" />
          </g>
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
          {/* County-like subdivisions appear only during the Kenya stages. */}
          {stageIndex >= 3 && (
            <g className="halisia-kenya-counties" aria-hidden="true">
              <path d="M106 99l17 2M104 105l19 2M108 112l12-17M114 116l2-21" />
            </g>
          )}
          {/* Nairobi marker — only visible once the camera reaches the city stage */}
          {stageIndex >= STAGES.length - 1 && (
            <g className="halisia-nairobi-marker">
              <circle cx="116" cy="103" r="2.4" />
              <circle cx="116" cy="103" r="5" fill="none" />
            </g>
          )}
        </g>
      </svg>
      <span
        key={stageIndex}
        data-testid="globe-intro-label"
        className="halisia-globe-intro-label absolute bottom-6 font-display text-[11px] uppercase tracking-[0.4em] text-muted-foreground"
      >
        {currentLabel}
      </span>
    </div>
  );
}
