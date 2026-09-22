import { supabase } from "@/integrations/supabase/client";
import type { PropertyRow, LeadRow } from "@/lib/properties";

export type LeadQuality = "hot" | "warm" | "cool";

export type ListingInsight = {
  property: PropertyRow;
  views: number;
  saves: number;
  leads: LeadRow[];
  contactRequests: number;
  leadsLast7: number;
  leadsPrev7: number;
  trendPct: number;
  quality: LeadQuality;
  qualityReason: string;
  saveRate: number;
  enquiryRate: number;
  followUps: string[];
  improvements: string[];
};

function daysAgo(n: number) {
  return Date.now() - n * 86_400_000;
}

export async function fetchSaveCount(propertyId: string): Promise<number> {
  const { data, error } = await supabase.rpc("listing_save_count", { p_property_id: propertyId });
  if (error) return 0;
  return Number(data ?? 0);
}

function qualityFor(views: number, leads: LeadRow[], saves: number): [LeadQuality, string] {
  const advanced = leads.filter((l) =>
    ["viewing", "negotiation", "offer", "closed"].includes(l.stage),
  ).length;
  const recent = leads.filter((l) => new Date(l.created_at).getTime() > daysAgo(7)).length;
  if (advanced > 0 || (recent >= 2 && saves >= 2))
    return ["hot", `${advanced} enquiry(ies) reached viewing or beyond and interest is recent.`];
  if (recent >= 1 || saves >= 2)
    return ["warm", `${recent} enquiry(ies) in the last 7 days and ${saves} save(s).`];
  return [
    "cool",
    views > 0
      ? `${views} views but little follow-through yet — the listing may need stronger detail.`
      : "No traffic recorded yet.",
  ];
}

function suggestFollowUps(leads: LeadRow[]): string[] {
  const out: string[] = [];
  const stale = leads.filter(
    (l) => l.stage === "new" && new Date(l.created_at).getTime() < daysAgo(2),
  );
  if (stale.length)
    out.push(`${stale.length} enquiry(ies) have been sitting in "new" for 2+ days — reply today.`);
  const viewing = leads.filter((l) => l.stage === "viewing");
  if (viewing.length)
    out.push(
      `${viewing.length} buyer(s) are at viewing stage — confirm a date and share directions.`,
    );
  const negotiating = leads.filter((l) => l.stage === "negotiation" || l.stage === "offer");
  if (negotiating.length)
    out.push(`${negotiating.length} in negotiation — send your best-and-final terms in writing.`);
  if (!out.length) out.push("No follow-ups pending. HALISIA never contacts your leads for you.");
  return out;
}

function suggestImprovements(
  p: PropertyRow,
  views: number,
  saves: number,
  leads: number,
): string[] {
  const out: string[] = [];
  if (p.latitude == null || p.longitude == null)
    out.push(
      "Add a map pin — coordinates let HALISIA read terrain, air quality and nearby amenities for the site.",
    );
  if ((p.media_urls?.length ?? 0) < 3)
    out.push("Upload at least three photos, including the access road.");
  if (!p.cover_image) out.push("Set a cover image so your card stands out in the grid.");
  if (p.price == null) out.push("Add a price — price-on-request listings convert poorly.");
  if (!p.description || p.description.length < 120)
    out.push("Expand the description with distances, boundaries and what is verified.");
  if (p.utilities.length === 0) out.push("List utilities on-site (water, KPLC, sewer, fibre).");
  if (p.amenities.length === 0) out.push("Add nearby amenities (schools, hospitals, shopping).");
  if (views >= 40 && leads === 0)
    out.push(
      "High views but no enquiries — market interest suggests your price may be above comparable listings.",
    );
  if (views >= 25 && saves === 0)
    out.push("Viewers are not saving this listing — refresh the lead photo and title.");
  if (!out.length)
    out.push("This listing is well completed. Keep it fresh by updating photos monthly.");
  return out;
}

export function buildInsight(
  property: PropertyRow,
  allLeads: LeadRow[],
  saves: number,
): ListingInsight {
  const leads = allLeads.filter((l) => l.property_id === property.id);
  const views = property.view_count ?? 0;
  const leadsLast7 = leads.filter((l) => new Date(l.created_at).getTime() > daysAgo(7)).length;
  const leadsPrev7 = leads.filter((l) => {
    const t = new Date(l.created_at).getTime();
    return t <= daysAgo(7) && t > daysAgo(14);
  }).length;
  const trendPct =
    leadsPrev7 === 0
      ? leadsLast7 > 0
        ? 100
        : 0
      : Math.round(((leadsLast7 - leadsPrev7) / leadsPrev7) * 100);
  const [quality, qualityReason] = qualityFor(views, leads, saves);
  const contactRequests = leads.filter((l) => l.contact_email || l.contact_phone).length;
  return {
    property,
    views,
    saves,
    leads,
    contactRequests,
    leadsLast7,
    leadsPrev7,
    trendPct,
    quality,
    qualityReason,
    saveRate: views > 0 ? Math.round((saves / views) * 100) : 0,
    enquiryRate: views > 0 ? Math.round((leads.length / views) * 100) : 0,
    followUps: suggestFollowUps(leads),
    improvements: suggestImprovements(property, views, saves, leads.length),
  };
}
