import { OutputTools, OutputIcon } from "@/components/halisia/output-tools";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ArrowLeft, ExternalLink, Loader2, Clock, CheckCircle2 } from "lucide-react";
import {
  getPartnerListing,
  createReferral,
  createPartnerLead,
  formatPartnerPrice,
  formatSize,
  formatCheckedDate,
  mayBeOutOfDate,
  partnerUrl,
  withReferral,
  CATEGORY_LABELS,
  INTENT_LABELS,
  AVAILABILITY_LABELS,
  type PartnerListing,
  type ReferralHandle,
} from "@/lib/marketplace-external";

export const Route = createFileRoute("/partner-listing/$id")({
  head: () => ({
    meta: [
      { title: "Partner listing — HALISIA.AI" },
      {
        name: "description",
        content:
          "A property listed by another company, shown with its source. HALISIA has not verified it.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PartnerListingPage,
});

function PartnerListingPage() {
  const { id } = Route.useParams();
  const query = useQuery({
    queryKey: ["partner-listing", id],
    queryFn: () => getPartnerListing(id),
  });

  const [referral, setReferral] = useState<ReferralHandle | null>(null);
  const [handoffFailed, setHandoffFailed] = useState(false);

  if (query.isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading listing…
        </p>
      </main>
    );
  }

  const listing = query.data;
  if (!listing) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-lg font-semibold">Listing not available</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          It may have been withdrawn by its source.
        </p>
        <Link to="/marketplace" className="mt-4 inline-block text-sm underline focus-ring">
          Back to the marketplace
        </Link>
      </main>
    );
  }

  const url = partnerUrl(listing);
  const size = formatSize(listing);
  const checked = formatCheckedDate(listing.source_checked_at);

  /** Records the click-out, then opens the source. A failure never blocks it. */
  async function openSource() {
    if (!url || !listing) return;
    let handle: ReferralHandle | null = referral;
    if (!handle && listing.source?.id) {
      try {
        handle = await createReferral(listing.source.id, listing.id);
        setReferral(handle);
      } catch (e) {
        setHandoffFailed(true);
        console.error("referral failed", e);
      }
    }
    window.open(withReferral(url, handle?.referral_code ?? null), "_blank", "noopener,noreferrer");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link
        to="/marketplace"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground focus-ring"
      >
        <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Marketplace
      </Link>

      <p className="mt-4 text-[11px] uppercase tracking-wider text-muted-foreground">
        Listed by {listing.source?.name ?? "an external source"}
      </p>
      <h1 className="mt-1 text-2xl font-semibold leading-tight">{listing.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {[listing.locality, listing.county].filter(Boolean).join(", ") || "Location not stated"}
      </p>
      <p className="mt-3 text-xl font-semibold">{formatPartnerPrice(listing)}</p>
      {mayBeOutOfDate(listing) && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" aria-hidden="true" /> May be out of date
          {checked ? ` · last checked ${checked}` : ""}
        </p>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
        <Fact
          label="Type"
          value={
            listing.listing_category
              ? (CATEGORY_LABELS[listing.listing_category] ?? listing.listing_category)
              : null
          }
        />
        <Fact
          label="Intent"
          value={listing.intent ? (INTENT_LABELS[listing.intent] ?? listing.intent) : null}
        />
        <Fact label="Size" value={size} />
        <Fact label="Bedrooms" value={listing.bedrooms != null ? String(listing.bedrooms) : null} />
        <Fact
          label="Bathrooms"
          value={listing.bathrooms != null ? String(listing.bathrooms) : null}
        />
        <Fact label="Tenure" value={listing.tenure} />
        <Fact label="Payment plan" value={listing.payment_plan_summary} />
        <Fact
          label="Completion"
          value={listing.completion_date ? formatCheckedDate(listing.completion_date) : null}
        />
        <Fact label="Project" value={listing.project_name} />
        <Fact label="Developer" value={listing.developer_name} />
        <Fact
          label="Availability"
          value={
            listing.availability_status
              ? (AVAILABILITY_LABELS[listing.availability_status] ?? listing.availability_status)
              : null
          }
        />
        <Fact label="Last checked" value={checked} />
      </dl>

      {listing.source?.can_display_description && listing.description ? (
        <p className="mt-5 whitespace-pre-line text-sm">{listing.description}</p>
      ) : null}

      <div className="mt-6">
        {url ? (
          <button
            onClick={openSource}
            className="btn-base btn-primary inline-flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> View on{" "}
            {listing.source?.name ?? "the source site"}
          </button>
        ) : (
          <p className="glass rounded-xl border border-white/10 p-3 text-sm text-muted-foreground">
            The link to this listing on {listing.source?.name ?? "the source site"} is being
            confirmed. You can still send an enquiry below.
          </p>
        )}
        {handoffFailed && (
          <p className="mt-2 text-xs text-muted-foreground">
            We could not record that click, but the link still works.
          </p>
        )}
      </div>

      <section className="mt-6 glass rounded-2xl border border-white/10 p-4 text-xs text-muted-foreground">
        <h2 className="text-sm font-semibold text-foreground">Where this comes from</h2>
        <p className="mt-1">
          HALISIA collected this from a public listing by{" "}
          {listing.source?.name ?? "an external source"}. We have not visited the property,
          confirmed ownership or boundaries, or checked any figure here.{" "}
          {listing.source?.commercial_status &&
          listing.source.commercial_status !== "discovery_only"
            ? "HALISIA has a commercial agreement with that company and may be paid a referral fee if you transact with them. That fee is paid by the company, not added to your price, and it does not affect what this page says about the property."
            : "HALISIA has no commercial agreement with that company and is paid nothing if you contact them."}{" "}
          Opening the link below records that you came from HALISIA, so the company can attribute
          the enquiry.
        </p>
        {listing.source?.rights_basis && <p className="mt-2">{listing.source.rights_basis}</p>}
        {listing.source?.website_url && (
          <a
            href={listing.source.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block underline focus-ring"
          >
            {listing.source.name}
          </a>
        )}
      </section>

      <EnquiryForm listing={listing} referralId={referral?.id} />
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div data-output-card>
      <OutputIcon subject={label} />
      <OutputTools label={label} />
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

const ENQUIRY_TYPES = ["Viewing", "Price and payment plan", "Availability", "General question"];

function EnquiryForm({ listing, referralId }: { listing: PartnerListing; referralId?: string }) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    message: "",
    enquiryType: ENQUIRY_TYPES[0],
  });
  const [consentPartner, setConsentPartner] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const sourceName = listing.source?.name ?? "the source";

  const canSubmit = consentPartner && form.fullName.trim().length > 1 && state !== "sending";

  async function submit() {
    setState("sending");
    setError(null);
    try {
      await createPartnerLead({
        fullName: form.fullName.trim(),
        consentPartnerContact: true,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        message: form.message.trim() || undefined,
        enquiryType: form.enquiryType,
        externalListingId: listing.id,
        referralId,
        consentMarketing,
      });
      setState("sent");
    } catch (e) {
      setState("idle");
      setError(e instanceof Error ? e.message : "The enquiry could not be sent.");
    }
  }

  if (state === "sent") {
    return (
      <section className="mt-6 glass rounded-2xl border border-white/10 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" /> Enquiry sent
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your name{form.email ? `, email` : ""}
          {form.phone ? ` and phone number` : ""} and your question about “{listing.title}” were
          shared with {sourceName} so they can reply to you directly. HALISIA does not answer on
          their behalf.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 glass rounded-2xl border border-white/10 p-4">
      <h2 className="text-sm font-semibold">Ask {sourceName} about this listing</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Your name" required>
          <input
            className="input"
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            autoComplete="name"
          />
        </Field>
        <Field label="Enquiry about">
          <select
            className="input"
            value={form.enquiryType}
            onChange={(e) => setForm((f) => ({ ...f, enquiryType: e.target.value }))}
          >
            {ENQUIRY_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Email">
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            autoComplete="email"
          />
        </Field>
        <Field label="Phone">
          <input
            className="input"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            autoComplete="tel"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Message">
            <textarea
              className="input min-h-24"
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            />
          </Field>
        </div>
      </div>

      <label className="mt-3 flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={consentPartner}
          onChange={(e) => setConsentPartner(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Share my name and contact details with {sourceName} so they can respond about this
          listing. Required to send.
        </span>
      </label>
      <label className="mt-2 flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={consentMarketing}
          onChange={(e) => setConsentMarketing(e.target.checked)}
          className="mt-0.5"
        />
        <span>Optional: {sourceName} may send me other offers.</span>
      </label>

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

      <button
        onClick={submit}
        disabled={!canSubmit}
        className="btn-base btn-primary mt-4 inline-flex items-center gap-2 disabled:opacity-50"
      >
        {state === "sending" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Send enquiry
      </button>
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">
        {label}
        {required ? " *" : ""}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
