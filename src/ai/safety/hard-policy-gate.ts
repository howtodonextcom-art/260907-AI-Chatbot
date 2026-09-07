export interface GateResult {
  passed: boolean;
  errors: Array<{
    code: string;
    message: string;
  }>;
}

export function hardPolicyGate(checks: Array<{
  code: string;
  passed: boolean;
  message: string;
}>): GateResult {
  const errors = checks
    .filter((c) => !c.passed)
    .map((c) => ({ code: c.code, message: c.message }));
  return { passed: errors.length === 0, errors };
}

export function gateDecisionApproval(args: {
  sessionStatus: string;
  approve: boolean;
  hasJudgeDraft: boolean;
  domainErrors: string[];
  budgetExceeded: boolean;
}): GateResult {
  return hardPolicyGate([
    {
      code: "SESSION_DECISION_READY",
      passed: args.sessionStatus === "DECISION_READY",
      message: "Session must be DECISION_READY",
    },
    {
      code: "EXPLICIT_APPROVAL",
      passed: args.approve === true,
      message: "Explicit user approval required",
    },
    {
      code: "JUDGE_DRAFT_EXISTS",
      passed: args.hasJudgeDraft,
      message: "Judge draft required",
    },
    {
      code: "DOMAIN_VALIDATION",
      passed: args.domainErrors.length === 0,
      message: args.domainErrors.join("; ") || "Domain validation passed",
    },
    {
      code: "BUDGET",
      passed: !args.budgetExceeded,
      message: "AI budget exceeded",
    },
  ]);
}

export function gateBlueprintCreation(args: {
  hasApprovedDecisionRecord: boolean;
}): GateResult {
  return hardPolicyGate([
    {
      code: "APPROVED_DECISION_REQUIRED",
      passed: args.hasApprovedDecisionRecord,
      message: "Blueprint requires an approved DecisionRecord",
    },
  ]);
}
