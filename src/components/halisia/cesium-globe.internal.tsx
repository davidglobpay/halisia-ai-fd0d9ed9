import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Crosshair, Eye, Loader2, Minus, Plus } from "lucide-react";
import { MapControlDock } from "@/components/halisia/map-controls/map-control-dock";
import { loadCesium } from "@/lib/cesium-loader";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CesiumNS = any;

export default function CesiumGlobe({
  lat,
  lng,
  label,
}: {
  lat: number;
  lng: number;
  label: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [basemap, setBasemap] = useState<"map" | "satellite">("map");
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const rootRef = useRef<HTMLDivElement>(null);
  const cesiumRef = useRef<CesiumNS>(null);

  useEffect(() => {
    let cancelled = false;
    loadCesium()
      .then((C) => {
        if (cancelled || !el.current) return;
        const Cesium = C as CesiumNS;
        // No Ion token: use OSM imagery, ellipsoid terrain.
        Cesium.Ion.defaultAccessToken = "";
        const viewer = new Cesium.Viewer(el.current, {
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          // The shared floating controls replace Cesium's own widgets.
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          imageryProvider: new Cesium.OpenStreetMapImageryProvider({
            url: "https://tile.openstreetmap.org/",
          }),
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
        });
        viewer.scene.globe.enableLighting = true;
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#050d24");
        viewer.scene.skyAtmosphere.show = true;
        // Attribution for Cesium and the imagery provider must stay visible.
        const credits = viewer.cesiumWidget.creditContainer as HTMLElement;
        credits.style.display = "";
        credits.style.color = "rgba(255,255,255,0.85)";
        credits.style.fontSize = "10px";
        viewerRef.current = viewer;
        cesiumRef.current = Cesium;

        const dest = Cesium.Cartesian3.fromDegrees(lng, lat, 25_000);
        viewer.camera.flyTo({
          destination: dest,
          orientation: {
            heading: Cesium.Math.toRadians(20),
            pitch: Cesium.Math.toRadians(-45),
            roll: 0,
          },
          duration: 2.4,
        });

        viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lng, lat),
          point: {
            pixelSize: 14,
            color: Cesium.Color.fromCssColorString("#62E9FF"),
            outlineColor: Cesium.Color.fromCssColorString("#2D8CFF"),
            outlineWidth: 3,
          },
          label: {
            text: label,
            font: "12px Inter, sans-serif",
            pixelOffset: new Cesium.Cartesian2(0, -22),
            fillColor: Cesium.Color.WHITE,
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString("rgba(5, 13, 36, 0.75)"),
            backgroundPadding: new Cesium.Cartesian2(6, 4),
          },
        });

        setReady(true);
      })
      .catch((e) => !cancelled && setError((e as Error).message || "Cesium failed"));

    return () => {
      cancelled = true;
      try {
        // Release the WebGL context: iOS Safari caps concurrent live contexts.
        const gl = viewerRef.current?.scene?.context?._gl as WebGLRenderingContext | undefined;
        viewerRef.current?.destroy();
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        /* noop */
      }
      viewerRef.current = null;
    };
  }, [lat, lng, label]);

  // Basemap switch: OpenStreetMap or Esri satellite imagery.
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!ready || !viewer || !Cesium) return;
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(
      basemap === "satellite"
        ? new Cesium.UrlTemplateImageryProvider({
            url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            credit: "Imagery © Esri, Maxar, Earthstar Geographics",
            maximumLevel: 19,
          })
        : new Cesium.OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" }),
    );
  }, [ready, basemap]);

  const fly = (pitchDeg: number, height = 25_000) => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lng, lat, height),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(pitchDeg), roll: 0 },
      duration: 1.2,
    });
  };
  const zoomBy = (k: number) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const h = viewer.camera.positionCartographic.height as number;
    if (k < 1) viewer.camera.zoomIn(h * (1 - k));
    else viewer.camera.zoomOut(h * (k - 1));
  };

  return (
    <div ref={rootRef} className="absolute inset-0">
      <div ref={el} className="absolute inset-0" />
      {ready && (
        <MapControlDock
          testId="globe-dock"
          fullscreenTarget={rootRef}
          actions={[
            { id: "zoom-in", label: "Zoom in", icon: Plus, onClick: () => zoomBy(0.5) },
            { id: "zoom-out", label: "Zoom out", icon: Minus, onClick: () => zoomBy(2) },
            {
              id: "recenter",
              label: "Back to the point",
              icon: Crosshair,
              onClick: () => fly(-45),
            },
            { id: "top", label: "Look straight down", icon: Eye, onClick: () => fly(-90, 8_000) },
          ]}
          layers={[
            {
              id: "basemap",
              title: "Map",
              kind: "single",
              options: [
                { id: "map", label: "Map (OpenStreetMap)" },
                { id: "satellite", label: "Satellite (Esri)" },
              ],
              selected: [basemap],
              onChange: ([v]) => setBasemap(v === "satellite" ? "satellite" : "map"),
            },
            {
              id: "mode",
              title: "View",
              kind: "single",
              options: [
                { id: "3d", label: "3D globe" },
                { id: "2d", label: "Flat map" },
              ],
              selected: [mode],
              onChange: ([v]) => {
                const next = v === "2d" ? "2d" : "3d";
                setMode(next);
                const scene = viewerRef.current?.scene;
                if (next === "2d") scene?.morphTo2D(0.8);
                else scene?.morphTo3D(0.8);
              },
            },
          ]}
          layerFootnote={<>Ground is a smooth globe here, without terrain heights.</>}
        />
      )}
      {!ready && !error && (
        <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-accent" /> Loading 3D globe (CesiumJS)…
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center text-center p-6">
          <div>
            <AlertTriangle className="mx-auto h-5 w-5 text-amber-glow" />
            <div className="mt-2 text-sm">Cesium could not load: {error}</div>
          </div>
        </div>
      )}
    </div>
  );
}
