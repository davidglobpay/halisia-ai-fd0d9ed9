import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { fallback } from "@tanstack/zod-adapter";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Surface, KitButton, SegmentedTabs, SectionHeading, StatusBadge } from "@/components/halisia/ds";
import { SpatialCanvas, type SpatialCanvasHandle } from "@/components/halisia/spatial/spatial-canvas";
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

  const parcelsQ = useQuery({ queryKey: ["spatial", "parcels"], queryFn: fetchSpatialParcels });
  const protosQ = useQuery({ queryKey: ["spatial", "prototypes"], queryFn: fetchSpatialPrototypes });
  const listingsQ = useQuery({ queryKey: ["spatial", "listings"], queryFn: fetchSpatialListings });

  const parcels = parcelsQ.data ?? [];
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
  const [xrMode, setXrMode] = useState<"ar" | "vr" | null>(null);
  const [placement, setPlacement] = useState<ArPlacementState>({
    hitTest: false,
    surfaceFound: false,
    placed: false,
  });
  const [xrError, setXrError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const { request: requestLocation, location, error: locationError, loading: locating } =
    useMyLocation();

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

  const usdz = prototype?.usdzUrl ?? null;
  const gltf = prototype?.gltfUrl ?? null;
  const sceneViewerHref = gltf
    ? `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(gltf)}&mode=ar_preferred#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;end;`
    : null;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 pt-24 pb-16">
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

      {parcel && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* --- viewport --- */}
          <div className="grid gap-4">
            <Surface elevation={3} padding="none" className="overflow-hidden">
              <div className="relative aspect-[4/3] md:aspect-[16/9]" data-testid="spatial-viewport">
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
                  onXrStateChange={setXrActive}
                />
                <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center gap-2 p-3">
                  <span className="pointer-events-auto rounded-full glass-strong border border-white/15 px-3 py-1 text-[11px]">
                    {parcel.parcelCode || parcel.titleDeedNo}
                  </span>
                  <StatusBadge kind={parcel.status === "verified" ? "verified" : "pending"}>
                    {parcel.status === "verified" ? "Survey verified" : "Verification pending"}
                  </StatusBadge>
                  {xrActive && (
                    <span className="pointer-events-auto rounded-full bg-[#008F55]/20 border border-[#008F55]/50 px-3 py-1 text-[11px] text-[#7ee0b4]">
                      XR session live
                    </span>
                  )}
                </div>
                <div className="absolute bottom-3 right-3 flex gap-2">
                  <KitButton
                    size="sm"
                    variant="secondary"
                    onClick={() => handle.current?.resetView()}
                  >
                    <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" /> Reset view
                  </KitButton>
                  {xrActive ? (
                    <KitButton size="sm" variant="destructive" onClick={() => handle.current?.endXr()}>
                      Exit XR
                    </KitButton>
                  ) : (
                    <KitButton
                      size="sm"
                      variant="premium"
                      onClick={() => void startAr()}
                      disabled={starting || xrSupported === false}
                      data-testid="spatial-start-ar"
                      title={
                        xrSupported === false
                          ? "WebXR AR is not available on this device — use the fallback viewer"
                          : "Launch immersive AR"
                      }
                    >
                      {starting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Scan className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Launch AR
                    </KitButton>
                  )}
                </div>
              </div>
            </Surface>

            {(xrError || xrSupported === false) && (
              <Surface elevation={1} className="p-4 text-xs" data-testid="spatial-ar-fallback">
                <p className="text-muted-foreground">
                  {xrError ??
                    "This browser does not expose WebXR immersive-AR. Use the native viewers below — the 3D studio above stays fully interactive."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {usdz && (
                    <a
                      href={usdz}
                      rel="ar"
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 hover:bg-white/10"
                    >
                      <Cuboid className="h-3.5 w-3.5 text-accent" aria-hidden="true" /> Open in AR
                      Quick Look (iOS)
                    </a>
                  )}
                  {sceneViewerHref && (
                    <a
                      href={sceneViewerHref}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 hover:bg-white/10"
                    >
                      <Boxes className="h-3.5 w-3.5 text-accent" aria-hidden="true" /> Open in Scene
                      Viewer (Android)
                    </a>
                  )}
                  {!usdz && !sceneViewerHref && (
                    <span className="text-muted-foreground">
                      Pick a massing prototype to unlock the native AR viewers.
                    </span>
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
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {([
                    ["Beacons", showBeacons, setShowBeacons],
                    ["Setbacks", showSetback, setShowSetback],
                    ["Zoning envelope", showEnvelope, setShowEnvelope],
                  ] as Array<[string, boolean, (v: (p: boolean) => boolean) => void]>).map(([label, on, set]) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set((v) => !v)}
                      className={`rounded-full border px-3 py-1.5 transition ${
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
                      · altitude {sun.altitudeDeg.toFixed(1)}° · azimuth {sun.azimuthDeg.toFixed(0)}°
                      {sun.isDay ? "" : " · night"}
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
                  className="w-full accent-[#D4AF37]"
                />
              </div>

              <div className="mt-5 grid gap-2">
                <p className="text-xs text-muted-foreground">Massing prototype</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setProtoId("")}
                    aria-pressed={protoId === ""}
                    className={`rounded-full border px-3 py-1.5 text-[11px] ${
                      protoId === "" ? "border-white/40 bg-white/10" : "border-white/10 text-muted-foreground"
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
                      className={`rounded-full border px-3 py-1.5 text-[11px] ${
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
                    {prototype.floors ?? 1} floor(s) · {prototype.footprintSqm ?? "—"} m² footprint ·{" "}
                    {prototype.heightM ?? "—"} m tall ·{" "}
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
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Surveyed parcels
              </p>
              <ul className="mt-3 grid gap-2" data-testid="spatial-parcel-list">
                {parcels.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      aria-pressed={p.id === selectedId}
                      className={`w-full rounded-xl border p-3 text-left text-xs transition ${
                        p.id === selectedId
                          ? "border-[#008F55]/60 bg-[#008F55]/10"
                          : "border-white/10 hover:bg-white/5"
                      }`}
                    >
                      <span className="block font-medium text-foreground">
                        {p.parcelCode || p.titleDeedNo}
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
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
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
                <li>Stand inside the parcel and allow location + camera access.</li>
                <li>Tap Launch AR to drop a tabletop twin of the survey.</li>
                <li>Match the gold beacon knobs to physical survey stones.</li>
                <li>Switch to VR masterplan for the sun-path and zoning study.</li>
              </ol>
            </Surface>
          </aside>
        </div>
      )}
    </main>
  );
}
