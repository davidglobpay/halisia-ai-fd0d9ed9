import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const GAP = 12; // matches gap-3

/**
 * Horizontal, snap-scrolling rail.
 *
 * Long rails are virtualized: only the slides inside (or just outside) the
 * scroll viewport are mounted, with spacer elements preserving scroll length.
 * That keeps the DOM small and scrolling at 60 FPS on low-end devices.
 */
export function HCarousel({
  label,
  children,
  itemClassName = "w-[240px] sm:w-[260px]",
  className = "",
  testId,
  loading = false,
  skeletonCount = 4,
  virtualize = true,
  virtualizeThreshold = 10,
  overscan = 3,
}: {
  label: string;
  children: ReactNode[];
  itemClassName?: string;
  className?: string;
  testId?: string;
  loading?: boolean;
  skeletonCount?: number;
  virtualize?: boolean;
  virtualizeThreshold?: number;
  overscan?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const probeRef = useRef<HTMLDivElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [itemWidth, setItemWidth] = useState(0);
  const [range, setRange] = useState({ start: 0, end: virtualizeThreshold });

  const count = children.length;
  const active = virtualize && !loading && itemWidth > 0 && count > virtualizeThreshold;

  // Measure a single slide once so the virtual window can be computed.
  useLayoutEffect(() => {
    const w = probeRef.current?.offsetWidth ?? 0;
    if (w && w !== itemWidth) setItemWidth(w);
  }, [itemWidth, count, loading]);

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
    if (!itemWidth) return;
    const step = itemWidth + GAP;
    const start = Math.max(0, Math.floor(el.scrollLeft / step) - overscan);
    const visible = Math.ceil(el.clientWidth / step);
    setRange({ start, end: Math.min(count, start + visible + overscan * 2) });
  }, [itemWidth, count, overscan]);

  useEffect(() => {
    sync();
  }, [sync]);

  const nudge = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" });
  };

  const step = itemWidth + GAP;
  const start = active ? range.start : 0;
  const end = active ? range.end : count;
  const visibleChildren = active ? children.slice(start, end) : children;

  return (
    <div className={`relative ${className}`} data-testid={testId}>
      <div
        ref={ref}
        onScroll={sync}
        role="list"
        aria-label={label}
        aria-busy={loading || undefined}
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:thin] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-2xl"
      >
        {loading ? (
          Array.from({ length: skeletonCount }).map((_, i) => (
            <div
              key={`s-${i}`}
              role="listitem"
              className={`shrink-0 snap-start ${itemClassName}`}
              ref={i === 0 ? probeRef : undefined}
            >
              <Skeleton className="h-[180px] w-full rounded-2xl" />
            </div>
          ))
        ) : (
          <>
            {active && start > 0 && (
              <div
                aria-hidden="true"
                className="shrink-0"
                style={{ width: start * step - GAP }}
              />
            )}
            {visibleChildren.map((child, i) => (
              <div
                key={start + i}
                role="listitem"
                className={`shrink-0 snap-start ${itemClassName}`}
                ref={i === 0 ? probeRef : undefined}
              >
                {child}
              </div>
            ))}
            {active && end < count && (
              <div
                aria-hidden="true"
                className="shrink-0"
                style={{ width: (count - end) * step - GAP }}
              />
            )}
          </>
        )}
      </div>
      <div className="mt-1 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => nudge(-1)}
          disabled={atStart || loading}
          aria-label={`Scroll ${label} left`}
          className="elev-1 grid h-8 w-8 place-items-center rounded-full border border-white/10 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => nudge(1)}
          disabled={atEnd || loading}
          aria-label={`Scroll ${label} right`}
          className="elev-1 grid h-8 w-8 place-items-center rounded-full border border-white/10 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
