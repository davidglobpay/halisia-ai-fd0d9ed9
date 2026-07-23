import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star, StarOff, Trash2, MapPin, Building2 } from "lucide-react";
import { listSavedItems, removeSavedItem, toggleFavorite, type SavedItem } from "@/lib/saved-items";

export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({
    meta: [
      { title: "My saved · HALISIA AI" },
      {
        name: "description",
        content: "Your saved Kenya locations, county profiles, and favorites.",
      },
      { property: "og:title", content: "My saved · HALISIA AI" },
      {
        property: "og:description",
        content: "Return to any Kenya location or county you've saved.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SavedPage,
});

function SavedPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["saved-items"], queryFn: listSavedItems });
  const del = useMutation({
    mutationFn: (id: string) => removeSavedItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-items"] }),
  });
  const fav = useMutation({
    mutationFn: ({ id, v }: { id: string; v: boolean }) => toggleFavorite(id, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-items"] }),
  });

  const items = q.data ?? [];
  const favorites = items.filter((i) => i.is_favorite);
  const rest = items.filter((i) => !i.is_favorite);

  return (
    <main className="min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-semibold">My saved</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Locations and counties you've saved. Favourites appear first.
        </p>
      </header>

      {q.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : q.isError ? (
        <div role="alert" className="text-sm text-red-300">
          Failed to load saved items.
        </div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {favorites.length > 0 && (
            <Section
              title="Favourites"
              items={favorites}
              onDelete={(id) => del.mutate(id)}
              onFav={(id, v) => fav.mutate({ id, v })}
            />
          )}
          <Section
            title={favorites.length ? "Everything else" : "Saved"}
            items={rest}
            onDelete={(id) => del.mutate(id)}
            onFav={(id, v) => fav.mutate({ id, v })}
          />
        </div>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="glass rounded-2xl border border-white/10 p-8 text-center">
      <p className="text-sm text-muted-foreground">You haven't saved anything yet.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link
          to="/"
          search={{ compare: "" }}
          className="rounded-full bg-primary/90 text-primary-foreground px-4 py-2 text-xs font-medium"
        >
          Browse counties
        </Link>
        <Link
          to="/explore"
          search={{ q: "" }}
          className="rounded-full border border-white/10 px-4 py-2 text-xs"
        >
          Analyse a location
        </Link>
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  onDelete,
  onFav,
}: {
  title: string;
  items: SavedItem[];
  onDelete: (id: string) => void;
  onFav: (id: string, v: boolean) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={`sec-${title}`}>
      <h2
        id={`sec-${title}`}
        className="text-xs uppercase tracking-widest text-muted-foreground mb-3"
      >
        {title}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.id} className="glass rounded-2xl border border-white/10 p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 grid place-items-center shrink-0">
                {i.kind === "county" ? (
                  <Building2 className="h-4 w-4 text-accent" />
                ) : (
                  <MapPin className="h-4 w-4 text-accent" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{i.label}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {i.kind === "county"
                    ? "County profile"
                    : i.latitude != null
                      ? `${i.latitude.toFixed(4)}, ${i.longitude?.toFixed(4)}`
                      : "Location"}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {i.kind === "county" ? (
                    <Link
                      to="/county/$code"
                      params={{ code: i.ref }}
                      className="text-xs rounded-full bg-primary/90 text-primary-foreground px-3 py-1"
                    >
                      Open
                    </Link>
                  ) : (
                    <Link
                      to="/explore"
                      search={{ q: i.ref }}
                      className="text-xs rounded-full bg-primary/90 text-primary-foreground px-3 py-1"
                    >
                      Open
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => onFav(i.id, !i.is_favorite)}
                    aria-pressed={i.is_favorite}
                    aria-label={i.is_favorite ? `Unfavorite ${i.label}` : `Favorite ${i.label}`}
                    className="text-xs rounded-full border border-white/10 px-3 py-1 inline-flex items-center gap-1.5 hover:bg-white/5"
                  >
                    {i.is_favorite ? (
                      <Star className="h-3.5 w-3.5 text-amber-glow" />
                    ) : (
                      <StarOff className="h-3.5 w-3.5" />
                    )}
                    {i.is_favorite ? "Favourited" : "Favourite"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(i.id)}
                    aria-label={`Remove ${i.label}`}
                    className="ml-auto text-xs rounded-full border border-white/10 px-3 py-1 inline-flex items-center gap-1.5 hover:bg-red-500/10 hover:text-red-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
