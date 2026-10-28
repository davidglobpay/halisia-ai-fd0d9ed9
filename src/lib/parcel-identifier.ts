/**
 * Recognises Kenyan land-registration identifiers typed into a place search.
 *
 * A title number or LR number names a parcel in the land register. It is not
 * an address: no public service turns it into a location, and sending it to a
 * geocoder returns, at best, the centre of a town that shares a word with it.
 * When a search looks like a parcel identifier, the app says so and offers the
 * Title Deed tool instead of showing a point it cannot stand behind.
 */

/** Registration-section titles, e.g. KAJIADO/KITENGELA/8891 or NAIROBI/BLOCK 118/2451. */
const SECTION_TITLE = /^[a-z][a-z .'-]*(?:\/[a-z0-9][a-z0-9 .'-]*)+\/\s*\d+[a-z]?\s*$/i;

/** LR numbers, e.g. "LR 209/1234", "L.R. No. 12345/67", "LR NO 7785". */
const LR_NUMBER = /^l\.?\s*r\.?\s*(?:no\.?|number)?\s*[:#]?\s*\d+(?:\s*\/\s*\d+)*\s*$/i;

/** Explicit title or plot references, e.g. "title no. 1234", "plot no 45/2". */
const EXPLICIT_REF =
  /^(?:title|title deed|plot|parcel|land ref(?:erence)?)\s*(?:no\.?|number)?\s*[:#]?\s*[a-z0-9]*\d[a-z0-9]*(?:\s*\/\s*[a-z0-9]+)*\s*$/i;

/** Bare "212/345" style numbers with no place words. */
const BARE_SLASHED = /^\d+(?:\s*\/\s*\d+)+$/;

export function looksLikeParcelIdentifier(input: string): boolean {
  const q = input.trim().replace(/\s+/g, " ");
  if (q.length < 3 || q.length > 120) return false;
  // Coordinates are handled elsewhere and must never be mistaken for a title.
  if (/^-?\d+(?:\.\d+)?\s*[, ]\s*-?\d+(?:\.\d+)?$/.test(q)) return false;
  return LR_NUMBER.test(q) || SECTION_TITLE.test(q) || EXPLICIT_REF.test(q) || BARE_SLASHED.test(q);
}

export const PARCEL_IDENTIFIER_NOTICE =
  "That looks like a title or LR number. These can't be located from text: there is no public register lookup, and a map search would only guess a nearby town. Use the Title Deed tool with a photo of the deed, or search the nearest town or road.";
