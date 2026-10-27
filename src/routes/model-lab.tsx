import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ModelLabViewer, {
  type EnvMode,
  type PresentationMode,
  type ViewerApi,
  type ViewerStatus,
} from "@/components/halisia/model-lab/viewer";
import {
  BUILDING_MODELS,
  MODEL_LAB_DISCLAIMER,
  MODEL_LAB_PARCEL_CONTEXT,
  selectBuildingById,
  type BuildingModel,
} from "@/components/halisia/model-lab/registry";
import {
  QUICK_LOOK_UNAVAILABLE_MESSAGE,
  arCapabilitySummary,
  fullscreenSupported,
  labPlatformFromUA,
  sceneViewerIntent,
  type LabPlatform,
} from "@/components/halisia/model-lab/device";
import { KitButton } from "@/components/halisia/ds/button";
import { humanBytes } from "@/components/halisia/model-lab/loader";
import SiteViewer from "@/components/halisia/model-lab/site/site-viewer";
import { parseSiteParams } from "@/components/halisia/model-lab/site/site-params";
import { structureLabel } from "@/components/halisia/model-lab/site/house-spec";

export const Route = createFileRoute("/model-lab")({
  head: () => ({
    meta: [
      { title: "Architectural Model Lab — HALISIA.AI" },
      {
        name: "description",
        content:
          "Isolated architectural model compatibility lab. Visualization only — not cadastral placement or survey evidence.",
      },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: "Architectural Model Lab — HALISIA.AI" },
      {
        property: "og:description",
        content: "Isolated architectural model compatibility lab.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    type: typeof s.type === "string" ? s.type : undefined,
    lat: typeof s.lat === "string" || typeof s.lat === "number" ? String(s.lat) : undefined,
    lng: typeof s.lng === "string" || typeof s.lng === "number" ? String(s.lng) : undefined,
    area: typeof s.area === "string" || typeof s.area === "number" ? String(s.area) : undefined,
  }),
  component: ModelLabRoute,
});

function ModelLabRoute() {
  const search = Route.useSearch();
  const site = useMemo(() => parseSiteParams(search), [search]);
  if (search.type && !site) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
        <h1 className="text-xl font-semibold">Site mode</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No schematic exists for “{search.type}”. Supported: 20 ft or 40 ft container, or 3-bedroom
          stone masonry.
        </p>
      </main>
    );
  }
  if (site) {
    return (
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6" key={JSON.stringify(search)}>
        <h1 className="text-xl font-semibold">Site mode — {structureLabel(site.structure)}</h1>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Visualization only. No parcel, boundary, title, survey or fit is implied.
        </p>
        <SiteViewer params={site} />
      </main>
    );
  }
  return <ModelLabPage />;
}

const DESKTOP_DEFAULT = "apartment-3";
const MOBILE_DEFAULT = "market-day";

function Group({
  label,
  children,
  collapsible,
  open,
}: {
  label: string;
  children: React.ReactNode;
  /** Native <details> so a narrow viewport keeps the viewport dominant. */
  collapsible?: boolean;
  open?: boolean;
}) {
  const heading =
    "text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground";
  if (collapsible) {
    return (
      <details open={open} className="flex flex-col gap-2" data-testid="model-lab-diagnostics">
        <summary className={`cursor-pointer list-item ${heading}`}>{label}</summary>
        <div className="mt-2 flex flex-wrap items-center gap-2">{children}</div>
      </details>
    );
  }
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <h2 className={heading}>{label}</h2>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </section>
  );
}

function Row({ k, v, code }: { k: string; v: string; code?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{k}</span>
      {/* Human-readable value; the raw enum stays available for debugging. */}
      <span className="text-right font-medium tabular-nums" title={code ?? v}>
        {v}
      </span>
    </div>
  );
}

const LOAD_STATE_LABEL: Record<string, string> = {
  IDLE: "Idle",
  CHECKING: "Checking the file",
  DOWNLOADING: "Downloading",
  PARSING: "Parsing",
  READY: "Ready",
  MODEL_NOT_LOADED: "No model is currently loaded.",
  FAILED_NETWORK: "The model could not be downloaded.",
  FAILED_ASSET: "This model file could not be read.",
  FAILED_WEBGL: "3D rendering stopped unexpectedly.",
};

/** Plain-English copy for every machine state shown as body text. */
const HUMAN_STATE: Record<string, string> = {
  SESSION_REJECTED: "AR could not start on this device.",
  XR_SESSION_REJECTED: "AR could not start on this device.",
  ERROR: "AR could not start on this device.",
  HIT_TEST_UNAVAILABLE: "Surface detection is unavailable.",
  MODEL_NOT_LOADED: "No model is currently loaded.",
  FAILED_NETWORK: "The model could not be downloaded.",
  FAILED_ASSET: "This model file could not be read.",
  FAILED_WEBGL: "3D rendering stopped unexpectedly.",
  CONTEXT_LOST: "3D rendering stopped unexpectedly.",
  AR_UNAVAILABLE: "AR is not available on this device.",
  CHECKING: "Checking AR support…",
};

const PERF_LABEL: Record<string, string> = {
  LIGHT: "Light",
  MEDIUM: "Medium",
  HEAVY: "Heavy",
  VERY_HEAVY: "Very heavy",
};

const PRESENTATION_LABEL: Record<PresentationMode, string> = {
  TABLETOP: "Tabletop",
  AUTHORED_SCALE: "Authored scale",
  USER_ADJUSTED: "User adjusted",
};

function ModelLabPage() {
  const [platform, setPlatform] = useState<LabPlatform>("desktop");
  const [coarse, setCoarse] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const [modelId, setModelId] = useState<string>(DESKTOP_DEFAULT);
  const [confirmedIds, setConfirmedIds] = useState<readonly string[]>([]);
  const [env, setEnv] = useState<EnvMode>("day");
  const [autoRotate, setAutoRotate] = useState(false);
  const [status, setStatus] = useState<ViewerStatus | null>(null);
  const [api, setApi] = useState<ViewerApi | null>(null);
  const [presentation, setPresentation] = useState<PresentationMode>("TABLETOP");
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const [viewerKey, setViewerKey] = useState(0);

  const shellRef = useRef<HTMLDivElement | null>(null);
  const overlayRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const p = labPlatformFromUA(navigator.userAgent, navigator.maxTouchPoints);
    setPlatform(p);
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    setCoarse(isCoarse);
    setCanFullscreen(fullscreenSupported(document));
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (isCoarse) setModelId(MOBILE_DEFAULT);
  }, []);

  const selected: BuildingModel = useMemo(
    () => selectBuildingById(modelId) ?? BUILDING_MODELS[0]!,
    [modelId],
  );

  const needsConfirm =
    coarse &&
    (selected.performanceClass === "HEAVY" || selected.performanceClass === "VERY_HEAVY") &&
    !confirmedIds.includes(selected.id);

  const index = BUILDING_MODELS.findIndex((m) => m.id === selected.id);
  const step = useCallback(
    (delta: number) => {
      const next =
        BUILDING_MODELS[(index + delta + BUILDING_MODELS.length) % BUILDING_MODELS.length]!;
      setModelId(next.id);
    },
    [index],
  );

  const onUserInteract = useCallback(() => setAutoRotate(false), []);

  const toggleFullscreen = useCallback(async () => {
    setFullscreenError(null);
    const el = shellRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch (err) {
      setFullscreenError(
        `Fullscreen was rejected by this browser: ${(err as Error)?.message ?? "unknown error"}`,
      );
    }
  }, []);

  const xr = status?.xr;
  const inSession = Boolean(xr?.inSession);
  const intent = sceneViewerIntent(
    selected,
    typeof window !== "undefined" ? window.location.origin : undefined,
    typeof window !== "undefined" ? window.location.href : undefined,
  );

  // The engine owns the presentation mode; local state is only the request.
  const activePresentation = status?.presentation ?? presentation;

  // After a keyed remount the fresh engine starts at its own default, so the
  // requested presentation is re-applied as soon as the new API arrives.
  useEffect(() => {
    api?.setPresentation(presentation);
    // Re-apply on a new API instance only, not on every presentation change
    // (the click handler already applies those directly).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const contextLost = Boolean(status?.contextLost);
  const restoreRenderer = useCallback(() => {
    // Full remount: the viewer's own cleanup disposes geometries, materials,
    // textures, controls and the canvas before a single new one is built.
    setStatus(null);
    setApi(null);
    setViewerKey((k) => k + 1);
  }, []);

  const errorNotice = (() => {
    const s = status?.state;
    if (!s) return null;
    if (s === "FAILED_NETWORK" || s === "FAILED_ASSET" || s === "FAILED_WEBGL") {
      return `${HUMAN_STATE[s]} ${status?.message ?? ""}`.trim();
    }
    if (status?.contextLost) return `${HUMAN_STATE["CONTEXT_LOST"]} ${status.message}`.trim();
    return null;
  })();

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <header className="mb-4">
        <h1 className="font-display text-2xl sm:text-3xl">Architectural Model Lab</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Isolated model compatibility harness. Nothing here is linked to a parcel record.
        </p>
        <p
          role="note"
          className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm font-medium"
        >
          {MODEL_LAB_DISCLAIMER}
        </p>
        {platform === "ios" ? (
          <p
            role="note"
            className="mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
          >
            {QUICK_LOOK_UNAVAILABLE_MESSAGE}
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* viewport */}
        <div
          ref={shellRef}
          className="relative min-h-[52vh] overflow-hidden rounded-2xl border border-white/10 bg-black/30 lg:min-h-[70vh]"
        >
          {needsConfirm ? (
            <div className="flex h-full min-h-[52vh] w-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm">
                {selected.name} is a {selected.performanceClass.toLowerCase()} model of{" "}
                {humanBytes(selected.bytes)}. On mobile data this download is not started
                automatically.
              </p>
              <KitButton
                variant="primary"
                onClick={() => setConfirmedIds((p) => [...p, selected.id])}
              >
                Download and load ({humanBytes(selected.bytes)})
              </KitButton>
            </div>
          ) : (
            <ModelLabViewer
              key={`${viewerKey}`}
              model={selected}
              env={env}
              autoRotate={autoRotate && !reducedMotion}
              onStatus={setStatus}
              onApi={setApi}
              onUserInteract={onUserInteract}
              overlayRootRef={overlayRootRef}
            />
          )}

          {contextLost ? (
            <div className="absolute inset-x-2 top-2 flex flex-wrap items-center gap-2 rounded-xl border border-white/15 bg-black/70 px-3 py-2">
              <p className="text-xs">
                The graphics context was lost. Rebuilding the viewer creates one fresh canvas and
                discards the old resources.
              </p>
              <KitButton size="sm" variant="primary" onClick={restoreRenderer}>
                Restore renderer
              </KitButton>
            </div>
          ) : null}

          {/* dom-overlay root: the only element visible inside an AR session */}
          <div
            ref={overlayRootRef}
            className="pointer-events-none absolute inset-x-2 bottom-2 flex flex-wrap items-center justify-center gap-2"
          >
            {inSession ? (
              xr?.domOverlay === false ? (
                <p className="pointer-events-auto rounded-lg bg-black/70 px-3 py-2 text-xs">
                  In-session controls are unavailable on this device.
                </p>
              ) : (
                <>
                  <KitButton
                    className="pointer-events-auto"
                    size="sm"
                    onClick={() => api?.replace()}
                    aria-label="Re-place the model"
                  >
                    Re-place
                  </KitButton>
                  <KitButton
                    className="pointer-events-auto"
                    size="sm"
                    onClick={() => api?.nudgeScale(1 / 1.2)}
                    aria-label="Decrease model scale"
                  >
                    Scale −
                  </KitButton>
                  <KitButton
                    className="pointer-events-auto"
                    size="sm"
                    onClick={() => api?.nudgeScale(1.2)}
                    aria-label="Increase model scale"
                  >
                    Scale +
                  </KitButton>
                  <KitButton
                    className="pointer-events-auto"
                    size="sm"
                    onClick={() => api?.rotatePlaced(-Math.PI / 12)}
                    aria-label="Rotate model left"
                  >
                    Rotate ←
                  </KitButton>
                  <KitButton
                    className="pointer-events-auto"
                    size="sm"
                    onClick={() => api?.rotatePlaced(Math.PI / 12)}
                    aria-label="Rotate model right"
                  >
                    Rotate →
                  </KitButton>
                  <KitButton
                    className="pointer-events-auto"
                    size="sm"
                    variant="destructive"
                    onClick={() => api?.exitXr()}
                  >
                    Exit XR
                  </KitButton>
                </>
              )
            ) : null}
          </div>
        </div>

        {/* controls */}
        <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-black/20 p-4">
          <Group label="Model">
            <KitButton
              iconOnly
              aria-label="Previous model"
              disabled={inSession}
              onClick={() => step(-1)}
            >
              ←
            </KitButton>
            <label className="sr-only" htmlFor="model-lab-select">
              Select building model
            </label>
            <select
              id="model-lab-select"
              className="min-h-11 flex-1 rounded-xl border border-white/15 bg-transparent px-3 text-sm"
              value={selected.id}
              disabled={inSession}
              onChange={(e) => setModelId(e.target.value)}
            >
              {BUILDING_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.performanceClass}
                </option>
              ))}
            </select>
            <KitButton
              iconOnly
              aria-label="Next model"
              disabled={inSession}
              onClick={() => step(1)}
            >
              →
            </KitButton>
            {inSession ? (
              <p className="w-full text-xs text-muted-foreground">
                Model switching is locked while an immersive session is running. Exit XR to change
                model.
              </p>
            ) : null}
          </Group>

          <Group label="View">
            <KitButton size="sm" onClick={() => api?.reset()}>
              Reset
            </KitButton>
            <KitButton size="sm" onClick={() => api?.fit()}>
              Fit
            </KitButton>
            {canFullscreen ? (
              <KitButton size="sm" onClick={() => void toggleFullscreen()}>
                Fullscreen
              </KitButton>
            ) : null}
            {reducedMotion ? (
              <span className="text-xs text-muted-foreground">
                Auto-rotate disabled (reduced motion).
              </span>
            ) : (
              <KitButton
                size="sm"
                variant={autoRotate ? "primary" : "secondary"}
                aria-pressed={autoRotate}
                onClick={() => setAutoRotate((v) => !v)}
              >
                Auto-rotate {autoRotate ? "on" : "off"}
              </KitButton>
            )}
          </Group>

          <Group label="Environment">
            {(["day", "neutral", "night"] as const).map((m) => (
              <KitButton
                key={m}
                size="sm"
                variant={env === m ? "primary" : "secondary"}
                aria-pressed={env === m}
                onClick={() => setEnv(m)}
              >
                {m[0]!.toUpperCase() + m.slice(1)}
              </KitButton>
            ))}
          </Group>

          <Group label="XR">
            {/* Deterministic ladder: an undecided probe is never reported as a failure,
                and no non-interactive text is ever styled to look like a button. */}
            {xr?.arSupported == null ? (
              <KitButton size="sm" disabled>
                Checking AR support…
              </KitButton>
            ) : xr.arSupported ? (
              <KitButton size="sm" onClick={() => api?.enterAr()} disabled={inSession}>
                Enter AR
              </KitButton>
            ) : platform === "android" && intent ? (
              <a
                className="btn-base btn-primary min-h-11 px-4 text-sm"
                href={intent}
                rel="nofollow noopener"
              >
                Open in Scene Viewer
              </a>
            ) : (
              <p className="w-full text-xs text-muted-foreground">
                Immersive AR is not available in this browser, so the model stays in the interactive
                3D viewer. {arCapabilitySummary(platform)}
              </p>
            )}
            {xr?.xrState === "SESSION_REJECTED" || xr?.xrState === "ERROR" ? (
              <p role="alert" className="w-full text-xs text-destructive">
                {HUMAN_STATE[xr.xrState] ?? "AR could not start on this device."}{" "}
                {xr.note || "No diagnostic detail was reported."}
              </p>
            ) : null}
            {xr?.vrSupported ? (
              <KitButton size="sm" onClick={() => api?.enterVr()} disabled={inSession}>
                Enter VR
              </KitButton>
            ) : null}
            {inSession ? (
              <KitButton size="sm" variant="destructive" onClick={() => api?.exitXr()}>
                Exit XR
              </KitButton>
            ) : null}
            {platform === "android" && intent && xr?.arSupported ? (
              <a
                className="btn-base btn-secondary min-h-11 px-4 text-sm"
                href={intent}
                rel="nofollow noopener"
              >
                Scene Viewer (asset compatibility {selected.sceneViewerAssetCompatibility})
              </a>
            ) : null}
          </Group>

          <Group label="Presentation">
            {(["TABLETOP", "AUTHORED_SCALE", "USER_ADJUSTED"] as const).map((m) => (
              <KitButton
                key={m}
                size="sm"
                variant={activePresentation === m ? "primary" : "secondary"}
                aria-pressed={activePresentation === m}
                onClick={() => {
                  setPresentation(m);
                  api?.setPresentation(m);
                }}
              >
                {PRESENTATION_LABEL[m]}
              </KitButton>
            ))}
          </Group>

          <Group label="Diagnostics" collapsible open={!coarse}>
            <div className="w-full space-y-1">
              <Row k="Model" v={selected.name} />
              <Row
                k="State"
                v={LOAD_STATE_LABEL[status?.state ?? "IDLE"] ?? "Model not loaded"}
                code={status?.state ?? "MODEL_NOT_LOADED"}
              />
              <Row
                k="Progress"
                v={
                  status?.progress == null
                    ? status?.state === "READY"
                      ? "100%"
                      : "indeterminate"
                    : `${Math.round(status.progress * 100)}%`
                }
              />
              <Row k="Bytes" v={humanBytes(selected.bytes)} />
              <Row k="Meshes" v={String(status?.meshes ?? 0)} />
              <Row k="Triangles" v={String(status?.triangles ?? 0)} />
              {/* Google recommends <= 10 materials for Scene Viewer; reported, never gated. */}
              <Row k="Materials" v={String(status?.materialCount ?? 0)} />
              <Row k="Max extent" v={status?.maxExtentM == null ? "—" : `${status.maxExtentM} m`} />
              <Row
                k="Performance class"
                v={PERF_LABEL[selected.performanceClass] ?? selected.performanceClass}
                code={selected.performanceClass}
              />
              <Row
                k="Presentation"
                v={PRESENTATION_LABEL[activePresentation]}
                code={activePresentation}
              />
              <Row
                k="AR support"
                v={
                  xr?.arSupported == null
                    ? "checking…"
                    : xr.arSupported
                      ? "supported"
                      : "not available"
                }
                code={
                  xr?.arSupported == null
                    ? "CHECKING"
                    : xr.arSupported
                      ? "SUPPORTED"
                      : "AR_UNAVAILABLE"
                }
              />
              <Row
                k="VR support"
                v={
                  xr?.vrSupported == null
                    ? "checking…"
                    : xr.vrSupported
                      ? "supported"
                      : "unsupported"
                }
              />
              <Row k="AR reference space" v={xr?.referenceSpace ?? "—"} />
              <Row
                k="dom-overlay"
                v={xr?.domOverlay == null ? "—" : xr.domOverlay ? "granted" : "not granted"}
              />
              <Row
                k="Hit test"
                v={
                  !inSession
                    ? "—"
                    : xr?.hitTest
                      ? "available"
                      : HUMAN_STATE["HIT_TEST_UNAVAILABLE"]!
                }
                code={
                  !inSession ? "—" : xr?.hitTest ? "HIT_TEST_AVAILABLE" : "HIT_TEST_UNAVAILABLE"
                }
              />
              <Row k="Placement" v={xr?.placed ? "placed" : inSession ? "awaiting surface" : "—"} />
              <Row
                k="Scene Viewer intent"
                v={selected.sceneViewerIntentSupported ? "constructed" : "n/a"}
              />
              <Row
                k="Scene Viewer asset"
                v={
                  selected.sceneViewerAssetCompatibility === "UNVERIFIED"
                    ? "not verified"
                    : "not applicable"
                }
                code={`SCENE_VIEWER_${selected.sceneViewerAssetCompatibility}`}
              />
              <Row k="Quick Look" v="not available" code="QUICK_LOOK_UNAVAILABLE" />
              <Row
                k="Parcel match"
                v="none"
                code={String(MODEL_LAB_PARCEL_CONTEXT.matchedParcelRecord)}
              />
              <Row
                k="Boundary evidence"
                v="none"
                code={MODEL_LAB_PARCEL_CONTEXT.boundaryEvidence}
              />
              <Row k="Model fit" v="unknown" code={MODEL_LAB_PARCEL_CONTEXT.modelFit} />
            </div>
          </Group>

          <p aria-live="polite" role="status" className="min-h-5 text-xs text-muted-foreground">
            {errorNotice ?? status?.message ?? "Idle."}
          </p>
          {fullscreenError ? (
            <p role="alert" className="text-xs text-destructive">
              {fullscreenError}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">{arCapabilitySummary(platform)}</p>
        </div>
      </div>
    </main>
  );
}
