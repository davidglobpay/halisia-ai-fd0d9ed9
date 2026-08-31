import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";
import {
  PASSPORT_DISCLAIMER,
  passportFacts,
  passportRef,
  polygonPerimeterM,
  ringToLocal,
  verificationDisplay,
  type SpatialParcel,
} from "@/lib/spatial";
import { Surface } from "@/components/halisia/ds";
import { StatusBadge } from "@/components/halisia/ds/status-badge";

/**
 * Digital Land Passport: a factual record summary plus a QR deep-link.
 * No synthetic scoring — nothing here asserts title validity, ownership or a
 * legal boundary position.
 */
export function LandPassport({ parcel }: { parcel: SpatialParcel }) {
  const facts = passportFacts(parcel);
  const verification = verificationDisplay(parcel);
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
            {perimeter} m indicative perimeter · {parcel.beacons.length} beacons
          </p>
          <p className="mt-1 font-mono text-[11px] text-accent">{ref}</p>
        </div>
        <div className="text-right">
          <StatusBadge kind={verification.tone} data-testid="passport-verification-badge">
            {verification.label}
          </StatusBadge>
          {parcel.verificationState === "evidence_backed" && (
            <p
              className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground"
              data-testid="passport-reviewer-confidence"
            >
              Reviewer confidence {parcel.verificationConfidence}%
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-[1fr_auto] md:items-start">
        <ul className="grid gap-2" data-testid="passport-facts">
          {facts.map((f) => (
            <li key={f.key} className="text-xs">
              <span className="text-foreground">{f.label}</span>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{f.value}</p>
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

      <p className="mt-4 text-[11px] text-muted-foreground" data-testid="passport-disclaimer">
        {PASSPORT_DISCLAIMER}
      </p>
    </Surface>
  );
}
