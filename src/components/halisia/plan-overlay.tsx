import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Info,
  Move,
  RotateCcw,
  Layers,
} from "lucide-react";
import { MapView } from "@/components/halisia/map-view";
import { ReadAloud } from "@/components/halisia/read-aloud";
import {
  centroid,
  describeArea,
  edges,
  fromLocalMetres,
  toLocalMetres,
  type LatLng,
} from "@/lib/parcel-geometry";
import {
  shapeForPlot,
  ringAt,
  nudge,
  fitAgainstBoundary,
  describeFit,
  type PlanShape,
  type PlanFit,
} from "@/lib/plan-overlay";
import type { MutationPlan } from "@/lib/mutation-plan";

/**
 * Step 7: lay the surveyor's plot over the land, by hand.
 *
 * The sheet gives a shape and a size. It gives no coordinates and no north
 * arrow, so there is no transform from paper to ground and this does not
 * pretend there is one. The plot is drawn at true scale and the person moves
 * and turns it, because they are the one who has stood on the land.
 *
 * The payoff is the comparison. Once the sheet's plot sits over the boundary
 * drawn in step 3, the two can be measured against each other, and a plot that
 * cannot be made to sit over the land they traced is a finding worth more than
 * either document alone.
 */
export function PlanOverlay({
  plan,
  boundary,
  pin,
  onPlacementChange,
  className = "",
}: {
  /** Step 2's parsed mutation plan. Null until one is uploaded. */
  plan: MutationPlan | null;
  /** Step 3's drawn boundary, for the comparison. May be empty. */
  boundary: LatLng[];
  /** Step 1's pin, used as the first resting place for the plot. */
  pin: LatLng | null;
  onPlacementChange?: (
    v: { ring: LatLng[]; shape: PlanShape; rotationDeg: number; fit: PlanFit | null } | null,
  ) => void;
  className?: string;
}) {
  const [areaPick, setAreaPick] = useState<number | null>(null);
  const [centre, setCentre] = useState<LatLng | null>(null);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [aspect, setAspect] = useState(1);

  /** Distinct plot sizes on the sheet, each with every dimension tied to one. */
  const sizes = useMemo(() => {
    if (!plan) return [];
    const byArea = new Map<number, { areaM2: number; count: number; dimsM: number[] }>();
    for (const p of plan.plots) {
      const e = byArea.get(p.areaM2) ?? { areaM2: p.areaM2, count: 0, dimsM: [] };
      e.count += 1;
      e.dimsM.push(...p.dimsM);
      byArea.set(p.areaM2, e);
    }
    return [...byArea.values()].sort((a, b) => a.areaM2 - b.areaM2);
  }, [plan]);

  const chosen = useMemo(
    () => sizes.find((s) => s.areaM2 === areaPick) ?? sizes[0] ?? null,
    [sizes, areaPick],
  );

  const shape = useMemo(
    () =>
      chosen
        ? shapeForPlot({ areaM2: chosen.areaM2, dimsM: chosen.dimsM }, plan?.dimensionsM ?? [], aspect)
        : null,
    [chosen, plan, aspect],
  );

  /** Where the plot rests before anyone moves it. */
  const defaultCentre = useMemo((): LatLng | null => {
    if (boundary.length >= 3) {
      const c = centroid(toLocalMetres(boundary, boundary[0]));
      return fromLocalMetres([c], boundary[0])[0];
    }
    return pin;
  }, [boundary, pin]);

  const here = centre ?? defaultCentre;

  const ring = useMemo(
    () => (shape && here ? ringAt(shape, here, rotationDeg) : null),
    [shape, here, rotationDeg],
  );

  const fit = useMemo(
    () => (ring && boundary.length >= 3 ? fitAgainstBoundary(ring, boundary) : null),
    [ring, boundary],
  );

  /** The bearing of the longest side the person drew, to align against. */
  const boundaryBearing = useMemo(() => {
    if (boundary.length < 3) return null;
    const es = edges(toLocalMetres(boundary, boundary[0]));
    if (!es.length) return null;
    return es.reduce((best, e) => (e.lengthM > best.lengthM ? e : best), es[0]).bearingDeg;
  }, [boundary]);

  // Lift the placement without making the parent a render dependency.
  const pendingRef = useRef<{
    ring: LatLng[];
    shape: PlanShape;
    rotationDeg: number;
    fit: PlanFit | null;
  } | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  const cbRef = useRef(onPlacementChange);
  cbRef.current = onPlacementChange;
  useEffect(() => {
    const next = pendingRef.current;
    if (!next) return;
    const key = JSON.stringify({
      r: next.ring.map((p) => [p.lat.toFixed(7), p.lng.toFixed(7)]),
      d: next.rotationDeg,
    });
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    cbRef.current?.(next);
  });
  pendingRef.current = ring && shape ? { ring, shape, rotationDeg, fit } : null;

  const reading = fit ? describeFit(fit) : null;

  const spoken = !plan
    ? "Upload the surveyor's plan in step two first."
    : [
        shape
          ? `The plot from the sheet is ${shape.widthM.toFixed(1)} by ${shape.depthM.toFixed(1)} metres.`
          : "No plot size could be read from the sheet.",
        here ? "It is drawn on the map at that size." : "Place your pin or draw the plot first.",
        reading ? reading.text : "Draw your boundary in step three to compare the two.",
        "Where this sits and which way it points is your doing. It is a tracing over imagery, not a survey.",
      ]
        .filter(Boolean)
        .join(" ");

  if (!plan) {
    return (
      <div className={`rounded-2xl glass border border-white/10 p-4 ${className}`}>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Step 7 · Place the surveyor&rsquo;s plan
        </div>
        <h3 className="mt-0.5 text-base font-semibold leading-tight">Upload a plan first</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Once you upload the mutation PDF in step 2, the plot it describes can be drawn on the map
          at its true size and laid over the land you drew.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl glass border border-white/10 p-4 ${className}`}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Step 7 · Place the surveyor&rsquo;s plan
          </div>
          <h3 className="mt-0.5 text-base font-semibold leading-tight">
            Lay the plot over the land
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            The plot from the sheet, drawn at its true size. Tap the map to move it, turn it to face
            the right way, then see how well it agrees with the boundary you drew.
          </p>
        </div>
        <ReadAloud text={spoken} label="Listen" />
      </div>

      {/* The one thing that must never be misread. */}
      <div className="mt-3 flex items-start gap-2 rounded-xl border-l-4 border-destructive bg-destructive/5 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-destructive" aria-hidden="true" />
        <p className="text-[11px] leading-relaxed text-foreground">
          A mutation plan carries no coordinates and no north arrow. <strong>Where this sits and
          which way it points is your doing</strong> &mdash; not the surveyor&rsquo;s and not
          HALISIA&rsquo;s. This is tracing paper over imagery. It is not georeferencing, not a
          survey, and it establishes nothing about where the legal boundary runs.
        </p>
      </div>

      {sizes.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No plot sizes were read from that sheet, so there is nothing to draw.
        </p>
      ) : (
        <>
          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Which plot on the sheet is yours?
            </div>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {sizes.map((s) => (
                <li key={s.areaM2}>
                  <button
                    type="button"
                    onClick={() => setAreaPick(s.areaM2)}
                    className={`min-h-[36px] rounded-full border px-3 py-1.5 text-[11px] transition ${
                      chosen?.areaM2 === s.areaM2
                        ? "border-accent bg-accent/15 text-foreground"
                        : "border-white/10 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {describeArea(s.areaM2)}
                    <span className="ml-1 text-muted-foreground">&times;{s.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {shape && (
            <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-sm">
                  {shape.widthM.toFixed(1)} &times; {shape.depthM.toFixed(1)} m
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {shape.basis === "dimensions"
                    ? "both sides printed on the sheet"
                    : "area from the sheet, proportions chosen by you"}
                </span>
              </div>
              {shape.check && (
                <p
                  className={`mt-1 text-[11px] ${
                    shape.check.consistent ? "text-muted-foreground" : "text-destructive"
                  }`}
                >
                  {shape.check.consistent ? (
                    <>
                      Those sides multiply to {Math.round(shape.check.computedM2)} m&sup2; against a
                      printed {Math.round(shape.check.statedM2)} m&sup2; &mdash;{" "}
                      {Math.abs(shape.check.errorPct).toFixed(1)}% apart, which rounding explains.
                    </>
                  ) : (
                    <>
                      The sides multiply to {Math.round(shape.check.computedM2)} m&sup2; but the
                      sheet prints {Math.round(shape.check.statedM2)} m&sup2; &mdash;{" "}
                      {Math.abs(shape.check.errorPct).toFixed(1)}% apart. The sheet disagrees with
                      itself; ask the surveyor which figure is right.
                    </>
                  )}
                </p>
              )}
              {shape.basis === "area-and-proportion" && (
                <label className="mt-2 block">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Shape &mdash; depth against width
                  </span>
                  <input
                    type="range"
                    min={0.25}
                    max={4}
                    step={0.05}
                    value={aspect}
                    onChange={(e) => setAspect(parseFloat(e.target.value))}
                    className="mt-1 w-full"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    The sheet printed only an area for this plot, so the shape is your choice. The
                    area stays {describeArea(shape.areaM2)} whatever you pick.
                  </span>
                </label>
              )}
            </div>
          )}

          {!here ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              <span>
                Place your pin in step 1, or draw the boundary in step 3, and the plot will appear on
                the map ready to move.
              </span>
            </div>
          ) : (
            <>
              <MapView
                center={here}
                zoom={19}
                mapType="satellite"
                polygon={boundary.length >= 3 ? boundary : null}
                overlayPolygons={
                  ring ? [{ ring, color: "#C08A2E", fillOpacity: 0.28 }] : null
                }
                onMapClick={(loc) => setCentre({ lat: loc.lat, lng: loc.lng })}
                className="mt-3 h-64 w-full rounded-xl"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                <Move className="mr-1 inline h-3 w-3" aria-hidden="true" />
                Tap anywhere on the map to move the plot there. The green outline is the boundary you
                drew; the gold one is the plot from the sheet.
              </p>

              <div className="mt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Turn it
                  </span>
                  <span className="font-mono text-xs tabular-nums">{rotationDeg}&deg;</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={359}
                  step={1}
                  value={rotationDeg}
                  onChange={(e) => setRotationDeg(parseInt(e.target.value, 10))}
                  aria-label="Rotation in degrees"
                  className="mt-1 w-full"
                />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {boundaryBearing != null && (
                    <button
                      type="button"
                      onClick={() => setRotationDeg(Math.round(boundaryBearing) % 180)}
                      className="min-h-[36px] rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <Compass className="mr-1 inline h-3 w-3" aria-hidden="true" />
                      Align to my longest side
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setRotationDeg(0);
                      setCentre(null);
                    }}
                    className="min-h-[36px] rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="mr-1 inline h-3 w-3" aria-hidden="true" />
                    Start again
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Nudge it, one metre at a time
                </span>
                <div className="mt-1.5 grid w-40 grid-cols-3 gap-1">
                  <span />
                  <Nudge label="N" onClick={() => setCentre(nudge(here, 0, 1))} />
                  <span />
                  <Nudge label="W" onClick={() => setCentre(nudge(here, -1, 0))} />
                  <span />
                  <Nudge label="E" onClick={() => setCentre(nudge(here, 1, 0))} />
                  <span />
                  <Nudge label="S" onClick={() => setCentre(nudge(here, 0, -1))} />
                  <span />
                </div>
              </div>

              {reading && fit && (
                <div
                  data-testid="plan-boundary-fit"
                  className={`mt-3 flex items-start gap-2 rounded-xl border p-3 text-xs ${
                    reading.tone === "good"
                      ? "border-primary/30 bg-primary/5"
                      : reading.tone === "warn"
                        ? "border-amber-glow/30 bg-amber-glow/5"
                        : "border-destructive/40 bg-destructive/5"
                  }`}
                >
                  {reading.tone === "good" ? (
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 flex-none text-primary"
                      aria-hidden="true"
                    />
                  ) : (
                    <AlertTriangle
                      className={`mt-0.5 h-4 w-4 flex-none ${
                        reading.tone === "warn" ? "text-amber-glow" : "text-destructive"
                      }`}
                      aria-hidden="true"
                    />
                  )}
                  <span className="text-foreground">{reading.text}</span>
                </div>
              )}

              {!fit && (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  <Layers className="mr-1 inline h-3 w-3" aria-hidden="true" />
                  Draw your boundary in step 3 and the two will be measured against each other here.
                </p>
              )}
            </>
          )}
        </>
      )}

      <p className="mt-3 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-muted-foreground">
        The size comes from the sheet. The position and the angle come from you. Agreement between
        the two outlines means the shape you drew matches the shape the surveyor drew &mdash; it says
        nothing about whether either one is on the right land, and nothing about ownership. A
        licensed surveyor fixes beacons; an advocate confirms title.
      </p>
    </div>
  );
}

function Nudge({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Move the plot one metre ${
        label === "N" ? "north" : label === "S" ? "south" : label === "E" ? "east" : "west"
      }`}
      className="flex h-9 w-full items-center justify-center rounded-lg border border-white/10 text-xs font-medium text-foreground hover:bg-white/5"
    >
      {label}
    </button>
  );
}
