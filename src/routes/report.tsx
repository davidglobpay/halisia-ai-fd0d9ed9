import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useState } from "react";
import { FileDown, Loader2, Share2, MapPin, Check, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Navbar } from "@/components/halisia/navbar";
import { MapView } from "@/components/halisia/map-view";
import { IntelligenceDashboard } from "@/components/halisia/intelligence-dashboard";
import { generateLocationDossier } from "@/lib/pdf-dossier";

const searchSchema = z.object({
  lat: fallback(z.number(), 0).default(0),
  lng: fallback(z.number(), 0).default(0),
  address: fallback(z.string(), "").default(""),
  ref: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/report")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Shared Land Report — HALISIA AI" },
      {
        name: "description",
        content:
          "Shareable HALISIA AI land intelligence dossier — view-only report for a specific location.",
      },
      { property: "og:title", content: "Shared Land Report — HALISIA AI" },
      {
        property: "og:description",
        content: "Environmental, infrastructure and AI-scored intelligence for this location.",
      },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { lat, lng, address, ref } = Route.useSearch();
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setShareUrl(window.location.href);
  }, []);

  const valid = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  const download = async () => {
    if (!valid) return;
    setDownloading(true);
    try {
      await generateLocationDossier({ lat, lng, address, shareUrl });
    } finally {
      setDownloading(false);
    }
  };

  if (!valid) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="pt-32 mx-auto max-w-xl px-4 text-center">
          <h1 className="font-display text-2xl">Report link is missing coordinates</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Shareable dossiers must include <code>?lat=&amp;lng=&amp;address=</code>.
          </p>
          <Link
            to="/title-deed"
            className="mt-6 inline-flex items-center gap-2 glass rounded-full px-4 py-2 text-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Start a title deed search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-24 pb-16 mx-auto max-w-[1400px] px-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 glass rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-accent">
              <Share2 className="h-3 w-3" /> Shared report
            </div>
            <h1 className="mt-3 font-display text-2xl md:text-3xl font-semibold tracking-tight">
              {address || "Location intelligence"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-accent" />
              {lat.toFixed(5)}, {lng.toFixed(5)}
              {ref ? <span className="ml-2 opacity-70">· ref {ref}</span> : null}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copy}
              className="glass rounded-full px-4 py-2 text-xs inline-flex items-center gap-2"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-accent" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy link"}
            </button>
            <button
              onClick={download}
              disabled={downloading}
              className="rounded-full px-4 py-2 text-xs bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium inline-flex items-center gap-2 disabled:opacity-60"
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileDown className="h-3.5 w-3.5" />
              )}
              Download PDF
            </button>
          </div>
        </div>

        <div className="mt-6 grid lg:grid-cols-[1fr_420px] gap-4">
          <div className="glass-strong rounded-3xl p-2">
            <MapView
              center={{ lat, lng }}
              marker={{ lat, lng, label: address }}
              zoom={14}
              mapType="hybrid"
              theme="dark"
              className="rounded-[22px] h-[420px]"
            />
          </div>
          <div>
            <IntelligenceDashboard lat={lat} lng={lng} address={address} />
          </div>
        </div>

        <p className="mt-6 text-[11px] text-muted-foreground">
          View-only shareable report. Data is recomputed on demand from public geodata and HALISIA
          models. Ownership status must be confirmed via authorized registries.
        </p>
      </div>
    </div>
  );
}
