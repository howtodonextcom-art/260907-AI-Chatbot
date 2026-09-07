import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canEnterDecisionReady,
  canEnterValidating,
  canTransition,
} from "@/domain/decision/state-machine";
import { calculateHeuristicConfidence } from "@/domain/decision/confidence";
import { validateCriteriaWeights } from "@/domain/decision/schemas";
import { decideRouting } from "@/ai/orchestration/routing-policy";
import {
  canSpend,
  createBudgetTracker,
  recordUsage,
} from "@/ai/orchestration/stop-conditions";
import { DEFAULT_BUDGETS } from "@/config/ai-budget";
import {
  gateBlueprintCreation,
  gateDecisionApproval,
} from "@/ai/safety/hard-policy-gate";
import {
  MemoryWorkspaceRepository,
  resetMemoryDb,
} from "@/infrastructure/repositories/memory-store";
import { extractLastDebateRoles } from "@/features/chat/DebateTimeline";

describe("state machine", () => {
  it("allows DISCOVERY → VALIDATING", () => {
    expect(canTransition("DISCOVERY", "VALIDATING")).toBe(true);
  });

  it("rejects DECIDED → DECISION_READY", () => {
    expect(canTransition("DECIDED", "DECISION_READY")).toBe(false);
    expect(() => assertTransition("DECIDED", "DECISION_READY")).toThrow();
  });

  it("validates enter rules", () => {
    expect(
      canEnterValidating({
        problem: "x",
        objective: "y",
        optionCount: 0,
        userAskedGenerateOptions: true,
      })
    ).toBe(true);
    expect(
      canEnterDecisionReady({
        optionCount: 1,
        assumptionCount: 1,
        highPriorityOpenUnknowns: 0,
        domainValidationErrors: [],
      })
    ).toBe(true);
  });
});

describe("confidence", () => {
  it("returns heuristic confidence without fake precision", () => {
    const result = calculateHeuristicConfidence({
      evidenceCoverage: 0.8,
      sourceReliability: 0.7,
      unresolvedUnknownPenalty: 0.1,
      assumptionPenalty: 0.1,
      agentAgreement: 0.6,
      experimentStrength: 0.4,
    });
    expect(result.type).toBe("HEURISTIC");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(["LOW", "MEDIUM", "HIGH"]).toContain(result.label);
  });
});

describe("criteria weights", () => {
  it("accepts weights summing to 1", () => {
    expect(
      validateCriteriaWeights([{ weight: 0.4 }, { weight: 0.6 }])
    ).toBe(true);
  });
});

describe("routing", () => {
  it("QUICK is single call", () => {
    const r = decideRouting({
      routeMode: "QUICK",
      intent: "DISCUSS",
      evidenceCoverage: 0.2,
      importance: "LOW",
    });
    expect(r.runAnalyst).toBe(true);
    expect(r.runCritic).toBe(false);
    expect(r.runJudge).toBe(false);
  });

  it("STANDARD DISCUSS is Analyst only (no debate)", () => {
    const r = decideRouting({
      routeMode: "STANDARD",
      intent: "DISCUSS",
      evidenceCoverage: 0.2,
      importance: "MEDIUM",
    });
    expect(r.runAnalyst).toBe(true);
    expect(r.runCritic).toBe(false);
    expect(r.runJudge).toBe(false);
  });

  it("DEEP can include critic and judge", () => {
    const r = decideRouting({
      routeMode: "DEEP",
      intent: "PREPARE_DECISION",
      evidenceCoverage: 0.2,
      importance: "HIGH",
    });
    expect(r.runAnalyst).toBe(true);
    expect(r.runCritic).toBe(true);
    expect(r.runJudge).toBe(true);
  });
});

describe("budget", () => {
  it("stops when calls exhausted", () => {
    const tracker = createBudgetTracker();
    recordUsage(tracker, { inputTokens: 10, outputTokens: 10, costUsd: 0.01 });
    const result = canSpend(tracker, {
      ...DEFAULT_BUDGETS.QUICK,
      maxCalls: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("BUDGET_EXHAUSTED");
  });
});

describe("hard policy gate", () => {
  it("requires approval and decision-ready", () => {
    const gate = gateDecisionApproval({
      sessionStatus: "DISCOVERY",
      approve: true,
      hasJudgeDraft: true,
      domainErrors: [],
      budgetExceeded: false,
    });
    expect(gate.passed).toBe(false);
  });

  it("requires approved decision for blueprint", () => {
    expect(
      gateBlueprintCreation({ hasApprovedDecisionRecord: false }).passed
    ).toBe(false);
  });
});

describe("workspace ownership", () => {
  it("user A cannot read user B workspace", async () => {
    resetMemoryDb();
    const repo = new MemoryWorkspaceRepository();
    const now = new Date().toISOString();
    const ws = await repo.create({
      ownerId: "user-a",
      name: "A",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });
    const stolen = await repo.getById(ws.id, "user-b");
    expect(stolen).toBeNull();
    const owned = await repo.listByOwner("user-a");
    expect(owned).toHaveLength(1);
  });
});

describe("debate timeline", () => {
  it("extracts agent roles after last user message", () => {
    const roles = extractLastDebateRoles([
      {
        id: "1",
        workspaceId: "w",
        sessionId: "s",
        ownerId: "u",
        role: "USER",
        content: "hi",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "2",
        workspaceId: "w",
        sessionId: "s",
        ownerId: "u",
        role: "ASSISTANT",
        content: "a",
        agentRole: "ANALYST",
        createdAt: "2026-01-01T00:00:01.000Z",
      },
      {
        id: "3",
        workspaceId: "w",
        sessionId: "s",
        ownerId: "u",
        role: "ASSISTANT",
        content: "c",
        agentRole: "CRITIC",
        createdAt: "2026-01-01T00:00:02.000Z",
      },
    ]);
    expect(roles).toEqual(["ANALYST", "CRITIC"]);
  });
});
