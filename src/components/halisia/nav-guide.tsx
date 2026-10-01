import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  X,
  Search,
  Map as MapIcon,
  FileDown,
  GitCompareArrows,
  Layers,
  Sparkles,
} from "lucide-react";

const STORAGE_KEY = "halisia:navguide:v1:seen";

const STEPS = [
  {
    icon: Search,
    title: "Search anywhere in Kenya",
    body: "Tap the search bar at the top, type a town, plot number, or coordinates. Press ⌘K (Ctrl+K) from any page to jump to search.",
  },
  {
    icon: MapIcon,
    title: "Click a county tile",
    body: "The landing map shows all 47 counties with county emblems. Tap any tile for a full political, economic, and geospatial profile.",
  },
  {
    icon: Sparkles,
    title: "Location readings",
    body: "Every location is read for terrain, air quality and nearby amenities, weighted to what you're doing — investing, buying a home, farming, developing. Anything HALISIA cannot read is listed as a check to run, never as a score.",
  },
  {
    icon: Layers,
    title: "Map layers on Explore",
    body: "Tap Layers to overlay traffic, transit, bicycling, slope/hillshade and drainage/rivers. Hillshade comes from Esri World Hillshade, drainage from Esri Hydro Reference. Switch the base map between Map, Satellite, Hybrid and Terrain.",
  },
  {
    icon: GitCompareArrows,
    title: "Compare two locations",
    body: "Compare lives in the top navigation, not on the map. Open Compare locations to run two places side by side and see which readings differ.",
  },
  {
    icon: FileDown,
    title: "Download PDF dossiers",
    body: "Every location, county, and comparison ships as a printable PDF with maps, scores, sources, and recommended next steps.",
  },
];

export function NavGuide() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // The tour must never sit on top of sign-in / password screens.
  const suppressed = pathname.startsWith("/auth") || pathname.startsWith("/reset-password");

  useEffect(() => {
    if (suppressed) setOpen(false);
  }, [suppressed]);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current =
      typeof document !== "undefined" ? (document.activeElement as HTMLElement) : null;
    // Focus the close button so screen readers announce the dialog and keyboard users can escape immediately.
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 40);
    return () => {
      window.clearTimeout(t);
      returnFocusRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (suppressed) return;
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        const t = window.setTimeout(() => setOpen(true), 1200);
        return () => window.clearTimeout(t);
      }
    } catch {
      /* storage disabled — skip auto-open */
    }
  }, [suppressed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !open) {
        setStep(0);
        setOpen(true);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = (remember: boolean) => {
    setOpen(false);
    if (remember && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {
        /* storage disabled */
      }
    }
  };

  return (
    <>
      {suppressed ? null : (
        <button
          type="button"
          onClick={() => {
            setStep(0);
            setOpen(true);
          }}
          aria-label="Open guided tour"
          title="Guided tour (press ?)"
          className="fixed bottom-4 right-4 z-30 h-11 w-11 rounded-full glass-strong border border-accent/40 text-accent shadow-[0_0_24px_-8px_var(--h-gold-ink)] hover:scale-105 transition inline-flex items-center justify-center"
        >
          <span className="text-lg font-semibold" aria-hidden="true">
            ?
          </span>
        </button>
      )}

      {open && !suppressed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="navguide-title"
          aria-describedby="navguide-body"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => close(false)}
        >
          <div
            className="glass-strong w-full max-w-md rounded-3xl p-5 sm:p-6 border border-accent/25"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 shrink-0 rounded-2xl grid place-items-center bg-accent/12 border border-accent/35 text-accent">
                {(() => {
                  const Icon = STEPS[step].icon;
                  return <Icon className="h-5 w-5" aria-hidden="true" />;
                })()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-widest text-accent font-medium">
                  Guided tour · {step + 1} of {STEPS.length}
                </div>
                <h2 id="navguide-title" className="mt-1 text-lg font-semibold text-foreground">
                  {STEPS[step].title}
                </h2>
              </div>
              <button
                type="button"
                ref={closeBtnRef}
                aria-label="Close tour"
                onClick={() => close(false)}
                className="p-1.5 -mr-1 -mt-1 rounded-full hover:bg-white/10"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <p id="navguide-body" className="mt-3 text-sm text-muted-foreground leading-relaxed">
              {STEPS[step].body}
            </p>

            <div className="mt-5 flex items-center gap-1.5" aria-hidden="true">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full transition-all ${
                    i === step
                      ? "w-6 bg-accent"
                      : i < step
                        ? "w-3 bg-primary/70"
                        : "w-3 bg-white/10"
                  }`}
                />
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => close(true)}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
              >
                Don't show again
              </button>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  disabled={step === 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  className="h-9 px-3 rounded-full text-sm border border-white/10 hover:bg-white/5 disabled:opacity-40"
                >
                  Back
                </button>
                {step < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s + 1)}
                    className="h-9 px-4 rounded-full text-sm font-medium bg-accent text-accent-foreground hover:brightness-110"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => close(true)}
                    className="h-9 px-4 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:brightness-110"
                  >
                    Start exploring
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
