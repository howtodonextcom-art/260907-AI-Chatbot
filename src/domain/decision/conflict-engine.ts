import type {
  ConflictMap,
  ConflictTopic,
  FrameConflictReport,
  IndependentFrame,
} from "@/domain/decision/types";
import {
  assertFramerQuorum,
} from "@/domain/decision/framer-quorum";

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function groupByStatement<T>(
  frames: IndependentFrame[],
  pick: (frame: IndependentFrame) => T[],
  key: (item: T) => string
): Map<string, Set<IndependentFrame["provider"]>> {
  const groups = new Map<string, Set<IndependentFrame["provider"]>>();
  for (const frame of frames) {
    for (const item of pick(frame)) {
      const normalized = normalize(key(item));
      if (!normalized) continue;
      const providers = groups.get(normalized) ?? new Set();
      providers.add(frame.provider);
      groups.set(normalized, providers);
    }
  }
  return groups;
}

function uniqueByProviderGaps(
  groups: Map<string, Set<IndependentFrame["provider"]>>,
  providerCount: number,
  label: string
): string[] {
  return [...groups.entries()]
    .filter(([, providers]) => providers.size > 0 && providers.size < providerCount)
    .map(
      ([statement, providers]) =>
        `${label}: "${statement}" surfaced by ${[...providers].join(", ")} only`
    );
}

function buildPerspectiveTopics(frames: IndependentFrame[]): ConflictTopic[] {
  const withFraming = frames.filter((f) => f.problemFraming?.trim());
  if (withFraming.length < 2) return [];

  const normalized = new Set(
    withFraming.map((f) => normalize(f.problemFraming ?? "").slice(0, 160))
  );
  if (normalized.size <= 1) return [];

  return [
    {
      topic: "Problem framing / primary lens",
      viewpoints: withFraming.map((f) => ({
        provider: f.provider,
        stance: (f.perspectiveName?.trim() || f.problemFraming || f.reply)
          .trim()
          .slice(0, 400),
      })),
    },
  ];
}

function buildAssumptionTopics(
  frames: IndependentFrame[],
  providerCount: number
): ConflictTopic[] {
  const groups = groupByStatement(
    frames,
    (frame) => frame.assumptions,
    (assumption) => assumption.statement
  );
  const topics: ConflictTopic[] = [];
  for (const [statement, providers] of groups) {
    if (providers.size === 0 || providers.size >= providerCount) continue;
    topics.push({
      topic: `Assumption coverage: ${statement.slice(0, 120)}`,
      viewpoints: frames.map((f) => ({
        provider: f.provider,
        stance: providers.has(f.provider)
          ? `Asserts: ${statement.slice(0, 200)}`
          : "Silent / not raised",
      })),
    });
  }
  return topics.slice(0, 8);
}

function buildUnknownTopics(
  frames: IndependentFrame[],
  providerCount: number
): ConflictTopic[] {
  const groups = groupByStatement(
    frames,
    (frame) => frame.unknowns,
    (unknown) => unknown.question
  );
  const topics: ConflictTopic[] = [];
  for (const [question, providers] of groups) {
    if (providers.size === 0 || providers.size >= providerCount) continue;
    topics.push({
      topic: `Unknown coverage: ${question.slice(0, 120)}`,
      viewpoints: frames.map((f) => ({
        provider: f.provider,
        stance: providers.has(f.provider)
          ? `Raises: ${question.slice(0, 200)}`
          : "Silent / not raised",
      })),
    });
  }
  return topics.slice(0, 8);
}

/** Structural option-title AST comparison — no LLM rewrite of opposing frames. */
function buildOptionTitleTopics(
  frames: IndependentFrame[],
  providerCount: number
): ConflictTopic[] {
  const groups = groupByStatement(
    frames,
    (frame) => frame.proposedOptions ?? [],
    (option) => option.title
  );
  const topics: ConflictTopic[] = [];
  for (const [title, providers] of groups) {
    if (providers.size === 0 || providers.size >= providerCount) continue;
    topics.push({
      topic: `Option title coverage: ${title.slice(0, 120)}`,
      viewpoints: frames.map((f) => {
        const hit = (f.proposedOptions ?? []).find(
          (o) => normalize(o.title) === title
        );
        return {
          provider: f.provider,
          stance: hit
            ? `Proposes: ${hit.title.slice(0, 120)} — ${(hit.description ?? "").slice(0, 120)}`
            : "Silent / not proposed",
        };
      }),
    });
  }
  return topics.slice(0, 8);
}

/**
 * Round-robin structural cross-check: each provider's frame is treated as a
 * verification peer for every other provider's statements. Returns gaps that
 * a monopolistic synthesizer would hide. Purely deterministic — never calls
 * an LLM (closes Conflict Engine synthesis monopoly).
 */
function crossValidateFrames(frames: IndependentFrame[]): string[] {
  const notes: string[] = [];
  for (let i = 0; i < frames.length; i++) {
    const verifier = frames[i]!;
    const subject = frames[(i + 1) % frames.length]!;
    if (verifier.provider === subject.provider) continue;
    const verifierAssumptions = new Set(
      verifier.assumptions.map((a) => normalize(a.statement))
    );
    for (const a of subject.assumptions) {
      const key = normalize(a.statement);
      if (key && !verifierAssumptions.has(key)) {
        notes.push(
          `Cross-check ${verifier.provider}↛${subject.provider}: assumption "${a.statement.slice(0, 100)}" not mirrored`
        );
      }
    }
  }
  return notes.slice(0, 12);
}

/**
 * Deterministic Conflict Detection Engine — no LLM.
 * Compares independent blind frames and extracts core disagreements
 * before any downstream OPTIONS/CRITIQUE debate.
 */
export function detectFrameConflicts(args: {
  frames: IndependentFrame[];
  now?: string;
}): FrameConflictReport {
  const frames = args.frames;
  const providerCount = new Set(frames.map((frame) => frame.provider)).size;
  const assumptionGroups = groupByStatement(
    frames,
    (frame) => frame.assumptions,
    (assumption) => assumption.statement
  );
  const unknownGroups = groupByStatement(
    frames,
    (frame) => frame.unknowns,
    (unknown) => unknown.question
  );

  const assumptionDisagreements = uniqueByProviderGaps(
    assumptionGroups,
    providerCount,
    "Assumption"
  );
  const unknownDisagreements = uniqueByProviderGaps(
    unknownGroups,
    providerCount,
    "Unknown"
  );
  const crossCheckNotes = crossValidateFrames(frames);

  const conflictMap: ConflictMap = {
    coreDisagreements: [
      ...buildPerspectiveTopics(frames),
      ...buildAssumptionTopics(frames, providerCount),
      ...buildUnknownTopics(frames, providerCount),
      ...buildOptionTitleTopics(frames, providerCount),
    ],
  };

  const coreDisagreements = [
    ...conflictMap.coreDisagreements.map(
      (d) =>
        `${d.topic}: ${d.viewpoints.map((v) => `${v.provider}=${v.stance.slice(0, 80)}`).join(" | ")}`
    ),
    ...assumptionDisagreements.slice(0, 5),
    ...unknownDisagreements.slice(0, 5),
    ...crossCheckNotes.slice(0, 5),
  ];

  return {
    providerCount,
    coreDisagreements,
    conflictMap,
    assumptionDisagreements,
    unknownDisagreements,
    perspectives: frames.map((frame) => ({
      provider: frame.provider,
      framing: frame.problemFraming,
      perspectiveName: frame.perspectiveName,
      assumptionCount: frame.assumptions.length,
      unknownCount: frame.unknowns.length,
    })),
    generatedAt: args.now ?? new Date().toISOString(),
  };
}

/**
 * Public synthesis entry — enforces framer quorum then runs deterministic
 * AST/schema conflict extraction. Never delegates rewrite/censor to a single LLM.
 */
export function synthesizeConflicts(args: {
  frames: IndependentFrame[];
  now?: string;
}): FrameConflictReport {
  assertFramerQuorum({
    frames: args.frames,
    failures: [],
    attemptedProviders: args.frames.map((f) => f.provider),
  });
  return detectFrameConflicts(args);
}

/**
 * Neutral multi-frame summary for session.latestSummary — structural only.
 * Does not invent council prose; each line is provider-tagged raw framing.
 */
export function summarizeParallelFraming(
  frames: IndependentFrame[],
  report: FrameConflictReport
): string {
  const lines = [
    `framers=${report.providerCount}; conflictTopics=${report.conflictMap.coreDisagreements.length}`,
    ...frames.map((f) => {
      const framing = (f.problemFraming ?? f.reply).trim().slice(0, 280);
      return `[${f.provider}] ${framing}`;
    }),
  ];
  return lines.join("\n").slice(0, 8000);
}
