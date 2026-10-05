import { useCallback, useMemo, useState } from "react";
import { Pencil, RotateCcw, Ruler, Scaling, Trash2, Undo2 } from "lucide-react";
import { MapView } from "@/components/halisia/map-view";
import { ReadAloud } from "@/components/halisia/read-aloud";
import {
  areaM2,
  describeArea,
  edges,
  fitToArea,
  fromLocalMetres,
  parseArea,
  perimeterM,
  toLocalMetres,
  type LatLng,
} from "@/lib/parcel-geometry";

/**
 * Draw the parcel boundary, then fit it to the area on the deed.
 *
 * This is the last step that a person can do from a phone, and it is also the
 * step most easily mistaken for something it is not. Scaling a drawn shape
 * until its area matches the deed does NOT make it the correct parcel: a shape
 * of the right size in the wrong place is still the wrong land. Everything
 * here is labelled a sketch, the fit is reversible, and the panel says plainly
 * who does set a boundary.
 *
 * What it is good for is real: a buyer can see whether the plot they were
 * walked around is anywhere near the size the deed claims. On a 0.044 Ha plot,
 * a boundary walked ten metres wide on each side is a third more land than was
 * sold, and nothing on a title search would ever show it.
 */

type Mode = "idle" | "drawing" | "editing";

export function ParcelDraw({
  center,
  deedAreaText,
  className = "",
}: {
  /** Where the map opens — normally the pin the user placed in Step 1. */
  center: LatLng;
  /** The area as printed on the deed, e.g. "0.0440HA." Optional. */
  deedAreaText?: string | null;
  className?: string;
}) {
  const [ring, setRing] = useState<LatLng[]>([]);
  const [mode, setMode] = useState<Mode>("idle");
  const [history, setHistory] = useState<LatLng[][]>([]);
  const [fitted, setFitted] = useState<{ factor: number; errorPct: number } | null>(null);

  const deedArea = useMemo(
    () => (deedAreaText ? parseArea(deedAreaText) : null),
    [deedAreaText],
  );

  // All measurement happens on a local east/north plane centred on the ring
  // itself, so a parcel never straddles a projection seam.
  const origin = ring.length ? ring[0] : center;
  const local = useMemo(() => toLocalMetres(ring, origin), [ring, origin]);
  const area = ring.length >= 3 ? areaM2(local) : 0;
  const perimeter = ring.length >= 2 ? perimeterM(local) : 0;
  const sides = ring.length >= 3 ? edges(local) : [];

  const push = useCallback(
    (next: LatLng[]) => {
      setHistory((h) => [...h.slice(-19), ring]);
      setRing(next);
      setFitted(null);
    },
    [ring],
  );

  const addPoint = useCallback(
    (p: { lat: number; lng: number }) => {
      if (mode !== "drawing") return;
      push([...ring, { lat: p.lat, lng: p.lng }]);
    },
    [mode, push, ring],
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      setRing(h[h.length - 1]);
      setFitted(null);
      return h.slice(0, -1);
    });
  }, []);

  const clear = useCallback(() => {
    setHistory((h) => [...h.slice(-19), ring]);
    setRing([]);
    setMode("idle");
    setFitted(null);
  }, [ring]);

  const applyFit = useCallback(() => {
    if (!deedArea || ring.length < 3) return;
    const res = fitToArea(local, deedArea.m2);
    if (!res) return;
    push(fromLocalMetres(res.ring, origin));
    setFitted({ factor: res.factor, errorPct: res.errorPct });
  }, [deedArea, local, origin, push, ring.length]);

  const diffPct =
    deedArea && area > 0 ? ((area - deedArea.m2) / deedArea.m2) * 100 : null;

  const spoken = [
    ring.length < 3
      ? "No boundary drawn yet. Tap Draw, then tap each corner of the plot on the satellite view."
      : `Boundary drawn with ${ring.length} corners. Area ${describeArea(area)}. Perimeter ${Math.round(perimeter)} metres.`,
    deedArea && ring.length >= 3
      ? `The deed says ${describeArea(deedArea.m2)}. Your drawing is ${Math.abs(diffPct ?? 0).toFixed(0)} percent ${
          (diffPct ?? 0) >= 0 ? "larger" : "smaller"
        } than that.`
      : "",
    sides.length
      ? `Sides: ${sides.map((e) => `${e.lengthM.toFixed(1)} metres bearing ${Math.round(e.bearingDeg)} degrees`).join(", ")}.`
      : "",
    "This is a sketch you drew. It is not a survey, it does not fix a boundary, and a shape of the right size in the wrong place is still the wrong land. Only a licensed surveyor sets beacons.",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`rounded-2xl glass border border-white/10 p-4 ${className}`}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Step 3 · The boundary
          </div>
          <h3 className="mt-0.5 text-base font-semibold leading-tight">Sketch the plot</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Tap each corner on the satellite view. Measurements update as you go, and you can check
            them against the area on the deed.
          </p>
        </div>
        <ReadAloud text={spoken} label="Listen" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode(mode === "drawing" ? "idle" : "drawing")}
          aria-pressed={mode === "drawing"}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
            mode === "drawing"
              ? "bg-primary text-primary-foreground"
              : "glass border border-white/12 hover:bg-white/5"
          }`}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          {mode === "drawing" ? "Tap corners…" : ring.length ? "Add corners" : "Draw"}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "editing" ? "idle" : "editing")}
          disabled={ring.length < 3}
          aria-pressed={mode === "editing"}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
            mode === "editing"
              ? "bg-primary text-primary-foreground"
              : "glass border border-white/12 hover:bg-white/5"
          }`}
        >
          <Scaling className="h-3.5 w-3.5" aria-hidden="true" />
          Adjust corners
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={!history.length}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full glass border border-white/12 px-3.5 py-1.5 text-xs transition hover:bg-white/5 disabled:opacity-50"
        >
          <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
          Undo
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={!ring.length}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full glass border border-white/12 px-3.5 py-1.5 text-xs transition hover:bg-white/5 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Clear
        </button>
      </div>

      <div className="relative mt-3 h-[360px] overflow-hidden rounded-xl border border-white/10">
        <MapView
          center={center}
          zoom={18}
          marker={null}
          mapType="satellite"
          theme="light"
          polygon={ring.length >= 3 ? ring : null}
          polygonEditable={mode === "editing"}
          onPolygonChange={(next) => {
            setRing(next);
            setFitted(null);
          }}
          onMapClick={addPoint}
          className="absolute inset-0"
        />
        {mode === "drawing" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
            <span className="glass rounded-full px-3 py-1 text-[11px]">
              {ring.length < 3
                ? `Tap each corner · ${ring.length} placed, ${3 - ring.length} more to close a shape`
                : `${ring.length} corners · tap to add more, or press Draw again to stop`}
            </span>
          </div>
        )}
      </div>

      {ring.length >= 3 && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Area" value={describeArea(area)} />
            <Stat label="Perimeter" value={`${Math.round(perimeter)} m`} />
            <Stat label="Corners" value={String(ring.length)} />
            {deedArea && (
              <Stat
                label="Deed says"
                value={describeArea(deedArea.m2)}
                tone={
                  diffPct == null ? undefined : Math.abs(diffPct) <= 5 ? "good" : "warn"
                }
              />
            )}
          </div>

          {deedArea && diffPct != null && (
            <div
              data-testid="area-vs-deed"
              className={`mt-2 rounded-xl border p-3 text-xs ${
                Math.abs(diffPct) <= 5
                  ? "border-primary/30 bg-primary/5"
                  : "border-amber-glow/40 bg-amber-glow/5"
              }`}
            >
              <p className="text-foreground">
                Your sketch is{" "}
                <span className="font-semibold tabular-nums">
                  {Math.abs(diffPct).toFixed(1)}% {diffPct >= 0 ? "larger" : "smaller"}
                </span>{" "}
                than the area on the deed.
                {Math.abs(diffPct) > 5 && (
                  <>
                    {" "}
                    That is a gap worth walking again before money moves — on a plot this size it is{" "}
                    <span className="tabular-nums">
                      {Math.abs(Math.round(area - deedArea.m2))} m²
                    </span>{" "}
                    of difference.
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={applyFit}
                className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full glass border border-white/12 px-3.5 py-1.5 text-xs transition hover:bg-white/5"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Resize my sketch to the deed&rsquo;s area
              </button>
              {fitted && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Resized about its own centre by ×{fitted.factor.toFixed(3)}, keeping the shape you
                  drew. It now measures the deed&rsquo;s area — which says nothing about whether it
                  sits over the right ground. Undo puts your original back.
                </p>
              )}
            </div>
          )}

          <details className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1.5 text-xs font-medium">
              <Ruler className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              Side lengths and bearings
              <span className="ml-auto text-[11px] text-muted-foreground">
                {sides.length} sides
              </span>
            </summary>
            <ul className="mt-2 grid gap-1 font-mono text-[11px] text-foreground/85">
              {sides.map((e, i) => (
                <li key={i} className="flex justify-between gap-3 tabular-nums">
                  <span className="text-muted-foreground">
                    {i + 1} → {((i + 1) % sides.length) + 1}
                  </span>
                  <span>{e.lengthM.toFixed(1)} m</span>
                  <span className="text-muted-foreground">
                    {Math.round(e.bearingDeg)}° {e.compass}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 font-sans text-[11px] text-muted-foreground">
              This is the form a surveyor&rsquo;s plan states a parcel in. Take these numbers to a
              surveyor and you will be understood.
            </p>
          </details>
        </>
      )}

      <p className="mt-3 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-muted-foreground">
        A sketch you drew, measured. It is not a survey and it does not fix a boundary. Resizing it
        to the deed&rsquo;s area changes its size, never its position — a shape of the right size in
        the wrong place is still the wrong land. A licensed surveyor sets beacons; an advocate
        confirms title.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 text-sm font-semibold tabular-nums ${
          tone === "warn" ? "text-amber-glow" : tone === "good" ? "text-accent" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
