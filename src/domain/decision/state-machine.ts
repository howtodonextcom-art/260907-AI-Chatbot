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

export interface GatedTransitionContext {
  problem: string;
  objective?: string;
  optionCount: number;
  assumptionCount: number;
  highPriorityOpenUnknowns: number;
  domainValidationErrors: string[];
  userAskedGenerateOptions?: boolean;
}

export interface GatedTransitionResult {
  status: DecisionSessionStatus;
  applied: boolean;
  reason?: string;
}

/**
 * THE single canonical place that decides whether a proposed status
 * transition may actually take effect. AI (Analyst/Judge output) and API
 * callers may PROPOSE a transition; only this function may AUTHORIZE one.
 * Every state-changing path (PATCH route, orchestrator/applyAnalystState,
 * Judge-driven DECISION_READY, any future automated workflow) must call
 * this instead of re-implementing the checks inline — that duplication is
 * exactly how DECISION_READY got bypassable via Analyst.suggestedStatus
 * (see CLAUDE.md [[transition-gate-unification]]).
 *
 * DECIDED is never reachable here by design: it may only be assigned by
 * approveDecision() after HardPolicyGate passes.
 */
export function gateStatusTransition(
  current: DecisionSessionStatus,
  proposed: DecisionSessionStatus,
  ctx: GatedTransitionContext
): GatedTransitionResult {
  if (proposed === current) {
    return { status: current, applied: false };
  }
  if (proposed === "DECIDED") {
    return {
      status: current,
      applied: false,
      reason:
        "DECIDED can only be assigned by approveDecision() after HardPolicyGate — not via a proposed transition",
    };
  }
  if (!canTransition(current, proposed)) {
    return {
      status: current,
      applied: false,
      reason: `Illegal transition ${current} → ${proposed}`,
    };
  }
  if (proposed === "VALIDATING") {
    const ok = canEnterValidating({
      problem: ctx.problem,
      objective: ctx.objective,
      optionCount: ctx.optionCount,
      userAskedGenerateOptions: ctx.userAskedGenerateOptions,
    });
    if (!ok) {
      return {
        status: current,
        applied: false,
        reason: "canEnterValidating requirements not met",
      };
    }
  }
  if (proposed === "DECISION_READY") {
    const ok = canEnterDecisionReady({
      optionCount: ctx.optionCount,
      assumptionCount: ctx.assumptionCount,
      highPriorityOpenUnknowns: ctx.highPriorityOpenUnknowns,
      domainValidationErrors: ctx.domainValidationErrors,
    });
    if (!ok) {
      return {
        status: current,
        applied: false,
        reason: "canEnterDecisionReady requirements not met",
      };
    }
  }
  return { status: proposed, applied: true };
}
