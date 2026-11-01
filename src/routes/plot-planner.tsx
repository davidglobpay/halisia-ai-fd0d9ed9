import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SectionHeading, Surface } from "@/components/halisia/ds";
import { PlotViewer } from "@/components/halisia/plot-planner/plot-viewer";
import { readLastPassportLocation } from "@/components/halisia/model-lab/site/site-params";
import { STRUCTURES, TYPOLOGIES } from "@/lib/cost-intel.functions";
import { structureName } from "@/lib/build-recommendation";
import {
  FT_TO_M,
  PLOT_SHAPES,
  edgeDistances,
  houseFootprint,
  isContainer,
  typologyName,
  type Placement,
} from "@/lib/plot-placement";

type PlotPlannerSearch = {
  lat?: string;
  lng?: string;
  typology?: string;
  structure?: string;
  plot?: string;
};

const str = (v: unknown) =>
  typeof v === "string" || typeof v === "number" ? String(v) : undefined;

export const Route = createFileRoute("/plot-planner")({
  head: () => ({
    meta: [
      { title: "Place a house on your plot — HALISIA" },
      {
        name: "description",
        content:
          "Schematic house massing to scale on satellite imagery of your plot. Drag and rotate it, and read the gaps to each boundary. Not a survey or a design.",
      },
      { property: "og:title", content: "Place a house on your plot — HALISIA" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): PlotPlannerSearch => ({
    lat: str(s.lat),
    lng: str(s.lng),
    typology: str(s.typology),
    structure: str(s.structure),
    plot: str(s.plot),
  }),
  component: PlotPlannerPage,
});

function parseCoord(lat?: string, lng?: string) {
  const a = lat != null ? Number(lat) : Number.NaN;
  const b = lng != null ? Number(lng) : Number.NaN;
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180)
    return null;
  return { lat: a, lng: b };
}

function PlotPlannerPage() {
  const search = Route.useSearch();
  const fromUrl = useMemo(() => parseCoord(search.lat, search.lng), [search.lat, search.lng]);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(fromUrl);
  const [coordText, setCoordText] = useState("");
  useEffect(() => {
    if (fromUrl) setPoint(fromUrl);
    else setPoint((p) => p ?? readLastPassportLocation());
  }, [fromUrl]);

  const [typology, setTypology] = useState<string>(
    TYPOLOGIES.includes(search.typology as (typeof TYPOLOGIES)[number])
      ? (search.typology as string)
      : "3br",
  );
  const [structure, setStructure] = useState<string>(
    STRUCTURES.includes(search.structure as (typeof STRUCTURES)[number])
      ? (search.structure as string)
      : "masonry_stone",
  );
  const [plotKey, setPlotKey] = useState<string>(
    PLOT_SHAPES.some((p) => p.key === search.plot) ? (search.plot as string) : "50x100",
  );
  const [customFt, setCustomFt] = useState<{ w: string; d: string }>({ w: "", d: "" });
  const [target, setTarget] = useState<"house" | "plot">("house");
  const [house, setHouse] = useState<Placement>({ x: 0, z: 0, rotationDeg: 0 });
  const [plotPlacement, setPlotPlacement] = useState<Placement>({ x: 0, z: 0, rotationDeg: 0 });

  const preset = PLOT_SHAPES.find((p) => p.key === plotKey) ?? PLOT_SHAPES[0];
  const customW = Number(customFt.w);
  const customD = Number(customFt.d);
  const plot =
    plotKey === "custom" && customW > 0 && customD > 0
      ? { widthM: customW * FT_TO_M, depthM: customD * FT_TO_M }
      : { widthM: preset.widthM, depthM: preset.depthM };

  const fp = houseFootprint(typology, structure);
  const gaps = edgeDistances(house, fp, plotPlacement, plot);
  const selected = target === "house" ? house : plotPlacement;
  const setSelected = target === "house" ? setHouse : setPlotPlacement;

  const ft = (m: number) => `${(m / FT_TO_M).toFixed(0)} ft`;
  const gap = (m: number) =>
    m < 0 ? `crosses by ${Math.abs(m).toFixed(1)} m` : `${m.toFixed(1)} m (${ft(m)})`;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-6" data-testid="plot-planner-page">
      <SectionHeading
        eyebrow="Plan on your plot"
        title="Place a house on your plot"
        description="Schematic massing to scale on satellite imagery. Drag the house or the plot outline, rotate them, and read the gap to each boundary."
      />

      {!point ? (
        <Surface elevation={1} className="mt-4 p-4">
          <p className="text-sm">
            Choose where the plot is: open a{" "}
            <Link to="/explore" className="underline">
              location on the map
            </Link>{" "}
            and come back, or type coordinates below.
          </p>
          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const [a, b] = coordText.split(/[,\s]+/);
              const c = parseCoord(a, b);
              if (c) setPoint(c);
            }}
          >
            <input
              className="min-h-11 flex-1 rounded-lg border border-white/15 bg-background px-3 text-sm"
              placeholder="-1.502157, 36.955288"
              value={coordText}
              onChange={(e) => setCoordText(e.target.value)}
              aria-label="Latitude, longitude"
            />
            <button
              type="submit"
              className="min-h-11 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Use this point
            </button>
          </form>
        </Surface>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-3">
            <label className="text-xs">
              House type
              <select
                className="ml-2 min-h-11 rounded-lg border border-white/15 bg-background px-2"
                value={typology}
                onChange={(e) => setTypology(e.target.value)}
                data-testid="pp-typology"
              >
                {TYPOLOGIES.map((t) => (
                  <option key={t} value={t}>
                    {typologyName(t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              Building system
              <select
                className="ml-2 min-h-11 rounded-lg border border-white/15 bg-background px-2"
                value={structure}
                onChange={(e) => setStructure(e.target.value)}
                data-testid="pp-structure"
              >
                {STRUCTURES.map((s) => (
                  <option key={s} value={s}>
                    {structureName(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              Plot
              <select
                className="ml-2 min-h-11 rounded-lg border border-white/15 bg-background px-2"
                value={plotKey}
                onChange={(e) => setPlotKey(e.target.value)}
                data-testid="pp-plot"
              >
                {PLOT_SHAPES.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
                <option value="custom">Custom size…</option>
              </select>
            </label>
            {plotKey === "custom" && (
              <span className="flex items-center gap-1 text-xs">
                <input
                  type="number"
                  min={1}
                  className="min-h-11 w-20 rounded-lg border border-white/15 bg-background px-2"
                  placeholder="width"
                  aria-label="Plot width in feet"
                  value={customFt.w}
                  onChange={(e) => setCustomFt((c) => ({ ...c, w: e.target.value }))}
                />
                ×
                <input
                  type="number"
                  min={1}
                  className="min-h-11 w-20 rounded-lg border border-white/15 bg-background px-2"
                  placeholder="depth"
                  aria-label="Plot depth in feet"
                  value={customFt.d}
                  onChange={(e) => setCustomFt((c) => ({ ...c, d: e.target.value }))}
                />
                ft
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Drag moves:</span>
            {(["house", "plot"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={target === t}
                onClick={() => setTarget(t)}
                className={`min-h-11 rounded-full border px-4 ${target === t ? "border-primary bg-primary text-primary-foreground" : "border-white/15"}`}
              >
                {t === "house" ? "House" : "Plot outline"}
              </button>
            ))}
            <label className="ml-1 flex min-h-11 flex-1 items-center gap-2">
              Rotate {target === "house" ? "house" : "plot"}
              <input
                type="range"
                min={0}
                max={359}
                value={selected.rotationDeg}
                onChange={(e) => setSelected({ ...selected, rotationDeg: Number(e.target.value) })}
                className="min-w-[120px] flex-1"
                aria-label={`Rotate ${target}`}
              />
              <span className="w-10 font-mono">{selected.rotationDeg}°</span>
            </label>
            <button
              type="button"
              className="min-h-11 rounded-full border border-white/15 px-4"
              onClick={() => {
                setHouse({
                  x: plotPlacement.x,
                  z: plotPlacement.z,
                  rotationDeg: plotPlacement.rotationDeg,
                });
              }}
            >
              Centre house on plot
            </button>
          </div>

          <div
            className="relative mt-3 h-[62svh] min-h-[360px] overflow-hidden rounded-2xl border border-white/10"
            data-testid="pp-viewer"
          >
            <PlotViewer
              lat={point.lat}
              lng={point.lng}
              typology={typology}
              structure={structure}
              plot={plot}
              house={house}
              plotPlacement={plotPlacement}
              target={target}
              onHouseChange={setHouse}
              onPlotChange={setPlotPlacement}
            />
          </div>

          <Surface elevation={1} className="mt-3 p-4 text-xs" data-testid="pp-readout">
            <p className="text-sm">
              <strong>{structureName(structure)}</strong>, {typologyName(typology)}: about{" "}
              {fp.floorAreaM2} m² floor area, {fp.lengthM.toFixed(1)} × {fp.widthM.toFixed(1)} m
              footprint
              {isContainer(structure) && fp.units ? ` (${fp.units.length} units)` : ""}. Plot{" "}
              {plot.widthM.toFixed(1)} × {plot.depthM.toFixed(1)} m; the house covers{" "}
              {gaps.coveragePct}% of it.
            </p>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
              <li>
                Front (orange edge): <span className="font-mono">{gap(gaps.front)}</span>
              </li>
              <li>
                Back: <span className="font-mono">{gap(gaps.back)}</span>
              </li>
              <li>
                Left: <span className="font-mono">{gap(gaps.left)}</span>
              </li>
              <li>
                Right: <span className="font-mono">{gap(gaps.right)}</span>
              </li>
            </ul>
            {!gaps.inside && (
              <p role="alert" className="mt-2 text-amber-glow">
                The house crosses the plot outline. Move or rotate it, or choose a bigger plot.
              </p>
            )}
            <p className="mt-3 text-muted-foreground">
              Imagery: Esri World Imagery (Esri, Maxar, Earthstar Geographics); capture date and
              positional accuracy not supplied. The plot outline is drawn from the size you chose
              around the selected point, not from a survey or the land registry. Schematic massing,
              not an architectural design; non-container systems share one single-storey shape.
              Check your county's required building lines before relying on these gaps.
            </p>
            <p className="mt-2">
              <Link to="/build-cost" className="underline" data-testid="pp-cost-link">
                See the cost of this house type
              </Link>
            </p>
          </Surface>
        </>
      )}
    </main>
  );
}
