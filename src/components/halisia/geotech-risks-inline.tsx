import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getGeotechIntel, type GeotechIntel } from "@/lib/geotech.functions";
import { RiskSection } from "./geotech-panel";

/**
 * Compact wrapper that surfaces the same construction-risks + mitigation
 * + KES/m² cost cards from the Geotech panel into other tabs (Overview,
 * Nearby Amenities) so users see the risk story alongside the location
 * they searched.
 */
export function GeotechRisksInline({ lat, lng }: { lat: number; lng: number }) {
  const q = useQuery<GeotechIntel>({
    queryKey: ["geotech", lat.toFixed(4), lng.toFixed(4)],
    queryFn: () => getGeotechIntel({ data: { lat, lng } }),
    staleTime: 15 * 60 * 1000,
  });
  if (q.error)
    return <p role="status">Construction screening unavailable. The data request failed.</p>;
  if (q.isLoading || !q.data) {
    return (
      <div className="glass rounded-2xl p-4 text-xs text-muted-foreground inline-flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-accent" /> Loading construction risks…
      </div>
    );
  }
  return <RiskSection g={q.data} />;
}
