import { useState } from "react";
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react";

// Mapillary offers a public embeddable Street-Level viewer — no auth required.
// Docs: https://www.mapillary.com/developer/api-documentation
export function MapillaryView({
  lat,
  lng,
  address,
}: {
  lat: number;
  lng: number;
  address: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const src = `https://www.mapillary.com/embed?lat=${lat}&lng=${lng}&z=17&style=photo`;
  const explore = `https://www.mapillary.com/app/?lat=${lat}&lng=${lng}&z=17`;

  return (
    <div className="space-y-2">
      <div className="relative h-[420px] rounded-2xl overflow-hidden border border-white/10 bg-[#050d24]">
        <iframe
          title={`Street-level imagery near ${address}`}
          src={src}
          className="absolute inset-0 h-full w-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allow="fullscreen"
          onLoad={() => setLoaded(true)}
          onError={() => setError("Mapillary refused to embed for this point")}
        />
        {!loaded && !error && (
          <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground pointer-events-none">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-accent" /> Finding nearest Mapillary
              imagery…
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center text-center p-6">
            <div>
              <AlertTriangle className="mx-auto h-5 w-5 text-amber-glow" />
              <div className="mt-2 text-sm">{error}</div>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
        <span>
          Street-level & aerial imagery by community contributors via Mapillary (Meta). Coverage
          varies by area.
        </span>
        <a
          href={explore}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-accent hover:underline"
        >
          Open in Mapillary <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}