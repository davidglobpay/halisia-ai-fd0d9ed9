import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";
import {
  passportMetrics,
  passportRef,
  passportScore,
  polygonPerimeterM,
  ringToLocal,
  type SpatialParcel,
} from "@/lib/spatial";
import { Surface } from "@/components/halisia/ds";

function RadarChart({ values, labels }: { values: number[]; labels: string[] }) {
  const size = 220;
  const c = size / 2;
  const r = c - 34;
  const n = values.length;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rr = (r * Math.max(v, 4)) / 100;
    return [c + rr * Math.cos(a), c + rr * Math.sin(a)] as const;
  };
  const poly = values.map((v, i) => pt(i, v).join(",")).join(" ");
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full max-w-[240px]"
      role="img"
      aria-label="Passport score radar"
    >
      {[25, 50, 75, 100].map((ring) => (
        <polygon
          key={ring}
          points={values.map((_, i) => pt(i, ring).join(",")).join(" ")}
          fill="none"
          stroke="currentColor"
          className="text-white/10"
        />
      ))}
      <polygon points={poly} fill="#008F5533" stroke="#008F55" strokeWidth={1.5} />
      {values.map((v, i) => {
        const [x, y] = pt(i, v);
        return <circle key={i} cx={x} cy={y} r={2.6} fill="#D4AF37" />;
      })}
      {labels.map((l, i) => {
        const [x, y] = pt(i, 118);
        return (
          <text
            key={l}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-current text-[7px] text-muted-foreground"
          >
            {l}
          </text>
        );
      })}
    </svg>
  );
}

/** Digital Land Passport: verifiable summary + QR deep-link + radar chart. */
export function LandPassport({ parcel }: { parcel: SpatialParcel }) {
  const metrics = passportMetrics(parcel);
  const score = passportScore(metrics);
  const ref = passportRef(parcel);
  const [qr, setQr] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    const url = `${window.location.origin}/spatial?parcel=${encodeURIComponent(parcel.id)}`;
    setShareUrl(url);
    void import("qrcode").then(async (m) => {
      const dataUrl = await m.toDataURL(url, {
        margin: 1,
        width: 240,
        color: { dark: "#F5F7F8", light: "#00000000" },
      });
      if (!cancelled) setQr(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [parcel.id]);

  const perimeter = Math.round(polygonPerimeterM(ringToLocal(parcel.ring, parcel.centroid)));

  return (
    <Surface elevation={2} className="p-5" data-testid="land-passport">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Digital Land Passport
          </p>
          <h3 className="font-display text-xl mt-1">{parcel.titleDeedNo || parcel.parcelCode}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {parcel.county ?? "Kenya"} · {Math.round(parcel.areaSqm).toLocaleString("en-KE")} m² ·{" "}
            {perimeter} m perimeter · {parcel.beacons.length} beacons
          </p>
          <p className="mt-1 font-mono text-[11px] text-accent">{ref}</p>
        </div>
        <div className="text-right">
          <div className="font-display text-4xl text-[#D4AF37]">{score}</div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Passport score
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-[240px_1fr_auto] md:items-center">
        <RadarChart values={metrics.map((m) => m.score)} labels={metrics.map((m) => m.label)} />
        <ul className="grid gap-2">
          {metrics.map((m) => (
            <li key={m.key} className="text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-foreground">{m.label}</span>
                <span className="text-muted-foreground">{m.score}</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-white/10">
                <div
                  className="h-1 rounded-full bg-gradient-to-r from-[#008F55] to-[#D4AF37]"
                  style={{ width: `${m.score}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{m.detail}</p>
            </li>
          ))}
        </ul>
        <div className="justify-self-start md:justify-self-end text-center">
          {qr ? (
            <img src={qr} alt={`QR code linking to parcel ${ref}`} className="h-28 w-28" />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-white/10">
              <QrCode className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </div>
          )}
          <p className="mt-1 max-w-[9rem] break-all text-[10px] text-muted-foreground">
            {shareUrl}
          </p>
        </div>
      </div>
    </Surface>
  );
}
