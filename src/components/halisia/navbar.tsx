import { Link, useRouterState } from "@tanstack/react-router";
import { Fragment, useEffect, useState } from "react";
import {
  Menu,
  X,
  LogIn,
  LogOut,
  Bookmark,
  FolderKanban,
  ChevronDown,
  User as UserIcon,
} from "lucide-react";
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

type NavLink = { to: string; label: string; hint?: string; group?: string };

// Plain words a first-time visitor (or a child) can follow. The top row is
// the everyday journeys; everything else sits under "More" with a hint.
const LINKS: NavLink[] = [
  { to: "/", label: "Home" },
  { to: "/explore", label: "Explore map", hint: "Search any place in Kenya" },
  { to: "/marketplace", label: "Buy land", hint: "Plots and homes for sale" },
  { to: "/title-deed", label: "Title deed", hint: "Read a deed photo" },
  { to: "/compare-locations", label: "Compare places", hint: "Two places side by side" },
  { to: "/connections", label: "Find experts", hint: "Surveyors, lawyers, valuers" },
  { to: "/reports", label: "My reports", hint: "Your saved reports" },
  { to: "/dashboard", label: "My dashboard", hint: "Your activity" },
];

// Finished public pages that are not on the top row.
const MORE_LINKS: NavLink[] = [
  {
    to: "/plot-planner",
    label: "Plan a house on my plot",
    hint: "See a house on your land in 3D",
    group: "Plan & build",
  },
  { to: "/build-cost", label: "How much to build?", hint: "Cost of a house, line by line" },
  { to: "/budget", label: "What can my budget buy?", hint: "Places that fit your money" },
  { to: "/design-studio", label: "3D Design Studio", hint: "Try building ideas in 3D" },
  { to: "/model-lab", label: "3D Model Lab", hint: "See a building and its shadows" },
  { to: "/spatial", label: "AR / VR land view", hint: "Walk a surveyed plot in 3D or AR" },
  {
    to: "/land-transfer",
    label: "Land transfer costs",
    hint: "Fees to buy or transfer land",
    group: "Learn",
  },
  { to: "/compare", label: "Compare counties", hint: "Counties side by side" },
  { to: "/pulse", label: "Land news", hint: "Latest land and property news" },
  { to: "/pricing", label: "Prices", hint: "What HALISIA costs" },
];

// Tools behind sign-in; only listed once the user is signed in.
const MEMBER_LINKS: NavLink[] = [
  { to: "/sell/new", label: "Sell land", hint: "List a plot for sale" },
  { to: "/seller-tools", label: "Seller tools", hint: "Manage your listings" },
  { to: "/rentals", label: "Rentals", hint: "Homes to rent" },
  { to: "/financing", label: "Get financing", hint: "Loans for land and building" },
  { to: "/pros", label: "Professionals", hint: "Work with experts" },
  { to: "/contributions", label: "Contributions", hint: "What you have added" },
  { to: "/admin", label: "Admin", hint: "Administrators only" },
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
                <Fragment key={l.to}>
                  {l.group ? <DropdownMenuLabel>{l.group}</DropdownMenuLabel> : null}
                  <DropdownMenuItem asChild>
                    <Link to={l.to} className="flex flex-col items-start gap-0">
                      <span>{l.label}</span>
                      {l.hint ? (
                        <span className="text-[11px] text-muted-foreground">{l.hint}</span>
                      ) : null}
                    </Link>
                  </DropdownMenuItem>
                </Fragment>
              ))}
              {!loading && user ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Your tools</DropdownMenuLabel>
                  {MEMBER_LINKS.map((l) => (
                    <DropdownMenuItem key={l.to} asChild>
                      <Link to={l.to} className="flex flex-col items-start gap-0">
                        <span>{l.label}</span>
                        {l.hint ? (
                          <span className="text-[11px] text-muted-foreground">{l.hint}</span>
                        ) : null}
                      </Link>
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
                to="/projects"
                search={{}}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 text-xs hover:bg-white/10"
              >
                <FolderKanban className="h-3.5 w-3.5 text-accent" aria-hidden="true" /> Projects
              </Link>
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
                idx === LINKS.length + MORE_LINKS.length
                  ? "Your tools"
                  : idx >= LINKS.length
                    ? (l.group ?? null)
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
                    <span className="flex min-w-0 flex-col">
                      <span>{l.label}</span>
                      {l.hint ? (
                        <span className="text-[12px] text-muted-foreground">{l.hint}</span>
                      ) : null}
                    </span>
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
                    to="/projects"
                    search={{}}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-[15px] text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  >
                    <FolderKanban className="h-4 w-4 text-accent" aria-hidden="true" /> My projects
                  </Link>
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
