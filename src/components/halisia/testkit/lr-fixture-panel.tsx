import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Surface, KitButton, SectionHeading } from "@/components/halisia/ds";
import { fetchStaticMapOSM } from "@/lib/static-map-osm";
import {
  absoluteModelUrl,
  canEnableBuildingFit,
  FIXTURE_DISCLAIMER,
  FIXTURE_MODELS,
  HARNESS_LABEL,
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
  return <span className={`font-data rounded-md px-2 py-0.5 text-[11px] ${tone}`}>{verdict}</span>;
}

export function LrFixturePanel() {
  const resolution = useMemo(() => resolveFixtureIdentifier(KONZA_FIXTURE.searchedTitle), []);
  const [selected, setSelected] = useState<FixtureModel | null>(null);
  const [previewOn, setPreviewOn] = useState(false);
  const [reach, setReach] = useState<Record<string, FixtureVerdict>>({});
  const [display, setDisplay] = useState<Record<string, FixtureVerdict>>({});
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

  // Read-only HTTPS reachability probe for each public test model.
  useEffect(() => {
    const ac = new AbortController();
    for (const m of FIXTURE_MODELS) {
      if (!m.url) {
        setReach((p) => ({ ...p, [m.file]: "FAIL" }));
        continue;
      }
      void fetch(m.url, { method: "HEAD", signal: ac.signal })
        .then((res) => setReach((p) => ({ ...p, [m.file]: res.ok ? "PASS" : "FAIL" })))
        .catch(() => {
          if (!ac.signal.aborted) setReach((p) => ({ ...p, [m.file]: "UNKNOWN" }));
        });
    }
    return () => ac.abort();
  }, []);

  const onStatus = useCallback(
    (s: "loading" | "loaded" | "error") => {
      if (!selected) return;
      setDisplay((p) => ({
        ...p,
        [selected.file]: s === "loaded" ? "PASS" : s === "error" ? "FAIL" : "UNKNOWN",
      }));
    },
    [selected],
  );

  const absGlb = absoluteModelUrl(selected?.url ?? null);
  const sceneHref = sceneViewerHref(absGlb);

  const checks: FixtureCheck[] = [
    ...BASELINE_CHECKS.slice(0, 3),
    check(
      "satellite-imagery",
      imagery.state === "ok" ? "PASS" : "UNKNOWN",
      imagery.state === "ok"
        ? "Esri imagery tiles centred on the user-supplied test coordinate, no boundary overlay."
        : "Imagery could not be loaded — reported as UNKNOWN, no imagery invented.",
    ),
    check(
      "glb-available",
      Object.values(reach).some((v) => v === "PASS") ? "PASS" : "UNKNOWN",
      "Per-model HTTPS reachability is listed in the model compatibility matrix.",
    ),
    check(
      "desktop-3d-load",
      Object.values(display).some((v) => v === "PASS")
        ? "PASS"
        : Object.values(display).some((v) => v === "FAIL")
          ? "FAIL"
          : "UNKNOWN",
      "Recorded per model when opened in the compatibility harness.",
    ),
    check(
      "android-scene-viewer-url",
      sceneHref ? "PASS" : "UNKNOWN",
      sceneHref
        ? "Absolute HTTPS handoff URL constructed read-only in the same public format. PHYSICAL DEVICE TEST REQUIRED."
        : "Select a reachable model to construct the handoff URL.",
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
              Searched title — document facts
            </p>
            <p className="font-data mt-2 text-sm break-words">{KONZA_FIXTURE.searchedTitle}</p>
            <dl className="text-muted-foreground mt-3 space-y-1 text-xs">
              <div className="flex justify-between gap-2">
                <dt>Document-stated area</dt>
                <dd className="font-data">
                  {KONZA_FIXTURE.documentStatedAreaHa.toFixed(4)} ha (document-derived)
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Registry map sheet</dt>
                <dd className="font-data">{KONZA_FIXTURE.documentStatedRegistryMapSheet}</dd>
              </div>
            </dl>
            <p className="text-muted-foreground mt-3 text-xs">
              Unverified document text only. No parcel dimensions, centroid or boundary are inferred
              from the stated area.
            </p>
          </Surface>

          <Surface elevation={1} padding="md" data-testid="fixture-physical-location">
            <p className="font-label text-accent text-[0.6875rem] tracking-[0.18em] uppercase">
              Physical test location — user supplied
            </p>
            <p className="font-data mt-2 text-sm" data-testid="fixture-coordinate">
              {lat}, {lng}
            </p>
            <p className="font-data text-muted-foreground mt-1 text-[11px]">
              {KONZA_FIXTURE.physicalTestCoordinate.source}
            </p>
            <p className="text-muted-foreground mt-3 text-xs">
              Separate test-location field. It is not the resolution result of the land reference and
              does not establish that reference&apos;s boundary.
            </p>
          </Surface>

          <Surface elevation={1} padding="md" data-testid="fixture-matched-parcel">
            <p className="font-label text-accent text-[0.6875rem] tracking-[0.18em] uppercase">
              Matched HALISIA parcel record
            </p>
            <p className="font-data text-destructive mt-2 text-sm">
              NONE — not in HALISIA parcel index
            </p>
            <p className="text-muted-foreground mt-3 text-xs">
              {resolution.note} Result state: {resolution.resultState}.
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              Boundary evidence: NONE (boundary not verified) · Geometry: none · Parcel fit: UNKNOWN
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
        <a
          className="focus-ring mt-3 inline-block rounded-xl border border-white/15 px-3 py-2 text-xs"
          href={`https://www.google.com/maps/@?api=1&map_action=map&center=${lat},${lng}&zoom=19&basemap=satellite`}
          target="_blank"
          rel="noreferrer"
          data-testid="fixture-external-map"
        >
          Open external satellite view of the test coordinate
        </a>
      </Surface>

      <Surface elevation={2} padding="lg">
        <SectionHeading
          as="h3"
          eyebrow="Model cohort"
          title="Model compatibility matrix"
          description={`${HARNESS_LABEL} Models load read-only from their public source URLs; authored scale only, parcel fit UNKNOWN because there is no evidence-backed parcel polygon.`}
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs" data-testid="fixture-model-matrix">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 pr-3 font-medium">Model</th>
                <th className="py-1 pr-3 font-medium">Role</th>
                <th className="py-1 pr-3 font-medium">HTTPS reachable</th>
                <th className="py-1 pr-3 font-medium">3D displayed</th>
                <th className="py-1 pr-3 font-medium">Parcel fit</th>
                <th className="py-1 font-medium">Harness</th>
              </tr>
            </thead>
            <tbody>
              {FIXTURE_MODELS.map((m) => (
                <tr
                  key={m.file}
                  className="border-t border-white/10"
                  data-testid={`fixture-model-row-${m.file}`}
                >
                  <td className="py-2 pr-3">
                    <span className="font-data break-all">{m.file}</span>
                  </td>
                  <td className="py-2 pr-3">
                    {m.role === "environment-control" ? "environment-control" : "building-candidate"}
                  </td>
                  <td className="py-2 pr-3">
                    <VerdictChip verdict={reach[m.file] ?? "UNKNOWN"} />
                  </td>
                  <td className="py-2 pr-3">
                    <VerdictChip verdict={display[m.file] ?? "UNKNOWN"} />
                  </td>
                  <td className="py-2 pr-3">
                    <VerdictChip verdict="UNKNOWN" />
                  </td>
                  <td className="py-2">
                    <KitButton
                      variant={selected?.file === m.file ? "primary" : "secondary"}
                      disabled={!m.url}
                      onClick={() => {
                        setSelected(m);
                        setPreviewOn(false);
                      }}
                      data-testid={`fixture-model-${m.file}`}
                    >
                      {selected?.file === m.file ? "Selected" : "Select"}
                    </KitButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected ? (
          <div className="mt-5 space-y-3" data-testid="fixture-selected-model">
            <p className="text-sm">
              Selected: <span className="font-data">{selected.file}</span> · building-fit status:{" "}
              <span className="font-data">
                {canEnableBuildingFit(selected) ? "ENABLED" : "UNKNOWN — boundary not verified"}
              </span>
            </p>
            {!previewOn ? (
              <KitButton onClick={() => setPreviewOn(true)} data-testid="fixture-3d-start">
                Load model in compatibility harness
              </KitButton>
            ) : (
              <ClientOnly fallback={<p className="text-muted-foreground text-xs">Preparing…</p>}>
                <Suspense fallback={<p className="text-muted-foreground text-xs">Preparing…</p>}>
                  <Preview url={selected.url!} onStatus={onStatus} />
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
                  Android handoff URL — PHYSICAL DEVICE TEST REQUIRED
                </a>
              ) : null}
              <button
                type="button"
                disabled
                className="rounded-xl border border-white/10 px-3 py-2 text-xs opacity-50"
                data-testid="fixture-quick-look"
              >
                iOS Quick Look — UNKNOWN (no USDZ supplied in this batch)
              </button>
              <span
                className="text-muted-foreground rounded-xl border border-white/10 px-3 py-2 text-xs"
                data-testid="fixture-webxr-note"
              >
                WebXR / VR — PHYSICAL DEVICE TEST REQUIRED
              </span>
            </div>
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
              <tr
                key={c.id}
                className="border-t border-white/10"
                data-testid={`fixture-log-${c.id}`}
              >
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
