import { foundationAssumption } from "./concept-drawing-assumptions";
import { useRef } from "react";
import { Download } from "lucide-react";

/**
 * Simple parametric concept drawings from footprint/plot/storey inputs.
 * Diagrammatic and NOT certified architectural drawings.
 */
export const DRAWING_LABEL = "CONCEPTUAL – NOT FOR CONSTRUCTION – NOT CERTIFIED";

type Props = {
  plotW: number;
  plotD: number;
  bldW: number;
  bldD: number;
  storeys: number;
  title: string;
  topology?: "level" | "gentle-slope" | "terraced";
};

/** Non-certified foundation assumption by user-selected topology. */

function Dim({
  x1,
  y1,
  x2,
  y2,
  label,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
}) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={GOLD} strokeWidth="0.7" />
      <line x1={x1} y1={y1 - 3} x2={x1} y2={y1 + 3} stroke={GOLD} strokeWidth="0.7" />
      <line x1={x2} y1={y2 - 3} x2={x2} y2={y2 + 3} stroke={GOLD} strokeWidth="0.7" />
      <text x={(x1 + x2) / 2} y={y1 - 3} fontSize="7" fill={INK} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

const INK = "#102D1A";
const GREEN = "#147B35";
const GOLD = "#C08A2E";

function Frame({
  id,
  title,
  scale,
  children,
}: {
  id: string;
  title: string;
  scale: string;
  children: React.ReactNode;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const exportSvg = (png: boolean) => {
    const svg = ref.current;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
    const save = (href: string, ext: string) => {
      const a = document.createElement("a");
      a.href = href;
      a.download = `halisia-concept-${id}.${ext}`;
      a.click();
    };
    if (!png) {
      save(url, "svg");
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 1600;
      c.height = 1200;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#FFFDF8";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      save(c.toDataURL("image/png"), "png");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };
  return (
    <figure
      className="rounded-lg border border-white/10 bg-card/70 p-2"
      data-testid={`drawing-${id}`}
    >
      <svg
        ref={ref}
        viewBox="0 0 400 300"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full"
        role="img"
        aria-label={title}
      >
        <rect width="400" height="300" fill="#FFFDF8" />
        {children}
        <text
          x="8"
          y="292"
          fontSize="8"
          fill={INK}
          fontFamily="monospace"
        >{`${title} · ${scale}`}</text>
        <text x="392" y="292" fontSize="7" fill="#B3261E" textAnchor="end" fontFamily="monospace">
          {DRAWING_LABEL}
        </text>
      </svg>
      <figcaption className="mt-1 flex items-center justify-between gap-2 text-[11px]">
        <span>{title}</span>
        <span className="flex gap-1">
          <button
            type="button"
            onClick={() => exportSvg(false)}
            className="inline-flex min-h-[36px] items-center gap-1 rounded border border-white/15 px-2 hover:bg-white/10"
          >
            <Download className="h-3 w-3" aria-hidden="true" /> SVG
          </button>
          <button
            type="button"
            onClick={() => exportSvg(true)}
            className="inline-flex min-h-[36px] items-center gap-1 rounded border border-white/15 px-2 hover:bg-white/10"
          >
            <Download className="h-3 w-3" aria-hidden="true" /> PNG
          </button>
        </span>
      </figcaption>
    </figure>
  );
}

export function ConceptDrawings({
  plotW,
  plotD,
  bldW,
  bldD,
  storeys,
  title,
  topology = "level",
}: Props) {
  const slopePct = topology === "terraced" ? 12 : topology === "gentle-slope" ? 4 : 0;
  const fl = 3.2;
  const H = Math.max(1, storeys) * fl;
  // Site plan
  const sS = Math.min(360 / plotW, 250 / plotD);
  const px = (400 - plotW * sS) / 2,
    py = 15;
  // Plan
  const pS = Math.min(360 / bldW, 250 / bldD);
  const bx = (400 - bldW * pS) / 2,
    by = 15;
  const cols = Math.max(2, Math.round(bldW / 5)),
    rows = Math.max(2, Math.round(bldD / 5));
  // Elevations
  const elev = (w: number) => {
    const s = Math.min(360 / w, 240 / (H + 2));
    const x0 = (400 - w * s) / 2,
      g = 270;
    const winCols = Math.max(2, Math.round(w / 3));
    return (
      <g>
        <line x1="10" y1={g} x2="390" y2={g} stroke={INK} strokeWidth="1.5" />
        <rect x={x0} y={g - H * s} width={w * s} height={H * s} fill="none" stroke={INK} />
        {Array.from({ length: storeys }).map((_, f) =>
          Array.from({ length: winCols }).map((__, i) => (
            <rect
              key={`${f}-${i}`}
              x={x0 + ((i + 0.3) * w * s) / winCols}
              y={g - (f + 0.75) * fl * s}
              width={(0.4 * w * s) / winCols}
              height={fl * s * 0.4}
              fill="none"
              stroke={GREEN}
              strokeWidth="0.7"
            />
          )),
        )}
        <text x={x0 + w * s + 4} y={g - H * s} fontSize="8" fill={INK}>{`${H.toFixed(1)} m`}</text>
      </g>
    );
  };
  // Isometric
  const iso = (x: number, y: number, z: number, s: number) => [
    200 + (x - y) * 0.866 * s,
    220 + (x + y) * 0.5 * s - z * s,
  ];
  const iS = 150 / (bldW + bldD + H);
  const pts = (arr: [number, number, number][]) =>
    arr.map(([x, y, z]) => iso(x - bldW / 2, y - bldD / 2, z, iS).join(",")).join(" ");
  return (
    <section data-testid="concept-drawings" className="space-y-2">
      <p className="text-[11px] text-muted-foreground">
        Parametric diagrams at {bldW.toFixed(1)} × {bldD.toFixed(1)} m, {storeys} floor(s), {fl} m
        floor-to-floor. Conceptual only — not a certified architectural, structural or planning
        drawing. No photoreal renders are generated.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Frame id="site-plan" title="Site plan" scale={`1 px ≈ ${(1 / sS).toFixed(2)} m`}>
          <rect
            x={px}
            y={py}
            width={plotW * sS}
            height={plotD * sS}
            fill="none"
            stroke={GOLD}
            strokeDasharray="4 3"
          />
          <rect
            x={200 - (bldW * sS) / 2}
            y={py + (plotD * sS - bldD * sS) / 2}
            width={bldW * sS}
            height={bldD * sS}
            fill={GREEN}
            fillOpacity="0.25"
            stroke={GREEN}
          />
          <text
            x={px}
            y={py + plotD * sS + 12}
            fontSize="8"
            fill={INK}
          >{`Plot ${plotW} × ${plotD} m (simulation input)`}</text>
          <text x="380" y="30" fontSize="10" fill={INK}>
            N↑
          </text>
          <Dim
            x1={200 - (bldW * sS) / 2}
            y1={py + (plotD * sS - bldD * sS) / 2 - 4}
            x2={200 + (bldW * sS) / 2}
            y2={py + (plotD * sS - bldD * sS) / 2 - 4}
            label={`${bldW.toFixed(1)} m`}
          />
          {slopePct > 0 ? (
            <text
              x={px + 4}
              y={py + 12}
              fontSize="7"
              fill={INK}
            >{`Fall ≈ ${slopePct}% (assumed, ${topology})`}</text>
          ) : null}
        </Frame>
        <Frame
          id="floor-plan"
          title="Floor plan (bay grid)"
          scale={`1 px ≈ ${(1 / pS).toFixed(2)} m`}
        >
          <rect
            x={bx}
            y={by}
            width={bldW * pS}
            height={bldD * pS}
            fill="none"
            stroke={INK}
            strokeWidth="2"
          />
          {Array.from({ length: cols - 1 }).map((_, i) => (
            <line
              key={`c${i}`}
              x1={bx + ((i + 1) * bldW * pS) / cols}
              y1={by}
              x2={bx + ((i + 1) * bldW * pS) / cols}
              y2={by + bldD * pS}
              stroke={INK}
              strokeWidth="0.6"
            />
          ))}
          {Array.from({ length: rows - 1 }).map((_, i) => (
            <line
              key={`r${i}`}
              x1={bx}
              y1={by + ((i + 1) * bldD * pS) / rows}
              x2={bx + bldW * pS}
              y2={by + ((i + 1) * bldD * pS) / rows}
              stroke={INK}
              strokeWidth="0.6"
            />
          ))}
          <Dim
            x1={bx}
            y1={by + bldD * pS + 22}
            x2={bx + bldW * pS}
            y2={by + bldD * pS + 22}
            label={`${bldW.toFixed(1)} m`}
          />
          <text
            x={bx}
            y={by + bldD * pS + 12}
            fontSize="8"
            fill={INK}
          >{`${cols} × ${rows} bays · ${(bldW * bldD).toFixed(0)} m² per floor`}</text>
        </Frame>
        <Frame id="elevation-front" title="Front / back elevation" scale="schematic">
          {elev(bldW)}
        </Frame>
        <Frame id="elevation-side" title="Left / right elevation" scale="schematic">
          {elev(bldD)}
        </Frame>
        <Frame id="section" title="Section A–A" scale="schematic">
          {elev(bldD)}
          {Array.from({ length: storeys + 1 }).map((_, f) => {
            const s = Math.min(360 / bldD, 240 / (H + 2));
            return (
              <line
                key={f}
                x1={(400 - bldD * s) / 2}
                x2={(400 + bldD * s) / 2}
                y1={270 - f * fl * s}
                y2={270 - f * fl * s}
                stroke={INK}
                strokeWidth="2"
              />
            );
          })}
        </Frame>
        <Frame id="structural" title="Structural concept notes" scale="annotation">
          {[
            `Grid: ${cols} × ${rows} bays ≈ ${(bldW / cols).toFixed(1)} × ${(bldD / rows).toFixed(1)} m (column positions at grid nodes)`,
            `Frame: RC columns/beams; slabs ${storeys > 1 ? "150–200 mm" : "ground-bearing 150 mm"} (assumption)`,
            `Floors: ${storeys} @ ${fl} m = ${H.toFixed(1)} m to roof`,
            `Ground: ${topology}${slopePct ? `, fall ≈ ${slopePct}%` : ""} — user-selected, not surveyed`,
            `Foundation: ${foundationAssumption(topology)}`,
            "Geotechnical investigation required before any foundation design.",
            "Sizes are indicative only. A licensed structural engineer must design and certify.",
          ].map((t, i) => (
            <text key={i} x="12" y={30 + i * 30} fontSize="7" fill={i >= 5 ? "#B3261E" : INK}>
              {t}
            </text>
          ))}
        </Frame>
        <Frame id="isometric" title="Isometric (aerial)" scale="schematic">
          <polygon
            points={pts([
              [0, 0, 0],
              [bldW, 0, 0],
              [bldW, bldD, 0],
              [0, bldD, 0],
            ])}
            fill="#E7E0D2"
            stroke={INK}
          />
          <polygon
            points={pts([
              [0, bldD, 0],
              [bldW, bldD, 0],
              [bldW, bldD, H],
              [0, bldD, H],
            ])}
            fill={GREEN}
            fillOpacity="0.35"
            stroke={INK}
          />
          <polygon
            points={pts([
              [bldW, 0, 0],
              [bldW, bldD, 0],
              [bldW, bldD, H],
              [bldW, 0, H],
            ])}
            fill={GREEN}
            fillOpacity="0.55"
            stroke={INK}
          />
          <polygon
            points={pts([
              [0, 0, H],
              [bldW, 0, H],
              [bldW, bldD, H],
              [0, bldD, H],
            ])}
            fill="#F1ECE0"
            stroke={INK}
          />
        </Frame>
      </div>
    </section>
  );
}
