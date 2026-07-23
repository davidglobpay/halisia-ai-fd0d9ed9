import halisiaLogo from "@/assets/halisia-logo.png.asset.json";

/**
 * Fixed-position brand watermark rendered behind hero areas.
 * ~4% opacity with a soft gold glow. Non-interactive, decorative.
 */
export function LogoWatermark({ position = "right" }: { position?: "right" | "center" }) {
  const posClass =
    position === "center"
      ? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      : "right-[-6%] top-[8%]";
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute ${posClass} w-[min(720px,80vw)] aspect-square opacity-[0.045] blur-[2px] mix-blend-screen`}
      style={{
        filter:
          "drop-shadow(0 0 60px oklch(0.78 0.14 85 / 0.35)) drop-shadow(0 0 120px oklch(0.78 0.14 85 / 0.18))",
      }}
    >
      <img
        src={halisiaLogo.url}
        alt=""
        className="h-full w-full object-contain"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
