import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileDown,
  Loader2,
  MapPin,
  Star,
  Trash2,
  FileText,
  Search,
  FolderPlus,
  Share2,
  History,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  listSavedReports,
  removeSavedItem,
  toggleFavorite,
  updateSavedNote,
  type SavedReport,
} from "@/lib/saved-items";
import {
  addToCollection,
  createCollection,
  createShare,
  deleteCollection,
  listCollectionItems,
  listCollections,
  listShares,
  listVersions,
  recordVersion,
  removeFromCollection,
  revokeShare,
  shareUrl,
  type ReportCollection,
} from "@/lib/report-collections";
import { KenyaMotif } from "@/components/halisia/ds";
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

type Tab = "all" | "starred";

function ReportsPage() {
  const qc = useQueryClient();
  const reports = useQuery({ queryKey: ["saved-reports"], queryFn: listSavedReports });
  const collections = useQuery({ queryKey: ["report-collections"], queryFn: listCollections });
  const items = useQuery({ queryKey: ["report-collection-items"], queryFn: listCollectionItems });

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<string | null>(null);
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);
  const [newName, setNewName] = useState("");
  const [shareFor, setShareFor] = useState<SavedReport | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["saved-reports"] });
    void qc.invalidateQueries({ queryKey: ["report-collection-items"] });
  };

  const del = useMutation({ mutationFn: removeSavedItem, onSuccess: invalidate });
  const fav = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => toggleFavorite(id, value),
    onSuccess: invalidate,
  });
  const note = useMutation({
    mutationFn: async ({ id, value, prev }: { id: string; value: string; prev: string | null }) => {
      await updateSavedNote(id, value);
      await recordVersion({
        savedItemId: id,
        summary: prev ? "Note updated" : "Note added",
        changes: [{ field: "note", from: prev, to: value.trim() || null }],
      });
    },
    onSuccess: () => {
      invalidate();
      void qc.invalidateQueries({ queryKey: ["report-versions"] });
      toast.success("Note saved", { description: "A new version was recorded." });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCollection = useMutation({
    mutationFn: (name: string) => createCollection({ name }),
    onSuccess: (c) => {
      setNewName("");
      setActiveCollection(c.id);
      void qc.invalidateQueries({ queryKey: ["report-collections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dropCollection = useMutation({
    mutationFn: deleteCollection,
    onSuccess: () => {
      setActiveCollection(null);
      void qc.invalidateQueries({ queryKey: ["report-collections"] });
      void qc.invalidateQueries({ queryKey: ["report-collection-items"] });
    },
  });

  const assign = useMutation({
    mutationFn: async ({
      collectionId,
      ids,
      remove,
    }: {
      collectionId: string;
      ids: string[];
      remove?: boolean;
    }) => {
      for (const id of ids) {
        if (remove) await removeFromCollection(collectionId, id);
        else await addToCollection(collectionId, id);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["report-collection-items"] });
      toast.success("Collection updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const all = reports.data ?? [];
  const cols = collections.data ?? [];
  const membership = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const it of items.data ?? []) {
      map.set(it.saved_item_id, [...(map.get(it.saved_item_id) ?? []), it.collection_id]);
    }
    return map;
  }, [items.data]);

  const term = q.trim().toLowerCase();
  const list = all.filter((r) => {
    if (tab === "starred" && !r.is_favorite) return false;
    if (activeCollection && !(membership.get(r.id) ?? []).includes(activeCollection)) return false;
    if (!term) return true;
    return (
      r.label.toLowerCase().includes(term) ||
      (r.note ?? "").toLowerCase().includes(term) ||
      r.ref.toLowerCase().includes(term)
    );
  });

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const download = async (r: SavedReport) => {
    setDownloading(r.id);
    try {
      await generateLocationDossier({ lat: r.lat, lng: r.lng, address: r.label });
    } catch {
      toast.error("Could not build that dossier");
    } finally {
      setDownloading(null);
    }
  };

  const downloadBatch = async () => {
    const chosen = list.filter((r) => selected.has(r.id));
    if (chosen.length === 0) return;
    setBatch({ done: 0, total: chosen.length });
    let ok = 0;
    for (const [i, r] of chosen.entries()) {
      try {
        await generateLocationDossier({ lat: r.lat, lng: r.lng, address: r.label });
        ok += 1;
      } catch {
        /* keep going: one failed dossier must not stop the batch */
      }
      setBatch({ done: i + 1, total: chosen.length });
    }
    setBatch(null);
    toast.success(`${ok} of ${chosen.length} dossiers downloaded`);
  };

  return (
    <main className="relative min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-5xl mx-auto">
      <KenyaMotif className="fixed inset-0 -z-10 opacity-[0.5]" />
      <nav aria-label="Breadcrumb" className="mb-3 text-[11px] text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link to="/" search={{ compare: "" }} className="hover:text-accent">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link to="/dashboard" className="hover:text-accent">
              Dashboard
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground">Reports</li>
        </ol>
      </nav>

      <header className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.25em] text-accent">Halisia AI</div>
        <h1 className="text-3xl font-display font-semibold mt-1">My reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Land intelligence dossiers you saved. Group them into collections, share with named
          people, track versions and export in batches.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
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
        <div className="flex gap-1.5" role="tablist" aria-label="Report filter">
          {(["all", "starred"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-full border px-3.5 py-1.5 text-[11px] capitalize transition ${
                tab === t
                  ? "border-accent/50 bg-accent/15 text-accent"
                  : "border-white/12 text-muted-foreground hover:bg-white/5"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <Link
          to="/explore"
          className="rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-medium text-primary-foreground"
        >
          Generate a new report
        </Link>
      </div>

      <section aria-label="Collections" className="mb-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveCollection(null)}
            aria-pressed={activeCollection === null}
            className={`rounded-full border px-3 py-1.5 text-[11px] ${
              activeCollection === null
                ? "border-accent/50 bg-accent/15 text-accent"
                : "border-white/12 text-muted-foreground hover:bg-white/5"
            }`}
          >
            All collections
          </button>
          {cols.map((c) => (
            <span key={c.id} className="inline-flex items-center">
              <button
                type="button"
                onClick={() => setActiveCollection(activeCollection === c.id ? null : c.id)}
                aria-pressed={activeCollection === c.id}
                className={`rounded-full border px-3 py-1.5 text-[11px] ${
                  activeCollection === c.id
                    ? "border-gold/50 bg-gold/10 text-gold"
                    : "border-white/12 text-muted-foreground hover:bg-white/5"
                }`}
              >
                {c.name}
                <span className="ml-1.5 tabular-nums opacity-70">
                  {all.filter((r) => (membership.get(r.id) ?? []).includes(c.id)).length}
                </span>
              </button>
              {activeCollection === c.id && (
                <button
                  type="button"
                  onClick={() => dropCollection.mutate(c.id)}
                  aria-label={`Delete collection ${c.name}`}
                  className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/12 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </span>
          ))}
          <form
            className="inline-flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim()) addCollection.mutate(newName.trim());
            }}
          >
            <label className="sr-only" htmlFor="new-collection">
              New collection name
            </label>
            <input
              id="new-collection"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New collection…"
              className="h-8 w-36 rounded-full border border-white/12 bg-white/[0.04] px-3 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            />
            <button
              type="submit"
              disabled={!newName.trim() || addCollection.isPending}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 text-[11px] text-accent disabled:opacity-40"
            >
              <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" /> Create
            </button>
          </form>
        </div>
      </section>

      {selected.size > 0 && (
        <div
          className="glass sticky top-20 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-accent/25 p-3"
          data-testid="reports-bulk-bar"
        >
          <span className="text-[12px] font-medium">{selected.size} selected</span>
          <button
            type="button"
            onClick={downloadBatch}
            disabled={batch !== null}
            data-testid="batch-download"
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-3.5 text-[11px] font-medium text-primary-foreground disabled:opacity-60"
          >
            {batch ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {batch ? `Building ${batch.done}/${batch.total}…` : "Download PDFs"}
          </button>
          {cols.length > 0 && (
            <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              Add to
              <select
                defaultValue=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  assign.mutate({ collectionId: e.target.value, ids: [...selected] });
                  e.target.value = "";
                }}
                className="h-8 rounded-full border border-white/12 bg-white/[0.04] px-2.5 text-[11px]"
              >
                <option value="">collection…</option>
                {cols.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto rounded-full border border-white/12 px-3 py-1.5 text-[11px] hover:bg-white/5"
          >
            Clear selection
          </button>
          {batch && (
            <div
              className="w-full"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={batch.total}
              aria-valuenow={batch.done}
              aria-label="Batch dossier progress"
            >
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width]"
                  style={{ width: `${(batch.done / batch.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

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
        <p className="text-sm text-muted-foreground">No saved report matches this view.</p>
      ) : (
        <ul className="grid gap-2.5">
          {list.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              collections={cols}
              memberOf={membership.get(r.id) ?? []}
              selected={selected.has(r.id)}
              onSelect={() => toggleSelect(r.id)}
              downloading={downloading === r.id}
              historyOpen={historyFor === r.id}
              onToggleHistory={() => setHistoryFor(historyFor === r.id ? null : r.id)}
              onShare={() => setShareFor(r)}
              onDownload={() => download(r)}
              onDelete={() => del.mutate(r.id)}
              onToggleFav={() => fav.mutate({ id: r.id, value: !r.is_favorite })}
              onNote={(value) => note.mutate({ id: r.id, value, prev: r.note })}
              onCollectionToggle={(collectionId, isMember) =>
                assign.mutate({ collectionId, ids: [r.id], remove: isMember })
              }
            />
          ))}
        </ul>
      )}

      {shareFor && <ShareDialog report={shareFor} onClose={() => setShareFor(null)} />}
    </main>
  );
}

function ReportCard({
  report,
  collections,
  memberOf,
  selected,
  onSelect,
  downloading,
  historyOpen,
  onToggleHistory,
  onShare,
  onDownload,
  onDelete,
  onToggleFav,
  onNote,
  onCollectionToggle,
}: {
  report: SavedReport;
  collections: ReportCollection[];
  memberOf: string[];
  selected: boolean;
  onSelect: () => void;
  downloading: boolean;
  historyOpen: boolean;
  onToggleHistory: () => void;
  onShare: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onToggleFav: () => void;
  onNote: (value: string) => void;
  onCollectionToggle: (collectionId: string, isMember: boolean) => void;
}) {
  const [draft, setDraft] = useState(report.note ?? "");
  const dirty = draft !== (report.note ?? "");

  return (
    <li className="glass rounded-2xl border border-white/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <label className="mt-1 inline-flex items-center">
            <span className="sr-only">Select {report.label} for batch export</span>
            <input
              type="checkbox"
              checked={selected}
              onChange={onSelect}
              className="h-4 w-4 accent-[oklch(0.78_0.16_210)]"
            />
          </label>
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
            onClick={onShare}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/12 px-3 text-[11px] hover:bg-white/5"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" /> Share
          </button>
          <button
            type="button"
            onClick={onToggleHistory}
            aria-expanded={historyOpen}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/12 px-3 text-[11px] hover:bg-white/5"
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" /> History
          </button>
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

      {collections.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Collections
          </span>
          {collections.map((c) => {
            const isMember = memberOf.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={isMember}
                onClick={() => onCollectionToggle(c.id, isMember)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] transition ${
                  isMember
                    ? "border-gold/50 bg-gold/10 text-gold"
                    : "border-white/12 text-muted-foreground hover:bg-white/5"
                }`}
              >
                {isMember && <Check className="h-3 w-3" aria-hidden="true" />}
                {c.name}
              </button>
            );
          })}
        </div>
      )}

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

      {historyOpen && <VersionHistory savedItemId={report.id} />}
    </li>
  );
}

function VersionHistory({ savedItemId }: { savedItemId: string }) {
  const versions = useQuery({
    queryKey: ["report-versions", savedItemId],
    queryFn: () => listVersions(savedItemId),
  });

  return (
    <section className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground">
        Version history
      </h4>
      {versions.isLoading ? (
        <p className="mt-2 text-[11px] text-muted-foreground">Loading versions…</p>
      ) : (versions.data ?? []).length === 0 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          No changes recorded yet. Edits to this dossier — notes, refreshed intelligence — appear
          here with a timestamp.
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
              {v.changes.length > 0 && (
                <ul className="mt-1 grid gap-0.5">
                  {v.changes.map((c, i) => (
                    <li key={i} className="text-[10px] text-muted-foreground">
                      <span className="uppercase tracking-widest">{c.field}</span>:{" "}
                      <span className="line-through opacity-60">{c.from || "—"}</span> →{" "}
                      <span className="text-foreground">{c.to || "—"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ShareDialog({ report, onClose }: { report: SavedReport; onClose: () => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [days, setDays] = useState("30");
  const shares = useQuery({
    queryKey: ["report-shares", report.id],
    queryFn: () => listShares(report.id),
  });

  const create = useMutation({
    mutationFn: () =>
      createShare({
        report,
        recipientEmail: email,
        expiresInDays: days === "never" ? null : Number(days),
      }),
    onSuccess: async (s) => {
      setEmail("");
      void qc.invalidateQueries({ queryKey: ["report-shares", report.id] });
      try {
        await navigator.clipboard.writeText(shareUrl(s.token));
        toast.success("Link created and copied", {
          description: `Only ${s.recipient_email} can open it.`,
        });
      } catch {
        toast.success("Link created", { description: `Only ${s.recipient_email} can open it.` });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: revokeShare,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report-shares", report.id] }),
  });

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Share ${report.label}`}
    >
      <div className="glass relative w-full max-w-lg rounded-3xl border border-white/12 p-5">
        <KenyaMotif className="opacity-60" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-accent">
                Share report
              </div>
              <h2 className="mt-1 font-display text-lg font-semibold">{report.label}</h2>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Links are private: the recipient must sign in to Halisia with the exact email you
                enter below.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close share dialog"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/12 hover:bg-white/5"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <form
            className="mt-4 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <label className="flex-1 min-w-[200px]">
              <span className="sr-only">Recipient email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="person@company.co.ke"
                className="h-9 w-full rounded-full border border-white/12 bg-white/[0.04] px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              />
            </label>
            <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              Expires
              <select
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="h-9 rounded-full border border-white/12 bg-white/[0.04] px-2.5 text-[11px]"
              >
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="never">Never</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={create.isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-4 text-[11px] font-medium text-primary-foreground disabled:opacity-60"
            >
              {create.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Create link
            </button>
          </form>

          <div className="mt-4">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Existing links
            </h3>
            {(shares.data ?? []).length === 0 ? (
              <p className="mt-2 text-[11px] text-muted-foreground">No links yet.</p>
            ) : (
              <ul className="mt-2 grid max-h-56 gap-2 overflow-y-auto pr-1">
                {(shares.data ?? []).map((s) => {
                  const expired = s.expires_at != null && new Date(s.expires_at) < new Date();
                  const dead = Boolean(s.revoked_at) || expired;
                  return (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px]">{s.recipient_email}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {s.revoked_at
                            ? "Revoked"
                            : expired
                              ? "Expired"
                              : s.expires_at
                                ? `Expires ${formatDateTime(s.expires_at)}`
                                : "No expiry"}
                        </p>
                      </div>
                      {!dead && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(shareUrl(s.token));
                              toast.success("Link copied");
                            }}
                            className="rounded-full border border-white/12 px-2.5 py-1 text-[10px] hover:bg-white/5"
                          >
                            Copy link
                          </button>
                          <button
                            type="button"
                            onClick={() => revoke.mutate(s.id)}
                            className="rounded-full border border-white/12 px-2.5 py-1 text-[10px] text-muted-foreground hover:text-destructive"
                          >
                            Revoke
                          </button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
