import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown, Loader2, MapPin, Star, Trash2, FileText, Search } from "lucide-react";
import {
  listSavedReports,
  removeSavedItem,
  toggleFavorite,
  updateSavedNote,
  type SavedReport,
} from "@/lib/saved-items";
import { generateLocationDossier } from "@/lib/pdf-dossier";
import { formatDateTime } from "@/lib/format-datetime";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "My reports · HALISIA AI" },
      {
        name: "description",
        content:
          "Your saved land intelligence reports — reopen, annotate and download PDF dossiers for any location you saved.",
      },
      { property: "og:title", content: "My reports · HALISIA AI" },
      {
        property: "og:description",
        content: "Saved HALISIA AI land intelligence dossiers, ready to reopen or download.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const qc = useQueryClient();
  const reports = useQuery({ queryKey: ["saved-reports"], queryFn: listSavedReports });
  const [q, setQ] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["saved-reports"] });
  const del = useMutation({ mutationFn: removeSavedItem, onSuccess: invalidate });
  const fav = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => toggleFavorite(id, value),
    onSuccess: invalidate,
  });
  const note = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => updateSavedNote(id, value),
    onSuccess: invalidate,
  });

  const all = reports.data ?? [];
  const term = q.trim().toLowerCase();
  const list = term
    ? all.filter(
        (r) =>
          r.label.toLowerCase().includes(term) ||
          (r.note ?? "").toLowerCase().includes(term) ||
          r.ref.toLowerCase().includes(term),
      )
    : all;
  const favorites = list.filter((r) => r.is_favorite);
  const rest = list.filter((r) => !r.is_favorite);

  const download = async (r: SavedReport) => {
    setDownloading(r.id);
    try {
      await generateLocationDossier({ lat: r.lat, lng: r.lng, address: r.label });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <main className="min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-5xl mx-auto">
      <header className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.25em] text-accent">Halisia AI</div>
        <h1 className="text-3xl font-display font-semibold mt-1">My reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Land intelligence dossiers you saved. Reopen the live report, add a private note, or
          download the PDF.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[220px]">
          <span className="sr-only">Search saved reports</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by location, note or deed reference"
            className="w-full rounded-full border border-white/12 bg-white/[0.04] py-2 pl-9 pr-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          />
        </label>
        <Link
          to="/explore"
          className="rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-medium text-primary-foreground"
        >
          Generate a new report
        </Link>
      </div>

      {reports.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your reports…</p>
      ) : reports.isError ? (
        <p className="text-sm text-destructive">Could not load your saved reports.</p>
      ) : all.length === 0 ? (
        <section className="glass rounded-2xl border border-white/10 p-6 text-center">
          <FileText className="mx-auto h-6 w-6 text-accent" aria-hidden="true" />
          <h2 className="mt-2 font-display text-lg">No saved reports yet</h2>
          <p className="mx-auto mt-1 max-w-md text-[12px] text-muted-foreground">
            Search any location in Explore or a title deed, then use “Save report” to keep the
            dossier in your account.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link
              to="/explore"
              className="rounded-full border border-white/15 px-4 py-2 text-xs hover:bg-white/10"
            >
              Explore locations
            </Link>
            <Link
              to="/title-deed"
              className="rounded-full border border-white/15 px-4 py-2 text-xs hover:bg-white/10"
            >
              Title deed search
            </Link>
          </div>
        </section>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No saved report matches “{q}”.</p>
      ) : (
        <div className="grid gap-5">
          {favorites.length > 0 && (
            <Group title="Starred" items={favorites}>
              {(r) => (
                <ReportCard
                  key={r.id}
                  report={r}
                  downloading={downloading === r.id}
                  onDownload={() => download(r)}
                  onDelete={() => del.mutate(r.id)}
                  onToggleFav={() => fav.mutate({ id: r.id, value: !r.is_favorite })}
                  onNote={(value) => note.mutate({ id: r.id, value })}
                />
              )}
            </Group>
          )}
          <Group title={favorites.length > 0 ? "All reports" : "Saved reports"} items={rest}>
            {(r) => (
              <ReportCard
                key={r.id}
                report={r}
                downloading={downloading === r.id}
                onDownload={() => download(r)}
                onDelete={() => del.mutate(r.id)}
                onToggleFav={() => fav.mutate({ id: r.id, value: !r.is_favorite })}
                onNote={(value) => note.mutate({ id: r.id, value })}
              />
            )}
          </Group>
        </div>
      )}
    </main>
  );
}

function Group({
  title,
  items,
  children,
}: {
  title: string;
  items: SavedReport[];
  children: (r: SavedReport) => React.ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">{title}</h2>
      <ul className="grid gap-2.5">{items.map((r) => children(r))}</ul>
    </section>
  );
}

function ReportCard({
  report,
  downloading,
  onDownload,
  onDelete,
  onToggleFav,
  onNote,
}: {
  report: SavedReport;
  downloading: boolean;
  onDownload: () => void;
  onDelete: () => void;
  onToggleFav: () => void;
  onNote: (value: string) => void;
}) {
  const [draft, setDraft] = useState(report.note ?? "");
  const dirty = draft !== (report.note ?? "");

  return (
    <li className="glass rounded-2xl border border-white/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-[15px] font-semibold">{report.label}</h3>
          <p className="mt-0.5 inline-flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3 text-accent" aria-hidden="true" />
              {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
            </span>
            {report.ref && <span>· deed {report.ref}</span>}
            <span>· saved {formatDateTime(report.created_at)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleFav}
            aria-pressed={report.is_favorite}
            aria-label={report.is_favorite ? "Remove star" : "Star this report"}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] transition ${
              report.is_favorite
                ? "border-gold/50 bg-gold/10 text-gold"
                : "border-white/12 hover:bg-white/5"
            }`}
          >
            <Star className="h-3.5 w-3.5" aria-hidden="true" />
            {report.is_favorite ? "Starred" : "Star"}
          </button>
          <Link
            to="/report"
            search={{
              lat: report.lat,
              lng: report.lng,
              address: report.label,
              ref: report.ref,
            }}
            className="inline-flex h-8 items-center rounded-full border border-white/12 px-3 text-[11px] hover:bg-white/5"
          >
            Open report
          </Link>
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-3 text-[11px] font-medium text-primary-foreground disabled:opacity-60"
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {downloading ? "Preparing…" : "PDF"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete saved report for ${report.label}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/12 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="flex-1 min-w-[200px]">
          <span className="sr-only">Private note for {report.label}</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a private note (why this location matters)…"
            className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-3 py-1.5 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          />
        </label>
        <button
          type="button"
          onClick={() => onNote(draft)}
          disabled={!dirty}
          className="rounded-full border border-white/12 px-3 py-1.5 text-[11px] disabled:opacity-40 hover:bg-white/5"
        >
          Save note
        </button>
      </div>
    </li>
  );
}
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/reports')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/reports"!</div>
}
