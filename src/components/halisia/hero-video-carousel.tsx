import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import hero1 from "@/assets/hero/hero1.mp4.asset.json";
import hero2 from "@/assets/hero/hero2.mp4.asset.json";
import hero1Poster from "@/assets/hero/hero1-poster.jpg.asset.json";
import hero2Poster from "@/assets/hero/hero2-poster.jpg.asset.json";

const CLIPS = [
  {
    src: hero1.url,
    poster: hero1Poster.url,
    caption: "Every parcel, translated into signal.",
  },
  {
    src: hero2.url,
    poster: hero2Poster.url,
    caption: "See the land before you walk it.",
  },
];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

export function HeroVideoCarousel({ children }: { children?: React.ReactNode }) {
  const [i, setI] = useState(0);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const regionRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  // True when the browser blocked autoplay — surfaces a large Play CTA
  // so the hero stays interactive and keyboard-friendly.
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const go = useCallback((next: number) => {
    setI(((next % CLIPS.length) + CLIPS.length) % CLIPS.length);
  }, []);
  const next = useCallback(() => go(i + 1), [go, i]);
  const prev = useCallback(() => go(i - 1), [go, i]);

  // Video playback / auto-advance. Skipped when the user prefers reduced motion —
  // the poster image stays as a static hero instead.
  useEffect(() => {
    if (reducedMotion || paused) return;
    const el = videoRefs.current[i];
    if (!el) return;
    el.currentTime = 0;
    el.play().then(
      () => setAutoplayBlocked(false),
      () => setAutoplayBlocked(true),
    );
    const onEnd = () => setI((n) => (n + 1) % CLIPS.length);
    el.addEventListener("ended", onEnd);
    const t = window.setTimeout(() => setI((n) => (n + 1) % CLIPS.length), 12000);
    return () => {
      el.removeEventListener("ended", onEnd);
      window.clearTimeout(t);
    };
  }, [i, reducedMotion, paused]);

  // Reflect play/pause + mute onto the current video element imperatively so
  // the browser <video> stays in sync with our React state.
  useEffect(() => {
    const el = videoRefs.current[i];
    if (!el) return;
    el.muted = muted;
    if (paused) el.pause();
    else if (!reducedMotion)
      el.play().then(
        () => setAutoplayBlocked(false),
        () => setAutoplayBlocked(true),
      );
  }, [paused, muted, i, reducedMotion]);

  // Keyboard nav: ←/→ to step through clips when the carousel has focus.
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    }
  };

  // Touch swipe support.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) next();
      else prev();
    }
  };

  return (
    <div
      ref={regionRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="HALISIA cinematic hero"
      tabIndex={0}
      onKeyDown={onKey}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="relative w-full overflow-hidden aspect-[3/4] sm:aspect-[16/10] md:aspect-[21/9] max-h-[92vh] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {CLIPS.map((clip, idx) => (
        <video
          key={clip.src}
          ref={(el) => {
            videoRefs.current[idx] = el;
          }}
          src={reducedMotion ? undefined : clip.src}
          poster={clip.poster}
          muted={muted}
          playsInline
          loop={CLIPS.length === 1}
          disablePictureInPicture
          controls={false}
          preload={idx === 0 ? "auto" : "none"}
          aria-hidden={i === idx ? undefined : true}
          aria-roledescription="slide"
          aria-label={`${clip.caption} (${idx + 1} of ${CLIPS.length})`}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-out ${
            i === idx ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      {/* Cinematic color blend into the Halisia palette */}
      <div
        className="absolute inset-0 mix-blend-color"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.32 0.14 260 / 0.55), oklch(0.55 0.18 220 / 0.35) 55%, oklch(0.75 0.16 190 / 0.45))",
        }}
      />
      {/* Depth vignette + bottom fade into the page */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,oklch(0.14_0.05_260/0.55)_75%,oklch(0.10_0.04_260/0.95)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
      {/* Subtle scanline / grid for tech texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(1 0 0 / 0.35) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.35) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
        }}
      />

      {/* Foreground content */}
      <div className="absolute inset-0 flex flex-col justify-end sm:justify-center">
        <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:pb-0">{children}</div>
      </div>

      {/* Autoplay-blocked fallback — the browser refused to autoplay.
          Show a prominent, accessible Play CTA so the carousel stays usable. */}
      {autoplayBlocked && !reducedMotion && (
        <button
          type="button"
          onClick={() => {
            setPaused(false);
            const el = videoRefs.current[i];
            el?.play().then(
              () => setAutoplayBlocked(false),
              () => setAutoplayBlocked(true),
            );
          }}
          aria-label="Play hero video"
          data-testid="hero-autoplay-cta"
          className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 inline-flex items-center gap-2 rounded-full glass-strong border border-white/20 px-5 py-3 text-sm font-medium text-white shadow-2xl hover:bg-white/10 transition outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Play className="h-4 w-4" />
          Tap to play
        </button>
      )}

      {/* Caption + dots */}
      <div
        className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2"
        role="group"
        aria-label="Carousel controls"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={CLIPS[i].caption}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: reducedMotion ? 0 : 0.5 }}
            className="glass rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/80"
            aria-live="polite"
          >
            {CLIPS[i].caption}
          </motion.div>
        </AnimatePresence>
        <div className="flex gap-1.5" role="tablist" aria-label="Choose hero clip">
          {CLIPS.map((clip, idx) => (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`Show clip ${idx + 1}: ${clip.caption}`}
              onClick={() => go(idx)}
              className={`h-2 rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
                i === idx ? "w-8 bg-white" : "w-3 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Playback controls (top-right) */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Play hero video" : "Pause hero video"}
          aria-pressed={paused}
          data-testid="hero-playpause"
          className="glass-strong border border-white/15 h-9 w-9 rounded-full inline-flex items-center justify-center text-white/90 hover:bg-white/10 transition outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute hero video" : "Mute hero video"}
          aria-pressed={!muted}
          data-testid="hero-mute"
          className="glass-strong border border-white/15 h-9 w-9 rounded-full inline-flex items-center justify-center text-white/90 hover:bg-white/10 transition outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
