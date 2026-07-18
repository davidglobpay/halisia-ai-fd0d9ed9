import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import hero1 from "@/assets/hero/hero1.mp4.asset.json";
import hero2 from "@/assets/hero/hero2.mp4.asset.json";

const CLIPS = [
  {
    src: hero1.url,
    caption: "Every parcel, translated into signal.",
  },
  {
    src: hero2.url,
    caption: "See the land before you walk it.",
  },
];

export function HeroVideoCarousel({ children }: { children?: React.ReactNode }) {
  const [i, setI] = useState(0);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);

  useEffect(() => {
    const el = videoRefs.current[i];
    if (!el) return;
    el.currentTime = 0;
    el.play().catch(() => {});
    const onEnd = () => setI((n) => (n + 1) % CLIPS.length);
    el.addEventListener("ended", onEnd);
    // Safety auto-advance in case `ended` never fires (some mobile browsers loop silently)
    const t = window.setTimeout(() => setI((n) => (n + 1) % CLIPS.length), 12000);
    return () => {
      el.removeEventListener("ended", onEnd);
      window.clearTimeout(t);
    };
  }, [i]);

  return (
    <div className="relative w-full overflow-hidden aspect-[3/4] sm:aspect-[16/10] md:aspect-[21/9] max-h-[92vh]">
      {CLIPS.map((clip, idx) => (
        <video
          key={clip.src}
          ref={(el) => {
            videoRefs.current[idx] = el;
          }}
          src={clip.src}
          muted
          playsInline
          preload={idx === 0 ? "auto" : "metadata"}
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

      {/* Caption + dots */}
      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={CLIPS[i].caption}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.5 }}
            className="glass rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/80"
          >
            {CLIPS[i].caption}
          </motion.div>
        </AnimatePresence>
        <div className="flex gap-1.5">
          {CLIPS.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Show clip ${idx + 1}`}
              onClick={() => setI(idx)}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? "w-8 bg-white" : "w-3 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}