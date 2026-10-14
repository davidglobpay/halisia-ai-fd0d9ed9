/**
 * Splitting a passage so a speech engine's character offset can be turned into
 * the word a reader should see highlighted.
 *
 * Kept out of the component so it can be tested without a DOM. The mapping is
 * the whole mechanism: `SpeechSynthesisUtterance.onboundary` reports a
 * character index into the string it was given, and the only way to highlight
 * the right word is to know which token that index falls in.
 */

/** A run of the source string: either a word, or the gap before the next one. */
export type Token = { text: string; start: number; end: number; word: boolean };

/**
 * Splits into words and the gaps between them, keeping every character.
 *
 * Gaps are preserved as their own tokens rather than trimmed, because the
 * passage is re-rendered from these tokens — losing a newline or a double
 * space would silently reflow the text a reader is following.
 */
export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const re = /\S+/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last)
      out.push({
        text: text.slice(last, m.index),
        start: last,
        end: m.index,
        word: false,
      });
    out.push({
      text: m[0],
      start: m.index,
      end: m.index + m[0].length,
      word: true,
    });
    last = m.index + m[0].length;
  }
  if (last < text.length)
    out.push({
      text: text.slice(last),
      start: last,
      end: text.length,
      word: false,
    });
  return out;
}

/**
 * The index of the word token containing a character offset.
 *
 * A boundary event often lands in the whitespace before a word rather than on
 * its first character, so an offset in a gap resolves forward to the next
 * word. It never resolves backwards: highlighting a word the voice has already
 * finished is worse than being one word early. Returns -1 past the last word.
 */
export function tokenAt(tokens: Token[], charIndex: number): number {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t.word) continue;
    if (charIndex >= t.start && charIndex < t.end) return i;
    if (t.start > charIndex) return i;
  }
  return -1;
}

/** Index of the first word, or -1 when the passage has none. */
export const firstWord = (tokens: Token[]): number =>
  tokens.findIndex((t) => t.word);

/**
 * Milliseconds a word takes at a given rate, for engines that never fire a
 * boundary event. ~165 words a minute is a typical synthesis pace at rate 1.
 * Coarse on purpose: it keeps a reader near the right line rather than
 * claiming to be in step with a voice it cannot hear.
 */
export const msPerWord = (rate: number): number =>
  60_000 / (165 * Math.max(0.1, rate));
