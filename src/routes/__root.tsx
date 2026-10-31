import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import halisiaLogo from "../assets/brand/halisia-mark.png.asset.json";
import { PerfMonitor } from "../components/halisia/perf-monitor";
import { GlobeBackdrop } from "../components/halisia/globe-backdrop";

import { BUILD_ID, BUILD_NOTE } from "../lib/build-info";
import { NavGuide } from "../components/halisia/nav-guide";
import { FileReadyPanel } from "../components/halisia/file-ready-panel";
import { Navbar } from "../components/halisia/navbar";
import { ServicePricing } from "../components/halisia/service-pricing";
import { supabase } from "../integrations/supabase/client";
import { takePostAuthRedirect } from "../lib/post-auth";
import { primeMark } from "../lib/pdf-chrome";

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

function ErrorComponent({ error, reset }: ErrorComponentProps) {
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
      // Lets a release be verified from the served page rather than from a
      // dashboard flag. See src/lib/build-info.ts.
      { name: "halisia-build", content: BUILD_ID },
      { name: "halisia-build-note", content: BUILD_NOTE },
      { property: "og:title", content: "HALISIA AI — Land Intelligence Platform" },
      {
        property: "og:description",
        content:
          "AI-powered land intelligence for Kenya. Understand any place before you buy, build, or invest — with maps, community signals, and confidence-scored insights.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@HalisiaAI" },
      { name: "theme-color", content: "#F7F3EA" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "HALISIA AI" },
      { name: "twitter:title", content: "HALISIA AI — Land Intelligence Platform" },
      {
        name: "twitter:description",
        content:
          "AI-powered land intelligence for Kenya. Understand any place before you buy, build, or invest — with maps, community signals, and confidence-scored insights.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/36722db2-818f-46ea-b8b4-5869b9578916/id-preview-82150c43--df72d311-6218-49be-b3b6-e5ca8b551b5b.lovable.app-1784499886923.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/36722db2-818f-46ea-b8b4-5869b9578916/id-preview-82150c43--df72d311-6218-49be-b3b6-e5ca8b551b5b.lovable.app-1784499886923.png",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        href: halisiaLogo.url,
        type: "image/png",
      },
      { rel: "apple-touch-icon", href: halisiaLogo.url },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=Cormorant+Garamond:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap",
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
  const router = useRouter();

  // Decode the brand mark once, early, so a PDF generated later has a logo.
  // Four of the ten generators are synchronous and read the mark from this
  // cache rather than awaiting it. Deliberately inside an effect: the decode
  // runs through an <img> and a canvas, neither of which exists during SSR,
  // and a server-side call would cache a null for the life of that module.
  useEffect(() => {
    primeMark(halisiaLogo.url);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") {
        queryClient.invalidateQueries();
        if (event === "SIGNED_IN") {
          // OAuth returns to the public origin; resume the intended destination.
          const next = takePostAuthRedirect();
          if (next && window.location.pathname !== next) {
            void router.navigate({ to: next, replace: true });
          }
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <PerfMonitor />
      {/* Plain ivory backdrop with a faint gold graticule sphere (globe) */}
      <GlobeBackdrop />

      <Navbar />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <ServicePricing />
      <NavGuide />
      <FileReadyPanel />
    </QueryClientProvider>
  );
}
