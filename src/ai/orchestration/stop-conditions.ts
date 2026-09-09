import type { AiBudget, Assumption, Unknown } from "@/domain/decision/types";
import type { EvidenceItem } from "@/domain/evidence/types";
import { countBlockingHighUnknowns } from "@/domain/decision/unknown-policy";

export type StopReason =
  | "ENOUGH_EVIDENCE"
  | "LOW_DISAGREEMENT"
  | "NO_NEW_INFORMATION"
  | "BUDGET_EXHAUSTED"
  | "EXPERIMENT_REQUIRED"
  | "HUMAN_DECISION_REQUIRED"
  | "MAX_ROUNDS_REACHED"
  | null;

export interface BudgetTracker {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  rounds: number;
}

export interface StopContext {
  evidenceCoverage: number;
  blockingUnknownCount: number;
  disagreementScore?: number;
  newInformationScore?: number;
  experimentRequired: boolean;
  humanDecisionRequired: boolean;
  budget: AiBudget;
  tracker: BudgetTracker;
  verifiedEvidenceCount: number;
  unverifiedAssumptionCount: number;
}

export interface StopDecision {
  stop: boolean;
  reason: StopReason;
  rationale: string;
}

export function createBudgetTracker(): BudgetTracker {
  return { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, rounds: 0 };
}

export function canSpend(
  tracker: BudgetTracker,
  budget: AiBudget
): { ok: boolean; reason: StopReason } {
  if (tracker.calls >= budget.maxCalls) {
    return { ok: false, reason: "BUDGET_EXHAUSTED" };
  }
  if (tracker.inputTokens >= budget.maxInputTokens) {
    return { ok: false, reason: "BUDGET_EXHAUSTED" };
  }
  if (tracker.outputTokens >= budget.maxOutputTokens) {
    return { ok: false, reason: "BUDGET_EXHAUSTED" };
  }
  if (tracker.costUsd >= budget.maxCostUsd) {
    return { ok: false, reason: "BUDGET_EXHAUSTED" };
  }
  if (tracker.rounds >= budget.maxRounds) {
    return { ok: false, reason: "MAX_ROUNDS_REACHED" };
  }
  return { ok: true, reason: null };
}

export function recordUsage(
  tracker: BudgetTracker,
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
  }
): void {
  tracker.calls += 1;
  tracker.inputTokens += usage.inputTokens ?? 0;
  tracker.outputTokens += usage.outputTokens ?? 0;
  tracker.costUsd += usage.costUsd ?? 0;
}

export function evaluateStop(ctx: StopContext): StopDecision {
  const spend = canSpend(ctx.tracker, ctx.budget);
  if (!spend.ok) {
    return {
      stop: true,
      reason: spend.reason,
      rationale: `Budget/round limit reached (${spend.reason})`,
    };
  }
  if (ctx.humanDecisionRequired) {
    return {
      stop: true,
      reason: "HUMAN_DECISION_REQUIRED",
      rationale: "An unknown is marked HUMAN_DECISION_REQUIRED",
    };
  }
  if (ctx.experimentRequired) {
    return {
      stop: true,
      reason: "EXPERIMENT_REQUIRED",
      rationale: "Further debate is blocked until an experiment runs",
    };
  }
  if (
    ctx.blockingUnknownCount === 0 &&
    ctx.verifiedEvidenceCount >= 1 &&
    ctx.unverifiedAssumptionCount === 0 &&
    ctx.evidenceCoverage >= 0.6
  ) {
    return {
      stop: true,
      reason: "ENOUGH_EVIDENCE",
      rationale: "Required claims are verified and no blocking unknowns remain",
    };
  }
  if (ctx.disagreementScore !== undefined && ctx.disagreementScore <= 0.2) {
    return {
      stop: true,
      reason: "LOW_DISAGREEMENT",
      rationale: "Agents have converged; another critique cycle is not justified",
    };
  }
  if (ctx.newInformationScore !== undefined && ctx.newInformationScore <= 0.1) {
    return {
      stop: true,
      reason: "NO_NEW_INFORMATION",
      rationale: "Latest run repeated existing conclusions",
    };
  }
  return { stop: false, reason: null, rationale: "Continue" };
}

export function sessionStopFlags(args: {
  assumptions: Assumption[];
  unknowns: Unknown[];
  evidence: EvidenceItem[];
}): Pick<
  StopContext,
  | "blockingUnknownCount"
  | "experimentRequired"
  | "humanDecisionRequired"
  | "verifiedEvidenceCount"
  | "unverifiedAssumptionCount"
  | "evidenceCoverage"
> {
  const blockingUnknownCount = countBlockingHighUnknowns(args.unknowns);
  return {
    blockingUnknownCount,
    experimentRequired: args.unknowns.some(
      (u) => u.resolution === "EXPERIMENT_REQUIRED"
    ),
    humanDecisionRequired: args.unknowns.some(
      (u) => u.resolution === "HUMAN_DECISION_REQUIRED"
    ),
    verifiedEvidenceCount: args.evidence.filter(
      (e) => e.verificationStatus === "VERIFIED"
    ).length,
    unverifiedAssumptionCount: args.assumptions.filter(
      (a) => a.status === "UNVERIFIED"
    ).length,
    evidenceCoverage:
      args.evidence.length === 0
        ? 0
        : args.evidence.filter((e) => e.verificationStatus === "VERIFIED")
            .length / Math.max(1, args.assumptions.length || 1),
  };
}

/**
 * Transparent disagreement heuristic (0–1): higher = more disagreement.
 * Critic empty criticisms + no missingEvidence → low disagreement.
 * Never invent a score when Critic did not run (caller must omit).
 */
export function computeDisagreementScore(args: {
  criticismCount: number;
  missingEvidenceCount: number;
  contradictionCount: number;
}): number {
  const raw =
    args.criticismCount * 0.25 +
    args.missingEvidenceCount * 0.2 +
    args.contradictionCount * 0.3;
  return Math.min(1, raw);
}

/**
 * Transparent new-information heuristic (0–1) from contribution counts.
 * Zero new options/assumptions/risks → near zero.
 */
export function computeNewInformationScore(args: {
  newOptions: number;
  newAssumptions: number;
  newRisks: number;
  newUnknowns: number;
}): number {
  const raw =
    args.newOptions * 0.35 +
    args.newAssumptions * 0.25 +
    args.newRisks * 0.2 +
    args.newUnknowns * 0.2;
  return Math.min(1, raw);
}
