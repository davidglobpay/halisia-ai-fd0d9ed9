import { useState } from "react";
import { Search, Loader2 } from "lucide-react";

export function SearchBar({
  onSearch,
  loading,
  placeholder = "Search a town, road, plot number, or coordinates…",
  size = "md",
}: {
  onSearch: (q: string) => void;
  loading?: boolean;
  placeholder?: string;
  size?: "md" | "lg";
}) {
  const [q, setQ] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) onSearch(q.trim());
  };
  return (
    <form
      onSubmit={submit}
      className={`glass-strong rounded-full flex items-center gap-2 ${size === "lg" ? "px-3 py-2" : "px-2.5 py-1.5"}`}
    >
      <div
        className={`${size === "lg" ? "h-11 w-11" : "h-9 w-9"} rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0`}
      >
        <Search className={`${size === "lg" ? "h-5 w-5" : "h-4 w-4"} text-accent`} />
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className={`flex-1 bg-transparent outline-none placeholder:text-muted-foreground ${size === "lg" ? "text-base py-1" : "text-sm"}`}
      />
      <button
        type="submit"
        disabled={loading || !q.trim()}
        className={`${size === "lg" ? "px-5 h-11 text-sm" : "px-4 h-9 text-xs"} rounded-full font-medium bg-gradient-to-r from-primary to-accent text-primary-foreground disabled:opacity-50 flex items-center gap-2 shadow-[0_10px_30px_-10px_oklch(0.68_0.19_249/0.9)]`}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Analyze
      </button>
    </form>
  );
}
