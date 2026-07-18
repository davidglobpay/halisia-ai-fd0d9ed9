import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import halisiaLogo from "@/assets/halisia-logo.png.asset.json";

const LINKS: Array<{ to: string; label: string }> = [
  { to: "/", label: "Home" },
  { to: "/explore", label: "Explore" },
  { to: "/title-deed", label: "Title Deed" },
  { to: "/compare", label: "Compare" },
  { to: "/report", label: "Reports" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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
          </ul>
          <div className="mt-2 px-4 pt-2 pb-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground border-t border-white/10">
            Land Intelligence · Kenya
          </div>
        </nav>
      </div>
    </>
  );
}
