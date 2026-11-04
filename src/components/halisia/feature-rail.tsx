import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  FileSearch,
  Crosshair,
  MapPin,
  Boxes,
  Orbit,
  ScrollText,
  Scale,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Tool = {
  to: string;
  /** Anchor on the landing page, for tools that live in a section rather than a route. */
  hash?: string;
  label: string;
  blurb: string;
  action: string;
  Icon: LucideIcon;
};

/** The paid-for entry points, in the order a visitor meets them. */
const TOOLS: Tool[] = [
  {
    to: "/title-deed",
    label: "Title deed reader",
    blurb: "Pull the parcel number, size and registry details off a deed photo.",
    action: "Read a deed",
    Icon: FileSearch,
  },
  {
    to: "/explore",
    label: "Coordinates",
    blurb: "Paste a latitude and longitude and read the full location profile.",
    action: "Enter coordinates",
    Icon: Crosshair,
  },
  {
    to: "/",
    hash: "counties",
    label: "Map pin",
    blurb: "Tap any county on the live map and drop a pin where you are looking.",
    action: "Open the county map",
    Icon: MapPin,
  },
  {
    to: "/plot-planner",
    label: "Plot planner",
    blurb: "Place a house type to scale on satellite imagery of your plot, on the real terrain.",
    action: "Plan on your plot",
    Icon: MapPin,
  },
  {
    to: "/build-cost",
    label: "How much to build?",
    blurb: "Pick a house size and building material and see the cost, line by line.",
    action: "Work out the cost",
    Icon: Boxes,
  },
  {
    to: "/budget",
    label: "What can my budget buy?",
    blurb: "Enter your budget and see which places can fit land plus a house.",
    action: "Plan my budget",
    Icon: MapPin,
  },
  {
    to: "/design-studio",
    label: "3D Design Studio",
    blurb: "Place five Kenyan-context development concepts on dimensions you control.",
    action: "Open Design Studio",
    Icon: Boxes,
  },
  {
    to: "/model-lab",
    label: "3D Model Lab",
    blurb: "Place building massing on the plot and check the shadows it casts.",
    action: "Open Model Lab",
    Icon: Boxes,
  },
  {
    to: "/spatial",
    label: "Spatial Studio",
    blurb: "Walk the site in 3D, or in augmented reality on a supported phone.",
    action: "Open Spatial Studio",
    Icon: Orbit,
  },
  {
    to: "/report",
    label: "Location dossier",
    blurb: "A dated PDF with the evidence maps and every source named.",
    action: "Build a dossier",
    Icon: ScrollText,
  },
  {
    to: "/compare-locations",
    label: "Compare locations",
    blurb: "Put two places side by side and see what actually differs.",
    action: "Compare two places",
    Icon: Scale,
  },
];

/**
 * A horizontal, snapping rail. On a phone it is a swipe; on a desktop the
 * arrows page through it. Scroll position drives the progress bar underneath.
 */
export function FeatureRail() {
  const trackRef = useRef<HTMLUListElement>(null);
  const [progress, setProgress] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setProgress(max <= 0 ? 1 : el.scrollLeft / max);
    setAtStart(el.scrollLeft < 8);
    setAtEnd(max - el.scrollLeft < 8);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure, { passive: true });
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const page = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 260), behavior: "smooth" });
  };

  return (
    <section
      id="tools"
      aria-labelledby="tools-heading"
      className="relative py-16 md:py-20"
      data-testid="feature-rail"
    >
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-accent">Start here</p>
            <h2
              id="tools-heading"
              className="mt-2 text-2xl md:text-4xl font-semibold tracking-tight"
            >
              {TOOLS.length} ways into a place.
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Search for a place, or pick the tool that matches what you already have: a deed, a
              coordinate, a pin on a map, or a plot you want to build on.
            </p>
          </div>
          <div className="hidden gap-2 md:flex">
            <button
              type="button"
              onClick={() => page(-1)}
              disabled={atStart}
              aria-label="Previous tools"
              className="glass-card flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-40 focus-ring"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => page(1)}
              disabled={atEnd}
              aria-label="More tools"
              className="glass-card flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-40 focus-ring"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <ul
          ref={trackRef}
          onScroll={measure}
          className="scrollbar-none mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3"
        >
          {TOOLS.map((t) => (
            <li key={`${t.to}-${t.label}`} className="w-[260px] shrink-0 snap-start sm:w-[300px]">
              <Link
                to={t.to}
                hash={t.hash}
                search={t.to === "/" ? { compare: "" } : undefined}
                className="glass-card glow-sheen group flex h-full flex-col rounded-3xl p-5 focus-ring"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <t.Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{t.label}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.blurb}</p>
                <span className="mt-auto pt-4 text-xs font-semibold text-primary">
                  {t.action}
                  <span className="ml-1 inline-block transition-transform group-hover:translate-x-1">
                    &rsaquo;
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-150"
            style={{ width: `${Math.max(12, progress * 100)}%` }}
          />
        </div>
      </div>
    </section>
  );
}
