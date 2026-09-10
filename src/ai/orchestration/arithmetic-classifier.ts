/**
 * Classifies whether a text fragment contains a GENUINE arithmetic
 * proposition, as opposed to an identifier/version/codec/platform token that
 * merely happens to contain "digit / digit" (MT4/MT5, H264/H265, IPv4/IPv6,
 * USB2/USB3, Gen4/Gen5, v1/v2, 4K/8K, A/B). See CLAUDE.md
 * [[ftmo-verify-classifier]] and MASTER CODING PROMPT v13 §14-16.
 *
 * Root cause of the original bug: a loose regex let arbitrary filler text
 * (`\D{0,24}`) sit between two digit groups so it could reach across an
 * identifier's slash and treat it as division. The filler gap is still
 * needed for legitimate prose like "20 users x $15" — the fix instead
 * validates that the two numeric operands are NOT lexically glued to a
 * letter (in either direction), which is what distinguishes a real number
 * ("20", "$15", "4") from an identifier fragment ("MT4", "H264", "v2", "4K").
 */

export type VerificationCoverage = "NONE" | "PARTIAL" | "FULL";

export interface ArithmeticCandidate {
  /** Normalized expression safe to hand to CalculatorConnector, e.g. "4*5". */
  normalizedInput: string;
  /** The exact original substring the expression was extracted from. */
  verifiedFragment: string;
  matchStart: number;
  matchEnd: number;
}

const ARITHMETIC_RE =
  /(\d+(?:\.\d+)?)(\D{0,24})([+\-*/×x])(\D{0,8})(\d+(?:\.\d+)?)/di;

const LETTER_RE = /\p{L}/u;

type IndexedMatch = RegExpMatchArray & {
  indices?: Array<[number, number] | undefined>;
};

function touchesLetter(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text[start - 1] : "";
  const after = end < text.length ? text[end] : "";
  return Boolean((before && LETTER_RE.test(before)) || (after && LETTER_RE.test(after)));
}

/**
 * Finds the first genuine arithmetic candidate in `text`, or null if none —
 * either because no digit/operator/digit pattern exists, or every candidate
 * found is lexically glued to a letter (identifier-like, not a number).
 */
export function findArithmeticCandidate(text: string): ArithmeticCandidate | null {
  const match = text.match(ARITHMETIC_RE) as IndexedMatch | null;
  if (!match || !match.indices) return null;

  const leftIdx = match.indices[1];
  const rightIdx = match.indices[5];
  if (!leftIdx || !rightIdx) return null;

  if (touchesLetter(text, leftIdx[0], leftIdx[1])) return null;
  if (touchesLetter(text, rightIdx[0], rightIdx[1])) return null;

  const rawOp = match[3];
  const op = rawOp === "×" || rawOp.toLowerCase() === "x" ? "*" : rawOp;
  const left = match[1];
  const right = match[5];

  return {
    normalizedInput: `${left}${op}${right}`,
    verifiedFragment: match[0],
    matchStart: match.index ?? 0,
    matchEnd: (match.index ?? 0) + match[0].length,
  };
}

/**
 * How much of the original claim the verified fragment actually accounts
 * for. A claim that IS the expression (ignoring surrounding whitespace) is
 * FULL; a compound claim where the expression is only one clause ("20 users
 * x $15 = $300 MRR and they will all subscribe") is PARTIAL — the rest of
 * the proposition (adoption, MRR label, "all will subscribe") was never
 * verified and must not be reported as if it were.
 */
export function computeCoverage(
  originalClaim: string,
  candidate: { verifiedFragment: string }
): VerificationCoverage {
  const trimmedLen = originalClaim.trim().length;
  if (trimmedLen === 0) return "NONE";
  const fragmentLen = candidate.verifiedFragment.trim().length;
  const ratio = fragmentLen / trimmedLen;
  return ratio >= 0.85 ? "FULL" : "PARTIAL";
}

/** Must be run through findArithmeticCandidate first; kept separate so the
 * strict-grammar check (§16) can be unit tested independently of extraction. */
export function isStrictArithmeticGrammar(expression: string): boolean {
  return /^[\d\s+\-*/().%]+$/.test(expression);
}
