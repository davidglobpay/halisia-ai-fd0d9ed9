import { lazy, Suspense, type Ref } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import type { SpatialCanvasHandle, SpatialCanvasProps } from "./spatial-canvas.internal";

const Inner = lazy(() => import("./spatial-canvas.internal"));

export type { SpatialCanvasHandle };

function Fallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin text-accent" /> Preparing spatial engine…
    </div>
  );
}

/**
 * SSR-safe wrapper for the Three.js/WebXR parcel canvas. The Three.js module
 * graph is only imported in the browser.
 */
export function SpatialCanvas(
  props: Omit<SpatialCanvasProps, "handleRef"> & { handleRef?: Ref<SpatialCanvasHandle> },
) {
  return (
    <ClientOnly fallback={<Fallback />}>
      <Suspense fallback={<Fallback />}>
        <Inner {...props} />
      </Suspense>
    </ClientOnly>
  );
}
