import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Renders its child only once the slide is near the viewport, so a long rail
 * mounts a handful of cards instead of dozens.
 */
function LazySlide({
  root,
  className,
  eager,
  children,
}: {
  root: HTMLDivElement | null;
  className: string;
  eager: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(eager);

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { root: root ?? null, rootMargin: "0px 800px 0px 800px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, root]);

  return (
    <div ref={ref} role="listitem" className={`shrink-0 snap-start ${className}`}>
      {shown ? children : <Skeleton className="h-full min-h-[160px] w-full rounded-2xl" />}
    </div>
  );
}

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
  loading = false,
  skeletonCount = 4,
}: {
  label: string;
  children: ReactNode[];
  itemClassName?: string;
  className?: string;
  testId?: string;
  loading?: boolean;
  skeletonCount?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
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
        ref={(el) => {
          ref.current = el;
          setRoot(el);
        }}
        onScroll={sync}
        role="list"
        aria-label={label}
        aria-busy={loading || undefined}
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:thin] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-2xl"
      >
        {loading
          ? Array.from({ length: skeletonCount }).map((_, i) => (
              <div key={`s-${i}`} role="listitem" className={`shrink-0 snap-start ${itemClassName}`}>
                <Skeleton className="h-[180px] w-full rounded-2xl" />
              </div>
            ))
          : children.map((child, i) => (
              <LazySlide key={i} root={root} className={itemClassName} eager={i < 4}>
                {child}
              </LazySlide>
            ))}
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
