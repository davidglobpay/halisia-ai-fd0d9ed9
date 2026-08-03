import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Bookmark,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Eye,
  FileText,
  GitCompare,
  Heart,
  KeyRound,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { listMyProperties, listMyLeadsAsSeller, formatPrice } from "@/lib/properties";
import { listSavedItems } from "@/lib/saved-items";
import { listMyContributions, summariseReputation } from "@/lib/contributions";
import { listRequestsForMe, listMyProProfiles, PRO_CATEGORY_LABELS } from "@/lib/professionals";

export function Panel({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="glass rounded-2xl border border-white/10 p-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          {icon} {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] text-muted-foreground">{children}</p>;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-display font-semibold">{value}</div>
    </div>
  );
}

/** Saved searches, locations, listings, comparisons, reports, alerts, activity. */
export function GeneralDashboard() {
  const saved = useQuery({ queryKey: ["saved-items"], queryFn: listSavedItems });
  const items = saved.data ?? [];
  const locations = items.filter((i) => i.kind === "location" || i.kind === "county");
  const listings = items.filter((i) => i.kind === "property");
  const favourites = items.filter((i) => i.is_favorite);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Panel
        title="Saved locations"
        icon={<Bookmark className="h-3 w-3" aria-hidden="true" />}
        action={
          <Link to="/saved" className="text-[11px] text-accent hover:underline">
            Open saved →
          </Link>
        }
      >
        {locations.length === 0 ? (
          <Empty>
            Save a location from{" "}
            <Link to="/explore" className="text-accent hover:underline">
              Explore
            </Link>{" "}
            to track it here.
          </Empty>
        ) : (
          <ul className="grid gap-1.5">
            {locations.slice(0, 5).map((i) => (
              <li key={i.id} className="truncate text-[12px]">
                {i.label}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Saved listings" icon={<Heart className="h-3 w-3" aria-hidden="true" />}>
        {listings.length === 0 ? (
          <Empty>
            Nothing saved from the{" "}
            <Link to="/marketplace" search={{}} className="text-accent hover:underline">
              marketplace
            </Link>{" "}
            yet.
          </Empty>
        ) : (
          <ul className="grid gap-1.5">
            {listings.slice(0, 5).map((i) => (
              <li key={i.id} className="truncate text-[12px]">
                {i.label}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Comparisons"
        icon={<GitCompare className="h-3 w-3" aria-hidden="true" />}
        action={
          <Link to="/compare-locations" className="text-[11px] text-accent hover:underline">
            Compare →
          </Link>
        }
      >
        <Empty>Put two locations side by side on scores, climate, terrain and amenities.</Empty>
      </Panel>

      <Panel
        title="Reports"
        icon={<FileText className="h-3 w-3" aria-hidden="true" />}
        action={
          <Link to="/report" className="text-[11px] text-accent hover:underline">
            Reports →
          </Link>
        }
      >
        <Empty>Generate and share PDF intelligence dossiers for any parcel.</Empty>
      </Panel>

      <Panel title="Recommendations" icon={<Sparkles className="h-3 w-3" aria-hidden="true" />}>
        {favourites.length === 0 ? (
          <Empty>
            Favourite a few places and Halisia will surface similar counties and listings.
          </Empty>
        ) : (
          <Empty>
            Based on {favourites.length} favourite{favourites.length === 1 ? "" : "s"}, check the
            rentals and marketplace rails tuned to those areas.
          </Empty>
        )}
      </Panel>

      <Panel
        title="News preferences & alerts"
        icon={<Bell className="h-3 w-3" aria-hidden="true" />}
        action={
          <Link to="/account" className="text-[11px] text-accent hover:underline">
            Manage →
          </Link>
        }
      >
        <Empty>Choose topics and whether alerts reach you by email, in-app, or both.</Empty>
      </Panel>

      <Panel title="Recent activity" icon={<TrendingUp className="h-3 w-3" aria-hidden="true" />}>
        {items.length === 0 ? (
          <Empty>No activity recorded yet.</Empty>
        ) : (
          <ul className="grid gap-1.5">
            {items.slice(0, 5).map((i) => (
              <li key={i.id} className="truncate text-[12px] text-muted-foreground">
                Saved <span className="text-foreground">{i.label}</span> ·{" "}
                {new Date(i.created_at).toLocaleDateString()}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export function SellerDashboard() {
  const listings = useQuery({ queryKey: ["my-properties"], queryFn: listMyProperties });
  const leads = useQuery({ queryKey: ["my-leads-seller"], queryFn: listMyLeadsAsSeller });
  const rows = (listings.data ?? []).filter((p) => p.intent === "sale");
  const myLeads = leads.data ?? [];
  const views = rows.reduce((s, p) => s + p.view_count, 0);
  const quality = rows.length
    ? Math.round(rows.reduce((s, p) => s + (p.completeness_pct ?? 0), 0) / rows.length)
    : 0;

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric
          label="Active listings"
          value={rows.filter((p) => p.status === "published").length}
        />
        <Metric label="Total views" value={views} />
        <Metric label="Leads" value={myLeads.length} />
        <Metric label="Listing quality" value={`${quality}%`} />
      </div>

      <Panel
        title="Active listings"
        icon={<Building2 className="h-3 w-3" aria-hidden="true" />}
        action={
          <Link to="/sell/new" className="text-[11px] text-accent hover:underline">
            New listing →
          </Link>
        }
      >
        {rows.length === 0 ? (
          <Empty>You have no sale listings yet.</Empty>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {rows.map((p) => (
              <li key={p.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <Link to="/marketplace/$id" params={{ id: p.id }} className="block">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{p.title}</span>
                    <span className="shrink-0 text-sm font-semibold">{formatPrice(p)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3 w-3" aria-hidden="true" /> {p.view_count} views
                    </span>
                    <span>{p.completeness_pct ?? 0}% complete</span>
                    <span>{p.status}</span>
                  </div>
                </Link>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Link
                    to="/sell/edit/$id"
                    params={{ id: p.id }}
                    className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] hover:text-accent"
                  >
                    Edit
                  </Link>
                  <Link
                    to="/develop/$id"
                    params={{ id: p.id }}
                    className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] text-accent"
                  >
                    Development &amp; finance
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Inquiries & contact requests"
        icon={<MessageSquare className="h-3 w-3" aria-hidden="true" />}
        action={
          <Link to="/seller-tools" className="text-[11px] text-accent hover:underline">
            Performance trends →
          </Link>
        }
      >
        {myLeads.length === 0 ? (
          <Empty>No inquiries yet.</Empty>
        ) : (
          <ul className="grid gap-2">
            {myLeads.slice(0, 6).map((l) => (
              <li key={l.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(l.created_at).toLocaleString()}
                  </span>
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-widest">
                    {l.stage}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[12px]">{l.message ?? "New enquiry"}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="AI recommendations" icon={<Sparkles className="h-3 w-3" aria-hidden="true" />}>
        <ul className="grid gap-1.5 text-[12px] text-muted-foreground">
          {quality < 80 && (
            <li>
              Listing quality is {quality}% — add photos, utilities and a pin to lift search
              ranking.
            </li>
          )}
          {myLeads.length > 0 && <li>Respond to new leads within 24 hours to keep them warm.</li>}
          {rows.length === 0 && (
            <li>Publish your first sale listing to start collecting demand data.</li>
          )}
          {quality >= 80 && rows.length > 0 && (
            <li>
              Listings are well completed — consider a price sensitivity check in Seller tools.
            </li>
          )}
        </ul>
      </Panel>
    </div>
  );
}

export function LandlordDashboard() {
  const listings = useQuery({ queryKey: ["my-properties"], queryFn: listMyProperties });
  const rentals = (listings.data ?? []).filter((p) => p.intent === "rent" || p.intent === "lease");
  const vacant = rentals.filter((p) => p.status === "published");

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Rental listings" value={rentals.length} />
        <Metric label="Currently vacant" value={vacant.length} />
        <Metric label="Occupied / off-market" value={rentals.length - vacant.length} />
      </div>
      <Panel
        title="Rental listings & vacancy"
        icon={<KeyRound className="h-3 w-3" aria-hidden="true" />}
        action={
          <Link to="/rentals" className="text-[11px] text-accent hover:underline">
            Rentals workspace →
          </Link>
        }
      >
        {rentals.length === 0 ? (
          <Empty>No rental listings yet — add one from the listing wizard.</Empty>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {rentals.map((p) => (
              <li key={p.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="truncate text-sm font-medium">{p.title}</div>
                <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                  <span>{p.status === "published" ? "Vacant" : p.status}</span>
                  <span>{p.county ?? "Kenya"}</span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" aria-hidden="true" /> {p.view_count}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel
        title="Viewing requests"
        icon={<CalendarClock className="h-3 w-3" aria-hidden="true" />}
        action={
          <Link to="/rentals" className="text-[11px] text-accent hover:underline">
            Availability calendar →
          </Link>
        }
      >
        <Empty>Propose viewing windows and confirm renter requests in the rentals workspace.</Empty>
      </Panel>
      <Panel title="Rental demand" icon={<TrendingUp className="h-3 w-3" aria-hidden="true" />}>
        <Empty>
          Demand signals combine views, saves and renter-match interest across your counties.
        </Empty>
      </Panel>
    </div>
  );
}

export function BuyerDashboard() {
  const saved = useQuery({ queryKey: ["saved-items"], queryFn: listSavedItems });
  const properties = (saved.data ?? []).filter((i) => i.kind === "property");

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Panel
        title="Recommended properties"
        icon={<Sparkles className="h-3 w-3" aria-hidden="true" />}
        action={
          <Link to="/marketplace" search={{}} className="text-[11px] text-accent hover:underline">
            Browse →
          </Link>
        }
      >
        <Empty>
          Recommendations tighten as you save listings and set preferences in your account.
        </Empty>
      </Panel>
      <Panel title="Saved properties" icon={<Heart className="h-3 w-3" aria-hidden="true" />}>
        {properties.length === 0 ? (
          <Empty>No saved properties yet.</Empty>
        ) : (
          <ul className="grid gap-1.5">
            {properties.slice(0, 6).map((i) => (
              <li key={i.id} className="truncate text-[12px]">
                {i.label}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel
        title="Comparison lists"
        icon={<GitCompare className="h-3 w-3" aria-hidden="true" />}
        action={
          <Link to="/compare" className="text-[11px] text-accent hover:underline">
            Compare →
          </Link>
        }
      >
        <Empty>Line up shortlisted parcels on score, price and risk.</Empty>
      </Panel>
      <Panel
        title="Verification workflows"
        icon={<ClipboardCheck className="h-3 w-3" aria-hidden="true" />}
        action={
          <Link to="/title-deed" className="text-[11px] text-accent hover:underline">
            Title deed check →
          </Link>
        }
      >
        <Empty>
          Run a title deed intelligence check, then engage a lawyer and surveyor from Connections.
        </Empty>
      </Panel>
    </div>
  );
}

export function ContributorSummary() {
  const rows = useQuery({ queryKey: ["my-contributions"], queryFn: listMyContributions });
  const rep = summariseReputation(rows.data ?? []);
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Contributions" value={(rows.data ?? []).length} />
        <Metric label="Accepted" value={rep.accepted} />
        <Metric label="Reputation" value={rep.tier} />
        <Metric label="Reward points" value={rep.points} />
      </div>
      <Panel
        title="Community impact"
        icon={<Users className="h-3 w-3" aria-hidden="true" />}
        action={
          <Link to="/contributions" className="text-[11px] text-accent hover:underline">
            Contributor dashboard →
          </Link>
        }
      >
        <Empty>{rep.impact}</Empty>
      </Panel>
    </div>
  );
}

export function ProfessionalSummary() {
  const profiles = useQuery({ queryKey: ["my-pro-profiles"], queryFn: listMyProProfiles });
  const requests = useQuery({ queryKey: ["pro-requests-mine"], queryFn: listRequestsForMe });
  const mine = profiles.data ?? [];
  const leads = requests.data ?? [];

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Service profiles" value={mine.length} />
        <Metric label="Project requests" value={leads.length} />
        <Metric label="Open leads" value={leads.filter((l) => l.status === "new").length} />
      </div>
      <Panel
        title="Service profile"
        icon={<Building2 className="h-3 w-3" aria-hidden="true" />}
        action={
          <Link to="/pro-profile" className="text-[11px] text-accent hover:underline">
            Manage →
          </Link>
        }
      >
        {mine.length === 0 ? (
          <Empty>
            Create a service profile to appear in Halisia Connections and receive project requests.
          </Empty>
        ) : (
          <ul className="grid gap-1.5 text-[12px]">
            {mine.map((p) => (
              <li key={p.id}>
                {PRO_CATEGORY_LABELS[p.category]} — {p.published ? "published" : "draft"} ·{" "}
                {p.verification_status === "verified" ? "verified" : "self-declared"}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel
        title="Project requests"
        icon={<MessageSquare className="h-3 w-3" aria-hidden="true" />}
        action={
          <Link to="/pros" className="text-[11px] text-accent hover:underline">
            Open bid requests →
          </Link>
        }
      >
        {leads.length === 0 ? (
          <Empty>No project requests yet.</Empty>
        ) : (
          <ul className="grid gap-1.5">
            {leads.slice(0, 5).map((l) => (
              <li key={l.id} className="line-clamp-1 text-[12px]">
                {l.project_brief}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
