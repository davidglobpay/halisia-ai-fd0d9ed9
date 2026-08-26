/**
 * Global page backdrop: plain ivory with a faint gold spherical mesh —
 * meridians and parallels standing in for the globe. Decorative only,
 * never interactive, and it never affects foreground contrast.
 */
export function GlobeBackdrop() {
  const meridians = Array.from({ length: 9 }, (_, i) => (i - 4) / 4.2); // -0.95…0.95 squash factor
  const parallels = Array.from({ length: 7 }, (_, i) => (i - 3) * 62); // y offsets

  return (
    <div
      aria-hidden="true"
      data-testid="globe-backdrop"
      className="pointer-events-none fixed inset-0 -z-10 ivory-globe-backdrop"
    >
      <svg
        className="absolute left-1/2 top-1/2 h-[min(160vh,160vw)] w-[min(160vh,160vw)] -translate-x-1/2 -translate-y-1/2 opacity-[0.5]"
        viewBox="-260 -260 520 520"
        fill="none"
        focusable="false"
      >
        <defs>
          <radialGradient id="halisia-globe-glow" cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor="#C08A2E" stopOpacity="0.10" />
            <stop offset="70%" stopColor="#C08A2E" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#C08A2E" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="0" cy="0" r="250" fill="url(#halisia-globe-glow)" />
        <circle cx="0" cy="0" r="220" stroke="#C08A2E" strokeOpacity="0.16" strokeWidth="0.8" />
        {/* Parallels (latitude) */}
        {parallels.map((y) => {
          const rx = Math.sqrt(Math.max(0, 220 * 220 - y * y));
          return (
            <ellipse
              key={`p-${y}`}
              cx="0"
              cy={y}
              rx={rx}
              ry={rx * 0.16}
              stroke="#C08A2E"
              strokeOpacity="0.11"
              strokeWidth="0.7"
            />
          );
        })}
        {/* Meridians (longitude) */}
        {meridians.map((k, i) => (
          <ellipse
            key={`m-${i}`}
            cx="0"
            cy="0"
            rx={Math.abs(k) * 220 || 0.6}
            ry="220"
            stroke="#147B35"
            strokeOpacity="0.07"
            strokeWidth="0.7"
          />
        ))}
      </svg>
    </div>
  );
}
