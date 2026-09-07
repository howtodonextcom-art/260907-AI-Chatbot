import type {
  AgentRole,
  Criterion,
  DecisionRecord,
} from "@/domain/decision/types";

export interface DomainPack {
  id: string;
  version: string;
  displayName: string;

  getContext(args: {
    userId: string;
    workspaceId: string;
    sessionId: string;
  }): Promise<Record<string, unknown>>;

  runDeterministicChecks(input: unknown): Promise<
    Array<{
      code: string;
      passed: boolean;
      message: string;
      metadata?: Record<string, unknown>;
    }>
  >;

  getRoleInstructions(role: AgentRole): string;
  getOutputSchemaName(role: AgentRole): string;

  validateDecision(decision: DecisionRecord): Promise<{
    valid: boolean;
    errors: string[];
  }>;

  getDecisionCriteria?(): Criterion[];
  getToolConnectorIds?(): string[];
  getEvaluationSuiteId?(): string;
}

export const GENERIC_DECISION_WORKFLOW: DomainPack = {
  id: "generic-decision",
  version: "1.0.0",
  displayName: "Generic Decision Workflow",

  async getContext() {
    return {
      workflow: "generic-decision",
      guidance:
        "Frame problem → assumptions → options → evidence → critique → decision → blueprint",
    };
  },

  async runDeterministicChecks(input: unknown) {
    const obj = input as { problem?: string };
    return [
      {
        code: "PROBLEM_NONEMPTY",
        passed: Boolean(obj.problem?.trim()),
        message: obj.problem?.trim()
          ? "Problem is present"
          : "Problem statement is required",
      },
    ];
  },

  getRoleInstructions(role: AgentRole) {
    return `Domain: Generic Decision Workflow. Role: ${role}. Keep advice domain-agnostic.`;
  },

  getOutputSchemaName(role: AgentRole) {
    return `${role.toLowerCase()}_output_v1`;
  },

  async validateDecision(decision: DecisionRecord) {
    const errors: string[] = [];
    if (!decision.rationale.length) errors.push("Rationale required");
    if (!decision.reviewTriggers.length) {
      errors.push("At least one review trigger required");
    }
    if (decision.confidence.type !== "HEURISTIC") {
      errors.push("Confidence must be HEURISTIC");
    }
    return { valid: errors.length === 0, errors };
  },
};
