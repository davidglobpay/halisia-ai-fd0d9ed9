import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Horizontal, snap-scrolling rail. Keeps dense content visible in a fraction
 * of the vertical space a grid needs, while staying keyboard and screen-reader
 * friendly.
 */
export function HCarousel({
  label,
  children,
  itemClassName = "w-[240px] sm:w-[260px]",
  className = "",
  testId,
}: {
  label: string;
  children: ReactNode[];
  itemClassName?: string;
  className?: string;
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    sync();
  }, [sync, children.length]);

  const nudge = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className={`relative ${className}`} data-testid={testId}>
      <div
        ref={ref}
        onScroll={sync}
        role="list"
        aria-label={label}
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:thin] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-2xl"
      >
        {children.map((child, i) => (
          <div key={i} role="listitem" className={`shrink-0 snap-start ${itemClassName}`}>
            {child}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => nudge(-1)}
          disabled={atStart}
          aria-label={`Scroll ${label} left`}
          className="elev-1 grid h-8 w-8 place-items-center rounded-full border border-white/10 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => nudge(1)}
          disabled={atEnd}
          aria-label={`Scroll ${label} right`}
          className="elev-1 grid h-8 w-8 place-items-center rounded-full border border-white/10 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
