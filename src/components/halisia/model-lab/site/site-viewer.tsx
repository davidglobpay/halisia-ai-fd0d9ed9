/** SSR-safe wrapper: three.js is only imported after mount. */
import { Suspense, lazy, useEffect, useState } from "react";
import type { SiteParams } from "./site-params";

const Internal = lazy(() => import("./site-viewer.internal"));

export default function SiteViewerClient({ params }: { params: SiteParams }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const fallback = (
    <div className="flex h-[60vh] items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-sm text-muted-foreground">
      Preparing schematic site view…
    </div>
  );
  if (!mounted) return fallback;
  return (
    <Suspense fallback={fallback}>
      <Internal params={params} />
    </Suspense>
  );
}
