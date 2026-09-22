/**
 * SSR-safe wrapper for the Model Lab viewer.
 *
 * The Three.js graph is loaded only after hydration and only when this browser
 * can create a WebGL context. Unsupported devices get a useful fallback.
 */
import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import type { ModelLabViewerProps } from "./viewer.internal";

const Internal = lazy(() => import("./viewer.internal"));
const STARTUP_TIMEOUT_MS = 15_000;

function canCreateWebGl() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function ReadySignal({ onReady, children }: { onReady: () => void; children: ReactNode }) {
  useEffect(onReady, [onReady]);
  return children;
}

function Notice({ title, detail, onRetry }: { title: string; detail: string; onRetry: () => void }) {
  return (
    <div className="flex h-full min-h-[18rem] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-6 text-center" role="status" data-testid="model-lab-fallback">
      <p className="font-medium text-foreground">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{detail}</p>
      <button type="button" className="btn-base btn-secondary min-h-11 px-4 text-sm" onClick={onRetry}>
        Retry 3D viewer
      </button>
    </div>
  );
}

function Skeleton({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[18rem] w-full items-center justify-center rounded-2xl border border-white/10 bg-black/20" data-testid="model-lab-skeleton" role="status">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export type { ModelLabViewerProps, ViewerApi, ViewerStatus, EnvMode, PresentationMode } from "./viewer.internal";

export default function ModelLabViewerClient(props: ModelLabViewerProps) {
  const [state, setState] = useState<"checking" | "loading" | "ready" | "unsupported" | "timeout">("checking");
  const [attempt, setAttempt] = useState(0);

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

  const retry = () => {
    setState("checking");
    setAttempt((value) => value + 1);
  };

  if (state === "checking") return <Skeleton label="Checking 3D support…" />;
  if (state === "unsupported") {
    return <Notice title="Interactive 3D is unavailable in this browser" detail="WebGL is disabled or unsupported. You can still review the model catalogue and diagnostics; try enabling hardware acceleration or opening this page in a current browser." onRetry={retry} />;
  }
  if (state === "timeout") {
    return <Notice title="The 3D viewer is taking longer than expected" detail="The model was not shown within 15 seconds. Check your connection or graphics settings, then retry." onRetry={retry} />;
  }

  return (
    <Suspense fallback={<Skeleton label="Loading 3D viewer…" />}>
      <ReadySignal onReady={() => setState("ready")}>
        <Internal key={attempt} {...props} />
      </ReadySignal>
    </Suspense>
  );
}
