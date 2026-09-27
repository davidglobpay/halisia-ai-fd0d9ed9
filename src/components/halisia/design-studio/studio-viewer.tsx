import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import type { StudioViewerProps } from "./studio-viewer.internal";

const Internal = lazy(() => import("./studio-viewer.internal"));

function Fallback() {
  return (
    <div className="grid h-full min-h-[420px] place-items-center bg-black/20 text-sm text-muted-foreground">
      Preparing the concept scene…
    </div>
  );
}

export function StudioViewer(props: StudioViewerProps) {
  return (
    <ClientOnly fallback={<Fallback />}>
      <Suspense fallback={<Fallback />}>
        <Internal {...props} />
      </Suspense>
    </ClientOnly>
  );
}