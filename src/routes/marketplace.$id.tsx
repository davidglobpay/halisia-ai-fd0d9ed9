import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, ArrowLeft, Building2, Loader2, Send, CheckCircle2 } from "lucide-react";
import { getProperty, createLead, formatPrice } from "@/lib/properties";
import { LandIntelligenceScore } from "@/components/halisia/land-intelligence-score";
import { SaveButton } from "@/components/halisia/save-button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/marketplace/$id")({
  loader: async ({ params }) => {
    const p = await getProperty(params.id);
    if (!p) throw notFound();
    return { property: p };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.property;
    const title = p ? `${p.title} · HALISIA AI` : "Listing · HALISIA AI";
    const desc = p?.description?.slice(0, 155) ?? "AI-scored real estate listing in Kenya.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(p?.cover_image
          ? [
              { property: "og:image", content: p.cover_image },
              { name: "twitter:image", content: p.cover_image },
            ]
          : []),
      ],
    };
  },
  component: ListingDetail,
  errorComponent: () => (
    <main className="min-h-dvh grid place-items-center px-4">
      <div className="glass rounded-2xl border border-white/10 p-6 text-center">
        <p className="text-sm">Couldn't load this listing.</p>
        <Link to="/marketplace" search={{}} className="mt-3 inline-block text-xs text-accent">
          ← Back to marketplace
        </Link>
      </div>
    </main>
  ),
  notFoundComponent: () => (
    <main className="min-h-dvh grid place-items-center px-4">
      <div className="glass rounded-2xl border border-white/10 p-6 text-center">
        <p className="text-sm">Listing not found.</p>
        <Link to="/marketplace" search={{}} className="mt-3 inline-block text-xs text-accent">
          ← Back to marketplace
        </Link>
      </div>
    </main>
  ),
});

function ListingDetail() {
  const { property } = Route.useLoaderData();
  const { data: p } = useQuery({
    queryKey: ["property", property.id],
    queryFn: () => getProperty(property.id),
    initialData: property,
  });
  if (!p) return null;

  return (
    <main className="min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-6xl mx-auto">
      <Link
        to="/marketplace"
        search={{}}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to marketplace
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <div className="rounded-2xl overflow-hidden border border-white/10 aspect-[16/10] bg-gradient-to-br from-primary/30 via-accent/10 to-emerald-500/20 relative">
            {p.cover_image ? (
              <img src={p.cover_image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-muted-foreground/60">
                <Building2 className="h-14 w-14" />
              </div>
            )}
          </div>

          <header className="mt-5">
            <div className="text-[11px] uppercase tracking-widest text-accent">
              {p.kind.replace("_", " ")} · {p.intent}
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-display font-semibold">{p.title}</h1>
            <div className="mt-1 text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {p.address ?? p.county ?? "Kenya"}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div className="text-xl font-semibold">{formatPrice(p)}</div>
              {p.size_value != null && (
                <div className="text-xs text-muted-foreground">
                  {p.size_value} {p.size_unit}
                </div>
              )}
              {p.bedrooms != null && (
                <div className="text-xs text-muted-foreground">{p.bedrooms} bed</div>
              )}
              {p.bathrooms != null && (
                <div className="text-xs text-muted-foreground">{p.bathrooms} bath</div>
              )}
              <SaveButton
                kind="location"
                ref_={`property:${p.id}`}
                label={p.title}
                latitude={p.latitude}
                longitude={p.longitude}
              />
            </div>
          </header>

          {p.description && (
            <section className="mt-6 glass rounded-2xl border border-white/10 p-5">
              <h2 className="text-sm font-semibold mb-2">About this property</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                {p.description}
              </p>
            </section>
          )}

          {(p.amenities?.length ?? 0) > 0 && (
            <section className="mt-4 glass rounded-2xl border border-white/10 p-5">
              <h2 className="text-sm font-semibold mb-3">Amenities</h2>
              <ul className="flex flex-wrap gap-2">
                {p.amenities.map((a: string) => (
                  <li
                    key={a}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs"
                  >
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-6">
            <LandIntelligenceScore
              address={p.address ?? p.title}
              lat={p.latitude ?? undefined}
              lng={p.longitude ?? undefined}
            />
          </div>
        </section>

        <aside className="lg:sticky lg:top-24 self-start">
          <ContactSeller propertyId={p.id} sellerId={p.owner_id} />
        </aside>
      </div>
    </main>
  );
}

function ContactSeller({ propertyId, sellerId }: { propertyId: string; sellerId: string }) {
  const { user } = useAuth();
  const [message, setMessage] = useState("Hi, I'd like more details and to schedule a viewing.");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const m = useMutation({
    mutationFn: () =>
      createLead({
        property_id: propertyId,
        seller_id: sellerId,
        message,
        contact_email: user?.email ?? undefined,
        contact_phone: phone || undefined,
      }),
    onSuccess: () => setSent(true),
  });

  if (!user) {
    return (
      <div className="glass rounded-2xl border border-white/10 p-5">
        <h2 className="text-sm font-semibold">Contact seller</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Sign in to message the seller and request a viewing.
        </p>
        <Link
          to="/auth"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-xs font-medium"
        >
          Sign in to continue
        </Link>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="glass rounded-2xl border border-white/10 p-5">
        <div className="flex items-center gap-2 text-emerald-glow">
          <CheckCircle2 className="h-5 w-5" />
          <h2 className="text-sm font-semibold">Enquiry sent</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          The seller will see your enquiry in their dashboard. You can track it there too.
        </p>
        <Link
          to="/dashboard"
          className="mt-3 inline-block text-xs text-accent hover:underline"
        >
          Go to my dashboard →
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate();
      }}
      className="glass rounded-2xl border border-white/10 p-5"
    >
      <h2 className="text-sm font-semibold">Contact seller</h2>
      <p className="text-[11px] text-muted-foreground mt-0.5">
        Powered by HALISIA AI Lead Management
      </p>
      <label className="block mt-3 text-xs text-muted-foreground">
        Message
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={1000}
          required
          className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>
      <label className="block mt-3 text-xs text-muted-foreground">
        Phone (optional)
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={32}
          className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>
      {m.isError && (
        <div role="alert" className="mt-2 text-xs text-red-300">
          Couldn't send. Please try again.
        </div>
      )}
      <button
        type="submit"
        disabled={m.isPending}
        className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-4 py-2 text-xs font-medium w-full disabled:opacity-60"
      >
        {m.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
        Send enquiry
      </button>
    </form>
  );
}