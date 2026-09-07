import type { AiBudget } from "@/domain/decision/types";

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
