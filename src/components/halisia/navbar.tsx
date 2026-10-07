import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X, LogIn, LogOut, Bookmark, ChevronDown, User as UserIcon } from "lucide-react";
import halisiaLogo from "@/assets/brand/halisia-mark.png.asset.json";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LINKS: Array<{ to: string; label: string }> = [
  { to: "/", label: "Home" },
  { to: "/explore", label: "Explore" },
  { to: "/marketplace", label: "Marketplace" },
  { to: "/title-deed", label: "Title Deed" },
  { to: "/spatial", label: "Spatial AR" },

  { to: "/connections", label: "Connections" },
  { to: "/compare", label: "Compare" },
  { to: "/reports", label: "Reports" },
  { to: "/dashboard", label: "Dashboard" },
];

// Finished public pages that previously had no menu entry.
const MORE_LINKS: Array<{ to: string; label: string }> = [
  { to: "/pricing", label: "Pricing" },
  { to: "/design-studio", label: "3D Design Studio" },
  { to: "/model-lab", label: "Model Lab" },
  { to: "/pulse", label: "Pulse news" },
  { to: "/compare-locations", label: "Compare locations" },
  { to: "/land-transfer", label: "Transfer costs" },
];

// Tools behind sign-in; only listed once the user is signed in.
const MEMBER_LINKS: Array<{ to: string; label: string }> = [
  { to: "/sell/new", label: "Sell land" },
  { to: "/seller-tools", label: "Seller tools" },
  { to: "/rentals", label: "Rentals" },
  { to: "/financing", label: "Financing" },
  { to: "/pros", label: "Professionals" },
  { to: "/contributions", label: "Contributions" },
];

// Exact or nested match, so "/compare" is not active on "/compare-locations".
const isActive = (pathname: string, to: string) =>
  to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);

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
            className="h-9 w-9 shrink-0 object-contain drop-shadow-[0_0_14px_rgba(0,143,85,0.35)]"
          />
          <span className="min-w-0 truncate font-display font-semibold tracking-tight text-[15px] sm:text-[16px]">
            HALISIA<span className="text-accent">·</span>AI
          </span>
        </Link>
        <nav
          className="hidden xl:flex min-w-0 flex-1 items-center justify-center gap-0.5 text-sm text-muted-foreground 2xl:gap-1"
          aria-label="Primary"
        >
          {LINKS.map((l) => {
            const active = isActive(pathname, l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                {...(l.to === "/" ? { search: { compare: "" } } : {})}
                className={`whitespace-nowrap rounded-full px-2.5 py-1.5 transition lg:px-3 ${
                  active ? "bg-white/10 text-foreground" : "hover:text-foreground hover:bg-white/5"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 transition lg:px-3 ${
                [...MORE_LINKS, ...(user ? MEMBER_LINKS : [])].some((l) => isActive(pathname, l.to))
                  ? "bg-white/10 text-foreground"
                  : "hover:text-foreground hover:bg-white/5"
              }`}
            >
              More <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              {MORE_LINKS.map((l) => (
                <DropdownMenuItem key={l.to} asChild>
                  <Link to={l.to}>{l.label}</Link>
                </DropdownMenuItem>
              ))}
              {!loading && user ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Your tools</DropdownMenuLabel>
                  {MEMBER_LINKS.map((l) => (
                    <DropdownMenuItem key={l.to} asChild>
                      <Link to={l.to}>{l.label}</Link>
                    </DropdownMenuItem>
                  ))}
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden whitespace-nowrap text-[10px] uppercase tracking-[0.25em] text-muted-foreground 2xl:block">
            Land Intelligence · Kenya
          </span>
          {!loading && user ? (
            <div className="hidden xl:flex items-center gap-1.5">
              <Link
                to="/saved"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 text-xs hover:bg-white/10"
              >
                <Bookmark className="h-3.5 w-3.5 text-accent" aria-hidden="true" /> Saved
              </Link>
              <Link
                to="/account"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 text-xs hover:bg-white/10"
              >
                <UserIcon className="h-3.5 w-3.5 text-accent" aria-hidden="true" /> Account
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
              className="hidden xl:inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-3 text-xs font-medium text-primary-foreground"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" /> Sign in
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="xl:hidden inline-flex h-10 w-10 items-center justify-center rounded-full glass hover:bg-white/10 transition"
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
        className={`xl:hidden fixed inset-0 z-40 transition ${
          open ? "pointer-events-auto" : "pointer-events-none"
        }`}
        // `inert` removes the closed drawer from the a11y tree and the tab
        // order; adding aria-hidden as well would double-hide focusable links.
        inert={!open || undefined}
      >
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-background/70 backdrop-blur-sm transition-opacity ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />
        <nav
          aria-label="Mobile"
          className={`absolute inset-x-3 top-[64px] box-border max-w-[calc(100vw-1.5rem)] rounded-2xl border border-white/10 p-3 glass-strong transition-all ${
            open ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
          }`}
        >
          <ul className="flex flex-col gap-1 max-h-[calc(100vh-120px)] overflow-y-auto">
            {[...LINKS, ...MORE_LINKS, ...(!loading && user ? MEMBER_LINKS : [])].map((l, idx) => {
              const active = isActive(pathname, l.to);
              const groupStart =
                idx === LINKS.length
                  ? "More"
                  : idx === LINKS.length + MORE_LINKS.length
                    ? "Your tools"
                    : null;
              return (
                <li key={l.to}>
                  {groupStart ? (
                    <p className="mt-2 border-t border-white/10 px-4 pb-1 pt-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {groupStart}
                    </p>
                  ) : null}
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
                  <Link
                    to="/account"
                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-[15px] text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  >
                    <UserIcon className="h-4 w-4 text-accent" aria-hidden="true" /> Account
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

