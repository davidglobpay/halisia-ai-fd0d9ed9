import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, CheckCircle2, Info, Ruler, XCircle } from "lucide-react";
import { MapView } from "@/components/halisia/map-view";
import { ReadAloud } from "@/components/halisia/read-aloud";
import {
  areaM2,
  describeArea,
  fromLocalMetres,
  toLocalMetres,
  type LatLng,
} from "@/lib/parcel-geometry";
import { buildableEnvelope, fitFootprint, groundCoveragePct, isConvex } from "@/lib/buildable";

/**
 * What can be built here, and a brief to take to an architect.
 *
 * This is the last step that is honest to automate. The geometry is real: given
 * the boundary drawn in Step 3 and the setbacks that apply, the envelope and
 * the fit are arithmetic, and they are computed rather than guessed.
 *
 * What is NOT automated here, deliberately: the design. A questionnaire that
 * produced "your 4-bedroom house" from six answers would be inventing an
 * architect's work and presenting it as a result. What it produces instead is
 * a brief — the plot's real constraints plus what the person wants — which is
 * the document an architect actually asks for at the first meeting.
 *
 * Setbacks are not law in this component either. The defaults are pre-filled
 * and editable and are labelled as commonly used figures to confirm with the
 * county, because they vary by county, zone and road class.
 */

const USES = [
  { id: "home", label: "A home to live in" },
  { id: "rental", label: "Rental units" },
  { id: "mixed", label: "Shop below, homes above" },
  { id: "commercial", label: "Commercial" },
] as const;
type UseId = (typeof USES)[number]["id"];

export function BuildBrief({
  boundary,
  onBriefChange,
  className = "",
}: {
  /** The ring drawn in Step 3. Fewer than three points renders a prompt. */
  boundary: LatLng[];
  /** Reports the setbacks and the assembled brief so the report can carry them. */
  onBriefChange?: (v: { setbacks: { frontM: number; sideM: number }; briefText: string }) => void;
  className?: string;
}) {
  const [frontM, setFrontM] = useState(6);
  const [sideM, setSideM] = useState(3);
  const [widthM, setWidthM] = useState(8);
  const [depthM, setDepthM] = useState(12);
  const [storeys, setStoreys] = useState(1);
  const [use, setUse] = useState<UseId>("home");
  const [bedrooms, setBedrooms] = useState(3);
  const [notes, setNotes] = useState("");

  const origin = boundary.length ? boundary[0] : null;
  const local = useMemo(() => (origin ? toLocalMetres(boundary, origin) : []), [boundary, origin]);

  const plotArea = local.length >= 3 ? areaM2(local) : 0;

  // The front setback is applied to the longest boundary, which on a Kenyan
  // subdivision plot is almost always the one facing the road. The person can
  // see the result on the map and change the figures if it is the wrong edge.
  const frontEdgeIndex = useMemo(() => {
    if (local.length < 3) return 0;
    let best = 0;
    let bestLen = -1;
    for (let i = 0; i < local.length; i++) {
      const a = local[i];
      const b = local[(i + 1) % local.length];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len > bestLen) {
        bestLen = len;
        best = i;
      }
    }
    return best;
  }, [local]);

  const env = useMemo(
    () =>
      local.length >= 3 ? buildableEnvelope(local, { allM: sideM, frontM, frontEdgeIndex }) : null,
    [local, sideM, frontM, frontEdgeIndex],
  );

  const fit = useMemo(
    () => (env?.buildable ? fitFootprint(env.ring, widthM, depthM) : null),
    [env, widthM, depthM],
  );

  const footprintM2 = widthM * depthM;
  const coverage = plotArea > 0 ? groundCoveragePct(plotArea, footprintM2) : null;
  const floorArea = footprintM2 * storeys;

  const overlays = useMemo(() => {
    if (!origin) return null;
    const out: { ring: LatLng[]; color: string; fillOpacity?: number }[] = [];
    if (env?.ring.length) {
      out.push({ ring: fromLocalMetres(env.ring, origin), color: "#147b35", fillOpacity: 0.12 });
    }
    if (fit?.ring.length) {
      out.push({
        ring: fromLocalMetres(fit.ring, origin),
        color: fit.fits ? "#2e7dd1" : "#b3261e",
        fillOpacity: 0.22,
      });
    }
    return out.length ? out : null;
  }, [env, fit, origin]);

  // Hooks must run before the early return below. The latest brief is written
  // to a ref during render and reported from this effect only when it changes.
  const onBriefChangeRef = useRef(onBriefChange);
  onBriefChangeRef.current = onBriefChange;
  const pendingBriefRef = useRef<{
    setbacks: { frontM: number; sideM: number };
    briefText: string;
  } | null>(null);
  const lastBriefKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const next = pendingBriefRef.current;
    if (!next) return;
    const key = JSON.stringify(next);
    if (key === lastBriefKeyRef.current) return;
    lastBriefKeyRef.current = key;
    onBriefChangeRef.current?.(next);
  });
  pendingBriefRef.current = null;

  if (boundary.length < 3) {
    return (
      <div className={`rounded-2xl glass border border-white/10 p-4 ${className}`}>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Step 4 · What you can build
        </div>
        <h3 className="mt-0.5 text-base font-semibold leading-tight">Draw the plot first</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Sketch the boundary in Step 3 and this works out the setbacks, the buildable area and
          whether a given house footprint fits.
        </p>
      </div>
    );
  }

  const spoken = [
    `The plot measures ${describeArea(plotArea)}.`,
    env?.buildable
      ? `With a ${frontM} metre front setback and ${sideM} metres elsewhere, ${describeArea(env.areaM2)} is left to build on.`
      : `With a ${frontM} metre front setback and ${sideM} metres elsewhere, nothing is left to build on. Check the setbacks with your county.`,
    env && !env.exact
      ? "This plot has a corner that turns inward, so the buildable area shown is a cautious under-estimate."
      : "",
    fit
      ? fit.fits
        ? `A ${widthM} by ${depthM} metre footprint fits, placed at the centre and square to the longest boundary.`
        : `A ${widthM} by ${depthM} metre footprint does not fit centred and square. A different position or angle might still work.`
      : "",
    coverage != null
      ? `That footprint covers ${coverage.toFixed(0)} percent of the plot. Counties cap ground coverage, so check the figure for your zone.`
      : "",
    "Setbacks are not law in this app. They change by county, by zone and by road class. These are commonly used figures to confirm with your county before anyone draws anything.",
  ]
    .filter(Boolean)
    .join(" ");

  // Omitted lines are null; an empty string is a real blank line. Filtering on
  // "" alone strips the section breaks too, and the brief comes out as one
  // undifferentiated block.
  const brief = [
    `PLOT`,
    `  Area as drawn: ${describeArea(plotArea)}`,
    `  Shape: ${isConvex(local) ? "convex" : "has an inward corner"}, ${boundary.length} corners`,
    ``,
    `SETBACKS USED (to be confirmed with the county)`,
    `  Front, on the longest boundary: ${frontM} m`,
    `  All other boundaries: ${sideM} m`,
    `  Buildable area: ${env?.buildable ? describeArea(env.areaM2) : "none at these setbacks"}`,
    env && !env.exact ? `  Note: an under-estimate, the plot has an inward corner` : null,
    ``,
    `WHAT I WANT TO BUILD`,
    `  Use: ${USES.find((u) => u.id === use)?.label}`,
    use === "home" || use === "rental" ? `  Bedrooms: ${bedrooms}` : null,
    `  Storeys: ${storeys}`,
    `  Footprint tested: ${widthM} m x ${depthM} m = ${footprintM2.toFixed(0)} m2`,
    `  Gross floor area at ${storeys} storey(s): ${floorArea.toFixed(0)} m2`,
    coverage != null ? `  Ground coverage: ${coverage.toFixed(1)}%` : null,
    fit ? `  Fit test: ${fit.fits ? "fits" : "does not fit"} - ${fit.method}` : null,
    notes.trim() ? `` : null,
    notes.trim() ? `NOTES` : null,
    notes.trim() ? `  ${notes.trim()}` : null,
    ``,
    `NOT ESTABLISHED BY THIS DOCUMENT`,
    `  Title, ownership and encumbrances`,
    `  The legal boundary position - the plot above is a sketch, not a survey`,
    `  Plot ratio, height limits, parking and services for this zone`,
    `  Any planning approval`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  // Reported from an effect, never during render: calling a parent's setState
  // inside this component's render pass is the classic cross-component update
  // warning, and in a loop it is a hang.
  pendingBriefRef.current = { setbacks: { frontM, sideM }, briefText: brief };

  return (
    <div className={`rounded-2xl glass border border-white/10 p-4 ${className}`}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Step 4 · What you can build
          </div>
          <h3 className="mt-0.5 text-base font-semibold leading-tight">The buildable envelope</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Set the setbacks, test a footprint, and take the brief to an architect.
          </p>
        </div>
        <ReadAloud text={spoken} label="Listen" />
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-glow/30 bg-amber-glow/5 p-3 text-[11px] leading-relaxed text-amber-glow">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
        <span>
          Setbacks are not law in this app. They change by county, by zone and by road class. The
          figures below are commonly used starting points — confirm yours with the county before
          anyone draws anything.
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Num label="Front setback" unit="m" value={frontM} onChange={setFrontM} min={0} max={30} />
        <Num label="Other sides" unit="m" value={sideM} onChange={setSideM} min={0} max={30} />
        <Num
          label="Footprint width"
          unit="m"
          value={widthM}
          onChange={setWidthM}
          min={1}
          max={200}
        />
        <Num
          label="Footprint depth"
          unit="m"
          value={depthM}
          onChange={setDepthM}
          min={1}
          max={200}
        />
      </div>

      <div className="relative mt-3 h-[320px] overflow-hidden rounded-xl border border-white/10">
        <MapView
          center={boundary[0]}
          zoom={18}
          marker={null}
          mapType="satellite"
          theme="light"
          polygon={boundary}
          overlayPolygons={overlays}
          className="absolute inset-0"
        />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <Key color="#c08a2e" label="Plot as drawn" />
        <Key color="#147b35" label="Buildable after setbacks" />
        <Key color={fit?.fits ? "#2e7dd1" : "#b3261e"} label="Footprint being tested" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Plot" value={describeArea(plotArea)} />
        <Stat
          label="Buildable"
          value={env?.buildable ? describeArea(env.areaM2) : "none"}
          tone={env?.buildable ? "good" : "warn"}
        />
        <Stat label="Footprint" value={`${footprintM2.toFixed(0)} m²`} />
        <Stat label="Ground coverage" value={coverage != null ? `${coverage.toFixed(1)}%` : "—"} />
      </div>

      {env && !env.exact && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          This plot has a corner that turns inward, so the buildable area is computed cautiously and
          is an under-estimate rather than an exact figure.
        </p>
      )}

      {fit && (
        <div
          data-testid="footprint-fit"
          className={`mt-3 flex items-start gap-2 rounded-xl border p-3 text-xs ${
            fit.fits ? "border-primary/30 bg-primary/5" : "border-destructive/40 bg-destructive/5"
          }`}
        >
          {fit.fits ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-primary" aria-hidden="true" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 flex-none text-destructive" aria-hidden="true" />
          )}
          <span>
            <span className="font-medium">
              {widthM} × {depthM} m {fit.fits ? "fits" : "does not fit"}
            </span>
            <span className="block text-muted-foreground">{fit.method}</span>
          </span>
        </div>
      )}

      <fieldset className="mt-4 border-t border-white/10 pt-3">
        <legend className="text-[10px] uppercase tracking-widest text-muted-foreground">
          <Building2 className="mr-1 inline h-3 w-3" aria-hidden="true" />
          The brief
        </legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {USES.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setUse(u.id)}
              aria-pressed={use === u.id}
              className={`min-h-9 rounded-full px-3 py-1.5 text-xs transition ${
                use === u.id
                  ? "bg-primary text-primary-foreground"
                  : "glass border border-white/12 hover:bg-white/5"
              }`}
            >
              {u.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Num label="Storeys" value={storeys} onChange={setStoreys} min={1} max={20} />
          {(use === "home" || use === "rental") && (
            <Num label="Bedrooms" value={bedrooms} onChange={setBedrooms} min={1} max={12} />
          )}
          <Stat label="Floor area" value={`${floorArea.toFixed(0)} m²`} />
        </div>
        <label className="mt-3 block">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Anything else an architect should know
          </span>
          <textarea
            id="build-brief-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Slope, mature trees, where the gate should be, a budget range…"
            className="mt-1 w-full resize-y rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs outline-none placeholder:text-muted-foreground focus:border-accent/60"
          />
        </label>
      </fieldset>

      <details className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
        <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1.5 text-xs font-medium">
          <Ruler className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          The brief, as text to take to an architect
        </summary>
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground/85">
          {brief}
        </pre>
      </details>

      <p className="mt-3 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-muted-foreground">
        Geometry only. This does not design a building, does not check plot ratio, height, parking
        or services, and is not a planning approval. It works out what the plot you drew allows, so
        the first conversation with an architect starts from real numbers.
      </p>
    </div>
  );
}

function Num({
  label,
  unit,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  unit?: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) {
  const id = `bb-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <label htmlFor={id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="mt-0.5 flex items-baseline gap-1">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={value}
          min={min}
          max={max}
          step="0.5"
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          className="w-full min-w-0 bg-transparent text-sm font-semibold tabular-nums outline-none"
        />
        {unit && <span className="text-[11px] text-muted-foreground">{unit}</span>}
      </span>
    </label>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
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

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={{ background: color, opacity: 0.85 }}
      />
      {label}
    </span>
  );
}
