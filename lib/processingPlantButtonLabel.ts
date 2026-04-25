/**
 * Two-character label for a processing plant name (sidebar rail).
 *
 * Rules:
 * - Trim; empty/whitespace → {@link PLANT_NAME_LABEL_FALLBACK}.
 * - Split with `/[\\s\\-_]+/`, non-empty parts only.
 * - **Two or more parts:** use only the **first two** parts. Take the first
 *   `[A-Za-z]` in each; both uppercase and concatenate. If one part has no
 *   letter, the other’s single initial is used; if neither has a letter →
 *   fallback.
 * - **One part:** take the first two letters in the part (ignoring
 *   non-letters); first uppercase, second lowercase. One letter → that letter
 *   uppercase; no letters → fallback.
 */
export const PLANT_NAME_LABEL_FALLBACK = "??" as const;

const LETTER_RE = /[a-zA-Z]/g;
const FIRST_LETTER_RE = /[a-zA-Z]/;

function firstLetterInSegment(segment: string): string | null {
  const m = segment.match(FIRST_LETTER_RE);
  return m ? m[0]! : null;
}

/** First two A–Z letters in a single segment, title case (e.g. dharan → Dh). */
function titleCaseTwoLettersFromSingleSegment(segment: string): string {
  const letters: string[] = [];
  for (const m of segment.matchAll(LETTER_RE)) {
    letters.push(m[0]!);
    if (letters.length >= 2) break;
  }
  if (letters.length === 0) return "";
  if (letters.length === 1) return letters[0]!.toUpperCase();
  return (
    letters[0]!.toUpperCase() + letters[1]!.toLowerCase()
  );
}

export function twoLetterLabelFromPlantName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return PLANT_NAME_LABEL_FALLBACK;

  const parts = trimmed.split(/[\s\-_]+/).filter((p) => p.length > 0);
  if (parts.length === 0) return PLANT_NAME_LABEL_FALLBACK;

  if (parts.length === 1) {
    const t = titleCaseTwoLettersFromSingleSegment(parts[0]!);
    return t || PLANT_NAME_LABEL_FALLBACK;
  }

  const a = firstLetterInSegment(parts[0]!);
  const b = firstLetterInSegment(parts[1]!);
  if (a && b) return a.toUpperCase() + b.toUpperCase();
  if (a && !b) return a.toUpperCase();
  if (!a && b) return b.toUpperCase();
  return PLANT_NAME_LABEL_FALLBACK;
}
