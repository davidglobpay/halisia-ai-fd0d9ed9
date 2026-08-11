import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cancelImagePrefetch, imageIsCached, prefetchImage } from "@/lib/media-cache";

/**
 * Card image that prefetches only while near the viewport, cancels its request
 * when it scrolls away, retries with backoff, and offers a one-click retry
 * after a final failure.
 */
export function PulseImage({
  src,
  className = "h-28 w-full object-cover",
  alt = "",
}: {
  src: string;
  className?: string;
  alt?: string;
}) {
  const holder = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">(() =>
    imageIsCached(src) ? "ready" : "idle",
  );

  const load = useCallback(
    (retry = false) => {
      if (imageIsCached(src)) return setState("ready");
      setState("loading");
      prefetchImage(src, { retry }).then(
        () => setState("ready"),
        (err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setState("error");
        },
      );
    },
    [src],
  );

  useEffect(() => {
    if (state === "ready") return;
    const el = holder.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      load();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          // Start early (0 threshold + margin), cancel once fully off-screen.
          if (e.isIntersecting) load();
          else if (e.intersectionRatio === 0) cancelImagePrefetch(src);
        }
      },
      { rootMargin: "0px 600px 0px 600px", threshold: [0, 0.01, 0.25] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelImagePrefetch(src);
    };
  }, [src, state, load]);

  return (
    <div ref={holder} className="relative">
      {state === "ready" ? (
        <img src={src} alt={alt} decoding="async" fetchPriority="low" className={className} />
      ) : state === "error" ? (
        <div className={`${className} grid place-items-center bg-white/5`}>
          <button
            type="button"
            onClick={() => load(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-[10px] text-muted-foreground hover:text-accent"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" /> Retry image
          </button>
        </div>
      ) : (
        <Skeleton className={className} />
      )}
    </div>
  );
}
