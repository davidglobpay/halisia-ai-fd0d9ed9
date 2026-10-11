import { OutputTools, OutputIcon } from "@/components/halisia/output-tools";
import { CostEstimator } from "@/components/halisia/cost-estimator";
import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, CheckCircle2, Info, Layers, Minus, Plus, XCircle } from "lucide-react";
import { MapView } from "@/components/halisia/map-view";
import { ReadAloud } from "@/components/halisia/read-aloud";
import {
  areaM2,
  fromLocalMetres,
  toLocalMetres,
  describeArea,
  type LatLng,
} from "@/lib/parcel-geometry";
import { buildableEnvelope } from "@/lib/buildable";
import {
  ROOMS,
  DEFAULTS,
  massingStudy,
  massingBlocks,
  briefText,
  frontEdgeIndexOf,
  type Questionnaire,
  type RoomId,
  type MassingStudy,
} from "@/lib/house-brief";

/**
 * Step 6: the household's brief, tested against the ground step 4 left.
 *
 * The questionnaire exists because "tell your architect what you need" is a
 * question almost nobody can answer cold. Counting rooms they can do. So this
 * counts rooms, turns the count into floor area using allowances it shows and
 * lets them change, and says whether that much building fits inside the
 * setbacks they entered.
 *
 * It stops there, deliberately. It does not lay out a plan, does not place the
 * house on the plot, and does not draw a building. The gold rectangle on the
 * map is a MASSING BLOCK — the amount of ground the brief needs, drawn at the
 * centre of the buildable area so the person can see the size of it. It is not
 * where the house goes. The screen says so, and so does the report.
 */
export function HouseBrief({
  boundary,
  setbacks,
  reference,
  onStudyChange,
  className = "",
}: {
  boundary: LatLng[];
  /** Step 4's setbacks. Null until the person enters them. */
  setbacks: { frontM: number; sideM: number } | null;
  reference?: string | null;
  /** Reports the study upward so the parcel report can carry it. */
  onStudyChange?: (v: { study: MassingStudy; briefText: string } | null) => void;
  className?: string;
}) {
  const [counts, setCounts] = useState<Partial<Record<RoomId, number>>>({
    masterEnsuite: 1,
    bedroom: 2,
    bathroom: 1,
    sitting: 1,
    kitchen: 1,
  });
  const [storeys, setStoreys] = useState(1);
  const [parkingBays, setParkingBays] = useState(1);
  const [parkingCovered, setParkingCovered] = useState(false);
  const [purpose, setPurpose] = useState<Questionnaire["purpose"]>("own-home");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(2);
  const [notes, setNotes] = useState("");
  const [circulationPct, setCirculationPct] = useState<number>(DEFAULTS.circulationPct);
  const [roomAreas, setRoomAreas] = useState<Partial<Record<RoomId, number>>>({});

  const origin = boundary.length ? boundary[0] : null;
  const local = useMemo(() => (origin ? toLocalMetres(boundary, origin) : []), [boundary, origin]);
  const plotArea = local.length >= 3 ? areaM2(local) : null;

  const env = useMemo(() => {
    if (local.length < 3 || !setbacks) return null;
    return buildableEnvelope(local, {
      allM: setbacks.sideM,
      frontM: setbacks.frontM,
      frontEdgeIndex: frontEdgeIndexOf(local),
    });
  }, [local, setbacks]);

  const q: Questionnaire = useMemo(
    () => ({
      counts,
      storeys,
      parkingBays,
      parkingCovered,
      purpose,
      household: { adults, children },
      notes,
    }),
    [counts, storeys, parkingBays, parkingCovered, purpose, adults, children, notes],
  );

  const study = useMemo(
    () => massingStudy(q, env, plotArea, { circulationPct, roomAreas }),
    [q, env, plotArea, circulationPct, roomAreas],
  );

  const brief = useMemo(
    () =>
      briefText(q, study, {
        reference: reference ?? null,
        plotAreaM2: plotArea,
        setbacks,
      }),
    [q, study, reference, plotArea, setbacks],
  );

  /** The massing block, back in lat/lng, for the map. */
  const blockOverlay = useMemo(() => {
    if (!origin || !env) return null;
    const blocks = massingBlocks(study, env);
    if (!blocks.length) return null;
    return [
      {
        ring: fromLocalMetres(env.ring, origin),
        color: "#46C46F",
        fillOpacity: 0.12,
      },
      {
        ring: fromLocalMetres(blocks[0].ring, origin),
        color: "#C08A2E",
        fillOpacity: 0.35,
      },
    ];
  }, [origin, env, study]);

  // Lift the study without making the parent a dependency of this render.
  // Same shape as step 4: a pending ref written during render, drained by an
  // effect that dedupes on the serialised value, so a parent that re-creates
  // its callback every render cannot cause a loop.
  const pendingRef = useRef<{ study: MassingStudy; briefText: string } | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  const onStudyChangeRef = useRef(onStudyChange);
  onStudyChangeRef.current = onStudyChange;
  useEffect(() => {
    const next = pendingRef.current;
    if (!next) return;
    const key = JSON.stringify({
      g: next.study.grossM2,
      s: next.study.storeysRequested,
      b: next.briefText,
    });
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    onStudyChangeRef.current?.(next);
  });
  pendingRef.current = study.grossM2 > 0 ? { study, briefText: brief } : null;

  const bump = (id: RoomId, by: number) =>
    setCounts((c) => ({
      ...c,
      [id]: Math.max(0, Math.min(20, (c[id] ?? 0) + by)),
    }));

  const spoken = [
    "Your brief.",
    study.grossM2 > 0
      ? `It comes to ${Math.round(study.grossM2)} square metres of floor area over ${study.storeysRequested} ${study.storeysRequested === 1 ? "floor" : "floors"}.`
      : "No rooms have been chosen yet.",
    study.envelopeM2 == null
      ? "Draw the plot and enter setbacks in step four to test this against real ground."
      : study.fitsByArea
        ? "That fits inside the setbacks you entered."
        : study.storeysNeeded
          ? `That does not fit on ${study.storeysRequested} ${study.storeysRequested === 1 ? "floor" : "floors"}. It would need ${study.storeysNeeded}, or a smaller brief.`
          : "That does not fit at these setbacks.",
    "This is a massing study, not a design. It does not lay out rooms and it does not say where the house goes on the plot.",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`rounded-2xl glass border border-white/10 p-4 ${className}`}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Step 6 · The brief
          </div>
          <h3 className="mt-0.5 text-base font-semibold leading-tight">
            What you need, against what the plot allows
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Count the rooms. HALISIA turns that into floor area and checks whether it fits inside
            the setbacks you entered in step 4.
          </p>
        </div>
        <ReadAloud text={spoken} label="Listen" />
      </div>

      {/* ---------- the household ---------- */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Num label="Adults" value={adults} onChange={setAdults} min={0} max={20} />
        <Num label="Children" value={children} onChange={setChildren} min={0} max={20} />
        <Num label="Floors" value={storeys} onChange={setStoreys} min={1} max={6} />
        <Num label="Parking bays" value={parkingBays} onChange={setParkingBays} min={0} max={10} />
      </div>

      <label className="mt-2 flex min-h-[44px] items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={parkingCovered}
          onChange={(e) => setParkingCovered(e.target.checked)}
        />
        Parking is under roof (open hardstanding adds no floor area)
      </label>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {(
          [
            ["own-home", "A home to live in"],
            ["rental", "To let"],
            ["resale", "To build and sell"],
            ["mixed", "Part home, part let"],
          ] as const
        ).map(([id, lbl]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPurpose(id)}
            className={`min-h-[36px] rounded-full border px-3 py-1.5 text-xs transition ${
              purpose === id
                ? "border-accent bg-accent/15 text-foreground"
                : "border-white/10 text-muted-foreground hover:text-foreground"
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* ---------- the rooms ---------- */}
      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Accommodation
        </div>
        <ul className="mt-1.5 divide-y divide-white/5">
          {ROOMS.map((r) => {
            const n = counts[r.id] ?? 0;
            const each = roomAreas[r.id] ?? r.defaultM2;
            return (
              <li key={r.id} className="flex items-center gap-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-xs ${n ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {r.label}
                  </div>
                  {n > 0 && (
                    <div className="text-[10px] text-muted-foreground">
                      {each} m² each · {Math.round(n * each)} m² total
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`One fewer ${r.label}`}
                    onClick={() => bump(r.id, -1)}
                    disabled={n === 0}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-muted-foreground disabled:opacity-30"
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <span className="w-6 text-center font-mono text-sm tabular-nums">{n}</span>
                  <button
                    type="button"
                    aria-label={`One more ${r.label}`}
                    onClick={() => bump(r.id, 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ---------- the allowances, open to change ---------- */}
      <details className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <summary className="cursor-pointer list-none text-xs font-medium">
          Adjust the allowances
          <span className="ml-2 font-normal text-muted-foreground">
            starting figures, not a standard
          </span>
        </summary>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          These are common starting sizes, offered so you have something to change rather than a
          blank box. They are not taken from a building code and they are not a regulation. Your
          architect will have better numbers for your household.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ROOMS.filter((r) => (counts[r.id] ?? 0) > 0).map((r) => (
            <Num
              key={r.id}
              label={r.label}
              unit="m²"
              value={roomAreas[r.id] ?? r.defaultM2}
              onChange={(v) => setRoomAreas((a) => ({ ...a, [r.id]: v }))}
              min={2}
              max={200}
            />
          ))}
          <Num
            label="Walls and corridors"
            unit="%"
            value={circulationPct}
            onChange={setCirculationPct}
            min={0}
            max={60}
          />
        </div>
      </details>

      <label className="mt-3 block">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Anything else the architect should know
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="e.g. my mother will live with us; the kitchen must face the back"
          className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs"
        />
      </label>

      {/* ---------- what it comes to ---------- */}
      {study.grossM2 > 0 && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Floor area" value={`${Math.round(study.grossM2)} m²`} />
            <Stat label="Ground footprint" value={`${Math.round(study.footprintM2)} m²`} />
            <Stat
              label="Buildable"
              value={study.envelopeM2 == null ? "—" : describeArea(study.envelopeM2)}
            />
            <Stat
              label="Coverage"
              value={study.coveragePct == null ? "—" : `${study.coveragePct.toFixed(0)}%`}
            />
          </div>

          {study.fitsByArea == null ? (
            <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              <span>
                Draw the plot in step 3 and enter your setbacks in step 4, and this will be tested
                against the ground you actually have. Until then these are floor areas only —
                nothing here has been checked against a plot.
              </span>
            </div>
          ) : study.fitsByArea ? (
            <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-primary" aria-hidden="true" />
              <span>
                <span className="font-medium text-primary">
                  Fits on {study.storeysRequested}{" "}
                  {study.storeysRequested === 1 ? "floor" : "floors"}
                </span>{" "}
                <span className="text-muted-foreground">
                  by area.{" "}
                  {study.fitsAsRectangle === false &&
                    "A single block of that size does not sit centred and square inside the envelope, so the plan would need to be an L or a T. An architect does that."}
                  {study.fitsAsRectangle === true &&
                    study.rect &&
                    `A ${study.rect.widthM.toFixed(1)} × ${study.rect.depthM.toFixed(1)} m block fits inside the envelope.`}
                </span>
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs">
              <XCircle className="mt-0.5 h-4 w-4 flex-none text-destructive" aria-hidden="true" />
              <span>
                <span className="font-medium text-destructive">
                  Does not fit on {study.storeysRequested}{" "}
                  {study.storeysRequested === 1 ? "floor" : "floors"}
                </span>{" "}
                <span className="text-muted-foreground">
                  {study.storeysNeeded
                    ? `It needs ${study.storeysNeeded}, or a smaller brief.`
                    : "The setbacks leave nothing to build on."}
                </span>
              </span>
            </div>
          )}

          {blockOverlay && origin && (
            <div>
              <MapView
                center={origin}
                zoom={19}
                mapType="satellite"
                polygon={boundary}
                overlayPolygons={blockOverlay}
                className="h-56 w-full rounded-xl"
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                <Key color="#46C46F" label="Buildable after setbacks" />
                <Key color="#C08A2E" label="Massing block — size, not position" />
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                <Layers className="mr-1 inline h-3 w-3" aria-hidden="true" />
                The gold rectangle is how much ground your brief needs, drawn at the centre of the
                buildable area so you can see the size of it. It is <strong>not</strong> where the
                house goes, and it is not a floor plan.
              </p>
            </div>
          )}

          <CostEstimator
            grossM2={study.grossM2}
            storeys={study.storeysRequested}
            use={q.purpose === "mixed" ? "mixed" : "residential"}
            title="Architectural brief"
          />

          <details className="rounded-xl border border-white/10 bg-white/5 p-3">
            <summary className="cursor-pointer list-none text-xs font-medium">
              <Building2 className="mr-1 inline h-3.5 w-3.5 text-accent" aria-hidden="true" />
              The brief for your architect
            </summary>
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground/85">
              {brief}
            </pre>
          </details>

          <ul className="space-y-1 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-muted-foreground">
            {study.limits.map((l) => (
              <li key={l}>— {l}</li>
            ))}
          </ul>
        </div>
      )}
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
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="mt-0.5 flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            // An empty field parses to NaN. Leaving the value alone is the only
            // safe response: writing NaN into state propagates into every
            // derived figure on the card.
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          className="w-full bg-transparent text-sm tabular-nums outline-none"
        />
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </span>
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-2.5" data-output-card>
      <OutputIcon subject={label} />
      <OutputTools label={label} />
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
