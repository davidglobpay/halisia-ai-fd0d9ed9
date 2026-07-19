import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import halisiaLogo from "../assets/halisia-logo.png.asset.json";
import appBg from "../assets/bg/app-bg.mp4.asset.json";
import appBg2 from "../assets/bg/app-bg-2.mp4.asset.json";
import appBgPoster from "../assets/bg/app-bg-poster.jpg.asset.json";
import { PerfMonitor } from "../components/halisia/perf-monitor";

function AppBackground() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoRef2 = useRef<HTMLVideoElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [activeClip, setActiveClip] = useState(0);
  // User-controlled + auto (reduced-motion, battery saver, saveData, hidden tab).
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const [autoPaused, setAutoPaused] = useState(false);

  // Detect reduced-motion, low-power / save-data conditions, and tab visibility.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Read persisted preference
    try {
      const stored = window.localStorage.getItem("halisia:bg-video");
      if (stored === "off") setUserPaused(true);
      else if (stored === "on") setUserPaused(false);
    } catch {
      /* ignore */
    }

    const compute = async () => {
      let paused = mql.matches || document.hidden;
      // Save-Data (Data Saver / metered) — Network Information API
      const conn = (
        navigator as Navigator & {
          connection?: { saveData?: boolean; effectiveType?: string };
        }
      ).connection;
      if (conn?.saveData) paused = true;
      if (conn?.effectiveType && /2g/.test(conn.effectiveType)) paused = true;
      // Battery API — low battery + not charging = low power
      try {
        const getBattery = (
          navigator as Navigator & {
            getBattery?: () => Promise<{ level: number; charging: boolean }>;
          }
        ).getBattery;
        if (getBattery) {
          const b = await getBattery.call(navigator);
          if (b.level < 0.2 && !b.charging) paused = true;
        }
      } catch {
        /* ignore */
      }
      setAutoPaused(paused);
    };
    void compute();

    const onVis = () => void compute();
    const onMotion = () => void compute();
    document.addEventListener("visibilitychange", onVis);
    mql.addEventListener?.("change", onMotion);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      mql.removeEventListener?.("change", onMotion);
    };
  }, []);

  // Apply pause state to <video>
  const shouldPlay = userPaused === true ? false : userPaused === false ? true : !autoPaused;
  useEffect(() => {
    const vids = [videoRef.current, videoRef2.current];
    vids.forEach((v) => {
      if (!v) return;
      if (shouldPlay) {
        v.play().catch(() => {
          /* autoplay blocked — poster remains visible */
        });
      } else {
        v.pause();
      }
    });
  }, [shouldPlay]);

  // Cross-fade between the two background clips every 18s for a living feel.
  useEffect(() => {
    if (!shouldPlay) return;
    const t = window.setInterval(() => setActiveClip((n) => (n + 1) % 2), 18000);
    return () => window.clearInterval(t);
  }, [shouldPlay]);

  // Motion-sensitive parallax: subtle drift + zoom in response to pointer
  // and device orientation. Skipped when reduced motion / paused.
  useEffect(() => {
    if (!shouldPlay) return;
    const el = layerRef.current;
    if (!el) return;
    let tx = 0,
      ty = 0,
      cur = { x: 0, y: 0 };
    let raf = 0;
    const tick = () => {
      cur.x += (tx - cur.x) * 0.06;
      cur.y += (ty - cur.y) * 0.06;
      el.style.transform = `scale(1.08) translate3d(${cur.x.toFixed(2)}px, ${cur.y.toFixed(2)}px, 0)`;
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    const onMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      tx = -nx * 24;
      ty = -ny * 24;
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      const g = e.gamma ?? 0; // left/right
      const b = e.beta ?? 0; // front/back
      tx = Math.max(-30, Math.min(30, -g * 0.6));
      ty = Math.max(-30, Math.min(30, -(b - 45) * 0.4));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("deviceorientation", onOrient);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("deviceorientation", onOrient);
    };
  }, [shouldPlay]);

  const toggle = () => {
    const next = !shouldPlay;
    setUserPaused(!next);
    try {
      window.localStorage.setItem("halisia:bg-video", next ? "on" : "off");
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div ref={layerRef} className="absolute inset-0 will-change-transform">
          <video
            ref={videoRef}
            src={appBg.url}
            poster={appBgPoster.url}
            muted
            loop
            playsInline
            preload="metadata"
            disablePictureInPicture
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1600ms] ${shouldPlay ? (activeClip === 0 ? "opacity-70" : "opacity-0") : "hidden"}`}
          />
          <video
            ref={videoRef2}
            src={appBg2.url}
            poster={appBgPoster.url}
            muted
            loop
            playsInline
            preload="metadata"
            disablePictureInPicture
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1600ms] ${shouldPlay ? (activeClip === 1 ? "opacity-70" : "opacity-0") : "hidden"}`}
          />
        </div>
        {/* Poster fallback (reduced motion, low power, user-paused, autoplay blocked) */}
        <div
          className={`absolute inset-0 bg-cover bg-center opacity-60 ${shouldPlay ? "hidden" : ""}`}
          style={{ backgroundImage: `url(${appBgPoster.url})` }}
        />
        {/* Cinematic readability layer — dark vignette + gentle Halisia tint at edges
            only, so the original footage color stays vibrant in the center. */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(7,30,61,0.15)_0%,rgba(7,30,61,0.55)_55%,rgba(7,30,61,0.9)_100%)]" />
        <div className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_30%,transparent_70%,rgba(0,0,0,0.5))]" />
      </div>
      {/* Accessible pause/play toggle for background video */}
      <button
        type="button"
        onClick={toggle}
        aria-label={shouldPlay ? "Pause background video" : "Play background video"}
        aria-pressed={!shouldPlay}
        title={shouldPlay ? "Pause background" : "Play background"}
        className="fixed bottom-3 left-3 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/80 shadow-lg backdrop-blur transition hover:bg-black/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2E8]"
      >
        {shouldPlay ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
    </>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            search={{ compare: "" }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "HALISIA AI — Land Intelligence Platform" },
      {
        name: "description",
        content:
          "AI-powered land intelligence for Kenya. Understand any place before you buy, build, or invest — with maps, community signals, and confidence-scored insights.",
      },
      { name: "author", content: "HALISIA AI" },
      { property: "og:title", content: "HALISIA AI — Land Intelligence Platform" },
      {
        property: "og:description",
        content: "Turn any location into trusted, human-centered intelligence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@HalisiaAI" },
      { name: "theme-color", content: "#071E3D" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "HALISIA AI" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: halisiaLogo.url, type: "image/png" },
      { rel: "apple-touch-icon", href: halisiaLogo.url },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Sora:wght@500;600;700&family=Inter:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
        integrity: "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=",
        crossOrigin: "",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AppBackground />
      <PerfMonitor />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
