import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

const InnerLeaflet = lazy(() => import("./leaflet-layers-map.internal"));

function Fallback() {
  return (
    <div className="h-[420px] rounded-2xl border border-white/10 flex items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin text-accent" /> Loading multi-source GIS map…
    </div>
  );
}

export function LeafletLayersMap(props: { lat: number; lng: number; label: string }) {
  return (
    <ClientOnly fallback={<Fallback />}>
      <Suspense fallback={<Fallback />}>
        <InnerLeaflet {...props} />
      </Suspense>
    </ClientOnly>
  );
}
