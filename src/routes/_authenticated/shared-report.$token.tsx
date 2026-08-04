import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileDown, Loader2, Lock, MapPin } from "lucide-react";
import { getSharedReport, listVersions } from "@/lib/report-collections";
import { generateLocationDossier } from "@/lib/pdf-dossier";
import { formatDateTime } from "@/lib/format-datetime";
import { KenyaMotif } from "@/components/halisia/ds";

export const Route = createFileRoute("/_authenticated/shared-report/$token")({
  head: () => ({
    meta: [
      { title: "Shared dossier · HALISIA AI" },
      {
        name: "description",
        content:
          "A private HALISIA AI land intelligence dossier shared with your account. Sign in with the invited email to view it.",
      },
      { property: "og:title", content: "Shared dossier · HALISIA AI" },
      {
        property: "og:description",
        content: "Access-controlled land intelligence report shared by a Halisia account holder.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SharedReportPage,
});

function SharedReportPage() {
  const { token } = Route.useParams();
  const [downloading, setDownloading] = useState(false);
  const share = useQuery({
    queryKey: ["shared-report", token],
    queryFn: () => getSharedReport(token),
  });
  const versions = useQuery({
    queryKey: ["report-versions", share.data?.saved_item_id],
    queryFn: () => listVersions(share.data!.saved_item_id),
    enabled: Boolean(share.data?.saved_item_id),
  });

  const s = share.data;
  const expired = s?.expires_at != null && new Date(s.expires_at) < new Date();
  const usable = Boolean(s) && !expired && !s?.revoked_at;

  const download = async () => {
    if (!s || s.latitude == null || s.longitude == null) return;
    setDownloading(true);
    try {
      await generateLocationDossier({ lat: s.latitude, lng: s.longitude, address: s.label });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main className="relative min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-3xl mx-auto">
      <KenyaMotif className="fixed inset-0 -z-10 opacity-[0.5]" />
      <nav aria-label="Breadcrumb" className="mb-3 text-[11px] text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link to="/" className="hover:text-accent">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link to="/reports" className="hover:text-accent">
              Reports
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground">Shared dossier</li>
        </ol>
      </nav>

      {share.isLoading ? (
        <p className="text-sm text-muted-foreground">Checking your access…</p>
      ) : !usable ? (
        <section className="glass rounded-3xl border border-white/10 p-6 text-center">
          <Lock className="mx-auto h-6 w-6 text-accent" aria-hidden="true" />
          <h1 className="mt-2 font-display text-xl font-semibold">This link isn’t available</h1>
          <p className="mx-auto mt-2 max-w-md text-[12px] text-muted-foreground">
            The share may have been revoked, expired, or issued to a different email address. Sign
            in with the invited account, or ask the owner for a new link.
          </p>
          <Link
            to="/reports"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs hover:bg-white/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to my reports
          </Link>
        </section>
      ) : (
        <>
          <header className="mb-5">
            <div className="text-[11px] uppercase tracking-[0.25em] text-accent">
              Shared with you
            </div>
            <h1 className="mt-1 font-display text-3xl font-semibold">{s!.label}</h1>
            <p className="mt-1 inline-flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
              {s!.latitude != null && s!.longitude != null && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-accent" aria-hidden="true" />
                  {s!.latitude.toFixed(5)}, {s!.longitude.toFixed(5)}
                </span>
              )}
              {s!.deed_ref && <span>· deed {s!.deed_ref}</span>}
              <span>
                · {s!.expires_at ? `access until ${formatDateTime(s!.expires_at)}` : "no expiry"}
              </span>
            </p>
          </header>

          {s!.note && (
            <p className="glass mb-4 rounded-2xl border border-white/10 p-4 text-[13px] leading-relaxed">
              {s!.note}
            </p>
          )}

          <div className="mb-6 flex flex-wrap gap-2">
            {s!.latitude != null && s!.longitude != null && (
              <Link
                to="/report"
                search={{
                  lat: s!.latitude,
                  lng: s!.longitude,
                  address: s!.label,
                  ref: s!.deed_ref ?? "",
                }}
                className="rounded-full border border-white/12 px-4 py-2 text-xs hover:bg-white/5"
              >
                Open live intelligence
              </Link>
            )}
            <button
              type="button"
              onClick={download}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {downloading ? "Preparing…" : "Download PDF dossier"}
            </button>
          </div>

          <section className="glass rounded-2xl border border-white/10 p-4">
            <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground">
              What changed
            </h2>
            {(versions.data ?? []).length === 0 ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                No revisions recorded since this dossier was saved.
              </p>
            ) : (
              <ol className="mt-2 grid gap-2">
                {(versions.data ?? []).map((v) => (
                  <li key={v.id} className="border-l border-accent/40 pl-3">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-[11px] font-medium">v{v.version}</span>
                      <span className="text-[11px]">{v.summary}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDateTime(v.created_at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </main>
  );
}
