import { useState } from "react";
import { COUNTY_LOGOS } from "@/lib/county-logos";
import { KENYA_COAT_OF_ARMS } from "@/lib/kenya-county-facts";
import { reportLovableError } from "@/lib/lovable-error-reporting";

interface Props {
  code: number;
  name: string;
  size?: number;
  priority?: boolean;
  className?: string;
}

/**
 * Circular county emblem placeholder with a subtle 3D lift and outer
 * golden glow. Handles broken assets with a clean Kenya Coat of Arms
 * fallback, then a text initial as a last resort. Accessible: real alt
 * text, focus-visible ring when wrapped in an interactive element.
 */
export function CountyEmblem({ code, name, size = 96, priority = false, className = "" }: Props) {
  const primary = COUNTY_LOGOS[code];
  const [src, setSrc] = useState<string | undefined>(primary ?? KENYA_COAT_OF_ARMS);
  const [failed, setFailed] = useState(false);

  const dim = { width: size, height: size };
  const innerPad = Math.max(6, Math.round(size * 0.09));
  const radius = Math.max(10, Math.round(size * 0.18));

  return (
    <div
      className={`county-emblem group relative shrink-0 ${className}`}
      style={dim}
      aria-hidden={false}
    >
      {/* Outer golden glow */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-1.5 opacity-80 blur-md transition-opacity duration-300 group-hover:opacity-100"
        style={{
          borderRadius: radius + 6,
          background:
            "radial-gradient(circle, rgba(250,204,21,0.55) 0%, rgba(234,179,8,0.35) 45%, rgba(0,0,0,0) 72%)",
        }}
      />
      {/* 3D ring */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: radius,
          background: "conic-gradient(from 220deg, #f5d67a, #b8860b, #fff4c2, #a97900, #f5d67a)",
          padding: 2,
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      <div
        className="relative flex h-full w-full items-center justify-center overflow-hidden bg-white ring-1 ring-white/40"
        style={{
          borderRadius: radius,
          boxShadow:
            "0 10px 24px -8px rgba(0,0,0,0.55), inset 0 2px 4px rgba(255,255,255,0.85), inset 0 -6px 14px rgba(0,0,0,0.18)",
        }}
      >
        {!failed && src ? (
          <img
            src={src}
            alt={`${name} County official emblem`}
            width={size}
            height={size}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "low"}
            referrerPolicy="no-referrer"
            draggable={false}
            onError={() => {
              reportLovableError(new Error("County logo failed to load"), {
                countyCode: code,
                countyName: name,
                assetUrl: src,
                fellBackToCoatOfArms: src !== KENYA_COAT_OF_ARMS,
              });
              if (src !== KENYA_COAT_OF_ARMS) {
                setSrc(KENYA_COAT_OF_ARMS);
              } else {
                setFailed(true);
              }
            }}
            className="h-full w-full object-contain"
            style={{ padding: innerPad }}
          />
        ) : (
          <span
            role="img"
            aria-label={`${name} County emblem placeholder`}
            className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-100 to-amber-300 font-black text-amber-900"
            style={{ fontSize: Math.round(size * 0.42) }}
          >
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}

export default CountyEmblem;
