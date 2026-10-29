import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Link2, Loader2, MapPin, Trash2, Unlink } from "lucide-react";
import {
  deleteProject,
  getProject,
  listLinkableSavedItems,
  listProjectLinks,
  PROJECT_STAGES,
  setSavedItemProject,
  updateProject,
} from "@/lib/projects";
import { EvidenceTrail } from "@/components/halisia/evidence-trail";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/project/$id")({
  head: () => ({ meta: [{ title: "Project · HALISIA AI" }] }),
  component: ProjectPage,
});

function ProjectPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const projectQ = useQuery({ queryKey: ["project", id], queryFn: () => getProject(id) });
  const linksQ = useQuery({ queryKey: ["project-links", id], queryFn: () => listProjectLinks(id) });
  const linkableQ = useQuery({
    queryKey: ["project-linkable", id],
    queryFn: () => listLinkableSavedItems(id),
  });

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toLink, setToLink] = useState("");

  const p = projectQ.data;
  useEffect(() => {
    if (p) {
      setName(p.name);
      setNotes(p.notes ?? "");
    }
  }, [p]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["project", id] });
    void qc.invalidateQueries({ queryKey: ["projects"] });
    void qc.invalidateQueries({ queryKey: ["project-links", id] });
    void qc.invalidateQueries({ queryKey: ["project-linkable", id] });
  };
  const fail = (e: unknown) =>
    setMessage(e instanceof Error ? e.message : "That change could not be saved.");

  const save = useMutation({
    mutationFn: (patch: Parameters<typeof updateProject>[1]) => updateProject(id, patch),
    onSuccess: () => {
      setMessage("Saved.");
      refresh();
    },
    onError: fail,
  });
  const link = useMutation({
    mutationFn: ({ item, project }: { item: string; project: string | null }) =>
      setSavedItemProject(item, project),
    onSuccess: () => {
      setToLink("");
      refresh();
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: () => deleteProject(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["projects"] });
      void navigate({ to: "/projects", search: {} });
    },
    onError: fail,
  });

  if (projectQ.isLoading)
    return (
      <main className="min-h-dvh px-4 pt-24 max-w-5xl mx-auto">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading project…
        </p>
      </main>
    );
  if (!p)
    return (
      <main className="min-h-dvh px-4 pt-24 max-w-5xl mx-auto">
        <p role="alert" className="text-sm">
          This project doesn't exist, or you are not a member of it.
        </p>
        <Link to="/projects" search={{}} className="mt-3 inline-block text-sm underline">
          Back to projects
        </Link>
      </main>
    );

  const isOwner = userId != null && p.owner_id === userId;
  const links = linksQ.data;
  const hasPlace = p.latitude != null && p.longitude != null;

  return (
    <main
      className="min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-5xl mx-auto"
      data-testid="project-page"
    >
      <Link
        to="/projects"
        search={{}}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> All projects
      </Link>

      <section className="glass mt-3 rounded-2xl border border-white/10 p-4">
        <label className="block text-xs font-medium text-muted-foreground" htmlFor="project-name">
          Project name
        </label>
        <div className="mt-1 flex flex-col sm:flex-row gap-2">
          <input
            id="project-name"
            value={name}
            maxLength={160}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 min-h-11 rounded-xl border border-white/15 bg-background/70 px-3 text-lg font-semibold"
          />
          <label className="sm:w-56">
            <span className="sr-only">Stage</span>
            <select
              value={p.stage}
              onChange={(e) => save.mutate({ stage: e.target.value })}
              className="w-full min-h-11 rounded-xl border border-white/15 bg-background/70 px-3 text-sm"
            >
              {PROJECT_STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label
          className="mt-3 block text-xs font-medium text-muted-foreground"
          htmlFor="project-notes"
        >
          Notes
        </label>
        <textarea
          id="project-notes"
          value={notes}
          maxLength={4000}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-xl border border-white/15 bg-background/70 px-3 py-2 text-sm"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => save.mutate({ name, notes: notes || null })}
            disabled={save.isPending}
            className="min-h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            Save
          </button>
          {message && (
            <span role="status" className="text-xs text-muted-foreground">
              {message}
            </span>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          <MapPin className="inline h-3 w-3" aria-hidden="true" />{" "}
          {hasPlace ? (
            <>
              {p.county ? `${p.county} · ` : ""}
              {p.latitude!.toFixed(5)}, {p.longitude!.toFixed(5)} — the point chosen, not a surveyed
              boundary.{" "}
              <Link
                to="/explore"
                search={{ q: `${p.latitude!.toFixed(6)},${p.longitude!.toFixed(6)}` }}
                className="underline underline-offset-2"
              >
                Open in Explore
              </Link>
            </>
          ) : (
            "No location set."
          )}
        </p>
      </section>

      <section
        className="glass mt-4 rounded-2xl border border-white/10 p-4"
        aria-labelledby="linked-title"
      >
        <h2 id="linked-title" className="text-sm font-semibold">
          Linked to this project
        </h2>
        {linksQ.isLoading || !links ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <LinkedList
              title="Saved places and reports"
              empty="Nothing saved here yet."
              items={links.saved.map((s) => ({
                id: s.id,
                label: s.label,
                meta: s.kind,
                action: (
                  <button
                    type="button"
                    onClick={() => link.mutate({ item: s.id, project: null })}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${s.label} from this project`}
                  >
                    <Unlink className="h-3 w-3" aria-hidden="true" /> Remove
                  </button>
                ),
              }))}
            />
            <LinkedList
              title="Listings"
              empty="No listings linked."
              items={links.listings.map((l) => ({ id: l.id, label: l.title, meta: l.status }))}
            />
            <LinkedList
              title="Financing applications"
              empty="No financing linked."
              items={links.financing.map((f) => ({
                id: f.id,
                label: f.borrower_name,
                meta: `${f.status} · KES ${f.requested_amount.toLocaleString("en-KE")}`,
              }))}
            />
            <LinkedList
              title="Bid requests"
              empty="No bid requests linked."
              items={links.bids.map((b) => ({ id: b.id, label: b.title, meta: b.status }))}
            />
          </div>
        )}

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <label className="flex-1">
            <span className="sr-only">Saved item to link</span>
            <select
              value={toLink}
              onChange={(e) => setToLink(e.target.value)}
              className="w-full min-h-10 rounded-xl border border-white/15 bg-background/70 px-3 text-sm"
            >
              <option value="">Link one of your saved places or reports…</option>
              {(linkableQ.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} ({s.kind})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!toLink || link.isPending}
            onClick={() => link.mutate({ item: toLink, project: id })}
            className="min-h-10 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 px-4 text-sm disabled:opacity-50"
          >
            <Link2 className="h-4 w-4" aria-hidden="true" /> Link
          </button>
        </div>
      </section>

      <EvidenceTrail locationKey={p.location_key} className="mt-4" />

      {isOwner && (
        <section className="mt-8">
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Delete this project? Linked records are kept, just unlinked.</span>
              <button
                type="button"
                onClick={() => remove.mutate()}
                className="rounded-xl bg-red-600 px-3 py-1.5 text-white"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-xl border border-white/15 px-3 py-1.5"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-300"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete project
            </button>
          )}
        </section>
      )}
    </main>
  );
}

function LinkedList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{ id: string; label: string; meta?: string; action?: React.ReactNode }>;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {i.label}
                {i.meta ? <span className="text-xs text-muted-foreground"> · {i.meta}</span> : null}
              </span>
              {i.action}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
