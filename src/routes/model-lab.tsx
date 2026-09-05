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
  component: ModelLabPage,
});

const DESKTOP_DEFAULT = "apartment-3";
const MOBILE_DEFAULT = "market-day";

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </h2>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium tabular-nums">{v}</span>
    </div>
  );
}

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
      const next = BUILDING_MODELS[(index + delta + BUILDING_MODELS.length) % BUILDING_MODELS.length]!;
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
    if (s === "FAILED_NETWORK" || s === "FAILED_ASSET" || s === "FAILED_WEBGL" || s === "AR_UNAVAILABLE") {
      return `${s}: ${status?.message ?? ""}`;
    }
    if (status?.contextLost) return `CONTEXT_LOST: ${status.message}`;
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
          <p role="note" className="mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
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
                {humanBytes(selected.bytes)}. On mobile data this download is not started automatically.
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
            <KitButton iconOnly aria-label="Previous model" onClick={() => step(-1)}>
              ←
            </KitButton>
            <label className="sr-only" htmlFor="model-lab-select">
              Select building model
            </label>
            <select
              id="model-lab-select"
              className="min-h-11 flex-1 rounded-xl border border-white/15 bg-transparent px-3 text-sm"
              value={selected.id}
              onChange={(e) => setModelId(e.target.value)}
            >
              {BUILDING_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.performanceClass}
                </option>
              ))}
            </select>
            <KitButton iconOnly aria-label="Next model" onClick={() => step(1)}>
              →
            </KitButton>
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
            {xr?.arSupported ? (
              <KitButton size="sm" onClick={() => api?.enterAr()} disabled={inSession}>
                Enter AR
              </KitButton>
            ) : (
              <span className="text-xs text-muted-foreground">AR_UNAVAILABLE on this device.</span>
            )}
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
            {(["TABLETOP", "AUTHORED_SCALE", "USER_ADJUSTED"] as const).map((m) => (
              <KitButton
                key={m}
                size="sm"
                variant={presentation === m ? "primary" : "secondary"}
                aria-pressed={presentation === m}
                onClick={() => {
                  setPresentation(m);
                  api?.setPresentation(m);
                }}
              >
                {m === "TABLETOP" ? "Tabletop" : m === "AUTHORED_SCALE" ? "Authored scale" : "User adjusted"}
              </KitButton>
            ))}
            {platform === "android" && intent ? (
              <a
                className="btn-base btn-secondary min-h-11 px-4 text-sm"
                href={intent}
                rel="nofollow noopener"
              >
                Scene Viewer (asset compatibility {selected.sceneViewerAssetCompatibility})
              </a>
            ) : null}
          </Group>

          <Group label="Status">
            <div className="w-full space-y-1">
              <Row k="Model" v={selected.name} />
              <Row k="State" v={status?.state ?? "MODEL_NOT_LOADED"} />
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
              <Row k="Max extent" v={status?.maxExtentM == null ? "—" : `${status.maxExtentM} m`} />
              <Row k="Performance class" v={selected.performanceClass} />
              <Row
                k="AR support"
                v={xr?.arSupported == null ? "checking…" : xr.arSupported ? "supported" : "AR_UNAVAILABLE"}
              />
              <Row
                k="VR support"
                v={xr?.vrSupported == null ? "checking…" : xr.vrSupported ? "supported" : "unsupported"}
              />
              <Row k="AR reference space" v={xr?.referenceSpace ?? "—"} />
              <Row
                k="dom-overlay"
                v={xr?.domOverlay == null ? "—" : xr.domOverlay ? "granted" : "not granted"}
              />
              <Row
                k="Hit test"
                v={!inSession ? "—" : xr?.hitTest ? "available" : "HIT_TEST_UNAVAILABLE"}
              />
              <Row k="Placement" v={xr?.placed ? "placed" : inSession ? "awaiting surface" : "—"} />
              <Row k="Scene Viewer intent" v={selected.sceneViewerIntentSupported ? "constructed" : "n/a"} />
              <Row k="Scene Viewer asset" v={`SCENE_VIEWER_${selected.sceneViewerAssetCompatibility}`} />
              <Row k="Quick Look" v="QUICK_LOOK_UNAVAILABLE" />
              <Row k="Parcel match" v={String(MODEL_LAB_PARCEL_CONTEXT.matchedParcelRecord)} />
              <Row k="Boundary evidence" v={MODEL_LAB_PARCEL_CONTEXT.boundaryEvidence} />
              <Row k="Model fit" v={MODEL_LAB_PARCEL_CONTEXT.modelFit} />
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
