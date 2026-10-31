import type { PropertyRow } from "@/lib/properties";
import type { ListingAiOutput } from "@/lib/ai-listing.functions";
import jsPDF from "jspdf";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { brandPage, brandFooters, getMarkSync } from "@/lib/pdf-chrome";
import { deliverBlob, deliverPdf } from "@/lib/pdf-delivery";

function fmtPriceRange(ai: ListingAiOutput): string {
  const { min, max, currency } = ai.priceEstimate;
  if (min == null && max == null) return "Price on request";
  const nf = new Intl.NumberFormat("en-KE");
  if (min != null && max != null)
    return `${currency} ${nf.format(min)} – ${nf.format(max)} (estimate)`;
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
  const slug = p.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  deliverBlob(blob, `halisia-brochure-${slug || p.id}.txt`);
}

export function formatPriceEstimate(ai: ListingAiOutput): string {
  return fmtPriceRange(ai);
}

// ---------- PDF brochure ----------

const BRAND = {
  primary: "#102d1a",
  accent: "#147b35",
  gold: "#c08a2e",
  ink: "#102d1a",
  mute: "#5f6e62",
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function setFill(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setFillColor(r, g, b);
}
function setText(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}
function setDraw(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setDrawColor(r, g, b);
}

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function downloadBrochurePDF(p: PropertyRow, ai: ListingAiOutput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  // Synchronous by contract, so the mark comes from the primed cache.
  const mark = getMarkSync();
  brandPage(doc, mark);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  let y = 0;

  // Cover band
  setFill(doc, BRAND.primary);
  doc.rect(0, 0, W, 150, "F");
  setFill(doc, BRAND.accent);
  doc.rect(0, 150, W, 4, "F");
  setText(doc, "#ffffff");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("HALISIA AI · LISTING BROCHURE", M, 42);
  doc.setFontSize(20);
  const title = doc.splitTextToSize(ai.polishedTitle || p.title, W - M * 2);
  doc.text(title, M, 70);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setText(doc, "#cdd8ea");
  const loc = p.address ?? p.county ?? "Kenya";
  doc.text(`${p.kind.replace("_", " ")} · ${p.intent} · ${loc}`, M, 118);
  doc.text(`Generated ${new Date(ai.generatedAt).toLocaleString()}`, M, 134);

  y = 180;
  setText(doc, BRAND.ink);

  const section = (label: string) => {
    if (y > H - 90) {
      doc.addPage();
      brandPage(doc, mark);
      y = M;
    }
    setText(doc, BRAND.accent);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(label.toUpperCase(), M, y);
    setDraw(doc, BRAND.accent);
    doc.setLineWidth(0.6);
    doc.line(M, y + 4, W - M, y + 4);
    y += 16;
    setText(doc, BRAND.ink);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  };
  const para = (text: string) => {
    const lines = doc.splitTextToSize(text, W - M * 2);
    for (const ln of lines) {
      if (y > H - 60) {
        doc.addPage();
        brandPage(doc, mark);
        y = M;
      }
      doc.text(ln, M, y);
      y += 13;
    }
  };
  const bullets = (items: string[]) => {
    for (const it of items) {
      const lines = doc.splitTextToSize(it, W - M * 2 - 12);
      if (y > H - 60) {
        doc.addPage();
        brandPage(doc, mark);
        y = M;
      }
      setFill(doc, BRAND.gold);
      doc.circle(M + 3, y - 3, 1.6, "F");
      doc.text(lines[0], M + 12, y);
      y += 13;
      for (let i = 1; i < lines.length; i++) {
        if (y > H - 60) {
          doc.addPage();
          brandPage(doc, mark);
          y = M;
        }
        doc.text(lines[i], M + 12, y);
        y += 13;
      }
    }
  };

  section("Headline");
  para(ai.headline);
  y += 4;

  section("AI summary");
  para(ai.aiSummary);
  y += 4;

  section("Key facts");
  const size = p.size_value != null ? `${p.size_value} ${p.size_unit ?? ""}`.trim() : "—";
  const facts = [
    `Size: ${size}`,
    `Location: ${loc}`,
    p.latitude != null && p.longitude != null
      ? `Coordinates: ${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`
      : "",
    (p.utilities ?? []).length ? `Utilities: ${(p.utilities ?? []).join(", ")}` : "",
    (p.amenities ?? []).length ? `Amenities: ${(p.amenities ?? []).join(", ")}` : "",
  ].filter(Boolean) as string[];
  bullets(facts);
  y += 4;

  section("Marketing highlights");
  bullets(ai.marketingHighlights);
  y += 4;

  section("Estimated price band");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  para(fmtPriceRange(ai));
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setText(doc, BRAND.mute);
  para(ai.priceEstimate.note);
  setText(doc, BRAND.ink);
  y += 4;

  section("SEO description");
  para(ai.seoDescription);
  y += 4;

  section("Social captions");
  (
    [
      ["Twitter / X", ai.socialCaptions.twitter],
      ["Facebook", ai.socialCaptions.facebook],
      ["WhatsApp", ai.socialCaptions.whatsapp],
      ["Instagram", ai.socialCaptions.instagram],
    ] as const
  ).forEach(([label, text]) => {
    doc.setFont("helvetica", "bold");
    para(`— ${label}`);
    doc.setFont("helvetica", "normal");
    para(text);
    y += 2;
  });

  if (ai.concepts.length) {
    doc.addPage();
    brandPage(doc, mark);
    y = M;
    section("Conceptual development options (conceptual only)");
    ai.concepts.forEach((c) => {
      if (y > H - 120) {
        doc.addPage();
        brandPage(doc, mark);
        y = M;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      para(`${c.name} — confidence ${c.confidencePct}%`);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      para(c.description);
      setText(doc, BRAND.mute);
      para(`Best for: ${c.useCase}`);
      para(`Site layout: ${c.siteLayout}`);
      setText(doc, BRAND.ink);
      y += 6;
    });
  }

  doc.addPage();
  brandPage(doc, mark);
  y = M;
  section("Disclaimers");
  bullets(ai.disclaimers);
  y += 8;
  setText(doc, BRAND.mute);
  doc.setFontSize(9);
  para(`Overall AI confidence: ${ai.confidencePct}%`);

  brandFooters(doc, mark, {
    note: "Marketing brochure. Figures are the seller's, not a valuation.",
  });

  deliverPdf(doc, `halisia-brochure-${slug(p.title) || p.id}.pdf`);
}

// ---------- DOCX brochure ----------

function h(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
  return new Paragraph({ heading: level, children: [new TextRun({ text, bold: true })] });
}
function p(text: string) {
  return new Paragraph({ children: [new TextRun(text)] });
}
function bullet(text: string) {
  return new Paragraph({ text, bullet: { level: 0 } });
}

export async function downloadBrochureDOCX(p_: PropertyRow, ai: ListingAiOutput) {
  const loc = p_.address ?? p_.county ?? "Kenya";
  const size = p_.size_value != null ? `${p_.size_value} ${p_.size_unit ?? ""}`.trim() : "—";

  const children: Paragraph[] = [];
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: "HALISIA AI · LISTING BROCHURE", bold: true, size: 20 })],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated ${new Date(ai.generatedAt).toLocaleString()}`,
          italics: true,
          color: "5b6a86",
        }),
      ],
    }),
    h(ai.polishedTitle || p_.title, HeadingLevel.HEADING_1),
    p(`${p_.kind.replace("_", " ")} · ${p_.intent} · ${loc}`),
    h("Headline", HeadingLevel.HEADING_2),
    p(ai.headline),
    h("AI summary", HeadingLevel.HEADING_2),
    p(ai.aiSummary),
    h("Key facts", HeadingLevel.HEADING_2),
    bullet(`Size: ${size}`),
    bullet(`Location: ${loc}`),
  );
  if (p_.latitude != null && p_.longitude != null)
    children.push(bullet(`Coordinates: ${p_.latitude.toFixed(5)}, ${p_.longitude.toFixed(5)}`));
  if ((p_.utilities ?? []).length)
    children.push(bullet(`Utilities: ${(p_.utilities ?? []).join(", ")}`));
  if ((p_.amenities ?? []).length)
    children.push(bullet(`Amenities: ${(p_.amenities ?? []).join(", ")}`));

  children.push(h("Marketing highlights", HeadingLevel.HEADING_2));
  ai.marketingHighlights.forEach((x) => children.push(bullet(x)));

  children.push(
    h("Estimated price band", HeadingLevel.HEADING_2),
    new Paragraph({
      children: [new TextRun({ text: fmtPriceRange(ai), bold: true, size: 28 })],
    }),
    new Paragraph({ children: [new TextRun({ text: ai.priceEstimate.note, italics: true })] }),
    h("SEO description", HeadingLevel.HEADING_2),
    p(ai.seoDescription),
    h("Social captions", HeadingLevel.HEADING_2),
  );
  (
    [
      ["Twitter / X", ai.socialCaptions.twitter],
      ["Facebook", ai.socialCaptions.facebook],
      ["WhatsApp", ai.socialCaptions.whatsapp],
      ["Instagram", ai.socialCaptions.instagram],
    ] as const
  ).forEach(([label, text]) => {
    children.push(
      new Paragraph({ children: [new TextRun({ text: `— ${label}`, bold: true })] }),
      p(text),
    );
  });

  if (ai.concepts.length) {
    children.push(h("Conceptual development options (conceptual only)", HeadingLevel.HEADING_2));
    ai.concepts.forEach((c) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${c.name} — confidence ${c.confidencePct}%`, bold: true }),
          ],
        }),
        p(c.description),
        p(`Best for: ${c.useCase}`),
        p(`Site layout: ${c.siteLayout}`),
      );
    });
  }

  children.push(h("Disclaimers", HeadingLevel.HEADING_2));
  ai.disclaimers.forEach((d) => children.push(bullet(d)));
  children.push(p(`Overall AI confidence: ${ai.confidencePct}%`));

  const docFile = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(docFile);
  deliverBlob(blob, `halisia-brochure-${slug(p_.title) || p_.id}.docx`);
}
