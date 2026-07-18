import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import type { LocationIntel } from "@/lib/location-intel.functions";
import { MapFrame } from "./map-frame";

const Inner = lazy(() => import("./heatmap.internal"));

function Fallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin text-accent" /> Building density heatmap…
    </div>
  );
}

export function HeatmapMap(props: { lat: number; lng: number; intel: LocationIntel | undefined }) {
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
