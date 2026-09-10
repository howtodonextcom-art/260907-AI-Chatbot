import type {
  DecisionSessionStatus,
  StatusTransitionAction,
} from "@/domain/decision/types";

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
  /**
   * P0-A fix: a CONTRADICTED assumption must never coexist with
   * DECISION_READY/DECIDED — the session's own reasoning foundation is
   * internally inconsistent. Mirrors the Pipeline Soft Gate's
   * EVIDENCE_CONTRADICTION pipeline blocker (workflow-stage.ts
   * collectPipelineBlockers), but that only stops the STAGE CONTROLLER
   * from advancing — it never gated this, the actual LEGAL authority for
   * DECISION_READY. Before this fix, an explicit-intent Judge run (H8
   * path) or a direct client PATCH could reach DECISION_READY with a
   * CONTRADICTED assumption still present, since this function never
   * checked assumption status at all (only count). See CLAUDE.md
   * [[contradicted-decision-ready-gap]].
   */
  contradictedAssumptionCount: number;
}): boolean {
  if (args.optionCount < 1) return false;
  if (args.assumptionCount < 1) return false;
  if (args.highPriorityOpenUnknowns > 0) return false;
  if (args.domainValidationErrors.length > 0) return false;
  if (args.contradictedAssumptionCount > 0) return false;
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
  contradictedAssumptionCount: number;
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
  ctx: GatedTransitionContext,
  action: StatusTransitionAction = { origin: "SYSTEM" }
): GatedTransitionResult {
  if (proposed === current) {
    return { status: current, applied: false };
  }
  if (proposed === "DECIDED") {
    if (action.origin === "HUMAN_APPROVE" && action.approve === true) {
      if (!canTransition(current, proposed)) {
        return {
          status: current,
          applied: false,
          reason: `Illegal transition ${current} → ${proposed}`,
        };
      }
      return { status: proposed, applied: true };
    }
    return {
      status: current,
      applied: false,
      reason:
        "DECIDED requires action.origin=HUMAN_APPROVE and explicit approve=true",
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
      contradictedAssumptionCount: ctx.contradictedAssumptionCount,
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
