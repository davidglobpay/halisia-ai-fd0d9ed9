import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode, type Ref } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import type { SpatialCanvasHandle, SpatialCanvasProps } from "./spatial-canvas.internal";

const Inner = lazy(() => import("./spatial-canvas.internal"));
const STARTUP_TIMEOUT_MS = 15_000;

export type { SpatialCanvasHandle };

function Fallback({ label = "Preparing spatial engine…" }: { label?: string }) {
  return <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground" role="status"><Loader2 className="mr-2 h-4 w-4 animate-spin text-accent" /> {label}</div>;
}

function ReadySignal({ onReady, children }: { onReady: () => void; children: ReactNode }) {
  useEffect(onReady, [onReady]);
  return children;
}

function canCreateWebGl() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function SpatialCanvasClient(props: Omit<SpatialCanvasProps, "handleRef"> & { handleRef?: Ref<SpatialCanvasHandle> }) {
  const [state, setState] = useState<"checking" | "loading" | "ready" | "unsupported" | "timeout">("checking");
  const [attempt, setAttempt] = useState(0);
  const markReady = useCallback(() => setState("ready"), []);

  useEffect(() => {
    if (!canCreateWebGl()) {
      setState("unsupported");
      return;
    }
    setState("loading");
  }, [attempt]);

  useEffect(() => {
    if (state !== "loading") return;
    const timer = window.setTimeout(() => setState("timeout"), STARTUP_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [state, attempt]);

  if (state === "checking") return <Fallback label="Checking spatial graphics support…" />;
  if (state === "unsupported" || state === "timeout") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/95 p-6 text-center" role="status" data-testid="spatial-webgl-fallback">
        <p className="font-medium text-foreground">{state === "unsupported" ? "Interactive parcel rendering is unavailable" : "The spatial engine is taking longer than expected"}</p>
        <p className="max-w-md text-sm text-muted-foreground">{state === "unsupported" ? "WebGL is disabled or unsupported. Parcel facts and controls remain available below; AR availability depends on a compatible device and browser." : "The 3D scene was not shown within 15 seconds. Check your connection or graphics settings, then retry."}</p>
        <button type="button" className="btn-base btn-secondary min-h-11 px-4 text-sm" onClick={() => { setState("checking"); setAttempt((value) => value + 1); }}>Retry spatial view</button>
      </div>
    );
  }

  return (
    <Suspense fallback={<Fallback />}>
      <ReadySignal onReady={markReady}>
        <Inner key={attempt} {...props} />
      </ReadySignal>
    </Suspense>
  );
}

export function SpatialCanvas(props: Omit<SpatialCanvasProps, "handleRef"> & { handleRef?: Ref<SpatialCanvasHandle> }) {
  return <ClientOnly fallback={<Fallback />}><SpatialCanvasClient {...props} /></ClientOnly>;
}
