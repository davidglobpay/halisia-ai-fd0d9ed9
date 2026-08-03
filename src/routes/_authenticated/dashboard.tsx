import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Briefcase, Landmark, BarChart3, KeyRound, UserCog } from "lucide-react";
import { listMyRoles, ROLE_LABELS, type AppRole } from "@/lib/roles";
import {
  BuyerDashboard,
  ContributorSummary,
  GeneralDashboard,
  LandlordDashboard,
  ProfessionalSummary,
  SellerDashboard,
} from "@/components/halisia/dashboard-views";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My dashboard · HALISIA AI" },
      {
        name: "description",
        content: "Manage your listings, leads and saved property intelligence.",
      },
      { property: "og:title", content: "My dashboard · HALISIA AI" },
      {
        property: "og:description",
        content:
          "A dashboard shaped by your roles: buyer, seller, landlord, contributor or professional.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

type ViewKey = "general" | "buyer" | "seller" | "landlord" | "contributor" | "professional";

const VIEW_ROLES: Record<Exclude<ViewKey, "general">, AppRole[]> = {
  buyer: ["buyer", "tenant", "investor"],
  seller: ["seller", "landowner", "land_agent", "property_company", "developer"],
  landlord: ["landlord", "property_company"],
  contributor: ["contributor"],
  professional: [
    "architect",
    "engineer",
    "surveyor",
    "valuer",
    "contractor",
    "lawyer",
    "land_agent",
    "financial_institution",
  ],
};

const VIEW_LABELS: Record<ViewKey, string> = {
  general: "General",
  buyer: "Buyer",
  seller: "Seller",
  landlord: "Landlord",
  contributor: "Contributor",
  professional: "Professional",
};

function Dashboard() {
  const roles = useQuery({ queryKey: ["my-roles"], queryFn: listMyRoles });
  const mine = useMemo(() => new Set(roles.data ?? []), [roles.data]);

  const views = useMemo<ViewKey[]>(() => {
    const keys: ViewKey[] = ["general"];
    (Object.keys(VIEW_ROLES) as Array<Exclude<ViewKey, "general">>).forEach((k) => {
      if (VIEW_ROLES[k].some((r) => mine.has(r))) keys.push(k);
    });
    return keys;
  }, [mine]);

  const [view, setView] = useState<ViewKey>("general");
  const activeView = views.includes(view) ? view : "general";

  return (
    <main className="min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-6xl mx-auto">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-accent">Halisia AI</div>
          <h1 className="text-3xl font-display font-semibold mt-1">My dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Shaped by the roles on your account.</p>
          {(roles.data ?? []).length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {(roles.data ?? []).map((r) => (
                <li
                  key={r}
                  className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground"
                >
                  {ROLE_LABELS[r]}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/account"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs hover:bg-white/10"
          >
            <UserCog className="h-3.5 w-3.5" aria-hidden="true" /> Account &amp; roles
          </Link>
          <Link
            to="/sell/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-medium text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> New listing
          </Link>
        </div>
      </header>

      <nav
        className="mb-6 flex flex-wrap gap-1.5"
        aria-label="Dashboard views"
        data-testid="dashboard-views"
      >
        {views.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            aria-current={activeView === v ? "page" : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-xs transition ${
              activeView === v
                ? "border-accent/50 bg-accent/15 text-accent"
                : "border-white/12 text-muted-foreground hover:bg-white/5"
            }`}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
        {views.length === 1 && (
          <Link to="/account" className="self-center text-[11px] text-accent hover:underline">
            Add roles to unlock more views →
          </Link>
        )}
      </nav>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Link
          to="/connections"
          className="glass rounded-2xl border border-white/10 p-4 hover:bg-white/5 transition flex items-center gap-3"
        >
          <Briefcase className="h-5 w-5 text-accent" />
          <div className="min-w-0">
            <div className="text-sm font-medium">Halisia Connections</div>
            <div className="text-[11px] text-muted-foreground">
              Find architects, engineers, surveyors, lawyers and contractors — matched to your
              project.
            </div>
          </div>
        </Link>
        <Link
          to="/financing"
          className="glass rounded-2xl border border-white/10 p-4 hover:bg-white/5 transition flex items-center gap-3"
        >
          <Landmark className="h-5 w-5 text-emerald-glow" />
          <div className="min-w-0">
            <div className="text-sm font-medium">Financing tracker</div>
            <div className="text-[11px] text-muted-foreground">
              Manage loan applications with lender-ready AI summaries.
            </div>
          </div>
        </Link>
        <Link
          to="/seller-tools"
          className="glass rounded-2xl border border-white/10 p-4 hover:bg-white/5 transition flex items-center gap-3"
        >
          <BarChart3 className="h-5 w-5 text-gold" />
          <div className="min-w-0">
            <div className="text-sm font-medium">Seller tools</div>
            <div className="text-[11px] text-muted-foreground">
              Lead quality, views, saves, inquiry trends and suggested follow-ups.
            </div>
          </div>
        </Link>
        <Link
          to="/rentals"
          className="glass rounded-2xl border border-white/10 p-4 hover:bg-white/5 transition flex items-center gap-3"
        >
          <KeyRound className="h-5 w-5 text-accent" />
          <div className="min-w-0">
            <div className="text-sm font-medium">Rentals & renter match</div>
            <div className="text-[11px] text-muted-foreground">
              Vacancy details plus consent-based matches you control.
            </div>
          </div>
        </Link>
      </section>

      {activeView === "general" && <GeneralDashboard />}
      {activeView === "buyer" && <BuyerDashboard />}
      {activeView === "seller" && <SellerDashboard />}
      {activeView === "landlord" && <LandlordDashboard />}
      {activeView === "contributor" && <ContributorSummary />}
      {activeView === "professional" && <ProfessionalSummary />}
    </main>
  );
}
