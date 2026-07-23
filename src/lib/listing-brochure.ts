import type { PropertyRow } from "@/lib/properties";
import type { ListingAiOutput } from "@/lib/ai-listing.functions";

function fmtPriceRange(ai: ListingAiOutput): string {
  const { min, max, currency } = ai.priceEstimate;
  if (min == null && max == null) return "Price on request";
  const nf = new Intl.NumberFormat("en-KE");
  if (min != null && max != null) return `${currency} ${nf.format(min)} – ${nf.format(max)} (estimate)`;
  return `${currency} ${nf.format((min ?? max)!)} (estimate)`;
}

export function buildBrochureText(p: PropertyRow, ai: ListingAiOutput): string {
  const size = p.size_value != null ? `${p.size_value} ${p.size_unit ?? ""}`.trim() : "—";
  const loc = p.address ?? p.county ?? "Kenya";
  const lines: string[] = [];
  lines.push(`HALISIA AI · LISTING BROCHURE`);
  lines.push(`Generated ${new Date(ai.generatedAt).toLocaleString()}`);
  lines.push("");
  lines.push(ai.polishedTitle);
  lines.push(`${p.kind.replace("_", " ")} · ${p.intent} · ${loc}`);
  lines.push("");
  lines.push("HEADLINE");
  lines.push(ai.headline);
  lines.push("");
  lines.push("AI SUMMARY");
  lines.push(ai.aiSummary);
  lines.push("");
  lines.push("KEY FACTS");
  lines.push(`• Size: ${size}`);
  lines.push(`• Location: ${loc}`);
  if (p.latitude != null && p.longitude != null)
    lines.push(`• Coordinates: ${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`);
  if ((p.utilities ?? []).length) lines.push(`• Utilities: ${(p.utilities ?? []).join(", ")}`);
  if ((p.amenities ?? []).length) lines.push(`• Amenities: ${(p.amenities ?? []).join(", ")}`);
  lines.push("");
  lines.push("MARKETING HIGHLIGHTS");
  ai.marketingHighlights.forEach((h) => lines.push(`• ${h}`));
  lines.push("");
  lines.push("PRICE (ESTIMATE)");
  lines.push(fmtPriceRange(ai));
  lines.push(ai.priceEstimate.note);
  lines.push("");
  lines.push("SEO DESCRIPTION");
  lines.push(ai.seoDescription);
  lines.push("");
  lines.push("SOCIAL CAPTIONS");
  lines.push(`— Twitter/X —\n${ai.socialCaptions.twitter}`);
  lines.push("");
  lines.push(`— Facebook —\n${ai.socialCaptions.facebook}`);
  lines.push("");
  lines.push(`— WhatsApp —\n${ai.socialCaptions.whatsapp}`);
  lines.push("");
  lines.push(`— Instagram —\n${ai.socialCaptions.instagram}`);
  if (ai.concepts.length) {
    lines.push("");
    lines.push("CONCEPTUAL DEVELOPMENT OPTIONS (CONCEPTUAL ONLY)");
    ai.concepts.forEach((c) => {
      lines.push(`• ${c.name} — ${c.description}`);
      lines.push(`  Use case: ${c.useCase}`);
      lines.push(`  Site layout: ${c.siteLayout}`);
      lines.push(`  Confidence: ${c.confidencePct}%`);
    });
  }
  lines.push("");
  lines.push("DISCLAIMERS");
  ai.disclaimers.forEach((d) => lines.push(`• ${d}`));
  lines.push("");
  lines.push(`Overall AI confidence: ${ai.confidencePct}%`);
  return lines.join("\n");
}

export function downloadBrochure(p: PropertyRow, ai: ListingAiOutput) {
  const text = buildBrochureText(p, ai);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const slug = p.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  a.download = `halisia-brochure-${slug || p.id}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function formatPriceEstimate(ai: ListingAiOutput): string {
  return fmtPriceRange(ai);
}