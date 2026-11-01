import { createFileRoute, Link } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  Crosshair,
  Eye,
  EyeOff,
  Minus,
  Plus,
  RefreshCw,
} from "lucide-react";
import { MapControlDock } from "@/components/halisia/map-controls/map-control-dock";
import { StudioViewer } from "@/components/halisia/design-studio/studio-viewer";
import { CAMERA_PRESETS } from "@/components/halisia/design-studio/camera-presets";
import type { StudioViewerApi } from "@/components/halisia/design-studio/studio-viewer.internal";
import { RenderExportPanel, XrStatus } from "@/components/halisia/design-studio/studio-export";
import {
  STUDIO_CONCEPTS,
  STUDIO_DISCLAIMER,
  validSimulationDimension,
  type StudioEnvironment,
  type StudioTopology,
} from "@/components/halisia/design-studio/catalog";
import { KitButton } from "@/components/halisia/ds/button";
import { CostEstimator } from "@/components/halisia/cost-estimator";
import { ConceptDrawings } from "@/components/halisia/concept-drawings";
import { CONCEPT_USE, TOPOLOGY_SLOPE } from "@/lib/construction-cost";

const searchSchema = z.object({
  lat: fallback(z.number(), NaN).default(NaN),
  lng: fallback(z.number(), NaN).default(NaN),
  ref: fallback(z.string(), "").default(""),
  label: fallback(z.string(), "").default(""),
  status: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/design-studio")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "3D Design Studio — HALISIA AI" },
      {
        name: "description",
        content:
          "Explore five Kenyan-context development concepts on user-entered simulation dimensions, with explicit evidence limitations.",
      },
      { property: "og:title", content: "3D Design Studio — HALISIA AI" },
      {
        property: "og:description",
        content: "Parcel-context concept visualization with five development examples.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DesignStudioPage,
});

function NumberField({
  label,
  value,
  onChange,
  min = 12,
  max = 500,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-h-11 rounded-xl border border-foreground/15 bg-background/70 px-3 font-mono"
      />
    </label>
  );
}

function DesignStudioPage() {
  const search = Route.useSearch();
  const [conceptId, setConceptId] = useState(STUDIO_CONCEPTS[0].id);
  const [widthM, setWidthM] = useState(36);
  const [depthM, setDepthM] = useState(48);
  const [topology, setTopology] = useState<StudioTopology>(STUDIO_CONCEPTS[0].defaultTopology);
  const [environment, setEnvironment] = useState<StudioEnvironment>("day");
  const [rotationDeg, setRotationDeg] = useState(0);
  const [scalePct, setScalePct] = useState(100);
  const [showParking, setShowParking] = useState(true);
  const [showLandscape, setShowLandscape] = useState(true);
  const [fitToken, setFitToken] = useState(0);
  const [generated, setGenerated] = useState(false);
  const [generatedUse, setGeneratedUse] = useState<"residential" | "commercial" | "mixed">(
    "residential",
  );
  const [generatedFloors, setGeneratedFloors] = useState(3);
  const [api, setApi] = useState<StudioViewerApi | null>(null);
  const viewerBoxRef = useRef<HTMLElement | null>(null);
  const [viewerState, setViewerState] = useState({ loading: true, error: null as string | null });
  const concept = useMemo(
    () => STUDIO_CONCEPTS.find((item) => item.id === conceptId) ?? STUDIO_CONCEPTS[0],
    [conceptId],
  );
  const dimensionsValid = validSimulationDimension(widthM) && validSimulationDimension(depthM);
  const hasPoint = Number.isFinite(search.lat) && Number.isFinite(search.lng);
  const contextLabel = search.ref || search.label;

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-24 sm:px-6">
      <Link
        to={hasPoint ? "/passport" : "/explore"}
        search={
          hasPoint
            ? {
                lat: search.lat,
                lng: search.lng,
                ref: search.ref,
                label: search.label,
                source: "Design Studio return",
                status: "approximate",
                gt: "",
                county: "",
                noloc: "",
              }
            : undefined
        }
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {hasPoint ? "Back to Land Passport" : "Back to Explore"}
      </Link>

      <header className="mt-3 grid gap-3 border-b border-foreground/10 pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-accent">3D Design Studio</p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl">Place a development concept</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Compare five Kenyan-context examples or shape deterministic massing on dimensions you
            enter. Every scene is illustrative and remains separate from parcel evidence.
          </p>
        </div>
        <div className="text-xs text-muted-foreground lg:text-right" data-testid="studio-context">
          <div className="font-semibold text-foreground">
            {contextLabel || "Unlinked simulation"}
          </div>
          <div>
            {hasPoint
              ? `${search.lat.toFixed(5)}, ${search.lng.toFixed(5)}`
              : "No map point supplied"}
          </div>
          <div>{search.status || "Position class not supplied"}</div>
        </div>
      </header>

      <p role="note" className="mt-4 border-l-2 border-accent px-3 text-sm text-muted-foreground">
        {STUDIO_DISCLAIMER}
      </p>

      <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section
          ref={viewerBoxRef}
          className="relative h-[58vh] min-h-[420px] min-w-0 max-h-[760px] overflow-hidden rounded-2xl border border-foreground/10 bg-black/20 sm:h-[68vh] xl:h-[720px]"
        >
          {dimensionsValid && api && (
            <MapControlDock
              testId="studio-dock"
              topOffsetClass="top-20"
              fullscreenTarget={viewerBoxRef}
              actions={[
                { id: "zoom-in", label: "Zoom in", icon: Plus, onClick: () => api.zoom(0.75) },
                { id: "zoom-out", label: "Zoom out", icon: Minus, onClick: () => api.zoom(1.33) },
                {
                  id: "reset",
                  label: "Isometric view",
                  icon: Crosshair,
                  onClick: () => api.setView("isometric"),
                },
                {
                  id: "top",
                  label: "Aerial view",
                  icon: Eye,
                  onClick: () => api.setView("aerial"),
                },
              ]}
              layers={[
                {
                  id: "light",
                  title: "Lighting",
                  kind: "single",
                  options: (["day", "neutral", "night"] as const).map((item) => ({
                    id: item,
                    label: item[0].toUpperCase() + item.slice(1),
                  })),
                  selected: [environment],
                  onChange: ([v]) => v && setEnvironment(v as StudioEnvironment),
                },
                {
                  id: "show",
                  title: "Show",
                  kind: "multi",
                  options: [
                    { id: "parking", label: "Parking" },
                    { id: "landscape", label: "Landscape" },
                  ],
                  selected: [
                    ...(showParking ? ["parking"] : []),
                    ...(showLandscape ? ["landscape"] : []),
                  ],
                  onChange: (v) => {
                    setShowParking(v.includes("parking"));
                    setShowLandscape(v.includes("landscape"));
                  },
                },
              ]}
            />
          )}
          {dimensionsValid ? (
            <StudioViewer
              concept={concept}
              widthM={widthM}
              depthM={depthM}
              topology={topology}
              environment={environment}
              rotationDeg={rotationDeg}
              scalePct={scalePct}
              showParking={showParking}
              showLandscape={showLandscape}
              fitToken={fitToken}
              generated={generated ? { use: generatedUse, floors: generatedFloors } : null}
              onState={setViewerState}
              onApi={setApi}
            />
          ) : (
            <div className="grid min-h-[52vh] place-items-center p-6 text-center text-sm text-destructive">
              Enter a width and depth between 12 m and 500 m.
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-between gap-3">
            <div className="rounded-lg bg-background/85 px-3 py-2 text-xs shadow-sm backdrop-blur">
              <div className="font-semibold">
                {generated ? "Generated concept massing" : concept.name}
              </div>
              <div className="text-muted-foreground">
                {generated ? `${generatedUse} · ${generatedFloors} floors` : concept.use}
              </div>
            </div>
            <div
              role={viewerState.error ? "alert" : "status"}
              className="max-w-xs rounded-lg bg-background/85 px-3 py-2 text-right text-xs shadow-sm backdrop-blur"
            >
              {viewerState.error ? (
                <span className="inline-flex items-start gap-1 text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {viewerState.error}
                </span>
              ) : viewerState.loading ? (
                "Loading concept…"
              ) : (
                "Concept ready"
              )}
            </div>
          </div>
        </section>

        <aside className="min-w-0 space-y-5">
          <section aria-labelledby="concept-heading">
            <h2
              id="concept-heading"
              className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
            >
              Five concept scenes
            </h2>
            <div className="mt-2 grid gap-2">
              {STUDIO_CONCEPTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`studio-concept-${item.id}`}
                  aria-pressed={item.id === concept.id}
                  onClick={() => {
                    setGenerated(false);
                    setConceptId(item.id);
                    setTopology(item.defaultTopology);
                    setRotationDeg(0);
                    setScalePct(100);
                  }}
                  className={`min-h-[48px] rounded-xl border px-3 py-2 text-left transition ${
                    item.id === concept.id
                      ? "border-primary bg-primary/10"
                      : "border-foreground/10 bg-card/70 hover:border-primary/40"
                  }`}
                >
                  <span className="block text-sm font-semibold">{item.name}</span>
                  <span className="block text-xs text-muted-foreground">{item.use}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{concept.context}</p>
            <p className="mt-1 text-xs text-muted-foreground">Site cues: {concept.landscape}.</p>
            <div className="mt-3 rounded-xl border border-foreground/10 bg-card/70 p-3">
              <button
                type="button"
                aria-pressed={generated}
                onClick={() => setGenerated((value) => !value)}
                className={`min-h-11 w-full rounded-lg px-3 text-sm font-semibold ${
                  generated ? "bg-primary text-primary-foreground" : "border border-primary/40"
                }`}
                data-testid="studio-generate"
              >
                {generated ? "Using generated massing" : "Generate concept massing"}
              </button>
              {generated ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="grid gap-1 text-xs">
                    Intended use
                    <select
                      value={generatedUse}
                      onChange={(event) =>
                        setGeneratedUse(event.target.value as typeof generatedUse)
                      }
                      className="min-h-11 rounded-lg border border-foreground/15 bg-background px-2"
                    >
                      <option value="residential">Residential</option>
                      <option value="mixed">Mixed use</option>
                      <option value="commercial">Commercial</option>
                    </select>
                  </label>
                  <NumberField
                    label="Floors"
                    min={1}
                    max={12}
                    value={generatedFloors}
                    onChange={(value) => setGeneratedFloors(Math.max(1, Math.min(12, value)))}
                  />
                  <p className="col-span-2 text-[11px] text-muted-foreground">
                    Deterministic massing only. It is not an AI-generated architectural drawing.
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3" aria-label="Simulation dimensions">
            <NumberField label="Width (m)" value={widthM} onChange={setWidthM} />
            <NumberField label="Depth (m)" value={depthM} onChange={setDepthM} />
            <p className="col-span-2 text-[11px] text-muted-foreground">
              These dimensions are simulation inputs only; they are not derived from a title or map
              pin.
            </p>
          </section>

          <section className="space-y-3" aria-label="Scene controls">
            <label className="grid gap-1 text-xs font-medium">
              Topology assumption
              <select
                value={topology}
                onChange={(event) => setTopology(event.target.value as StudioTopology)}
                className="min-h-11 rounded-xl border border-foreground/15 bg-background/70 px-3"
              >
                <option value="level">Level concept surface</option>
                <option value="gentle-slope">Gentle slope concept</option>
                <option value="terraced">Terraced slope concept</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Rotation · {rotationDeg}°
              <input
                type="range"
                min={-180}
                max={180}
                step={15}
                value={rotationDeg}
                onChange={(event) => setRotationDeg(Number(event.target.value))}
                className="h-11 w-full cursor-pointer accent-primary"
                data-testid="studio-rotation"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Concept scale · {scalePct}%
              <input
                type="range"
                min={60}
                max={140}
                step={5}
                value={scalePct}
                onChange={(event) => setScalePct(Number(event.target.value))}
                className="h-11 w-full cursor-pointer accent-primary"
                data-testid="studio-scale"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {(["day", "neutral", "night"] as const).map((item) => (
                <KitButton
                  key={item}
                  size="sm"
                  variant={environment === item ? "primary" : "secondary"}
                  aria-pressed={environment === item}
                  onClick={() => setEnvironment(item)}
                >
                  {item[0].toUpperCase() + item.slice(1)}
                </KitButton>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <KitButton
                size="sm"
                variant={showParking ? "primary" : "secondary"}
                aria-pressed={showParking}
                data-testid="studio-parking"
                onClick={() => setShowParking((value) => !value)}
              >
                {showParking ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} Parking
              </KitButton>
              <KitButton
                size="sm"
                variant={showLandscape ? "primary" : "secondary"}
                aria-pressed={showLandscape}
                data-testid="studio-landscape"
                onClick={() => setShowLandscape((value) => !value)}
              >
                {showLandscape ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}{" "}
                Landscape
              </KitButton>
              <KitButton
                size="sm"
                data-testid="studio-fit"
                onClick={() => setFitToken((value) => value + 1)}
              >
                <Box className="h-4 w-4" /> Fit
              </KitButton>
              <KitButton
                size="sm"
                data-testid="studio-reset"
                onClick={() => {
                  setRotationDeg(0);
                  setScalePct(100);
                  setTopology(concept.defaultTopology);
                  setFitToken((value) => value + 1);
                }}
              >
                <RefreshCw className="h-4 w-4" /> Reset
              </KitButton>
            </div>
          </section>

          <section aria-label="Camera views" className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Camera views
            </h2>
            <div className="grid grid-cols-4 gap-1.5">
              {CAMERA_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={!api}
                  data-testid={`studio-view-${p.id}`}
                  onClick={() => api?.setView(p.id)}
                  className="min-h-11 rounded-lg border border-foreground/15 px-1 text-[11px] font-medium hover:border-primary/50 disabled:opacity-50"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>
          <RenderExportPanel
            api={api}
            name={generated ? `generated-${generatedUse}` : concept.id}
          />
          <XrStatus />
          <section className="border-t border-foreground/10 pt-4 text-xs leading-relaxed text-muted-foreground">
            <h2 className="font-semibold uppercase tracking-[0.18em] text-foreground">
              Evidence boundary
            </h2>
            <p className="mt-2">
              The map point is context only. Building fit, setbacks, zoning, utilities, ground
              conditions, drainage capacity and approvals remain unknown until supported by the
              relevant evidence.
            </p>
          </section>
        </aside>
      </div>
      <div className="mx-auto mt-6 max-w-7xl space-y-4 px-4">
        {(() => {
          const storeys = generated
            ? generatedFloors
            : Math.max(1, Math.round(concept.authoredHeightM / 3.5));
          const s = scalePct / 100;
          const footprint = generated
            ? widthM * depthM * 0.4
            : concept.authoredFootprintSqm * s * s;
          const ratio = Math.max(0.3, Math.min(3, widthM / Math.max(1, depthM)));
          const bldW = Math.min(widthM * 0.9, Math.sqrt(footprint * ratio));
          const bldD = Math.min(depthM * 0.9, footprint / Math.max(1, bldW));
          const use = generated ? generatedUse : (CONCEPT_USE[concept.id] ?? "residential");
          return (
            <>
              <CostEstimator
                grossM2={bldW * bldD * storeys}
                storeys={storeys}
                use={use}
                slopeAdjust={TOPOLOGY_SLOPE[topology]}
                title={generated ? `Generated ${generatedUse} concept` : concept.name}
                context={`${topology} topology assumption · ${widthM} × ${depthM} m simulation plot`}
              />
              <ConceptDrawings
                plotW={widthM}
                plotD={depthM}
                bldW={bldW}
                bldD={bldD}
                storeys={storeys}
                topology={topology}
                title={generated ? `Generated ${generatedUse} concept` : concept.name}
              />
            </>
          );
        })()}
      </div>
    </main>
  );
}
