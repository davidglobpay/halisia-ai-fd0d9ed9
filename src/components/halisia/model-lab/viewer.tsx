/**
 * SSR-safe wrapper for the Model Lab viewer.
 *
 * React.lazy alone is not sufficient: TanStack Start still renders on the
 * server, so the internal module (which imports three at module scope) must be
 * gated behind a mounted flag as well. No three.js import at module scope here.
 */
import { Suspense, lazy, useEffect, useState } from "react";
import type { ModelLabViewerProps } from "./viewer.internal";

const Internal = lazy(() => import("./viewer.internal"));

function Skeleton({ label }: { label: string }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center rounded-2xl border border-white/10 bg-black/20"
      data-testid="model-lab-skeleton"
    >
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export type { ModelLabViewerProps, ViewerApi, ViewerStatus, EnvMode, PresentationMode } from "./viewer.internal";

export default function ModelLabViewerClient(props: ModelLabViewerProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <Skeleton label="Preparing 3D viewer…" />;

  return (
    <Suspense fallback={<Skeleton label="Loading 3D viewer…" />}>
      <Internal {...props} />
    </Suspense>
  );
}
