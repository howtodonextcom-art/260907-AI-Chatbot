import type { DomainPack } from "@/domain-packs/generic";
import {
  CHALLENGEREADY_INSTRUCTIONS,
  CHALLENGEREADY_SCHEMAS,
} from "@/domain-packs/challengeready/instructions";
import type { AgentRole, Criterion, DecisionRecord } from "@/domain/decision/types";

export const ChallengeReadyDomainPack: DomainPack = {
  id: "challengeready",
  version: "0.1.0",
  displayName: "ChallengeReady Reference Pack",

  async getContext() {
    return {
      vertical: "prop-trading-readiness",
      disclaimer:
        "Education and decision support only. Not financial advice. No trade execution.",
      preferredModules: [
        "Readiness Lab",
        "ChallengeGuard",
        "Training Arena",
        "AI Coach",
      ],
      forbidden: [
        "trading signals",
        "broker execution",
        "guaranteed FTMO pass",
      ],
    };
  },

  async runDeterministicChecks(input: unknown) {
    const text = JSON.stringify(input).toLowerCase();
    const hasSignalIntent =
      text.includes("buy/sell signal") ||
      text.includes("auto trade") ||
      text.includes("execute trades");
    return [
      {
        code: "NO_TRADE_EXECUTION",
        passed: !hasSignalIntent,
        message: hasSignalIntent
          ? "ChallengeReady pack forbids trade execution / signal bots in MVP scope"
          : "No trade-execution intent detected",
      },
      {
        code: "DISCLAIMER_AWARE",
        passed: true,
        message: "Training/decision-support boundary active",
      },
    ];
  },

  getRoleInstructions(role: AgentRole) {
    return CHALLENGEREADY_INSTRUCTIONS[role];
  },

  getOutputSchemaName(role: AgentRole) {
    return CHALLENGEREADY_SCHEMAS[role];
  },

  async validateDecision(decision: DecisionRecord) {
    const errors: string[] = [];
    const joined = [
      decision.problem,
      ...decision.rationale,
      ...decision.tradeoffs,
    ]
      .join(" ")
      .toLowerCase();
    if (joined.includes("guaranteed pass")) {
      errors.push("Must not claim guaranteed challenge pass");
    }
    if (!decision.reviewTriggers.length) {
      errors.push("Review triggers required");
    }
    return { valid: errors.length === 0, errors };
  },

  getDecisionCriteria(): Criterion[] {
    return [
      {
        id: "survival-first",
        name: "Survival & risk discipline",
        weight: 0.35,
        proposedBy: "DOMAIN_PACK",
        confirmedByUser: false,
      },
      {
        id: "learning-value",
        name: "Learning / readiness value",
        weight: 0.25,
        proposedBy: "DOMAIN_PACK",
        confirmedByUser: false,
      },
      {
        id: "implementation-speed",
        name: "Implementation speed",
        weight: 0.2,
        proposedBy: "DOMAIN_PACK",
        confirmedByUser: false,
      },
      {
        id: "commercial-clarity",
        name: "Commercial clarity",
        weight: 0.2,
        proposedBy: "DOMAIN_PACK",
        confirmedByUser: false,
      },
    ];
  },

  getToolConnectorIds() {
    return ["calculator"];
  },

  getEvaluationSuiteId() {
    return "challengeready-baseline";
  },
};
