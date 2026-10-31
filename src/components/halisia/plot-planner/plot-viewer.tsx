import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import type { PlotViewerProps } from "./plot-viewer.internal";

const Internal = lazy(() => import("./plot-viewer.internal"));

function Fallback() {
  return (
    <div className="grid h-full place-items-center bg-black/10 text-sm text-muted-foreground">
      Preparing the plot view…
    </div>
  );
}

export function PlotViewer(props: PlotViewerProps) {
  return (
    <ClientOnly fallback={<Fallback />}>
      <Suspense fallback={<Fallback />}>
        <Internal {...props} />
      </Suspense>
    </ClientOnly>
  );
}
