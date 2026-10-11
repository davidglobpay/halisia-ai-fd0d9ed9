import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { RenderCapability, StudioViewerApi } from "./studio-viewer.internal";

const SIZES = [
  { id: "hd", label: "HD 1920 × 1080", w: 1920, h: 1080 },
  { id: "4k", label: "4K 3840 × 2160", w: 3840, h: 2160 },
  { id: "8k", label: "8K 7680 × 4320", w: 7680, h: 4320 },
] as const;

/** Offscreen high-resolution still export. Only offers sizes the GPU can render. */
export function RenderExportPanel({ api, name }: { api: StudioViewerApi | null; name: string }) {
  const [cap, setCap] = useState<RenderCapability | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    setCap(api ? api.capability() : null);
  }, [api]);

  async function run(w: number, h: number, id: string) {
    if (!api) return;
    setBusy(id);
    setMsg(null);
    try {
      const blob = await api.capture(w, h);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `halisia-studio-${name}-${w}x${h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMsg(`Saved ${w} × ${h} px PNG.`);
    } catch (e) {
      setMsg((e as Error).message || "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-label="Render export" className="space-y-2" data-testid="render-export">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        High-resolution still
      </h2>
      <p className="text-[11px] text-muted-foreground" data-testid="render-capability">
        {cap
          ? `This device can render up to ${cap.maxWidth} × ${cap.maxHeight} px. ${cap.supports8k ? "8K export available." : "8K unavailable on this device."}`
          : "Renderer not ready."}
      </p>
      <div className="grid gap-1.5">
        {SIZES.map((s) => {
          const ok = !!cap && s.w <= cap.maxWidth && s.h <= cap.maxHeight;
          return (
            <button
              key={s.id}
              type="button"
              disabled={!ok || !!busy}
              data-testid={`render-${s.id}`}
              onClick={() => run(s.w, s.h, s.id)}
              className="min-h-11 rounded-lg border border-foreground/15 px-3 text-left text-xs hover:border-primary/50 disabled:opacity-50"
            >
              {busy === s.id ? "Rendering…" : ok ? s.label : `${s.label} — unavailable`}
            </button>
          );
        })}
      </div>
      {msg ? (
        <p role="status" className="text-[11px]">
          {msg}
        </p>
      ) : null}
      <p className="text-[11px] text-muted-foreground">
        Real-time rasterised massing with soft shadows — not ray-traced photorealism.
      </p>
    </section>
  );
}

type XrNav = { xr?: { isSessionSupported: (m: string) => Promise<boolean> } };

/** Detects WebXR support honestly and routes to the Model Lab AR/VR viewer. */
export function XrStatus() {
  const [ar, setAr] = useState<boolean | null>(null);
  const [vr, setVr] = useState<boolean | null>(null);
  useEffect(() => {
    const xr = (navigator as unknown as XrNav).xr;
    if (!xr) {
      setAr(false);
      setVr(false);
      return;
    }
    xr.isSessionSupported("immersive-ar").then(setAr, () => setAr(false));
    xr.isSessionSupported("immersive-vr").then(setVr, () => setVr(false));
  }, []);
  const t = (v: boolean | null) => (v === null ? "checking…" : v ? "supported" : "not supported");
  return (
    <section aria-label="AR and VR" className="space-y-1 text-[11px]" data-testid="studio-xr">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        AR / VR
      </h2>
      <p>
        Immersive AR: {t(ar)} · Immersive VR: {t(vr)}
      </p>
      <p className="text-muted-foreground">
        {ar || vr
          ? "Open the Model Lab to place these buildings in AR or walk through in VR."
          : "This browser cannot start AR/VR. The Model Lab offers a 3D viewer and phone model-viewer fallback."}
      </p>
      <Link
        to="/model-lab"
        className="inline-flex min-h-11 items-center font-semibold text-primary underline"
      >
        Open Model Lab
      </Link>
    </section>
  );
}
