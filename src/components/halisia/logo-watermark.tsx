import halisiaLogo from "@/assets/brand/halisia-mark.png.asset.json";

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
      className={`pointer-events-none absolute ${posClass} w-[min(720px,80vw)] aspect-square opacity-[0.07] blur-[1px] mix-blend-multiply`}
      style={{
        filter:
          "drop-shadow(0 0 60px rgba(192, 138, 46, 0.28)) drop-shadow(0 0 120px rgba(20, 123, 53, 0.14))",
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
