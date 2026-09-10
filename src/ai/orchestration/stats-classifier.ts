/**
 * Classifies whether a text fragment contains a GENUINE, unambiguous request
 * for real descriptive statistics on a user-supplied numeric dataset — as
 * opposed to loosely parsing natural language for "numbers that look like
 * data", which is exactly the false-positive-verification bug class already
 * fixed once for arithmetic (see CLAUDE.md [[ftmo-verify-classifier]]).
 *
 * Deliberately requires an explicit, structurally unambiguous tag —
 * `DATA=[n1, n2, ...]` — rather than free-text number extraction. No
 * ordinary sentence accidentally contains this exact tag, so there is no
 * "MT4/MT5"-style false-positive risk to guard against here: the trigger
 * itself is the safety property, not a post-hoc grammar check.
 */

export interface StatsCandidate {
  values: number[];
  /** The exact original substring the values were extracted from. */
  verifiedFragment: string;
  matchStart: number;
  matchEnd: number;
}

const DATA_TAG_RE =
  /DATA\s*=\s*\[\s*(-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?)+)\s*\]/i;

/**
 * Finds the first `DATA=[...]` tag in `text` with at least 2 numbers, or
 * null if none. Requires 2+ values because standard deviation/spread is
 * meaningless for a single point.
 */
export function findStatsCandidate(text: string): StatsCandidate | null {
  const match = text.match(DATA_TAG_RE);
  if (!match || match.index === undefined) return null;

  const values = match[1]
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v));

  if (values.length < 2) return null;

  return {
    values,
    verifiedFragment: match[0],
    matchStart: match.index,
    matchEnd: match.index + match[0].length,
  };
}
