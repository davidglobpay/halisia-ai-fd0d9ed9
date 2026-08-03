import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Building2,
  Users,
  TrendingUp,
  Bookmark,
  Briefcase,
  Landmark,
  BarChart3,
  KeyRound,
} from "lucide-react";
import { listMyProperties, listMyLeadsAsSeller, formatPrice } from "@/lib/properties";
import { listSavedItems } from "@/lib/saved-items";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My dashboard · HALISIA AI" },
      {
        name: "description",
        content: "Manage your listings, leads and saved property intelligence.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const listings = useQuery({ queryKey: ["my-properties"], queryFn: listMyProperties });
  const leads = useQuery({ queryKey: ["my-leads-seller"], queryFn: listMyLeadsAsSeller });
  const saved = useQuery({ queryKey: ["saved-items"], queryFn: listSavedItems });

  const myListings = listings.data ?? [];
  const myLeads = leads.data ?? [];
  const mySaved = saved.data ?? [];

  return (
    <main className="min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-6xl mx-auto">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-accent">Halisia AI</div>
          <h1 className="text-3xl font-display font-semibold mt-1">My dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your listings, leads and saved intelligence in one place.
          </p>
        </div>
        <Link
          to="/sell/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-medium text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> New listing
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Link
          to="/_authenticated/pros"
          className="glass rounded-2xl border border-white/10 p-4 hover:bg-white/5 transition flex items-center gap-3"
        >
          <Briefcase className="h-5 w-5 text-accent" />
          <div className="min-w-0">
            <div className="text-sm font-medium">Pro network & bids</div>
            <div className="text-[11px] text-muted-foreground">
              Post work, review proposals from construction, architecture & surveying pros.
            </div>
          </div>
        </Link>
        <Link
          to="/_authenticated/financing"
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

      <section className="grid gap-4 sm:grid-cols-3 mb-8">
        <Stat
          icon={<Building2 className="h-4 w-4" />}
          label="Active listings"
          value={myListings.length}
        />
        <Stat icon={<Users className="h-4 w-4" />} label="Leads received" value={myLeads.length} />
        <Stat
          icon={<Bookmark className="h-4 w-4" />}
          label="Saved intelligence"
          value={mySaved.length}
        />
      </section>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground">My listings</h2>
          <Link to="/marketplace" search={{}} className="text-xs text-accent hover:underline">
            View marketplace →
          </Link>
        </div>
        {myListings.length === 0 ? (
          <div className="glass rounded-2xl border border-white/10 p-6 text-sm text-muted-foreground">
            You haven't listed a property yet.{" "}
            <Link to="/sell/new" className="text-accent hover:underline">
              Create your first listing
            </Link>
            .
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {myListings.map((p) => (
              <li key={p.id} className="glass rounded-2xl border border-white/10 p-4">
                <Link to="/marketplace/$id" params={{ id: p.id }} className="block">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{p.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {p.county ?? "Kenya"} · {p.kind} · {p.status}
                      </div>
                    </div>
                    <div className="text-sm font-semibold shrink-0">{formatPrice(p)}</div>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> {p.view_count} views
                    </span>
                  </div>
                </Link>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Link
                    to="/sell/edit/$id"
                    params={{ id: p.id }}
                    className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] hover:text-accent"
                  >
                    Edit &amp; resubmit
                  </Link>
                  <Link
                    to="/develop/$id"
                    params={{ id: p.id }}
                    className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] text-accent"
                  >
                    Development &amp; finance readiness
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-widest text-muted-foreground mb-3">
          Recent leads
        </h2>
        {myLeads.length === 0 ? (
          <div className="glass rounded-2xl border border-white/10 p-6 text-sm text-muted-foreground">
            No leads yet — buyers who message you from a listing will appear here.
          </div>
        ) : (
          <ul className="grid gap-3">
            {myLeads.map((l) => (
              <li key={l.id} className="glass rounded-2xl border border-white/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleString()}
                    </div>
                    <p className="text-sm mt-1 line-clamp-2">{l.message ?? "New enquiry"}</p>
                    {l.contact_email && (
                      <div className="text-[11px] text-accent mt-1">{l.contact_email}</div>
                    )}
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-widest">
                    {l.stage}
                  </span>
                </div>
                <div className="mt-2">
                  <Link
                    to="/marketplace/$id"
                    params={{ id: l.property_id }}
                    className="text-xs text-accent hover:underline"
                  >
                    View listing →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="glass rounded-2xl border border-white/10 p-4">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        {icon} {label}
      </div>
      <div className="mt-2 text-3xl font-display font-semibold">{value}</div>
    </div>
  );
}
