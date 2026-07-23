import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, Loader2, LogIn } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { isSaved, removeSavedItem, saveItem, type SavedKind } from "@/lib/saved-items";
import { useAuth } from "@/hooks/use-auth";

type Props = {
  kind: SavedKind;
  ref_: string;
  label: string;
  latitude?: number | null;
  longitude?: number | null;
  className?: string;
};

export function SaveButton({ kind, ref_, label, latitude, longitude, className }: Props) {
  const { user, loading: authLoading } = useAuth();
  const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!user) {
      setSavedId(null);
      return;
    }
    void isSaved(kind, ref_).then((s) => {
      if (alive) setSavedId(s?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, [user, kind, ref_]);

  if (authLoading) {
    return (
      <button
        disabled
        aria-label="Loading save state"
        className={
          className ??
          "h-9 px-3 rounded-full text-xs border border-white/10 inline-flex items-center gap-1.5 opacity-60"
        }
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </button>
    );
  }

  if (!user) {
    return (
      <Link
        to="/auth"
        aria-label={`Sign in to save ${label}`}
        className={
          className ??
          "h-9 px-3 rounded-full text-xs border border-white/10 inline-flex items-center gap-1.5 hover:bg-white/5"
        }
      >
        <LogIn className="h-3.5 w-3.5" aria-hidden="true" /> Sign in to save
      </Link>
    );
  }

  const onToggle = async () => {
    setBusy(true);
    try {
      if (savedId) {
        await removeSavedItem(savedId);
        setSavedId(null);
      } else {
        const item = await saveItem({ kind, ref: ref_, label, latitude, longitude });
        setSavedId(item.id);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={!!savedId}
      aria-label={savedId ? `Remove ${label} from saved` : `Save ${label}`}
      className={
        className ??
        `h-9 px-3 rounded-full text-xs inline-flex items-center gap-1.5 border transition ${savedId ? "border-accent/50 bg-accent/10 text-accent" : "border-white/10 hover:bg-white/5"}`
      }
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : savedId ? (
        <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {savedId ? "Saved" : "Save"}
    </button>
  );
}
