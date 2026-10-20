import { useState } from "react";
import type { EvidencePosition, MapEvidence } from "@/lib/map-evidence";
import { mapPreviewTiles, PREVIEW_LAYERS, type EvidenceMapLayer } from "@/lib/map-evidence-preview";

export function MapEvidencePreview({
  item,
  target,
  selected,
  onFocus,
}: {
  item: MapEvidence;
  target: EvidencePosition;
  selected: boolean;
  onFocus: () => void;
}) {
  const [layer, setLayer] = useState<EvidenceMapLayer>("satellite");
  const scope =
    item.positionScope === "place"
      ? "Provider-reported place"
      : item.positionScope === "sample"
        ? "Regional sampling context"
        : item.positionScope === "supplied"
          ? "User-supplied point"
          : "Location context";
  // Regional estimates must not gain parcel-level visual precision.
  const zoom = item.positionScope === "sample" ? 12 : layer === "terrain" ? 17 : 18;
  return (
    <figure className="mt-3 min-w-0" aria-label={`Map context for ${item.label}`}>
      <div
        className="mb-2 flex flex-wrap gap-1"
        role="group"
        aria-label={`Map layer for ${item.label}`}
      >
        {(Object.keys(PREVIEW_LAYERS) as EvidenceMapLayer[]).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={layer === value}
            onClick={() => setLayer(value)}
            className="min-h-11 rounded-lg border border-foreground/20 px-3 text-xs aria-pressed:bg-primary/15"
          >
            {PREVIEW_LAYERS[value].label}
          </button>
        ))}
      </div>
      <TileImage
        key={`${target.lat}:${target.lng}:${layer}:${zoom}`}
        target={target}
        layer={layer}
        zoom={zoom}
        label={item.label}
        selected={selected}
        onFocus={onFocus}
      />
      {item.positionScope === "place" && (
        <a
          href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${target.lat},${target.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-foreground/20 px-3 text-xs font-semibold"
          aria-label={`Open Street View near ${item.label}`}
        >
          Street View · nearby coverage
        </a>
      )}
      <figcaption className="mt-2 space-y-1 text-xs text-muted-foreground">
        <p>
          {scope} · {target.lat.toFixed(5)}, {target.lng.toFixed(5)}
        </p>
        <p>{PREVIEW_LAYERS[layer].attribution}</p>
        <p>
          {layer === "satellite"
            ? "Imagery capture date unavailable. The pin marks the recorded coordinate, not a verified parcel."
            : layer === "terrain"
              ? "Reference relief and contours; not a measured site slope or flood assessment."
              : "Reference map features; not proof of current ground conditions or legal access."}
        </p>
        <p>
          This view does not independently confirm the written finding. Select the image to inspect
          its location on the main map.
        </p>
      </figcaption>
    </figure>
  );
}

function TileImage({
  target,
  layer,
  zoom,
  label,
  selected,
  onFocus,
}: {
  target: EvidencePosition;
  layer: EvidenceMapLayer;
  zoom: number;
  label: string;
  selected: boolean;
  onFocus: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const tiles = mapPreviewTiles(target, layer, zoom);
  if (!tiles || failed) {
    return (
      <div role="status" className="rounded-lg border border-foreground/15 bg-muted p-4 text-sm">
        Map image unavailable. No substitute image has been generated. The recorded coordinates and
        source remain below.
      </div>
    );
  }
  return (
    <button
      type="button"
      aria-label={`Inspect map evidence for ${label}`}
      aria-pressed={selected}
      onClick={onFocus}
      className="relative block h-52 w-full max-w-lg overflow-hidden rounded-lg border border-foreground/20 bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      data-testid="map-evidence-preview"
    >
      <span
        className="absolute inset-0"
        role="img"
        aria-label={`${PREVIEW_LAYERS[layer].label} reference view centered on ${target.lat.toFixed(5)}, ${target.lng.toFixed(5)}; not independent verification`}
      >
        {tiles.map((tile) => (
          <img
            key={tile.src}
            src={tile.src}
            alt=""
            loading="lazy"
            decoding="async"
            width={256}
            height={256}
            onLoad={() => setLoaded((count) => count + 1)}
            onError={() => setFailed(true)}
            className="pointer-events-none absolute max-w-none"
            style={{ left: `calc(50% + ${tile.left}px)`, top: `calc(50% + ${tile.top}px)` }}
          />
        ))}
      </span>
      {loaded === tiles.length ? (
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-600 shadow-md"
        />
      ) : (
        <span
          role="status"
          className="absolute inset-x-0 top-2 mx-auto w-fit rounded bg-background/90 px-2 py-1 text-xs"
        >
          Loading map image…
        </span>
      )}
      <span className="absolute bottom-2 left-2 rounded bg-background/90 px-2 py-1 text-xs">
        {PREVIEW_LAYERS[layer].label} context · zoom {zoom}
      </span>
    </button>
  );
}
