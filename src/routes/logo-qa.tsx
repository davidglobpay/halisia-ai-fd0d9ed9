import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CountyEmblem } from "@/components/halisia/county-emblem";
import { KENYA_COUNTY_FACTS } from "@/lib/kenya-county-facts";
import { COUNTY_LOGOS } from "@/lib/county-logos";

// Developer-only Logo QA page. Renders every county emblem alongside the
// underlying asset URL, and toggles overlay guides (center crosshair,
// safe-area ring, bounding box) so we can spot-check crop & centering
// without opening every county profile individually.
function LogoQAPage() {
  const [size, setSize] = useState(128);
  const [showCrosshair, setShowCrosshair] = useState(true);
  const [showSafeArea, setShowSafeArea] = useState(true);
  const [showBoundingBox, setShowBoundingBox] = useState(false);
  const [filter, setFilter] = useState("");

  const counties = useMemo(
    () =>
      Object.values(KENYA_COUNTY_FACTS)
        .sort((a, b) => a.code - b.code)
        .filter((c) => {
          if (!filter.trim()) return true;
          const q = filter.trim().toLowerCase();
          return c.name.toLowerCase().includes(q) || String(c.code) === q;
        }),
    [filter],
  );

  return (
    <main className="min-h-screen bg-[#0a1735] p-6 text-white" data-testid="logo-qa-page">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-end gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-accent">
              Developer tools
            </div>
            <h1 className="text-2xl font-bold">County emblem QA</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/70">
              Toggle overlay guides to verify centering and safe-area padding for every county
              emblem. Filter by county code or name to spot-check.
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                data-testid="qa-toggle-crosshair"
                checked={showCrosshair}
                onChange={(e) => setShowCrosshair(e.target.checked)}
              />
              Crosshair
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                data-testid="qa-toggle-safearea"
                checked={showSafeArea}
                onChange={(e) => setShowSafeArea(e.target.checked)}
              />
              Safe area (12%)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                data-testid="qa-toggle-bbox"
                checked={showBoundingBox}
                onChange={(e) => setShowBoundingBox(e.target.checked)}
              />
              Bounding box
            </label>
            <label className="flex items-center gap-2">
              Size
              <input
                type="range"
                min={80}
                max={200}
                step={8}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                aria-label="Emblem size in pixels"
                data-testid="qa-size"
              />
              <span className="w-8 text-right tabular-nums">{size}</span>
            </label>
            <input
              type="search"
              placeholder="Filter by code or name"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-md border border-white/20 bg-black/40 px-2 py-1 text-white placeholder:text-white/40"
              data-testid="qa-filter"
              aria-label="Filter counties by code or name"
            />
          </div>
        </header>

        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${size + 60}px, 1fr))`,
          }}
        >
          {counties.map((c) => (
            <figure
              key={c.code}
              data-testid={`qa-cell-${c.code}`}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center"
            >
              <div className="relative mx-auto" style={{ width: size, height: size }}>
                <CountyEmblem code={c.code} name={c.name} size={size} priority />
                {showBoundingBox && (
                  <span className="pointer-events-none absolute inset-0 rounded-[18%] outline outline-1 outline-fuchsia-400" />
                )}
                {showSafeArea && (
                  <span
                    className="pointer-events-none absolute rounded-full outline outline-1 outline-emerald-400/80"
                    style={{
                      inset: `${Math.round(size * 0.12)}px`,
                    }}
                  />
                )}
                {showCrosshair && (
                  <>
                    <span className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-red-400/70" />
                    <span className="pointer-events-none absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-red-400/70" />
                  </>
                )}
              </div>
              <figcaption className="mt-2 text-xs">
                <div className="font-semibold uppercase">
                  {String(c.code).padStart(2, "0")} · {c.name}
                </div>
                <a
                  href={COUNTY_LOGOS[c.code]}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate text-[10px] text-accent/80 underline decoration-dotted"
                  title={COUNTY_LOGOS[c.code]}
                >
                  {COUNTY_LOGOS[c.code]?.split("/").pop() ?? "no asset"}
                </a>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/logo-qa")({
  head: () => ({
    meta: [
      { title: "Logo QA · HALISIA (dev)" },
      {
        name: "description",
        content: "Developer-only QA view for verifying Kenya county emblem crops.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LogoQAPage,
});
