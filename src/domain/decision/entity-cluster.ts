import type { Assumption, Unknown, UnknownResolution } from "@/domain/decision/types";
import type { EvidenceItem } from "@/domain/evidence/types";

/**
 * Conservative near-duplicate clustering for Unknowns / Assumptions.
 *
 * This is NOT an LLM pass and MUST NOT silently resolve HIGH blockers.
 * Exact-string dedupe already exists in parallel-frame-merge /
 * applyAnalystState; this layer only collapses high-similarity paraphrases.
 *
 * Safety invariants:
 * - Merge only when Jaccard(fingerprint) >= HIGH_SIMILARITY_THRESHOLD.
 * - Unknown importance = max(cluster). If ANY member is still blocking
 *   (HIGH + non-terminal resolution), the survivor MUST stay blocking —
 *   never collapse onto RESOLVED / HUMAN_DECISION / ACCEPTED_RISK.
 * - Assumption status: CONTRADICTED wins; never drop it. UNVERIFIED is
 *   not silently upgraded to SUPPORTED.
 */

export const HIGH_SIMILARITY_THRESHOLD = 0.8;

const TERMINAL_RESOLUTIONS = new Set<UnknownResolution>([
  "RESOLVED",
  "HUMAN_DECISION",
  "ACCEPTED_RISK",
]);

const IMPORTANCE_RANK: Record<"LOW" | "MEDIUM" | "HIGH", number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "to",
  "for",
  "in",
  "on",
  "and",
  "or",
  "is",
  "are",
  "was",
  "be",
  "as",
  "at",
  "by",
  "from",
  "with",
  "what",
  "whats",
  "how",
  "should",
  "we",
  "do",
  "does",
  "will",
  "can",
  "this",
  "that",
  "it",
  "la",
  "cua",
  "va",
  "cho",
  "voi",
  "mot",
  "cac",
  "nhung",
  "co",
  "khong",
  "hay",
  "hoac",
  "duoc",
  "nay",
  "do",
  "the",
  "nhu",
  "nao",
  "ra",
  "sao",
]);

export function normalizeEntityText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function contentWords(text: string): string[] {
  return normalizeEntityText(text)
    .split(" ")
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

function charNgrams(text: string, n = 3): string[] {
  const compact = normalizeEntityText(text).replace(/\s+/g, "");
  if (compact.length === 0) return [];
  if (compact.length < n) return [compact];
  const grams: string[] = [];
  for (let i = 0; i <= compact.length - n; i++) {
    grams.push(compact.slice(i, i + n));
  }
  return grams;
}

export function fingerprint(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const w of contentWords(text)) tokens.add(`w:${w}`);
  for (const g of charNgrams(text, 3)) tokens.add(`g:${g}`);
  return tokens;
}

export function jaccardSimilarity(a: string, b: string): number {
  const A = fingerprint(a);
  const B = fingerprint(b);
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) {
    if (B.has(x)) inter += 1;
  }
  return inter / (A.size + B.size - inter);
}

export function sharesContentTokens(
  a: string,
  b: string,
  minShared = 2
): boolean {
  const A = new Set(contentWords(a));
  const B = new Set(contentWords(b));
  let shared = 0;
  let strong = false;
  for (const w of A) {
    if (!B.has(w)) continue;
    shared += 1;
    if (w.length >= 5) strong = true;
  }
  if (shared >= minShared) return true;
  if (shared === 1 && strong) return true;
  return jaccardSimilarity(a, b) >= 0.35;
}

/**
 * P2+: evidence may close an Unknown only if it is explicitly linked to
 * that unknownId OR shares topical tokens with the question. No NLP stack.
 */
export function evidenceTopicallySupportsUnknown(
  evidence: EvidenceItem,
  unknown: Unknown
): boolean {
  const linked = evidence.supportsUnknownIds ?? [];
  if (linked.includes(unknown.id)) return true;
  const evText = [
    evidence.claim,
    evidence.originalClaim ?? "",
    evidence.verifiedFragment ?? "",
  ].join(" ");
  return sharesContentTokens(evText, unknown.question);
}

function maxImportance<T extends { importance: "LOW" | "MEDIUM" | "HIGH" }>(
  items: T[]
): "LOW" | "MEDIUM" | "HIGH" {
  return items.reduce<"LOW" | "MEDIUM" | "HIGH">(
    (best, item) =>
      IMPORTANCE_RANK[item.importance] > IMPORTANCE_RANK[best]
        ? item.importance
        : best,
    items[0].importance
  );
}

function isBlockingUnknown(u: Unknown): boolean {
  return u.importance === "HIGH" && !TERMINAL_RESOLUTIONS.has(u.resolution);
}

function pickUnknownResolution(items: Unknown[]): UnknownResolution {
  const anyBlocking = items.some(isBlockingUnknown);
  if (anyBlocking) {
    const nonTerminal = items.filter(
      (u) => !TERMINAL_RESOLUTIONS.has(u.resolution)
    );
    const open = nonTerminal.find((u) => u.resolution === "OPEN");
    return open?.resolution ?? nonTerminal[0].resolution;
  }
  return items[0].resolution;
}

function pickAssumptionStatus(items: Assumption[]): Assumption["status"] {
  if (items.some((a) => a.status === "CONTRADICTED")) return "CONTRADICTED";
  if (items.some((a) => a.status === "UNVERIFIED")) return "UNVERIFIED";
  if (items.some((a) => a.status === "ACCEPTED_FOR_NOW")) {
    return "ACCEPTED_FOR_NOW";
  }
  return "SUPPORTED";
}

function unionIds(lists: string[][]): string[] {
  return Array.from(new Set(lists.flat()));
}

function clusterByText<T>(
  items: T[],
  textOf: (item: T) => string,
  threshold: number
): T[][] {
  const n = items.length;
  if (n <= 1) return items.map((item) => [item]);

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    let x = i;
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (jaccardSimilarity(textOf(items[i]), textOf(items[j])) >= threshold) {
        union(i, j);
      }
    }
  }

  const groups = new Map<number, T[]>();
  const order: number[] = [];
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) {
      groups.set(root, []);
      order.push(root);
    }
    groups.get(root)!.push(items[i]);
  }
  return order.map((root) => groups.get(root)!);
}

function mergeUnknownCluster(items: Unknown[]): Unknown {
  const base = items[0];
  const resolution = pickUnknownResolution(items);
  const importance = maxImportance(items);
  const stillBlocking = items.some(isBlockingUnknown);
  const longest = items.reduce(
    (best, u) => (u.question.length > best.question.length ? u : best),
    base
  );
  const merged: Unknown = {
    ...base,
    question: longest.question,
    importance,
    resolution,
    evidenceIds: unionIds(items.map((u) => u.evidenceIds)),
  };
  if (stillBlocking || !TERMINAL_RESOLUTIONS.has(resolution)) {
    delete merged.resolutionNote;
    delete merged.resolvedAt;
    delete merged.resolvedBy;
  } else {
    const terminal = items.find(
      (u) => u.resolution === resolution && u.resolvedBy
    );
    if (terminal) {
      merged.resolutionNote = terminal.resolutionNote;
      merged.resolvedAt = terminal.resolvedAt;
      merged.resolvedBy = terminal.resolvedBy;
    }
  }
  return merged;
}

function mergeAssumptionCluster(items: Assumption[]): Assumption {
  const base = items[0];
  const longest = items.reduce(
    (best, a) => (a.statement.length > best.statement.length ? a : best),
    base
  );
  return {
    ...base,
    statement: longest.statement,
    importance: maxImportance(items),
    status: pickAssumptionStatus(items),
    evidenceIds: unionIds(items.map((a) => a.evidenceIds)),
  };
}

export function clusterUnknowns(
  unknowns: Unknown[],
  threshold = HIGH_SIMILARITY_THRESHOLD
): Unknown[] {
  return clusterByText(unknowns, (u) => u.question, threshold).map(
    mergeUnknownCluster
  );
}

export function clusterAssumptions(
  assumptions: Assumption[],
  threshold = HIGH_SIMILARITY_THRESHOLD
): Assumption[] {
  return clusterByText(assumptions, (a) => a.statement, threshold).map(
    mergeAssumptionCluster
  );
}
