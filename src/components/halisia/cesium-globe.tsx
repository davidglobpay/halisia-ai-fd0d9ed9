import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { MapFrame } from "./map-frame";

const Inner = lazy(() => import("./cesium-globe.internal"));

function Fallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin text-accent" /> Preparing 3D globe…
    </div>
  );
}

export function CesiumGlobe(props: { lat: number; lng: number; label: string }) {
  return (
    <MapFrame>
      <ClientOnly fallback={<Fallback />}>
        <Suspense fallback={<Fallback />}>
          <Inner {...props} />
        </Suspense>
      </ClientOnly>
    </MapFrame>
  );
}
