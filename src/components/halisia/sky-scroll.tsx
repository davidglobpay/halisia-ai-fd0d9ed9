import { useEffect, useRef } from "react";

/**
 * A full-page sky that moves from dawn to night as the page scrolls, and back
 * again on the way up. Everything is driven by one rAF loop writing directly to
 * refs, so React never re-renders while scrolling.
 *
 * Phases, evenly spaced across scroll progress:
 *   0.00 first light   0.25 sunrise   0.50 clear day   0.75 sunset   1.00 night
 */

type Phase = {
  /** Sky gradient, top to horizon. */
  sky: [string, string, string];
  /** Sun or moon disc colour and glow. */
  disc: string;
  glow: string;
  /** How much of the disc is the moon rather than the sun (0 to 1). */
  moon: number;
  /** Star opacity. */
  stars: number;
  /** Cloud opacity. */
  clouds: number;
  /** Hills, far to near. */
  hills: [string, string, string];
};

const PHASES: Phase[] = [
  {
    sky: ["#101c33", "#3d3350", "#8a5a54"],
    disc: "#f0c98b",
    glow: "rgba(240,201,139,0.35)",
    moon: 0.7,
    stars: 0.55,
    clouds: 0.35,
    hills: ["#2c3347", "#1d2532", "#121820"],
  },
  {
    sky: ["#5b7fb8", "#c38f7a", "#f0b464"],
    disc: "#ffd89b",
    glow: "rgba(255,196,107,0.55)",
    moon: 0,
    stars: 0.08,
    clouds: 0.85,
    hills: ["#5c6f63", "#33463c", "#18261d"],
  },
  {
    sky: ["#3f7fd0", "#84b4e4", "#d8e6f2"],
    disc: "#fff6d8",
    glow: "rgba(255,246,216,0.5)",
    moon: 0,
    stars: 0,
    clouds: 0.75,
    hills: ["#7c9584", "#41684e", "#1c3325"],
  },
  {
    sky: ["#2f4a72", "#b8683f", "#e8a04a"],
    disc: "#ffb765",
    glow: "rgba(255,150,70,0.55)",
    moon: 0,
    stars: 0.12,
    clouds: 0.7,
    hills: ["#4e5a5e", "#2f3b3a", "#151f1c"],
  },
  {
    sky: ["#060d1c", "#0d1b2f", "#1b2d3f"],
    disc: "#e8eef5",
    glow: "rgba(216,229,245,0.32)",
    moon: 1,
    stars: 1,
    clouds: 0.18,
    hills: ["#16202c", "#0f1720", "#080c11"],
  },
];

const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/** Blends two hex colours; t of 0 returns a, t of 1 returns b. */
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const round = (x: number) => Math.round(x);
  return `rgb(${round(r1 + (r2 - r1) * t)}, ${round(g1 + (g2 - g1) * t)}, ${round(b1 + (b2 - b1) * t)})`;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smooth start and end, so phase changes never snap. */
const ease = (t: number) => t * t * (3 - 2 * t);

const STARS = Array.from({ length: 70 }, (_, i) => {
  // Deterministic scatter, so the sky looks the same on every render and on the server.
  const x = ((i * 137.508) % 100).toFixed(2);
  const y = ((i * 61.803) % 62).toFixed(2);
  const r = (0.5 + ((i * 7) % 5) / 6).toFixed(2);
  return { x, y, r, delay: ((i * 13) % 40) / 10 };
});

export function SkyScroll() {
  const rootRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const discRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<SVGSVGElement>(null);
  const cloudsRef = useRef<HTMLDivElement>(null);
  const hill0 = useRef<SVGPathElement>(null);
  const hill1 = useRef<SVGPathElement>(null);
  const hill2 = useRef<SVGPathElement>(null);
  const layer0 = useRef<SVGSVGElement>(null);
  const layer1 = useRef<SVGSVGElement>(null);
  const layer2 = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const hillRefs = [hill0, hill1, hill2];
    const hillLayerRefs = [layer0, layer1, layer2];
    let frame = 0;
    let pending = true;
    let current = reduced ? 0.5 : 0;

    const paint = (p: number) => {
      const span = (PHASES.length - 1) * Math.min(Math.max(p, 0), 1);
      const i = Math.min(Math.floor(span), PHASES.length - 2);
      const t = ease(span - i);
      const from = PHASES[i];
      const to = PHASES[i + 1];

      if (skyRef.current) {
        const top = mix(from.sky[0], to.sky[0], t);
        const mid = mix(from.sky[1], to.sky[1], t);
        const low = mix(from.sky[2], to.sky[2], t);
        skyRef.current.style.background = `linear-gradient(180deg, ${top} 0%, ${mid} 48%, ${low} 76%)`;
      }

      if (discRef.current) {
        // The sun and moon share one disc travelling a shallow arc across the sky.
        const x = lerp(12, 84, Math.min(Math.max(p, 0), 1));
        const y = 60 - Math.sin(Math.min(Math.max(p, 0), 1) * Math.PI) * 42;
        const disc = mix(from.disc, to.disc, t);
        const moon = lerp(from.moon, to.moon, t);
        discRef.current.style.transform = `translate3d(${x}vw, ${y}vh, 0)`;
        discRef.current.style.background = disc;
        discRef.current.style.boxShadow = `0 0 ${moon > 0.5 ? 40 : 90}px ${moon > 0.5 ? 10 : 30}px ${
          t < 0.5 ? from.glow : to.glow
        }`;
        // A soft crater shadow slides in as the disc becomes the moon.
        discRef.current.style.setProperty("--moon", String(moon));
      }

      if (starsRef.current) {
        starsRef.current.style.opacity = String(lerp(from.stars, to.stars, t));
      }
      if (cloudsRef.current) {
        cloudsRef.current.style.opacity = String(lerp(from.clouds, to.clouds, t));
        if (!reduced) {
          cloudsRef.current.style.transform = `translate3d(${-p * 12}vw, ${p * 2}vh, 0)`;
        }
      }
      hillRefs.forEach((ref, idx) => {
        if (ref.current) ref.current.setAttribute("fill", mix(from.hills[idx], to.hills[idx], t));
      });
      if (!reduced) {
        // Near hills move more than far hills, which reads as depth.
        hillLayerRefs.forEach((ref, idx) => {
          if (ref.current) ref.current.style.transform = `translate3d(0, ${p * (idx + 1) * 1.6}vh, 0)`;
        });
      }
    };

    const progress = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return max <= 0 ? 0 : window.scrollY / max;
    };

    const loop = () => {
      if (pending) {
        const target = reduced ? 0.5 : progress();
        // Ease towards the target so fast flicks glide instead of jumping.
        current += (target - current) * 0.12;
        if (Math.abs(target - current) < 0.0005) {
          current = target;
          pending = false;
        }
        paint(current);
      }
      frame = requestAnimationFrame(loop);
    };

    const onScroll = () => {
      pending = true;
    };

    paint(current);
    frame = requestAnimationFrame(loop);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    // Refs are stable; this effect owns the whole animation for the life of the page.
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      data-testid="sky-scroll"
    >
      <style>{`
        .sky-star { animation: sky-twinkle 4.5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .sky-star { animation: none; } }
        @keyframes sky-twinkle { 0%, 100% { opacity: 0.35 } 50% { opacity: 1 } }
      `}</style>

      <div ref={skyRef} className="absolute inset-0" />

      <svg
        ref={starsRef}
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ opacity: 0 }}
      >
        {STARS.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={Number(s.r) / 6}
            fill="#fdfbf4"
            className="sky-star"
            style={{ animationDelay: `${s.delay}s` }}
          />
        ))}
      </svg>

      <div
        ref={discRef}
        className="absolute left-0 top-0 h-[10vh] w-[10vh] rounded-full will-change-transform"
      />

      <div ref={cloudsRef} className="absolute inset-0 will-change-transform">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 60" preserveAspectRatio="none">
          <g fill="#fffdf8" opacity="0.55">
            <ellipse cx="18" cy="14" rx="13" ry="3.4" />
            <ellipse cx="26" cy="12" rx="8" ry="2.6" />
            <ellipse cx="62" cy="9" rx="16" ry="3" />
            <ellipse cx="74" cy="18" rx="11" ry="2.4" />
            <ellipse cx="42" cy="24" rx="19" ry="2.8" opacity="0.7" />
            <ellipse cx="88" cy="28" rx="12" ry="2.2" opacity="0.6" />
          </g>
        </svg>
      </div>

      {/* Three ridgelines. The nearest is darkest, which keeps text legible over it. */}
      <svg
        ref={layer0}
        className="absolute bottom-0 left-0 w-full will-change-transform"
        viewBox="0 0 100 24"
        preserveAspectRatio="none"
        style={{ height: "34vh" }}
      >
        <path
          ref={hill0}
          d="M0 16 C 12 9, 20 18, 32 13 C 44 8, 52 16, 64 11 C 76 6, 88 15, 100 10 L100 24 L0 24 Z"
        />
      </svg>
      <svg
        ref={layer1}
        className="absolute bottom-0 left-0 w-full will-change-transform"
        viewBox="0 0 100 20"
        preserveAspectRatio="none"
        style={{ height: "26vh" }}
      >
        <path
          ref={hill1}
          d="M0 14 C 14 6, 26 16, 40 12 C 54 8, 66 15, 80 10 C 88 7, 94 12, 100 9 L100 20 L0 20 Z"
        />
      </svg>
      <svg
        ref={layer2}
        className="absolute bottom-0 left-0 w-full will-change-transform"
        viewBox="0 0 100 14"
        preserveAspectRatio="none"
        style={{ height: "17vh" }}
      >
        <path
          ref={hill2}
          d="M0 9 C 10 4, 22 11, 34 7 C 48 3, 58 10, 70 6 C 82 2, 92 9, 100 5 L100 14 L0 14 Z"
        />
      </svg>

      {/* Keeps body text readable whatever the sky is doing. */}
      <div className="absolute inset-0 bg-[color:var(--background)] opacity-[0.58]" />
    </div>
  );
}
