import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { MapFrame } from "./map-frame";

const InnerLeaflet = lazy(() => import("./leaflet-layers-map.internal"));

function Fallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin text-accent" /> Loading multi-source GIS map…
    </div>
  );
}

export function LeafletLayersMap(props: { lat: number; lng: number; label: string }) {
  // The measuring toolbar (Distance, Area, Draw, Export) sits top-left, where
  // MapFrame's Back button would cover "Distance". The page and the browser
  // already offer Back, so this map leaves it out, like the county map.
  return (
    <MapFrame showBack={false}>
      <ClientOnly fallback={<Fallback />}>
        <Suspense fallback={<Fallback />}>
          <InnerLeaflet {...props} />
        </Suspense>
      </ClientOnly>
    </MapFrame>
  );
}
