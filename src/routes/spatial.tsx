import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { fallback } from "@tanstack/zod-adapter";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Boxes,
  Building2,
  Cuboid,
  Crosshair,
  Glasses,
  Loader2,
  Maximize2,
  MapPin,
  Ruler,
  Scan,
  ShieldAlert,
  Sun,
} from "lucide-react";
import {
  Surface,
  KitButton,
  SegmentedTabs,
  SectionHeading,
  StatusBadge,
} from "@/components/halisia/ds";
import {
  SpatialCanvas,
  type SpatialCanvasHandle,
} from "@/components/halisia/spatial/spatial-canvas";
import type { ArPlacementState } from "@/components/halisia/spatial/spatial-canvas.internal";
import { LandPassport } from "@/components/halisia/spatial/land-passport";
import { useReducedMotionPref } from "@/hooks/use-reduced-motion-pref";
import { useMyLocation } from "@/hooks/use-my-location";
import {
  distanceM,
  fetchSpatialListings,
  fetchSpatialParcels,
  fetchSpatialPrototypes,
} from "@/lib/spatial-data";
import { buildableEnvelope, polygonPerimeterM, ringToLocal, sunPosition } from "@/lib/spatial";
import { arFallbackMessage, arPlatformFromUA, type ArPlatform } from "@/lib/spatial-platform";

const TITLE = "Spatial AR / VR Land Studio — HALISIA.AI";
const DESCRIPTION =
  "Walk a Kenyan parcel in augmented reality, inspect survey beacons, setback ribbons and zoning envelopes in 3D, run a live sun-path study and issue a Digital Land Passport.";

export const Route = createFileRoute("/spatial")({
  validateSearch: z.object({ parcel: fallback(z.string(), "").default("") }),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SpatialPage,
});

function dayOfYearNow() {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  return Math.floor((now.getTime() - start) / 86_400_000);
}

function SpatialPage() {
  const { parcel: parcelParam } = Route.useSearch();
  const [reduced] = useReducedMotionPref();
  const handle = useRef<SpatialCanvasHandle>(null);
  // Focus management targets for XR start/exit/error transitions.
  const fallbackRef = useRef<HTMLElement>(null);
  const startArRef = useRef<HTMLButtonElement>(null);
  const exitXrRef = useRef<HTMLButtonElement>(null);
  const parcelListRef = useRef<HTMLUListElement>(null);
  // Control that opened the capability/fallback panel; focus returns here.
  const panelInvokerRef = useRef<HTMLElement | null>(null);

  const parcelsQ = useQuery({ queryKey: ["spatial", "parcels"], queryFn: fetchSpatialParcels });
  const protosQ = useQuery({
    queryKey: ["spatial", "prototypes"],
    queryFn: fetchSpatialPrototypes,
  });
  const listingsQ = useQuery({ queryKey: ["spatial", "listings"], queryFn: fetchSpatialListings });

  const parcels = useMemo(() => parcelsQ.data ?? [], [parcelsQ.data]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [protoId, setProtoId] = useState<string>("");
  const [mode, setMode] = useState<"site" | "masterplan">("site");
  const [sunHour, setSunHour] = useState(13);
  const [showBeacons, setShowBeacons] = useState(true);
  const [showSetback, setShowSetback] = useState(true);
  const [showEnvelope, setShowEnvelope] = useState(true);
  const [xrActive, setXrActive] = useState(false);
  const [xrSupported, setXrSupported] = useState<boolean | null>(null);
  const [vrSupported, setVrSupported] = useState<boolean | null>(null);
  const [xrBlockedByFrame, setXrBlockedByFrame] = useState(false);
  const [xrMode, setXrMode] = useState<"ar" | "vr" | null>(null);
  const [placement, setPlacement] = useState<ArPlacementState>({
    hitTest: false,
    surfaceFound: false,
    placed: false,
  });
  const [xrError, setXrError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [arPlatform, setArPlatform] = useState<ArPlatform>("desktop");
  const {
    request: requestLocation,
    location,
    error: locationError,
    loading: locating,
  } = useMyLocation();

  // Platform detection is client-only (user agent + touch points).
  useEffect(() => {
    setArPlatform(arPlatformFromUA(navigator.userAgent, navigator.maxTouchPoints));
  }, []);

  useEffect(() => {
    if (!parcels.length) return;
    setSelectedId((cur) => {
      if (cur && parcels.some((p) => p.id === cur)) return cur;
      const wanted = parcels.find((p) => p.id === parcelParam);
      return (wanted ?? parcels[0]!).id;
    });
  }, [parcels, parcelParam]);

  useEffect(() => {
    const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
    if (!xr?.isSessionSupported) {
      setXrSupported(false);
      setVrSupported(false);
      return;
    }
    void xr
      .isSessionSupported("immersive-ar")
      .then(setXrSupported)
      .catch(() => setXrSupported(false));
    void xr
      .isSessionSupported("immersive-vr")
      .then(setVrSupported)
      .catch(() => setVrSupported(false));
  }, []);

  const parcel = parcels.find((p) => p.id === selectedId) ?? null;
  const prototypes = protosQ.data ?? [];
  const prototype = prototypes.find((p) => p.id === protoId) ?? null;

  const env = useMemo(() => (parcel ? buildableEnvelope(parcel) : null), [parcel]);
  const perimeter = useMemo(
    () => (parcel ? Math.round(polygonPerimeterM(ringToLocal(parcel.ring, parcel.centroid))) : 0),
    [parcel],
  );
  const sun = parcel
    ? sunPosition(parcel.centroid.lat, parcel.centroid.lng, dayOfYearNow(), sunHour)
    : null;

  const nearbyListings = useMemo(() => {
    if (!parcel) return [];
    return (listingsQ.data ?? [])
      .map((l) => ({ ...l, dist: distanceM(parcel.centroid, { lat: l.lat, lng: l.lng }) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 4);
  }, [listingsQ.data, parcel]);

  const startSession = async (kind: "ar" | "vr") => {
    // Remember the control that opened the fallback panel so focus can return
    // to it when the panel closes. Focus is never trapped inside the panel.
    const active = document.activeElement;
    if (active instanceof HTMLElement) panelInvokerRef.current = active;
    setXrError(null);
    setStarting(true);
    setXrMode(kind);
    try {
      if (kind === "ar") {
        void requestLocation();
        await handle.current?.startAr();
      } else {
        await handle.current?.startVr();
      }
    } catch (err) {
      setXrMode(null);
      setXrError(
        err instanceof Error
          ? `${err.message} Use the model viewer fallback below on iOS or Android.`
          : `Could not start the ${kind === "ar" ? "AR" : "VR"} session.`,
      );
    } finally {
      setStarting(false);
    }
  };

  // Non-blocking focus management for the fallback panel: focus moves into the
  // panel when it opens through a user action and returns to the invoking
  // control when it closes. Focus is never trapped — Tab/Shift+Tab still reach
  // the canvas and every other control.
  const fallbackOpen = Boolean(xrError) || xrSupported === false;
  const wasFallbackOpen = useRef(false);
  useEffect(() => {
    if (fallbackOpen && !wasFallbackOpen.current) {
      // Only pull focus when a control actually opened the panel.
      if (panelInvokerRef.current) fallbackRef.current?.focus();
    } else if (!fallbackOpen && wasFallbackOpen.current) {
      panelInvokerRef.current?.focus();
      panelInvokerRef.current = null;
    }
    wasFallbackOpen.current = fallbackOpen;
  }, [fallbackOpen]);

  // Entering XR focuses "Exit XR"; leaving it returns focus to "Launch AR".
  const wasXrActive = useRef(false);
  useEffect(() => {
    if (xrActive && !wasXrActive.current) exitXrRef.current?.focus();
    if (!xrActive && wasXrActive.current) startArRef.current?.focus();
    wasXrActive.current = xrActive;
  }, [xrActive]);

  // Roving arrow-key navigation across the surveyed parcel radio group.
  const onParcelKeyDown = (e: ReactKeyboardEvent<HTMLUListElement>) => {
    const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const items = Array.from(
      parcelListRef.current?.querySelectorAll<HTMLButtonElement>("button[role='radio']") ?? [],
    );
    if (!items.length) return;
    const current = items.findIndex((el) => el === document.activeElement);
    const idx = current < 0 ? 0 : current;
    let next = idx;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (idx + 1) % items.length;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft")
      next = (idx - 1 + items.length) % items.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = items.length - 1;
    e.preventDefault();
    const target = items[next];
    if (!target) return;
    target.focus();
    const id = target.dataset["parcelId"];
    if (id) setSelectedId(id);
  };

  const arDisabledReason =
    xrSupported === false
      ? "WebXR AR is not available on this device — use the fallback viewer below"
      : starting
        ? "Starting an immersive session…"
        : "Launch immersive AR";
  const vrDisabledReason =
    vrSupported === false
      ? "WebXR VR is not available on this device or browser"
      : starting
        ? "Starting an immersive session…"
        : "Enter the immersive VR masterplan";

  const usdz = prototype?.usdzUrl ?? null;
  const gltf = prototype?.gltfUrl ?? null;
  const sceneViewerHref = gltf
    ? `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(gltf)}&mode=ar_preferred#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;end;`
    : null;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 pt-24 pb-16">
      <a
        href="#spatial-controls"
        data-testid="spatial-skip-link"
        className="focus-ring sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-20 focus:z-50 focus:rounded-full focus:glass-strong focus:border focus:border-white/20 focus:px-4 focus:py-2 focus:text-xs"
      >
        Skip to spatial controls
      </a>
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link to="/" search={{ compare: "" }} className="hover:text-foreground">
          Home
        </Link>{" "}
        / <span className="text-foreground">Spatial AR studio</span>
      </nav>

      <SectionHeading
        eyebrow="Spatial intelligence"
        title="AR · VR · XR Land Studio"
        description="Project a surveyed Kenyan parcel into your physical space, verify beacons on the ground, test massing against zoning envelopes and issue a Digital Land Passport."
        className="mt-4"
      />

      {parcelsQ.isLoading && (
        <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-accent" /> Loading surveyed parcels…
        </p>
      )}
      {parcelsQ.isError && (
        <Surface elevation={1} className="mt-8 p-5 text-sm text-red-300">
          Could not load parcels right now.{" "}
          <button type="button" className="underline" onClick={() => void parcelsQ.refetch()}>
            Retry
          </button>
        </Surface>
      )}

      {parcel && parcel.coordinateIssue && parcel.coordinateIssue !== "none" && (
        <Surface
          elevation={1}
          className="mt-6 p-4 text-sm text-amber-200"
          data-testid="spatial-crs-warning"
        >
          <span role="alert">
            {parcel.coordinateIssue === "out-of-bounds"
              ? "This parcel's stored survey geometry falls outside Kenya's WGS84 envelope — it is most likely recorded in a projected CRS (e.g. Arc 1960 / UTM 37S). Boundary, beacon and area rendering are not reliable until the source coordinates are reprojected."
              : "This parcel's stored survey geometry contains invalid coordinates, so boundaries and beacons cannot be rendered reliably."}
          </span>
        </Surface>
      )}

      {parcel && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* --- viewport --- */}
          <div className="grid gap-4">
            <Surface elevation={3} padding="none" className="overflow-hidden">
              <div
                className="relative aspect-[4/3] md:aspect-[16/9]"
                data-testid="spatial-viewport"
              >
                <SpatialCanvas
                  handleRef={handle}
                  parcel={parcel}
                  prototype={prototype}
                  sunHour={sunHour}
                  dayOfYear={dayOfYearNow()}
                  showBeacons={showBeacons}
                  showSetback={showSetback}
                  showEnvelope={showEnvelope}
                  mode={mode}
                  reducedMotion={reduced}
                  onXrStateChange={(active, sessionMode) => {
                    setXrActive(active);
                    setXrMode(active ? (sessionMode ?? null) : null);
                  }}
                  onArPlacementChange={setPlacement}
                />
                <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center gap-2 p-3">
                  <span className="pointer-events-auto rounded-full glass-strong border border-white/15 px-3 py-1 text-[11px]">
                    {parcel.parcelCode || parcel.titleDeedNo}
                  </span>
                  <StatusBadge kind={parcel.status === "verified" ? "verified" : "pending"}>
                    {parcel.status === "verified" ? "Survey verified" : "Verification pending"}
                  </StatusBadge>
                  <span
                    className="sr-only"
                    role="status"
                    aria-live="polite"
                    data-testid="spatial-session-announcer"
                  >
                    {xrActive
                      ? `${xrMode === "vr" ? "VR" : "AR"} session live.`
                      : starting
                        ? "Starting immersive session…"
                        : "No immersive session running."}
                  </span>
                  {xrActive && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-auto rounded-full bg-[#008F55]/20 border border-[#008F55]/50 px-3 py-1 text-[11px] text-[#7ee0b4]"
                    >
                      {xrMode === "vr" ? "VR session live" : "AR session live"}
                    </span>
                  )}
                  {xrActive && xrMode === "ar" && (
                    <span
                      className="pointer-events-auto rounded-full glass-strong border border-white/15 px-3 py-1 text-[11px]"
                      data-testid="spatial-placement-hint"
                      role="status"
                      aria-live="polite"
                    >
                      {placement.placed
                        ? "Twin anchored — tap Re-place to move it"
                        : placement.surfaceFound
                          ? "Surface detected — tap to place"
                          : placement.hitTest
                            ? "Scanning for a ground surface…"
                            : "Hit testing unavailable — twin shown in front of you"}
                    </span>
                  )}
                </div>
                <div
                  id="spatial-controls"
                  tabIndex={-1}
                  role="group"
                  aria-label="Spatial viewport controls"
                  className="absolute bottom-3 right-3 flex max-w-[calc(100%-1.5rem)] flex-wrap justify-end gap-2"
                >
                  <KitButton
                    size="sm"
                    variant="secondary"
                    onClick={() => handle.current?.resetView()}
                    aria-label="Reset view — return the 3D camera to the default parcel framing"
                  >
                    <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" /> Reset view
                  </KitButton>
                  {xrActive ? (
                    <>
                      {xrMode === "ar" && placement.placed && placement.hitTest && (
                        <KitButton
                          size="sm"
                          variant="secondary"
                          onClick={() => handle.current?.resetPlacement()}
                          aria-label="Re-place the parcel twin on another surface"
                        >
                          <Crosshair className="h-3.5 w-3.5" aria-hidden="true" /> Re-place
                        </KitButton>
                      )}
                      <KitButton
                        ref={exitXrRef}
                        size="sm"
                        variant="destructive"
                        onClick={() => handle.current?.endXr()}
                        aria-label={`Exit the immersive ${xrMode === "vr" ? "VR" : "AR"} session and return to the 3D studio`}
                      >
                        Exit XR
                      </KitButton>
                    </>
                  ) : (
                    <>
                      <KitButton
                        ref={startArRef}
                        size="sm"
                        variant="premium"
                        onClick={() => void startSession("ar")}
                        disabled={starting || xrSupported === false}
                        data-testid="spatial-start-ar"
                        title={arDisabledReason}
                        aria-label={`Launch AR. ${arDisabledReason}`}
                        aria-describedby="spatial-xr-status-summary"
                        aria-busy={starting || undefined}
                      >
                        {starting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Scan className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        Launch AR
                      </KitButton>
                      <KitButton
                        size="sm"
                        variant="secondary"
                        onClick={() => void startSession("vr")}
                        disabled={starting || vrSupported === false}
                        data-testid="spatial-start-vr"
                        title={vrDisabledReason}
                        aria-label={`Enter VR. ${vrDisabledReason}`}
                        aria-describedby="spatial-xr-status-summary"
                        aria-busy={starting || undefined}
                      >
                        <Glasses className="h-3.5 w-3.5" aria-hidden="true" /> Enter VR
                      </KitButton>
                    </>
                  )}
                </div>
              </div>
            </Surface>

            <Surface
              elevation={1}
              className="p-4 text-xs"
              data-testid="spatial-xr-status"
              role="region"
              aria-label="Device XR and location capability status"
            >
              <div
                className="flex flex-wrap items-center gap-3"
                id="spatial-xr-status-summary"
                role="status"
                aria-live="polite"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${xrSupported ? "bg-[#008F55]" : "bg-[#AEB7BC]"}`}
                  />
                  WebXR AR:{" "}
                  {xrSupported === null ? "checking…" : xrSupported ? "supported" : "unavailable"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${vrSupported ? "bg-[#008F55]" : "bg-[#AEB7BC]"}`}
                  />
                  WebXR VR:{" "}
                  {vrSupported === null ? "checking…" : vrSupported ? "supported" : "unavailable"}
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                  {locating
                    ? "Reading device location…"
                    : location
                      ? `Device GPS accuracy ±${Math.round(location.accuracy ?? 0)} m`
                      : locationError
                        ? `Location unavailable — ${locationError}`
                        : "Device location not requested"}
                  {!location && !locating && (
                    <button
                      type="button"
                      className="underline rounded focus-ring"
                      onClick={() => void requestLocation()}
                      aria-label="Check accuracy — request device GPS permission"
                      aria-busy={locating || undefined}
                    >
                      Check accuracy
                    </button>
                  )}
                </span>
              </div>
              <p className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground">
                <ShieldAlert
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D4AF37]"
                  aria-hidden="true"
                />
                Approximate spatial visualization — not a cadastral survey. Consumer GPS and WebXR
                plane detection carry metre-level error; boundaries shown here must not be used for
                beaconing, subdivision or legal demarcation.
              </p>
            </Surface>

            {(xrError || xrSupported === false) && (
              <Surface
                elevation={1}
                className="p-4 text-xs focus-ring"
                data-testid="spatial-ar-fallback"
                ref={fallbackRef}
                tabIndex={-1}
                role={xrError ? "alert" : "region"}
                aria-live={xrError ? "assertive" : "polite"}
                aria-label="Immersive AR fallback options"
              >
                <p className="text-muted-foreground">
                  {xrError ??
                    arFallbackMessage({
                      platform: arPlatform,
                      prototypeSelected: Boolean(prototype),
                      hasUsdz: Boolean(usdz),
                      hasGltf: Boolean(gltf),
                    })}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {usdz && (
                    <a
                      href={usdz}
                      rel="ar"
                      aria-label="Open this massing prototype in AR Quick Look on iOS or iPadOS"
                      className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 hover:bg-white/10"
                    >
                      <Cuboid className="h-3.5 w-3.5 text-accent" aria-hidden="true" /> Open in AR
                      Quick Look (iOS)
                    </a>
                  )}
                  {sceneViewerHref && (
                    <a
                      href={sceneViewerHref}
                      aria-label="Open this massing prototype in Google Scene Viewer on Android"
                      className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 hover:bg-white/10"
                    >
                      <Boxes className="h-3.5 w-3.5 text-accent" aria-hidden="true" /> Open in Scene
                      Viewer (Android)
                    </a>
                  )}
                </div>
              </Surface>
            )}

            {/* --- controls --- */}
            <Surface elevation={2} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SegmentedTabs
                  items={[
                    { value: "site", label: "Site AR" },
                    { value: "masterplan", label: "VR masterplan" },
                  ]}
                  value={mode}
                  onValueChange={(v) => setMode(v as "site" | "masterplan")}
                  label="Spatial mode"
                />
                <div
                  className="flex flex-wrap gap-2 text-[11px]"
                  role="group"
                  aria-label="Map layer visibility"
                >
                  {(
                    [
                      ["Beacons", showBeacons, setShowBeacons],
                      ["Setbacks", showSetback, setShowSetback],
                      ["Zoning envelope", showEnvelope, setShowEnvelope],
                    ] as Array<[string, boolean, (v: (p: boolean) => boolean) => void]>
                  ).map(([label, on, set]) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set((v) => !v)}
                      className={`min-h-9 rounded-full border px-3 py-1.5 transition focus-ring ${
                        on
                          ? "border-[#008F55]/60 bg-[#008F55]/15 text-foreground"
                          : "border-white/10 text-muted-foreground hover:bg-white/5"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-2">
                <label htmlFor="sun-hour" className="flex items-center gap-2 text-xs">
                  <Sun className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden="true" /> Sun-path study —{" "}
                  <span className="font-mono">
                    {String(Math.floor(sunHour)).padStart(2, "0")}:
                    {String(Math.round((sunHour % 1) * 60)).padStart(2, "0")}
                  </span>{" "}
                  EAT
                  {sun && (
                    <span className="text-muted-foreground">
                      · altitude {sun.altitudeDeg.toFixed(1)}° · azimuth {sun.azimuthDeg.toFixed(0)}
                      °{sun.isDay ? "" : " · night"}
                    </span>
                  )}
                </label>
                <input
                  id="sun-hour"
                  type="range"
                  min={5}
                  max={19}
                  step={0.25}
                  value={sunHour}
                  onChange={(e) => setSunHour(Number(e.target.value))}
                  aria-label="Sun-path study time of day, East Africa Time"
                  aria-valuetext={`${String(Math.floor(sunHour)).padStart(2, "0")}:${String(
                    Math.round((sunHour % 1) * 60),
                  ).padStart(2, "0")} EAT${
                    sun ? `, sun altitude ${sun.altitudeDeg.toFixed(0)} degrees` : ""
                  }`}
                  className="w-full accent-[#D4AF37]"
                />
              </div>

              <div className="mt-5 grid gap-2">
                <p className="text-xs text-muted-foreground" id="spatial-prototype-label">
                  Massing prototype
                </p>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-labelledby="spatial-prototype-label"
                >
                  <button
                    type="button"
                    onClick={() => setProtoId("")}
                    aria-pressed={protoId === ""}
                    aria-label="Show bare land with no massing prototype"
                    className={`min-h-9 rounded-full border px-3 py-1.5 text-[11px] focus-ring ${
                      protoId === ""
                        ? "border-white/40 bg-white/10"
                        : "border-white/10 text-muted-foreground"
                    }`}
                  >
                    None (bare land)
                  </button>
                  {prototypes.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProtoId(p.id)}
                      aria-pressed={protoId === p.id}
                      aria-label={`Massing prototype ${p.title}${p.floors ? `, ${p.floors} floors` : ""}`}
                      className={`min-h-9 rounded-full border px-3 py-1.5 text-[11px] focus-ring ${
                        protoId === p.id
                          ? "border-[#D4AF37]/60 bg-[#D4AF37]/15 text-foreground"
                          : "border-white/10 text-muted-foreground hover:bg-white/5"
                      }`}
                    >
                      <Building2 className="mr-1 inline h-3 w-3" aria-hidden="true" />
                      {p.title}
                    </button>
                  ))}
                </div>

                {prototype && (
                  <p className="text-[11px] text-muted-foreground">
                    {prototype.floors ?? 1} floor(s) · {prototype.footprintSqm ?? "—"} m² footprint
                    · {prototype.heightM ?? "—"} m tall ·{" "}
                    {prototype.estimatedCostKes
                      ? `KES ${prototype.estimatedCostKes.toLocaleString("en-KE")}`
                      : "cost on request"}
                  </p>
                )}
              </div>

              {env && (
                <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                  {[
                    ["Parcel area", `${Math.round(parcel.areaSqm).toLocaleString("en-KE")} m²`],
                    ["Buildable", `${Math.round(env.buildableSqm).toLocaleString("en-KE")} m²`],
                    ["Coverage", `${env.coveragePct}%`],
                    ["Perimeter", `${perimeter} m`],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {k}
                      </dt>
                      <dd className="mt-1 font-display text-base">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </Surface>

            <LandPassport parcel={parcel} />
          </div>

          {/* --- parcel rail --- */}
          <aside className="grid content-start gap-4">
            <Surface elevation={2} className="p-4">
              <p
                className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
                id="spatial-parcel-label"
              >
                Surveyed parcels
              </p>
              <ul
                className="mt-3 grid gap-2"
                data-testid="spatial-parcel-list"
                ref={parcelListRef}
                role="radiogroup"
                aria-labelledby="spatial-parcel-label"
                onKeyDown={onParcelKeyDown}
              >
                {parcels.map((p) => (
                  <li key={p.id} role="none">
                    <button
                      type="button"
                      role="radio"
                      data-parcel-id={p.id}
                      onClick={() => setSelectedId(p.id)}
                      aria-checked={p.id === selectedId}
                      tabIndex={p.id === selectedId ? 0 : -1}
                      aria-label={`Parcel ${p.parcelCode || p.titleDeedNo}, ${p.county ?? "Kenya"}, ${Math.round(
                        p.areaSqm,
                      ).toLocaleString("en-KE")} square metres, ${p.beacons.length} beacons${
                        p.coordinateIssue && p.coordinateIssue !== "none"
                          ? ". Coordinate reference warning — geometry not reliable"
                          : ""
                      }`}
                      className={`w-full rounded-xl border p-3 text-left text-xs transition focus-ring ${
                        p.id === selectedId
                          ? "border-[#008F55]/60 bg-[#008F55]/10"
                          : "border-white/10 hover:bg-white/5"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        {p.parcelCode || p.titleDeedNo}
                        {p.coordinateIssue && p.coordinateIssue !== "none" && (
                          <span
                            data-testid="spatial-parcel-crs-flag"
                            data-parcel-crs={p.id}
                            title="Coordinate reference warning"
                            className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-400/10 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-amber-200"
                          >
                            <ShieldAlert className="h-3 w-3" aria-hidden="true" /> CRS
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-muted-foreground">
                        {p.county ?? "Kenya"} · {Math.round(p.areaSqm).toLocaleString("en-KE")} m² ·{" "}
                        {p.beacons.length} beacons
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Surface>

            <Surface elevation={1} className="p-4">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Nearest marketplace listings
              </p>
              {nearbyListings.length ? (
                <ul className="mt-3 grid gap-2 text-xs">
                  {nearbyListings.map((l) => (
                    <li key={l.id}>
                      <Link
                        to="/marketplace/$id"
                        params={{ id: l.id }}
                        className="flex items-start gap-2 rounded-lg border border-white/10 p-2 hover:bg-white/5"
                      >
                        <MapPin
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
                          aria-hidden="true"
                        />
                        <span>
                          <span className="block text-foreground">{l.title}</span>
                          <span className="text-muted-foreground">
                            {(l.dist / 1000).toFixed(1)} km away
                            {l.price ? ` · ${l.currency} ${l.price.toLocaleString("en-KE")}` : ""}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  No geo-tagged listings near this parcel yet.
                </p>
              )}
            </Surface>

            <Surface elevation={1} className="p-4 text-xs text-muted-foreground">
              <p className="flex items-center gap-2 text-foreground">
                <Ruler className="h-3.5 w-3.5 text-accent" aria-hidden="true" /> How to use on site
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>Allow camera access, then scan a flat floor or table surface.</li>
                <li>Tap Launch AR and tap again to place the scaled tabletop twin.</li>
                <li>
                  Use the twin to read beacon layout, setbacks and massing — it is a scale model,
                  not a 1:1 overlay on the ground.
                </li>
                <li>Switch to VR masterplan for the sun-path and zoning study.</li>
              </ol>
              <p className="mt-2">
                Beacon positions shown here are indicative. Physical beacon location must be
                confirmed by a licensed surveyor.
              </p>
            </Surface>
          </aside>
        </div>
      )}
    </main>
  );
}
