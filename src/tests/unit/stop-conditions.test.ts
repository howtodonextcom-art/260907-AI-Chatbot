import { describe, expect, it } from "vitest";
import {
  canSpend,
  createBudgetTracker,
  evaluateStop,
  recordUsage,
  sessionStopFlags,
} from "@/ai/orchestration/stop-conditions";
import { DEFAULT_BUDGETS } from "@/config/ai-budget";

describe("stop conditions", () => {
  it("ENOUGH_EVIDENCE when verified claims cover assumptions", () => {
    const flags = sessionStopFlags({
      assumptions: [
        {
          id: "a",
          statement: "20*15=300",
          status: "SUPPORTED",
          importance: "MEDIUM",
          evidenceIds: ["e"],
        },
      ],
      unknowns: [],
      evidence: [
        {
          id: "e",
          workspaceId: "w",
          sessionId: "s",
          ownerId: "u",
          type: "CALCULATION",
          claim: "20*15=300",
          reliability: "HIGH",
          createdBy: "TOOL",
          supportsOptionIds: [],
          contradictsOptionIds: [],
          verificationStatus: "VERIFIED",
          createdAt: "2026-09-07T00:00:00.000Z",
        },
      ],
    });
    const stop = evaluateStop({
      ...flags,
      budget: DEFAULT_BUDGETS.DEEP,
      tracker: createBudgetTracker(),
    });
    expect(stop.stop).toBe(true);
    expect(stop.reason).toBe("ENOUGH_EVIDENCE");
  });

  it("EXPERIMENT_REQUIRED stops debate", () => {
    const stop = evaluateStop({
      evidenceCoverage: 0,
      blockingUnknownCount: 0,
      experimentRequired: true,
      humanDecisionRequired: false,
      verifiedEvidenceCount: 0,
      unverifiedAssumptionCount: 1,
      budget: DEFAULT_BUDGETS.DEEP,
      tracker: createBudgetTracker(),
    });
    expect(stop.reason).toBe("EXPERIMENT_REQUIRED");
  });

  it("HUMAN_DECISION_REQUIRED has priority over evidence", () => {
    const stop = evaluateStop({
      evidenceCoverage: 1,
      blockingUnknownCount: 0,
      experimentRequired: false,
      humanDecisionRequired: true,
      verifiedEvidenceCount: 5,
      unverifiedAssumptionCount: 0,
      budget: DEFAULT_BUDGETS.DEEP,
      tracker: createBudgetTracker(),
    });
    expect(stop.reason).toBe("HUMAN_DECISION_REQUIRED");
  });

  it("LOW_DISAGREEMENT stops extra critique", () => {
    const stop = evaluateStop({
      evidenceCoverage: 0.3,
      blockingUnknownCount: 1,
      experimentRequired: false,
      humanDecisionRequired: false,
      verifiedEvidenceCount: 0,
      unverifiedAssumptionCount: 1,
      disagreementScore: 0.1,
      budget: DEFAULT_BUDGETS.DEEP,
      tracker: createBudgetTracker(),
    });
    expect(stop.reason).toBe("LOW_DISAGREEMENT");
  });

  it("NO_NEW_INFORMATION stops repeats", () => {
    const stop = evaluateStop({
      evidenceCoverage: 0.3,
      blockingUnknownCount: 1,
      experimentRequired: false,
      humanDecisionRequired: false,
      verifiedEvidenceCount: 0,
      unverifiedAssumptionCount: 1,
      newInformationScore: 0.05,
      budget: DEFAULT_BUDGETS.DEEP,
      tracker: createBudgetTracker(),
    });
    expect(stop.reason).toBe("NO_NEW_INFORMATION");
  });

  it("BUDGET_EXHAUSTED after real recorded calls", () => {
    const tracker = createBudgetTracker();
    recordUsage(tracker, { inputTokens: 1, outputTokens: 1, costUsd: 0 });
    recordUsage(tracker, { inputTokens: 1, outputTokens: 1, costUsd: 0 });
    const spend = canSpend(tracker, { ...DEFAULT_BUDGETS.QUICK, maxCalls: 2 });
    expect(spend.ok).toBe(false);
    expect(spend.reason).toBe("BUDGET_EXHAUSTED");
  });
});
