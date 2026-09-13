import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
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
          sceneModePicker: true,
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
