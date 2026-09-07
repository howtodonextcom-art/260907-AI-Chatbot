import type { DecisionSessionStatus } from "@/domain/decision/types";

const ALLOWED: Record<DecisionSessionStatus, DecisionSessionStatus[]> = {
  DISCOVERY: ["VALIDATING", "ARCHIVED"],
  VALIDATING: ["DISCOVERY", "DECISION_READY", "ARCHIVED"],
  DECISION_READY: ["VALIDATING", "DECIDED"],
  DECIDED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function canTransition(
  from: DecisionSessionStatus,
  to: DecisionSessionStatus
): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(
  from: DecisionSessionStatus,
  to: DecisionSessionStatus
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid session transition: ${from} → ${to}`);
  }
}

export function canEnterValidating(args: {
  problem: string;
  objective?: string;
  optionCount: number;
  userAskedGenerateOptions?: boolean;
}): boolean {
  if (!args.problem.trim()) return false;
  if (!args.objective?.trim()) return false;
  return args.optionCount > 0 || Boolean(args.userAskedGenerateOptions);
}

export function canEnterDecisionReady(args: {
  optionCount: number;
  assumptionCount: number;
  highPriorityOpenUnknowns: number;
  domainValidationErrors: string[];
}): boolean {
  if (args.optionCount < 1) return false;
  if (args.assumptionCount < 1) return false;
  if (args.highPriorityOpenUnknowns > 0) return false;
  if (args.domainValidationErrors.length > 0) return false;
  return true;
}
