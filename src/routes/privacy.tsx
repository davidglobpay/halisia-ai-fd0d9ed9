import { createFileRoute, Link } from "@tanstack/react-router";

/**
 * Plain description of how the app handles personal data today. Every
 * statement here must stay true of the code: if a flow changes, change this
 * page in the same commit. Legal review is still pending, and the page says so.
 */
export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy and data handling — HALISIA" },
      {
        name: "description",
        content:
          "How HALISIA handles account details, searches, title-deed text, listings and financing information, and who processes it.",
      },
    ],
  }),
  component: PrivacyPage,
});

const SECTIONS: Array<{ id: string; title: string; points: string[] }> = [
  {
    id: "deeds",
    title: "Title deeds",
    points: [
      "When you upload a deed photo, the text is read in your own browser. The image is not uploaded to HALISIA.",
      "Only after you agree, the recognised text — which can include the registered owner's name and other personal details — is sent to Google's Gemini model through Lovable's AI service to pull out fields such as the title number and county.",
      "HALISIA does not store the deed text or the extracted fields on its servers. Your recent deed lookups are kept in this browser's local storage, and you can clear them there.",
      "HALISIA has no connection to any land registry and never confirms ownership or title.",
    ],
  },
  {
    id: "account",
    title: "Your account",
    points: [
      "Sign-in uses your email address, handled by Supabase through Lovable Cloud. We keep a display name and the roles you choose.",
      "Administrators must use two-step verification before they can see other people's records.",
    ],
  },
  {
    id: "searches",
    title: "Searches and locations",
    points: [
      "Place searches are sent to Google Maps to find the location. Title and LR numbers are not sent, because they cannot be located from text.",
      "Your device location is used only when you press “My location”, and only for that search.",
    ],
  },
  {
    id: "records",
    title: "Listings, enquiries, viewings and financing",
    points: [
      "What you enter in a listing, enquiry, viewing request, financing application or document vault is stored in the HALISIA database.",
      "Each record is visible only to you, the other party to it (for example the seller of a listing you enquire about), and verified administrators.",
      "Files in the financing vault are private to you unless you share them, and shares can expire.",
      "When you ask for an AI summary of a financing application, listing or insurance brief, the details in that form are sent to Google's Gemini model through Lovable's AI service to draft it.",
    ],
  },
  {
    id: "processors",
    title: "Who processes data for HALISIA",
    points: [
      "Lovable (hosting, AI gateway) and Supabase (database, sign-in, file storage) through Lovable Cloud.",
      "Google (Maps, Gemini AI models, text-to-speech for news audio).",
      "Map and open-data providers receive only coordinates or place names, never your identity.",
    ],
  },
  {
    id: "rights",
    title: "Your rights",
    points: [
      "Under Kenya's Data Protection Act, 2019 you can ask to see, correct or delete personal data HALISIA holds about you, and object to its use.",
      "Write to hello@halisia.ai and we will respond. You can delete your own listings, saved items and vault files at any time from your account.",
    ],
  },
];

function PrivacyPage() {
  return (
    <div className="min-h-screen" data-testid="privacy-page">
      <div className="pt-28 pb-16 mx-auto max-w-3xl px-4">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy and data handling</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This page describes what the app does with your information today, in plain terms. It has
          not yet been reviewed by legal counsel; a formal privacy policy will replace it.
        </p>
        <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-2 text-xs">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="glass rounded-full px-3 py-1.5">
              {s.title}
            </a>
          ))}
        </nav>
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="mt-10 scroll-mt-28">
            <h2 className="text-lg font-semibold">{s.title}</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed list-disc pl-5">
              {s.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        ))}
        <p className="mt-12 text-xs text-muted-foreground">
          Questions:{" "}
          <a href="mailto:hello@halisia.ai" className="underline">
            hello@halisia.ai
          </a>
          {" · "}
          <Link to="/" search={{ compare: "" }} className="underline">
            Back to HALISIA
          </Link>
        </p>
      </div>
    </div>
  );
}
