import { cn } from "@/lib/utils";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Visual shape preset. */
  variant?: "line" | "block" | "circle" | "card" | "media" | "text";
  /** Number of stacked lines for `variant="text"`. */
  lines?: number;
};

/**
 * Skeleton — animated shimmer placeholder for loading states. Prevents
 * blank screens and CLS by reserving the same footprint as the final
 * content. Respects prefers-reduced-motion.
 */
function Skeleton({ className, variant = "line", lines = 3, ...props }: SkeletonProps) {
  if (variant === "text") {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading"
        className={cn("space-y-2", className)}
        {...props}
      >
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="skeleton-shimmer h-3 rounded-md"
            style={{ width: i === lines - 1 ? "60%" : "100%" }}
          />
        ))}
      </div>
    );
  }

  const shape =
    variant === "circle"
      ? "rounded-full aspect-square"
      : variant === "block"
        ? "rounded-lg"
        : variant === "card"
          ? "rounded-2xl"
          : variant === "media"
            ? "rounded-xl aspect-video"
            : "rounded-md h-3";

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={cn("skeleton-shimmer", shape, className)}
      {...props}
    />
  );
}

/** Preset skeleton compositions for common surfaces. */
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("glass p-4 space-y-3", className)}>
      <Skeleton variant="media" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton variant="text" lines={3} />
    </div>
  );
}

function SkeletonGrid({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
      role="status"
      aria-busy="true"
      aria-label="Loading results"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

function SkeletonDashboard({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading dashboard"
      className={cn("space-y-4", className)}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass p-4 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-2 w-1/2" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass p-4 lg:col-span-2 space-y-3">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton variant="block" className="h-56 w-full" />
        </div>
        <div className="glass p-4 space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton variant="text" lines={5} />
        </div>
      </div>
    </div>
  );
}

function SkeletonReport({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading report"
      className={cn("space-y-6", className)}
    >
      <div className="glass p-6 space-y-3">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton variant="text" lines={2} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="glass p-6 space-y-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton variant="text" lines={6} />
      </div>
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonGrid, SkeletonDashboard, SkeletonReport };
