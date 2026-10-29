import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { FolderKanban, Loader2, MapPin, Plus } from "lucide-react";
import {
  createProject,
  listProjects,
  stageLabel,
  validCoordinate,
  validProjectName,
} from "@/lib/projects";
import { countyForPoint } from "@/lib/location-validation";
import { formatDate } from "@/lib/format-datetime";

const searchSchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  label: z.string().max(160).optional(),
});

export const Route = createFileRoute("/_authenticated/projects")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Projects · HALISIA AI" },
      {
        name: "description",
        content:
          "Keep everything about one site together: the place, saved reports, listings, financing and the evidence behind them.",
      },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const coord = validCoordinate(search.lat, search.lng);
  const [name, setName] = useState(search.label ?? "");
  const [error, setError] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const create = useMutation({
    mutationFn: () =>
      createProject({
        name,
        lat: coord?.lat ?? null,
        lng: coord?.lng ?? null,
        county: coord ? (countyForPoint(coord.lat, coord.lng)?.name ?? null) : null,
      }),
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: ["projects"] });
      void navigate({ to: "/project/$id", params: { id: p.id } });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not create the project."),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validProjectName(name);
    if (problem) return setError(problem);
    setError(null);
    create.mutate();
  };

  const projects = q.data ?? [];

  return (
    <main
      className="min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-5xl mx-auto"
      data-testid="projects-page"
    >
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-display font-semibold">
          <FolderKanban className="h-7 w-7 text-accent" aria-hidden="true" /> Projects
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          A project keeps everything about one site together: the place, saved reports, listings,
          financing, bids and the evidence behind them.
        </p>
      </header>

      <form
        onSubmit={submit}
        className="glass rounded-2xl border border-white/10 p-4 mb-8"
        aria-labelledby="new-project-title"
      >
        <h2 id="new-project-title" className="text-sm font-semibold">
          New project
        </h2>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <label className="flex-1">
            <span className="sr-only">Project name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={160}
              placeholder="e.g. Kitengela family home"
              className="w-full min-h-11 rounded-xl border border-white/15 bg-background/70 px-3 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={create.isPending}
            className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="h-4 w-4" aria-hidden="true" />
            )}
            Create project
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {coord ? (
            <>
              <MapPin className="inline h-3 w-3" aria-hidden="true" /> Located at{" "}
              {coord.lat.toFixed(5)}, {coord.lng.toFixed(5)}. This is the point you chose, not a
              surveyed boundary.
            </>
          ) : (
            <>
              No location yet. To start from a place, use “Start a project here” on{" "}
              <Link to="/explore" className="underline underline-offset-2">
                Explore
              </Link>
              .
            </>
          )}
        </p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-amber-glow">
            {error}
          </p>
        )}
      </form>

      {q.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
        </p>
      ) : q.isError ? (
        <p role="alert" className="text-sm text-amber-glow">
          Projects could not be loaded.
        </p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                to="/project/$id"
                params={{ id: p.id }}
                className="glass block rounded-2xl border border-white/10 p-4 hover:bg-white/5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{p.name}</span>
                  <span className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {stageLabel(p.stage)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {p.county ?? (p.latitude != null ? "Location set" : "No location")} · updated{" "}
                  {formatDate(p.updated_at)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
