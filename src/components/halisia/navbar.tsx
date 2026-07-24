import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X, LogIn, LogOut, Bookmark, User as UserIcon } from "lucide-react";
import halisiaLogo from "@/assets/halisia-logo.png.asset.json";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

const LINKS: Array<{ to: string; label: string }> = [
  { to: "/", label: "Home" },
  { to: "/explore", label: "Explore" },
  { to: "/marketplace", label: "Marketplace" },
  { to: "/title-deed", label: "Title Deed" },
  { to: "/compare", label: "Compare" },
  { to: "/report", label: "Reports" },
  { to: "/_authenticated/pros", label: "Pros" },
  { to: "/_authenticated/financing", label: "Financing" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading, signOut } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 w-full glass-strong border-b border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between">
        <Link
          to="/"
          search={{ compare: "" }}
          className="flex items-center gap-2.5 min-w-0"
          aria-label="HALISIA AI home"
        >
          <img
            src={halisiaLogo.url}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover shadow-[0_0_20px_oklch(0.68_0.19_249/0.5)]"
          />
          <span className="font-display font-semibold tracking-tight text-[15px] sm:text-[16px] truncate">
            HALISIA<span className="text-accent">·</span>AI
          </span>
        </Link>
        <nav
          className="hidden md:flex items-center gap-1 text-sm text-muted-foreground"
          aria-label="Primary"
        >
          {LINKS.map((l) => {
            const active = l.to === "/" ? pathname === "/" : pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                {...(l.to === "/" ? { search: { compare: "" } } : {})}
                className={`px-3 py-1.5 rounded-full transition ${
                  active ? "bg-white/10 text-foreground" : "hover:text-foreground hover:bg-white/5"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground hidden xl:block">
            Land Intelligence · Kenya
          </span>
          {!loading && user ? (
            <div className="hidden md:flex items-center gap-1.5">
              <Link
                to="/saved"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 text-xs hover:bg-white/10"
              >
                <Bookmark className="h-3.5 w-3.5 text-accent" aria-hidden="true" /> Saved
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Sign out"
                title={user.email ?? "Sign out"}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 px-3 text-xs hover:bg-white/10"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Sign out
              </button>
            </div>
          ) : !loading ? (
            <Link
              to="/auth"
              className="hidden md:inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-3 text-xs font-medium text-primary-foreground"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" /> Sign in
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full glass hover:bg-white/10 transition"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="halisia-mobile-nav"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>
      <div
        id="halisia-mobile-nav"
        className={`md:hidden fixed inset-0 z-40 transition ${
          open ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-background/70 backdrop-blur-sm transition-opacity ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />
        <nav
          aria-label="Mobile"
          className={`absolute top-[64px] inset-x-3 rounded-2xl glass-strong border border-white/10 p-3 transition-all ${
            open ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
          }`}
        >
          <ul className="flex flex-col gap-1">
            {LINKS.map((l) => {
              const active = l.to === "/" ? pathname === "/" : pathname.startsWith(l.to);
              return (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    {...(l.to === "/" ? { search: { compare: "" } } : {})}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl text-[15px] transition ${
                      active
                        ? "bg-white/10 text-foreground"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    }`}
                  >
                    <span>{l.label}</span>
                    {active && (
                      <span className="text-[10px] uppercase tracking-widest text-accent">
                        Current
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
            <li className="mt-1 border-t border-white/10 pt-2">
              {!loading && user ? (
                <>
                  <Link
                    to="/saved"
                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-[15px] text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  >
                    <Bookmark className="h-4 w-4 text-accent" aria-hidden="true" /> My saved
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-[15px] text-muted-foreground hover:bg-white/5 hover:text-foreground text-left"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
                    <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[60%]">
                      {user.email}
                    </span>
                  </button>
                </>
              ) : !loading ? (
                <Link
                  to="/auth"
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-[15px] font-medium text-foreground bg-gradient-to-r from-primary/30 to-accent/30 border border-white/10"
                >
                  <UserIcon className="h-4 w-4 text-accent" aria-hidden="true" /> Sign in / Create
                  account
                </Link>
              ) : null}
            </li>
          </ul>
          <div className="mt-2 px-4 pt-2 pb-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground border-t border-white/10">
            Land Intelligence · Kenya
          </div>
        </nav>
      </div>
    </>
  );
}
