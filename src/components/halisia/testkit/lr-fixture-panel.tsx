import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Surface, KitButton, SectionHeading } from "@/components/halisia/ds";
import { fetchStaticMapOSM } from "@/lib/static-map-osm";
import {
  absoluteModelUrl,
  canEnableBuildingFit,
  FIXTURE_DISCLAIMER,
  FIXTURE_MODELS,
  IMAGERY_CAPTION,
  KONZA_FIXTURE,
  resolveFixtureIdentifier,
  sceneViewerHref,
  type FixtureModel,
} from "@/lib/testfixtures/konza-lr-fixture";
import {
  BASELINE_CHECKS,
  check,
  type FixtureCheck,
  type FixtureVerdict,
} from "@/lib/testfixtures/fixture-log";

const Preview = lazy(() => import("./fixture-model-preview.internal"));

/**
 * Developer-only, preview-only test fixture panel (mounted on /style-guide with
 * ?dev=1). It never writes data, never creates a parcel record and never
 * asserts title validity, ownership or survey verification.
 */

function VerdictChip({ verdict }: { verdict: FixtureVerdict }) {
  const tone =
    verdict === "PASS"
      ? "bg-primary/15 text-primary"
      : verdict === "FAIL"
        ? "bg-destructive/15 text-destructive"
        : "bg-white/10 text-muted-foreground";
  return (
    <span className={`font-data rounded-md px-2 py-0.5 text-[11px] ${tone}`}>{verdict}</span>
  );
}

export function LrFixturePanel() {
  const resolution = useMemo(() => resolveFixtureIdentifier(KONZA_FIXTURE.searchedTitle), []);
  const [selected, setSelected] = useState<FixtureModel | null>(null);
  const [previewOn, setPreviewOn] = useState(false);
  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [imagery, setImagery] = useState<{ state: "loading" | "ok" | "unknown"; src?: string }>({
    state: "loading",
  });

  const { lat, lng } = KONZA_FIXTURE.physicalTestCoordinate;

  useEffect(() => {
    let alive = true;
    void fetchStaticMapOSM({ lat, lng, layer: "satellite", zoom: 18 }).then((r) => {
      if (!alive) return;
      setImagery(r.ok ? { state: "ok", src: r.dataUrl } : { state: "unknown" });
    });
    return () => {
      alive = false;
    };
  }, [lat, lng]);

  const absGlb = absoluteModelUrl(selected?.url ?? null);
  const sceneHref = sceneViewerHref(absGlb);

  const checks: FixtureCheck[] = [
    ...BASELINE_CHECKS.slice(0, 3),
    check(
      "satellite-imagery",
      imagery.state === "ok" ? "PASS" : imagery.state === "loading" ? "UNKNOWN" : "UNKNOWN",
      imagery.state === "ok"
        ? "Esri imagery tiles centred on the supplied coordinate, no boundary overlay."
        : "Imagery could not be loaded — reported as UNKNOWN, no imagery invented.",
    ),
    check(
      "glb-available",
      selected ? (selected.url ? "PASS" : "FAIL") : "UNKNOWN",
      selected
        ? selected.url
          ? `${selected.file} available (${selected.sizeBytes?.toLocaleString()} bytes).`
          : `${selected.file} unavailable — no substitute model used.`
        : "Select a fixture model.",
    ),
    check(
      "desktop-3d-load",
      modelStatus === "loaded" ? "PASS" : modelStatus === "error" ? "FAIL" : "UNKNOWN",
      modelStatus === "loaded"
        ? "Model rendered at authored scale in the fixture preview."
        : "Load a model in the desktop preview to record this check.",
    ),
    check(
      "android-scene-viewer-url",
      sceneHref ? "PASS" : "UNKNOWN",
      sceneHref
        ? "Absolute HTTPS intent constructed. PHYSICAL DEVICE TEST REQUIRED to confirm launch."
        : "Select an available model to construct the intent URL.",
    ),
    ...BASELINE_CHECKS.slice(3),
  ];

  return (
    <section className="mt-8 space-y-5" aria-label="LR test fixture" data-testid="lr-fixture-panel">
      <Surface elevation={2} padding="lg">
        <SectionHeading
          as="h3"
          eyebrow="Developer fixture · preview only"
          title="Land reference test fixture (not a parcel record)"
          description="Ephemeral, in-memory test case. Nothing here is stored, and nothing here is evidence of a title, an owner or a boundary."
        />

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Surface elevation={1} padding="md" data-testid="fixture-searched-title">
            <p className="font-label text-accent text-[0.6875rem] tracking-[0.18em] uppercase">
              Searched title / LR
            </p>
            <p className="font-data mt-2 text-sm break-words">{KONZA_FIXTURE.searchedTitle}</p>
            <dl className="text-muted-foreground mt-3 space-y-1 text-xs">
              <div className="flex justify-between gap-2">
                <dt>Document-stated area</dt>
                <dd className="font-data">
                  {KONZA_FIXTURE.documentStatedAreaHa.toFixed(4)} ha (approx.)
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Registry map sheet</dt>
                <dd className="font-data">{KONZA_FIXTURE.documentStatedRegistryMapSheet}</dd>
              </div>
            </dl>
            <p className="text-muted-foreground mt-3 text-xs">
              Document-derived and unverified. No polygon is generated from the stated area.
            </p>
          </Surface>

          <Surface elevation={1} padding="md" data-testid="fixture-physical-location">
            <p className="font-label text-accent text-[0.6875rem] tracking-[0.18em] uppercase">
              Physical test location
            </p>
            <p className="font-data mt-2 text-sm" data-testid="fixture-coordinate">
              {lat}, {lng}
            </p>
            <p className="text-muted-foreground mt-3 text-xs">
              User-supplied physical test point. It is not derived from the title reference and does
              not establish the boundary of that title.
            </p>
          </Surface>

          <Surface elevation={1} padding="md" data-testid="fixture-matched-parcel">
            <p className="font-label text-accent text-[0.6875rem] tracking-[0.18em] uppercase">
              Matched parcel record
            </p>
            <p className="font-data text-destructive mt-2 text-sm">
              NONE — {resolution.resultState}
            </p>
            <p className="text-muted-foreground mt-3 text-xs">{resolution.note}</p>
            <p className="text-muted-foreground mt-2 text-xs">
              Boundary evidence: {KONZA_FIXTURE.boundaryEvidence} · Geometry: none · Model fit:{" "}
              {KONZA_FIXTURE.modelFit}
            </p>
          </Surface>
        </div>

        <p className="text-muted-foreground font-data mt-4 text-xs">{FIXTURE_DISCLAIMER}</p>
      </Surface>

      <Surface elevation={2} padding="lg">
        <SectionHeading as="h3" eyebrow="Context" title="Location imagery" />
        {imagery.state === "ok" && imagery.src ? (
          <img
            src={imagery.src}
            alt="Satellite imagery centred on the user-supplied test coordinate"
            className="mt-4 w-full rounded-xl border border-white/15"
            data-testid="fixture-imagery"
          />
        ) : (
          <p className="font-data mt-4 text-sm" data-testid="fixture-imagery-unknown">
            {imagery.state === "loading" ? "Loading imagery…" : "UNKNOWN — imagery unavailable"}
          </p>
        )}
        <p className="text-muted-foreground mt-2 text-xs" data-testid="fixture-imagery-caption">
          {IMAGERY_CAPTION}
        </p>
      </Surface>

      <Surface elevation={2} padding="lg">
        <SectionHeading
          as="h3"
          eyebrow="Model cohort"
          title="Fixture models"
          description="Indicative massing only — not construction documentation. Fit against a legal parcel boundary remains unavailable."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FIXTURE_MODELS.map((m) => {
            const active = selected?.file === m.file;
            return (
              <Surface key={m.file} elevation={1} padding="md">
                <p className="text-sm font-semibold">{m.label}</p>
                <p className="font-data text-muted-foreground mt-1 text-[11px] break-all">
                  {m.file}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="rounded-md bg-white/10 px-2 py-0.5">
                    {m.role === "environment-control"
                      ? "Environment control — never a building-fit model"
                      : "Building candidate"}
                  </span>
                  <span className="font-data text-muted-foreground">
                    {m.url ? `${m.sizeBytes?.toLocaleString()} B` : "UNAVAILABLE"}
                  </span>
                </div>
                <KitButton
                  variant={active ? "primary" : "secondary"}
                  className="mt-3"
                  disabled={!m.url}
                  onClick={() => {
                    setSelected(m);
                    setPreviewOn(false);
                    setModelStatus("idle");
                  }}
                  data-testid={`fixture-model-${m.file}`}
                >
                  {active ? "Selected" : "Select"}
                </KitButton>
              </Surface>
            );
          })}
        </div>

        {selected ? (
          <div className="mt-5 space-y-3" data-testid="fixture-selected-model">
            <p className="text-sm">
              Selected: <span className="font-data">{selected.file}</span> · building-fit status:{" "}
              <span className="font-data">
                {canEnableBuildingFit(selected) ? "ENABLED" : "UNKNOWN / UNAVAILABLE"}
              </span>
            </p>
            {!previewOn ? (
              <KitButton onClick={() => setPreviewOn(true)} data-testid="fixture-3d-start">
                Load desktop 3D preview
              </KitButton>
            ) : (
              <ClientOnly fallback={<p className="text-muted-foreground text-xs">Preparing…</p>}>
                <Suspense fallback={<p className="text-muted-foreground text-xs">Preparing…</p>}>
                  <Preview url={selected.url!} onStatus={setModelStatus} />
                </Suspense>
              </ClientOnly>
            )}

            <div className="flex flex-wrap gap-3">
              {sceneHref ? (
                <a
                  href={sceneHref}
                  className="focus-ring rounded-xl border border-white/15 px-3 py-2 text-xs"
                  data-testid="fixture-scene-viewer"
                >
                  Android Scene Viewer test — PHYSICAL DEVICE TEST REQUIRED
                </a>
              ) : null}
              <button
                type="button"
                disabled
                className="rounded-xl border border-white/10 px-3 py-2 text-xs opacity-50"
                data-testid="fixture-quick-look"
              >
                iOS Quick Look — UNKNOWN (no USDZ for this cohort)
              </button>
              <a
                href="/spatial"
                className="focus-ring rounded-xl border border-white/15 px-3 py-2 text-xs"
                data-testid="fixture-webxr-link"
              >
                Open the existing Spatial studio for WebXR/VR regression
              </a>
            </div>
            <p className="text-muted-foreground text-xs">
              Opening the Spatial studio does not make LR 14726 a matched parcel and unlocks no
              boundary evidence.
            </p>
          </div>
        ) : null}
      </Surface>

      <Surface elevation={2} padding="lg">
        <SectionHeading as="h3" eyebrow="Test log" title="PASS / FAIL / UNKNOWN" />
        <table className="mt-4 w-full text-left text-xs" data-testid="fixture-log-table">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 pr-3 font-medium">Check</th>
              <th className="py-1 pr-3 font-medium">Verdict</th>
              <th className="py-1 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.id} className="border-t border-white/10" data-testid={`fixture-log-${c.id}`}>
                <td className="py-2 pr-3">{c.label}</td>
                <td className="py-2 pr-3">
                  <VerdictChip verdict={c.verdict} />
                </td>
                <td className="text-muted-foreground py-2">{c.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Surface>
    </section>
  );
}
