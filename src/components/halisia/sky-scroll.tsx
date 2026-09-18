import { useEffect, useRef, useState } from "react";

/**
 * The sky behind the landing page, moving from first light to night as the
 * page scrolls and back again on the way up.
 *
 * It runs in one of two modes.
 *
 *   Photographic — if all five images under `public/sky/` load, they are
 *   cross-faded against each other. This is the mode to aim for: nothing drawn
 *   by hand looks like a real horizon.
 *
 *   Painted — the fallback, drawn once per phase to an offscreen canvas at
 *   mount and then cross-faded exactly like the photographs. Clouds are built
 *   from many blurred blobs rather than hard shapes, and the ridgelines come
 *   from ridge noise with distance haze, so it reads as atmosphere rather than
 *   as a cartoon. It is still a painting.
 *
 * Either way the scroll position drives one animation-frame loop that writes
 * straight to the DOM, so React never re-renders while the page is moving.
 */

/** Drop these five files into `public/sky/` and the page switches to photographs. */
const PHOTO_SOURCES = [
  "/sky/1-first-light.jpg",
  "/sky/2-sunrise.jpg",
  "/sky/3-day.jpg",
  "/sky/4-sunset.jpg",
  "/sky/5-night.jpg",
] as const;

type Phase = {
  readonly name: string;
  /** Sky gradient from zenith to horizon. */
  readonly sky: readonly [string, string, string];
  /** Light source: colour, glow colour, height up the frame, and moon-ness. */
  readonly light: { colour: string; glow: string; y: number; moon: number };
  readonly stars: number;
  readonly cloud: { amount: number; colour: string; shadow: string };
  /** Ridge colours, furthest first. */
  readonly ridges: readonly [string, string, string, string];
  readonly haze: string;
};

const PHASES: readonly Phase[] = [
  {
    name: "First light",
    sky: ["#0d1830", "#334060", "#7d6470"],
    light: { colour: "#f2d3a4", glow: "rgba(242,211,164,0.30)", y: 0.74, moon: 0.75 },
    stars: 0.5,
    cloud: { amount: 0.5, colour: "rgba(176,164,178,0.5)", shadow: "rgba(40,44,68,0.45)" },
    ridges: ["#4a5570", "#333d52", "#232b3a", "#151a24"],
    haze: "rgba(125,100,112,0.55)",
  },
  {
    name: "Sunrise",
    sky: ["#5d84b8", "#c79680", "#f0b36a"],
    light: { colour: "#ffe0ab", glow: "rgba(255,198,112,0.52)", y: 0.68, moon: 0 },
    stars: 0.06,
    cloud: { amount: 0.9, colour: "rgba(255,228,200,0.78)", shadow: "rgba(150,110,110,0.4)" },
    ridges: ["#7d8a86", "#5a6a5f", "#3b4840", "#232c26"],
    haze: "rgba(240,179,106,0.5)",
  },
  {
    name: "Clear day",
    sky: ["#3d7ac9", "#79ade0", "#cfe0ee"],
    light: { colour: "#fff8e0", glow: "rgba(255,248,224,0.45)", y: 0.22, moon: 0 },
    stars: 0,
    cloud: { amount: 0.75, colour: "rgba(255,255,255,0.9)", shadow: "rgba(150,165,185,0.38)" },
    ridges: ["#94a8a0", "#5f7a63", "#3c5741", "#233828"],
    haze: "rgba(207,224,238,0.55)",
  },
  {
    name: "Sunset",
    sky: ["#2d4574", "#b06640", "#e79f4c"],
    light: { colour: "#ffb35f", glow: "rgba(255,148,66,0.55)", y: 0.7, moon: 0 },
    stars: 0.1,
    cloud: { amount: 0.85, colour: "rgba(255,196,150,0.75)", shadow: "rgba(96,64,80,0.45)" },
    ridges: ["#6d6f74", "#4b4d52", "#2f3236", "#1a1c1f"],
    haze: "rgba(231,159,76,0.5)",
  },
  {
    name: "Night",
    sky: ["#05091a", "#0b1730", "#1a2a3e"],
    light: { colour: "#eef3fa", glow: "rgba(214,228,246,0.3)", y: 0.2, moon: 1 },
    stars: 1,
    cloud: { amount: 0.25, colour: "rgba(120,136,164,0.4)", shadow: "rgba(6,10,22,0.55)" },
    ridges: ["#1d2734", "#141c27", "#0d131b", "#070a0f"],
    haze: "rgba(26,42,62,0.5)",
  },
];

/* ------------------------------------------------------------------ noise */

/** Deterministic hash, so every visitor and every reload gets the same sky. */
function hash(x: number, seed: number): number {
  const s = Math.sin(x * 127.1 + seed * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const fade = (t: number) => t * t * (3 - 2 * t);

function valueNoise(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = fade(x - i);
  return hash(i, seed) * (1 - f) + hash(i + 1, seed) * f;
}

/** Layered noise. `ridged` folds it so the peaks sharpen the way hills do. */
function fbm(x: number, seed: number, octaves = 5, ridged = false): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    let v = valueNoise(x * freq, seed + o * 17);
    if (ridged) v = 1 - Math.abs(v * 2 - 1);
    sum += v * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return sum / norm;
}

/* ------------------------------------------------------------- painting */

function paintPhase(ctx: CanvasRenderingContext2D, phase: Phase, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);

  const horizon = h * 0.66;

  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, phase.sky[0]);
  sky.addColorStop(0.55, phase.sky[1]);
  sky.addColorStop(1, phase.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon + 2);

  // Stars, brightest first so the sky keeps some depth.
  if (phase.stars > 0.02) {
    for (let i = 0; i < 260; i++) {
      const x = hash(i, 3) * w;
      const y = hash(i, 9) * horizon * 0.92;
      const mag = Math.pow(hash(i, 21), 2.4);
      const r = 0.3 + mag * 1.5;
      ctx.globalAlpha = phase.stars * (0.25 + mag * 0.75);
      ctx.fillStyle = hash(i, 33) > 0.85 ? "#ffe7cf" : "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // The sun or moon, and the glow it throws across the sky.
  const lx = w * 0.72;
  const ly = horizon * phase.light.y;
  const discR = Math.max(14, w * 0.021);

  const bloom = ctx.createRadialGradient(lx, ly, discR * 0.4, lx, ly, discR * 16);
  bloom.addColorStop(0, phase.light.glow);
  bloom.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, w, horizon + 2);

  ctx.save();
  ctx.beginPath();
  ctx.arc(lx, ly, discR, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = phase.light.colour;
  ctx.fillRect(lx - discR, ly - discR, discR * 2, discR * 2);
  if (phase.light.moon > 0.4) {
    // Maria, so the moon is a surface rather than a white dot.
    ctx.globalAlpha = 0.16 * phase.light.moon;
    ctx.fillStyle = "#7d8798";
    for (let i = 0; i < 9; i++) {
      const a = hash(i, 51) * Math.PI * 2;
      const d = hash(i, 63) * discR * 0.72;
      ctx.beginPath();
      ctx.arc(
        lx + Math.cos(a) * d,
        ly + Math.sin(a) * d,
        discR * (0.12 + hash(i, 77) * 0.22),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Cloud banks. Many soft blobs under a heavy blur read as depth; a handful
  // of hard ellipses is what made the first version look like a cartoon.
  if (phase.cloud.amount > 0.05) {
    const supportsBlur = "filter" in ctx;
    for (let band = 0; band < 3; band++) {
      const bandY = horizon * (0.16 + band * 0.19);
      const scale = 1 - band * 0.22;
      ctx.save();
      if (supportsBlur) ctx.filter = `blur(${Math.round(w * (0.013 - band * 0.003))}px)`;
      ctx.globalAlpha = phase.cloud.amount * (0.85 - band * 0.16);
      for (let i = 0; i < 46; i++) {
        const seed = band * 200 + i;
        const t = i / 46;
        const x = (t + hash(seed, 5) * 0.03) * w * 1.15 - w * 0.07;
        const lift = fbm(t * 6 + band, 11 + band, 4) - 0.5;
        const y = bandY + lift * horizon * 0.12;
        const rx = w * (0.035 + hash(seed, 13) * 0.07) * scale;
        const ry = rx * (0.17 + hash(seed, 17) * 0.16);
        // Underside first, then the lit top edge just above it.
        ctx.fillStyle = phase.cloud.shadow;
        ctx.beginPath();
        ctx.ellipse(x, y + ry * 0.5, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = phase.cloud.colour;
        ctx.beginPath();
        ctx.ellipse(x, y, rx * 0.94, ry * 0.92, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // Ridgelines, furthest first, each one hazed toward the sky behind it.
  const supportsBlur = "filter" in ctx;
  for (let layer = 0; layer < 4; layer++) {
    const baseY = horizon - h * (0.1 - layer * 0.035);
    const amp = h * (0.075 + layer * 0.05);
    const rough = 1.1 + layer * 1.5;
    ctx.save();
    if (supportsBlur && layer < 2) ctx.filter = `blur(${2 - layer}px)`;
    ctx.beginPath();
    ctx.moveTo(0, h);
    const step = Math.max(2, Math.floor(w / 420));
    for (let x = 0; x <= w; x += step) {
      const u = x / w;
      const ridge = fbm(u * rough + layer * 3.3, 41 + layer * 7, 6, true);
      ctx.lineTo(x, baseY - (ridge - 0.42) * amp);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = phase.ridges[layer];
    ctx.fill();
    ctx.restore();

    // Atmospheric haze sitting in front of each distant layer.
    if (layer < 3) {
      const veil = ctx.createLinearGradient(0, baseY - amp, 0, baseY + amp * 0.7);
      veil.addColorStop(0, "rgba(0,0,0,0)");
      veil.addColorStop(1, phase.haze);
      ctx.globalAlpha = 0.5 - layer * 0.14;
      ctx.fillStyle = veil;
      ctx.fillRect(0, baseY - amp, w, amp * 1.8);
      ctx.globalAlpha = 1;
    }
  }

  // A fall of water down the nearest ridge, with mist where it lands.
  const fx = w * 0.29;
  const fTop = horizon - h * 0.055;
  const fBottom = horizon + h * 0.1;
  ctx.save();
  if (supportsBlur) ctx.filter = "blur(2px)";
  const fall = ctx.createLinearGradient(0, fTop, 0, fBottom);
  fall.addColorStop(0, "rgba(255,255,255,0.05)");
  fall.addColorStop(0.35, "rgba(238,246,255,0.62)");
  fall.addColorStop(1, "rgba(226,240,255,0.16)");
  ctx.fillStyle = fall;
  ctx.beginPath();
  ctx.moveTo(fx - w * 0.006, fTop);
  ctx.lineTo(fx + w * 0.006, fTop);
  ctx.lineTo(fx + w * 0.011, fBottom);
  ctx.lineTo(fx - w * 0.011, fBottom);
  ctx.closePath();
  ctx.fill();
  const mist = ctx.createRadialGradient(fx, fBottom, 0, fx, fBottom, w * 0.05);
  mist.addColorStop(0, "rgba(255,255,255,0.4)");
  mist.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = mist;
  ctx.fillRect(fx - w * 0.06, fBottom - w * 0.05, w * 0.12, w * 0.1);
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------- component */

export function SkyScroll() {
  const rootRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<Array<HTMLDivElement | null>>([]);
  const [mode, setMode] = useState<"painted" | "photo">("painted");

  // Try the photographs first. Every one has to load: a half-photographic sky
  // looks worse than a consistent painted one.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      PHOTO_SOURCES.map(
        (src) =>
          new Promise<boolean>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = src;
          }),
      ),
    ).then((results) => {
      if (!cancelled && results.every(Boolean)) setMode("photo");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Paint the five canvases, and repaint them when the viewport changes shape.
  useEffect(() => {
    if (mode !== "painted") return;
    let timer: number | undefined;

    const render = () => {
      // Capped: this is a blurred-back backdrop, not something to read detail
      // from, and five full-resolution canvases is a lot of memory on a phone.
      const w = Math.min(1280, Math.max(360, window.innerWidth));
      const h = Math.round(w * (window.innerHeight / Math.max(1, window.innerWidth)));
      layersRef.current.forEach((el, i) => {
        if (!el) return;
        let canvas = el.querySelector("canvas");
        if (!canvas) {
          canvas = document.createElement("canvas");
          canvas.style.width = "100%";
          canvas.style.height = "100%";
          canvas.style.display = "block";
          canvas.style.objectFit = "cover";
          el.appendChild(canvas);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) paintPhase(ctx, PHASES[i], w, h);
      });
    };

    render();
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(render, 220);
    };
    window.addEventListener("resize", onResize, { passive: true });
    const layers = layersRef.current;
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      // The canvases are appended outside React, so React will not clear them
      // when this switches to photographs. Take them out by hand.
      layers.forEach((el) => el?.querySelector("canvas")?.remove());
    };
  }, [mode]);

  // Cross-fade on scroll.
  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let frame = 0;
    let pending = true;
    let current = reduced ? 0.5 : 0;

    const paint = (p: number) => {
      const span = (PHASES.length - 1) * Math.min(Math.max(p, 0), 1);
      layersRef.current.forEach((el, i) => {
        if (!el) return;
        // A triangular weight, so only the two neighbouring phases are ever
        // visible and the sum across layers stays at one.
        const weight = Math.max(0, 1 - Math.abs(span - i));
        el.style.opacity = String(weight);
        // The sky drifts a little slower than the page, which gives depth
        // without ever pulling the horizon out of frame.
        el.style.transform = reduced ? "" : `translate3d(0, ${p * 4}vh, 0) scale(1.08)`;
      });
    };

    const progress = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return max <= 0 ? 0 : window.scrollY / max;
    };

    const loop = () => {
      if (pending) {
        const target = reduced ? 0.5 : progress();
        current += (target - current) * 0.1;
        if (Math.abs(target - current) < 0.0004) {
          current = target;
          pending = false;
        }
        paint(current);
      }
      frame = requestAnimationFrame(loop);
    };

    const wake = () => {
      pending = true;
    };

    paint(current);
    frame = requestAnimationFrame(loop);
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", wake, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", wake);
      window.removeEventListener("resize", wake);
    };
  }, [mode]);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      data-testid="sky-scroll"
      data-sky-mode={mode}
    >
      {PHASES.map((phase, i) => (
        <div
          key={phase.name}
          ref={(el) => {
            layersRef.current[i] = el;
          }}
          className="absolute inset-0 will-change-[opacity,transform]"
          style={{ opacity: 0 }}
        >
          {mode === "photo" ? (
            <img
              src={PHOTO_SOURCES[i]}
              alt=""
              decoding="async"
              loading={i > 1 ? "lazy" : "eager"}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
      ))}

      {/* Keeps body text readable whatever the sky is doing. */}
      <div className="absolute inset-0 bg-[color:var(--background)] opacity-[0.45]" />
    </div>
  );
}
