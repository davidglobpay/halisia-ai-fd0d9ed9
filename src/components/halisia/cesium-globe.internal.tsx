import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { loadCesium } from "@/lib/cesium-loader";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CesiumNS = any;

export default function CesiumGlobe({
  lat,
  lng,
  label,
  intro = false,
  onFlightComplete,
}: {
  lat: number;
  lng: number;
  label: string;
  intro?: boolean;
  onFlightComplete?: () => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const completeRef = useRef(onFlightComplete);
  completeRef.current = onFlightComplete;

  useEffect(() => {
    let cancelled = false;
    loadCesium()
      .then((C) => {
        if (cancelled || !el.current) return;
        const Cesium = C as CesiumNS;
        const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN;
        Cesium.Ion.defaultAccessToken = ionToken ?? "";

        const viewerOptions: Record<string, unknown> = {
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: !intro,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          imageryProvider: new Cesium.UrlTemplateImageryProvider({
            url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            credit: "Tiles © Esri, Maxar, Earthstar Geographics",
            maximumLevel: 19,
          }),
        };

        if (ionToken && Cesium.Terrain?.fromWorldTerrain) {
          viewerOptions.terrain = Cesium.Terrain.fromWorldTerrain({
            requestVertexNormals: true,
            requestWaterMask: true,
          });
        } else {
          viewerOptions.terrainProvider = new Cesium.EllipsoidTerrainProvider();
        }

        const viewer = new Cesium.Viewer(el.current, viewerOptions);
        viewer.scene.globe.enableLighting = true;
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#050d24");
        viewer.scene.skyAtmosphere.show = true;
        viewer.scene.screenSpaceCameraController.enableInputs = !intro;
        // Attribution for Cesium and the imagery provider must stay visible.
        const credits = viewer.cesiumWidget.creditContainer as HTMLElement;
        credits.style.display = "";
        credits.style.color = "rgba(255,255,255,0.85)";
        credits.style.fontSize = "10px";
        viewerRef.current = viewer;

        const flyTo = (targetLng: number, targetLat: number, height: number, duration: number) =>
          new Promise<void>((resolve) => {
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(targetLng, targetLat, height),
              orientation: {
                heading: Cesium.Math.toRadians(intro ? 0 : 20),
                pitch: Cesium.Math.toRadians(intro ? -90 : -45),
                roll: 0,
              },
              duration,
              complete: resolve,
              cancel: resolve,
            });
          });

        if (intro) {
          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(15, 2, 20_000_000),
            orientation: {
              heading: 0,
              pitch: Cesium.Math.toRadians(-90),
              roll: 0,
            },
          });
          void (async () => {
            await flyTo(20, 1, 5_500_000, 1.25);
            if (cancelled) return;
            await flyTo(37.5, 0.2, 650_000, 1.25);
            if (cancelled) return;
            await flyTo(lng, lat, 25_000, 1.4);
            if (!cancelled) completeRef.current?.();
          })();
        } else {
          void flyTo(lng, lat, 25_000, 2.4);
        }

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
  }, [lat, lng, label, intro]);

  return (
    <div className="absolute inset-0">
      <div ref={el} className="absolute inset-0" />
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
