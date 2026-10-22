# Edit `src/lib/pulse/classify.ts`

**3 changes.** Open the file on GitHub, click the pencil
icon, then work through these in order with Ctrl+F (Cmd+F).

Each FIND block appears **exactly once** in the file. That was verified against
commit `6a4e62e8`. If a FIND block isn't found, stop and say so — do not
improvise, it means the file moved.

---

## 1. A. Kenyan institution acronyms + foreign publisher list

**FIND:**

```tsx
|environment and land court|mazingira day)\b/i;
```

**REPLACE WITH:**

```tsx
|environment and land court|mazingira day|eacc|epra|jkia|kerra|kws|kebs|nssf|nhc|dci|nse|kra|kcb|ardhi house|lands ministry|gazette notice|kenya airports authority|kenya railways|national construction authority)\b/i;

/**
 * Outlets that are not Kenyan newsrooms.
 *
 * Measured on the live feed, 22 Oct 2026: these seven accounted for 346
 * published articles, 333 of which carried no Kenyan signal of any kind --
 * Suez Canal, Nepal floods, Dar es Salaam governance, World of Warcraft.
 * One of them, Tanzania's The Citizen, runs NSSF and NHC stories about
 * Tanzanian institutions that share their acronyms with Kenyan ones.
 *
 * This is a veto, never a licence. A Kenyan masthead does not make a story
 * Kenyan -- Citizen Digital carries Reuters hurricane copy -- so a
 * publisher absent from this list still has to clear the anchor test.
 */
const FOREIGN_PUBLISHERS = new Set([
  "the citizen",
  "africanews",
  "climate home news",
  "menafn",
  "good news network",
  "ign africa",
  "middle east monitor",
]);
```

---

## 2. B. read the publisher in classify()

**FIND:**

```tsx
    .replace(/\bland\s+rover\b/g, "vehicle");

  // Category scoring.
```

**REPLACE WITH:**

```tsx
    .replace(/\bland\s+rover\b/g, "vehicle");
  // Trimmed and lowercased: feeds pad and recase the masthead.
  const publisher = (article.sourceName ?? "").trim().toLowerCase();

  // Category scoring.
```

---

## 3. C. apply the publisher veto in the gate

**FIND:**

```tsx
    relevant:
      (county !== null || /\bkenyan?s?\b/i.test(text) || KENYA_TERMS.test(text)) &&
      (coreHits > 0 || topicHits > 0),
```

**REPLACE WITH:**

```tsx
    // The publisher veto runs first and is absolute: no keyword, county or
    // institution rescues a story from an outlet that does not cover Kenya.
    relevant:
      !FOREIGN_PUBLISHERS.has(publisher) &&
      (county !== null || /\bkenyan?s?\b/i.test(text) || KENYA_TERMS.test(text)) &&
      (coreHits > 0 || topicHits > 0),
```
