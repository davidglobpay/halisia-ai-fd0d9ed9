import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  MapPin,
  ArrowLeft,
  Building2,
  Loader2,
  Send,
  CheckCircle2,
  FileDown,
  FileText,
  Sparkles,
  Copy,
  Info,
  Eye,
  EyeOff,
  Globe,
  Lock,
} from "lucide-react";
import { getProperty, createLead, formatPrice, updateProperty } from "@/lib/properties";
import { LandIntelligenceScore } from "@/components/halisia/land-intelligence-score";
import { SaveButton } from "@/components/halisia/save-button";
import { useAuth } from "@/hooks/use-auth";
import type { ListingAiOutput } from "@/lib/ai-listing.functions";
import {
  downloadBrochure,
  downloadBrochurePDF,
  downloadBrochureDOCX,
  formatPriceEstimate,
} from "@/lib/listing-brochure";
import { ListingEditor, type ListingAiWithMeta } from "@/components/halisia/listing-editor";
import { ListingServices } from "@/components/halisia/listing-services";
import { PassportLinks } from "@/components/halisia/land-passport/passport-links";

export const Route = createFileRoute("/marketplace/$id")({
  validateSearch: (s: Record<string, unknown>): { preview?: "1" } =>
    s.preview === "1" || s.preview === 1 ? { preview: "1" } : {},
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
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: p } = useQuery({
    queryKey: ["property", property.id],
    queryFn: () => getProperty(property.id),
    initialData: property,
  });
  const { user } = useAuth();
  const togglePublish = useMutation({
    mutationFn: async () => {
      const next = p!.status === "published" ? "draft" : "published";
      return updateProperty(p!.id, { status: next });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["property", property.id] }),
  });
  if (!p) return null;
  const ai = (p.ai_summary ?? null) as ListingAiWithMeta | null;
  const isRealOwner = !!user && user.id === p.owner_id;
  const previewing = search.preview === "1";
  const isOwner = isRealOwner && !previewing;

  return (
    <main className="min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-6xl mx-auto">
      <Link
        to="/marketplace"
        search={{}}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to marketplace
      </Link>

      {isRealOwner && (
        <div
          data-testid="owner-bar"
          className="mb-4 glass rounded-2xl border border-white/10 p-3 flex flex-wrap items-center gap-2 text-xs"
        >
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 border ${
              p.status === "published"
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-glow"
                : "border-amber-400/30 bg-amber-500/10 text-amber-glow"
            }`}
          >
            {p.status === "published" ? (
              <Globe className="h-3 w-3" />
            ) : (
              <Lock className="h-3 w-3" />
            )}
            {p.status === "published" ? "Published" : "Draft"}
          </span>
          <span className="text-muted-foreground">
            {p.status === "published"
              ? "Visible on the public marketplace."
              : "Only you can see this listing."}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                navigate({
                  to: "/marketplace/$id",
                  params: { id: p.id },
                  search: previewing ? {} : { preview: "1" },
                })
              }
              data-testid="toggle-preview"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5"
            >
              {previewing ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {previewing ? "Exit preview" : "Preview as visitor"}
            </button>
            <button
              type="button"
              disabled={togglePublish.isPending}
              onClick={() => togglePublish.mutate()}
              data-testid="toggle-publish"
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-3 py-1.5 font-medium disabled:opacity-60"
            >
              {togglePublish.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : p.status === "published" ? (
                <Lock className="h-3.5 w-3.5" />
              ) : (
                <Globe className="h-3.5 w-3.5" />
              )}
              {p.status === "published" ? "Unpublish" : "Publish now"}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <div className="rounded-2xl overflow-hidden border border-white/10 aspect-[16/10] bg-gradient-to-br from-primary/30 via-accent/10 to-emerald-500/20 relative">
            {p.cover_image ? (
              <img
                src={p.cover_image}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
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

          {ai && <AiListingBrief p={p} ai={ai} />}
          {ai && isOwner && <ListingEditor property={p} ai={ai} />}
          {ai && ai.concepts.length > 0 && <ConceptStudio ai={ai} />}

          <ListingServices property={p} />

          <div className="mt-6">
            <div className="mb-3">
              <div className="text-[11px] uppercase tracking-widest text-accent">
                AI Intelligence Breakdown
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Every module below shows its score, data sources, last-updated time and a
                recommendation. Expand any card for possible limitations.
              </p>
            </div>
            {p.latitude != null && p.longitude != null ? (
              <PassportLinks
                className="mb-3"
                target={{
                  lat: Number(p.latitude),
                  lng: Number(p.longitude),
                  ref: p.title,
                  label: p.address ?? p.title,
                  source: "Seller-provided listing location",
                  status: "user_provided",
                  county: p.county ?? "",
                }}
              />
            ) : (
              <p className="mb-3 text-[11px] text-muted-foreground">
                Land Passport unavailable: the seller has not added coordinates.
              </p>
            )}
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

function AiListingBrief({
  p,
  ai,
}: {
  p: import("@/lib/properties").PropertyRow;
  ai: ListingAiOutput;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <section
      data-testid="ai-listing-brief"
      className="mt-6 glass rounded-2xl border border-white/10 p-5"
    >
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-accent inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> AI Listing Assistant
          </div>
          <h2 className="text-lg font-display font-semibold mt-1">{ai.polishedTitle}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{ai.headline}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] tabular-nums"
            title="Overall AI confidence"
          >
            Confidence {ai.confidencePct}%
          </span>
          <button
            type="button"
            onClick={() => downloadBrochure(p, ai)}
            data-testid="download-brochure"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1.5 text-xs"
          >
            <FileDown className="h-3.5 w-3.5" /> Brochure (.txt)
          </button>
          <button
            type="button"
            onClick={() => downloadBrochurePDF(p, ai)}
            data-testid="download-brochure-pdf"
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-3 py-1.5 text-xs"
          >
            <FileText className="h-3.5 w-3.5" /> Brochure (PDF)
          </button>
          <button
            type="button"
            onClick={() => downloadBrochureDOCX(p, ai)}
            data-testid="download-brochure-docx"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1.5 text-xs"
          >
            <FileDown className="h-3.5 w-3.5" /> Brochure (DOCX)
          </button>
        </div>
      </header>

      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{ai.aiSummary}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
            Marketing highlights
          </h3>
          <ul className="space-y-1.5">
            {ai.marketingHighlights.map((h) => (
              <li key={h} className="text-sm flex gap-2">
                <span className="text-accent">•</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
            Estimated price band
          </h3>
          <div className="text-lg font-semibold">{formatPriceEstimate(ai)}</div>
          <p className="text-[11px] text-muted-foreground mt-1">{ai.priceEstimate.note}</p>
          <div className="mt-3">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
              SEO description
            </h3>
            <p className="text-xs text-muted-foreground">{ai.seoDescription}</p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
          Social captions
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["twitter", "Twitter / X"],
              ["facebook", "Facebook"],
              ["whatsapp", "WhatsApp"],
              ["instagram", "Instagram"],
            ] as const
          ).map(([k, label]) => (
            <div key={k} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-muted-foreground">{label}</span>
                <button
                  type="button"
                  onClick={() => copy(k, ai.socialCaptions[k])}
                  className="inline-flex items-center gap-1 text-[10px] text-accent hover:underline"
                >
                  <Copy className="h-3 w-3" />
                  {copied === k ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="whitespace-pre-line text-muted-foreground">{ai.socialCaptions[k]}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/5 p-3 text-[11px] text-amber-glow">
        <div className="flex items-center gap-1.5 font-medium mb-1">
          <Info className="h-3 w-3" /> Disclaimers
        </div>
        <ul className="space-y-1">
          {ai.disclaimers.map((d) => (
            <li key={d}>• {d}</li>
          ))}
        </ul>
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground">
        Generated {new Date(ai.generatedAt).toLocaleString()}
      </p>
    </section>
  );
}

function ConceptStudio({ ai }: { ai: ListingAiOutput }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selected = ai.concepts[selectedIdx] ?? ai.concepts[0];
  const zones = useMemo(
    () => deriveZones(selected?.name ?? "", selected?.siteLayout ?? ""),
    [selected],
  );
  return (
    <section
      data-testid="concept-studio"
      className="mt-6 glass rounded-2xl border border-white/10 p-5"
    >
      <header>
        <div className="text-[11px] uppercase tracking-widest text-accent inline-flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> Architectural Concept Studio
        </div>
        <h2 className="text-lg font-display font-semibold mt-1">Conceptual development options</h2>
        <p className="text-xs text-muted-foreground mt-1">
          AI-generated concepts to spark planning conversations —{" "}
          <span className="text-amber-glow">conceptual only, not architectural approvals.</span>
        </p>
      </header>
      <div className="mt-4 grid gap-3 sm:grid-cols-3" role="tablist" aria-label="Concept options">
        {ai.concepts.map((c, i) => {
          const on = i === selectedIdx;
          return (
            <button
              type="button"
              key={c.name}
              role="tab"
              aria-selected={on}
              data-testid={`concept-card-${i}`}
              onClick={() => setSelectedIdx(i)}
              className={`text-left rounded-2xl border p-4 transition ${
                on
                  ? "border-accent bg-accent/10 shadow-[0_0_0_1px_rgba(0,194,232,0.35)]"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{c.name}</h3>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] tabular-nums">
                  {c.confidencePct}%
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{c.description}</p>
              <div className="mt-2 text-[10px] uppercase tracking-widest text-amber-glow">
                Conceptual only
              </div>
            </button>
          );
        })}
      </div>
      {selected && (
        <div
          data-testid="concept-preview"
          className="mt-4 grid gap-4 sm:grid-cols-[220px_1fr] rounded-2xl border border-white/10 bg-white/[0.03] p-4"
        >
          <div>
            <ConceptSchematic zones={zones} />
            <div className="mt-2 text-[10px] uppercase tracking-widest text-amber-glow text-center">
              Illustrative schematic · conceptual only
            </div>
          </div>
          <div className="text-sm">
            <div className="text-[11px] uppercase tracking-widest text-accent">
              Selected concept
            </div>
            <h3 className="mt-1 font-display text-lg font-semibold">{selected.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{selected.description}</p>
            <div className="mt-3 text-xs">
              <span className="text-muted-foreground">Best for: </span>
              {selected.useCase}
            </div>
            <div className="mt-2 text-xs">
              <span className="text-muted-foreground">Site layout: </span>
              {selected.siteLayout}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {zones.map((z) => (
                <span
                  key={z.key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: z.color }}
                    aria-hidden
                  />
                  {z.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

type Zone = {
  key: string;
  label: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

function deriveZones(name: string, layout: string): Zone[] {
  const t = `${name} ${layout}`.toLowerCase();
  const zones: Zone[] = [];
  const push = (
    key: string,
    label: string,
    color: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => zones.push({ key, label, color, x, y, w, h });
  // Always: parcel boundary implicit; road on south
  if (/cottage|homestead|bungalow|house|villa/.test(t)) {
    push("house", "Main house", "#00c2e8", 20, 25, 60, 38);
    push("garden", "Garden / lawn", "#3fbf7f", 20, 70, 60, 22);
    push("drive", "Driveway", "#8a95a8", 82, 25, 14, 60);
  } else if (/court|rental|studio|units|apartment/.test(t)) {
    push("u1", "Unit A", "#00c2e8", 15, 20, 30, 25);
    push("u2", "Unit B", "#00c2e8", 55, 20, 30, 25);
    push("u3", "Unit C", "#00c2e8", 15, 55, 30, 25);
    push("u4", "Unit D", "#00c2e8", 55, 55, 30, 25);
    push("court", "Courtyard", "#d4a017", 45, 43, 10, 14);
  } else if (/agri|farm|orchard|greenhouse|horticulture/.test(t)) {
    push("crop", "Crop plots", "#3fbf7f", 12, 20, 55, 55);
    push("green", "Greenhouse", "#00c2e8", 72, 20, 18, 30);
    push("cottage", "Cottage", "#d4a017", 72, 55, 18, 20);
  } else if (/commercial|retail|office|mixed/.test(t)) {
    push("block", "Commercial block", "#00c2e8", 20, 20, 60, 45);
    push("park", "Parking", "#8a95a8", 20, 70, 60, 20);
  } else {
    push("build", "Structure", "#00c2e8", 25, 25, 50, 40);
    push("open", "Open space", "#3fbf7f", 25, 70, 50, 20);
  }
  push("road", "Access road", "#b0bccd", 0, 92, 100, 6);
  return zones;
}

function ConceptSchematic({ zones }: { zones: Zone[] }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-auto rounded-xl border border-white/10 bg-[radial-gradient(circle_at_30%_20%,rgba(0,194,232,0.15),transparent_60%),linear-gradient(135deg,#0b1e3a,#050b18)]"
      role="img"
      aria-label="Conceptual site layout"
    >
      <rect
        x="1"
        y="1"
        width="98"
        height="98"
        fill="none"
        stroke="#d4a017"
        strokeWidth="0.4"
        strokeDasharray="1.5 1.5"
      />
      {zones.map((z) => (
        <g key={z.key}>
          <rect
            x={z.x}
            y={z.y}
            width={z.w}
            height={z.h}
            fill={z.color}
            fillOpacity={0.55}
            stroke={z.color}
            strokeWidth={0.3}
            rx={1}
          />
          <text
            x={z.x + z.w / 2}
            y={z.y + z.h / 2 + 1}
            textAnchor="middle"
            fill="#0b1e3a"
            fontSize="2.6"
            fontWeight={600}
          >
            {z.label}
          </text>
        </g>
      ))}
      <text x="50" y="99" textAnchor="middle" fill="#cdd8ea" fontSize="2.3">
        N ↑ · Conceptual only
      </text>
    </svg>
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
        <Link to="/dashboard" className="mt-3 inline-block text-xs text-accent hover:underline">
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
