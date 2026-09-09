import { describe, expect, it } from "vitest";
import type { DecisionSession } from "@/domain/decision/types";
import {
  applyWorkflowProgress,
  decideWorkflowStage,
  detectMaterialInvalidation,
  emptyWorkflowMetadata,
  resolveIntentForRun,
} from "@/domain/decision/workflow-stage";

function baseSession(
  overrides: Partial<DecisionSession> = {}
): DecisionSession {
  const now = "2026-09-10T00:00:00.000Z";
  return {
    id: "s1",
    workspaceId: "w1",
    ownerId: "u1",
    title: "FTMO",
    problem: "Should we build a training web app for FTMO challenge traders?",
    objective: "Pick an MVP scope",
    constraints: [],
    assumptions: [],
    unknowns: [],
    options: [],
    criteria: [],
    status: "DISCOVERY",
    workflow: emptyWorkflowMetadata("STANDARD"),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("decideWorkflowStage", () => {
  it("new session → FRAME", () => {
    const session = baseSession({
      objective: undefined,
      latestSummary: undefined,
      problem: "Short",
    });
    const d = decideWorkflowStage({ session, routeMode: "STANDARD" });
    expect(d.nextStage).toBe("FRAME");
    expect(d.shouldAdvance).toBe(true);
    expect(d.state).toBe("RUNNING");
  });

  it("FRAME complete → OPTIONS", () => {
    const session = baseSession({
      latestSummary: "Framed as MVP readiness lab",
      workflow: {
        ...emptyWorkflowMetadata("DEEP"),
        currentStage: "FRAME",
        completedStages: ["FRAME"],
        artifacts: {
          FRAME: {
            agentRunIds: ["r1"],
            status: "CURRENT",
            updatedAt: "2026-09-10T00:00:00.000Z",
          },
        },
      },
    });
    const d = decideWorkflowStage({ session, routeMode: "DEEP" });
    expect(d.nextStage).toBe("OPTIONS");
  });

  it("OPTIONS complete → CRITIQUE", () => {
    const session = baseSession({
      latestSummary: "Framed",
      options: [
        {
          id: "o1",
          title: "A",
          description: "d",
          pros: [],
          cons: [],
          risks: [],
          evidenceIds: [],
          status: "PROPOSED",
          proposedBy: "ANALYST",
        },
      ],
      assumptions: [
        {
          id: "a1",
          statement: "Traders will pay",
          status: "UNVERIFIED",
          importance: "HIGH",
          evidenceIds: [],
        },
      ],
      workflow: {
        ...emptyWorkflowMetadata("DEEP"),
        currentStage: "OPTIONS",
        completedStages: ["FRAME", "OPTIONS"],
        artifacts: {
          FRAME: {
            agentRunIds: ["r1"],
            status: "CURRENT",
            updatedAt: "2026-09-10T00:00:00.000Z",
          },
          OPTIONS: {
            agentRunIds: ["r2"],
            status: "CURRENT",
            updatedAt: "2026-09-10T00:00:00.000Z",
          },
        },
      },
    });
    const d = decideWorkflowStage({ session, routeMode: "DEEP" });
    expect(d.nextStage).toBe("CRITIQUE");
  });

  it("CRITIQUE complete → VERIFY when assumptions need tools", () => {
    const session = baseSession({
      latestSummary: "Framed",
      options: [
        {
          id: "o1",
          title: "A",
          description: "d",
          pros: [],
          cons: [],
          risks: [],
          evidenceIds: [],
          status: "PROPOSED",
        },
      ],
      assumptions: [
        {
          id: "a1",
          statement: "20 users x $15",
          status: "UNVERIFIED",
          importance: "HIGH",
          evidenceIds: [],
        },
      ],
      workflow: {
        ...emptyWorkflowMetadata("DEEP"),
        currentStage: "CRITIQUE",
        completedStages: ["FRAME", "OPTIONS", "CRITIQUE"],
        artifacts: {
          FRAME: {
            agentRunIds: ["r1"],
            status: "CURRENT",
            updatedAt: "2026-09-10T00:00:00.000Z",
          },
          OPTIONS: {
            agentRunIds: ["r2"],
            status: "CURRENT",
            updatedAt: "2026-09-10T00:00:00.000Z",
          },
          CRITIQUE: {
            agentRunIds: ["r3"],
            status: "CURRENT",
            updatedAt: "2026-09-10T00:00:00.000Z",
          },
        },
      },
    });
    const d = decideWorkflowStage({ session, routeMode: "DEEP" });
    expect(d.nextStage).toBe("VERIFY");
  });

  it("VERIFY complete + ready → PREPARE", () => {
    const session = baseSession({
      latestSummary: "Framed",
      status: "VALIDATING",
      options: [
        {
          id: "o1",
          title: "A",
          description: "d",
          pros: [],
          cons: [],
          risks: [],
          evidenceIds: [],
          status: "PROPOSED",
        },
      ],
      assumptions: [
        {
          id: "a1",
          statement: "Users exist",
          status: "SUPPORTED",
          importance: "MEDIUM",
          evidenceIds: ["e1"],
        },
      ],
      workflow: {
        ...emptyWorkflowMetadata("DEEP"),
        currentStage: "VERIFY",
        completedStages: ["FRAME", "OPTIONS", "CRITIQUE", "VERIFY"],
        artifacts: {
          FRAME: {
            agentRunIds: ["r1"],
            status: "CURRENT",
            updatedAt: "2026-09-10T00:00:00.000Z",
          },
          OPTIONS: {
            agentRunIds: ["r2"],
            status: "CURRENT",
            updatedAt: "2026-09-10T00:00:00.000Z",
          },
          CRITIQUE: {
            agentRunIds: ["r3"],
            status: "CURRENT",
            updatedAt: "2026-09-10T00:00:00.000Z",
          },
          VERIFY: {
            agentRunIds: [],
            status: "CURRENT",
            updatedAt: "2026-09-10T00:00:00.000Z",
          },
        },
      },
    });
    const d = decideWorkflowStage({ session, routeMode: "DEEP" });
    expect(d.nextStage).toBe("PREPARE");
  });

  it("HIGH Unknown → PAUSED after options", () => {
    const session = baseSession({
      latestSummary: "Framed",
      options: [
        {
          id: "o1",
          title: "A",
          description: "d",
          pros: [],
          cons: [],
          risks: [],
          evidenceIds: [],
          status: "PROPOSED",
        },
      ],
      unknowns: [
        {
          id: "u1",
          question: "Upload MT4 or API?",
          importance: "HIGH",
          resolution: "OPEN",
          evidenceIds: [],
        },
      ],
      workflow: {
        ...emptyWorkflowMetadata("DEEP"),
        currentStage: "CRITIQUE",
        completedStages: ["FRAME", "OPTIONS", "CRITIQUE", "VERIFY"],
        artifacts: {
          FRAME: {
            agentRunIds: ["r1"],
            status: "CURRENT",
            updatedAt: "2026-09-10T00:00:00.000Z",
          },
          OPTIONS: {
            agentRunIds: ["r2"],
            status: "CURRENT",
            updatedAt: "2026-09-10T00:00:00.000Z",
          },
          CRITIQUE: {
            agentRunIds: ["r3"],
            status: "CURRENT",
            updatedAt: "2026-09-10T00:00:00.000Z",
          },
          VERIFY: {
            agentRunIds: [],
            status: "CURRENT",
            updatedAt: "2026-09-10T00:00:00.000Z",
          },
        },
      },
    });
    const d = decideWorkflowStage({ session, routeMode: "DEEP" });
    expect(d.state).toBe("PAUSED");
    expect(d.blockers).toContain("HIGH_UNKNOWNS_OPEN");
    expect(d.shouldAdvance).toBe(false);
  });

  it("resolution → resume toward PREPARE", () => {
    const session = baseSession({
      latestSummary: "Framed",
      status: "VALIDATING",
      options: [
        {
          id: "o1",
          title: "A",
          description: "d",
          pros: [],
          cons: [],
          risks: [],
          evidenceIds: [],
          status: "PROPOSED",
        },
      ],
      assumptions: [
        {
          id: "a1",
          statement: "Users exist",
          status: "SUPPORTED",
          importance: "MEDIUM",
          evidenceIds: ["e1"],
        },
      ],
      unknowns: [
        {
          id: "u1",
          question: "Upload MT4 or API?",
          importance: "HIGH",
          resolution: "HUMAN_DECISION",
          evidenceIds: [],
          resolutionNote: "Use API",
        },
      ],
      workflow: {
        ...emptyWorkflowMetadata("DEEP"),
        currentStage: "VERIFY",
        state: "PAUSED",
        completedStages: ["FRAME", "OPTIONS", "CRITIQUE", "VERIFY"],
        blockers: ["HIGH_UNKNOWNS_OPEN"],
        artifacts: {
          FRAME: {
            agentRunIds: ["r1"],
            status: "CURRENT",
            updatedAt: "2026-09-10T00:00:00.000Z",
          },
          OPTIONS: {
            agentRunIds: ["r2"],
            status: "CURRENT",
            updatedAt: "2026-09-10T00:00:00.000Z",
          },
          CRITIQUE: {
            agentRunIds: ["r3"],
            status: "CURRENT",
            updatedAt: "2026-09-10T00:00:00.000Z",
          },
          VERIFY: {
            agentRunIds: [],
            status: "CURRENT",
            updatedAt: "2026-09-10T00:00:00.000Z",
          },
        },
      },
    });
    const d = decideWorkflowStage({ session, routeMode: "DEEP" });
    expect(d.nextStage).toBe("PREPARE");
    expect(d.shouldAdvance).toBe(true);
  });

  it("DECISION_READY → stop COMPLETED", () => {
    const session = baseSession({
      status: "DECISION_READY",
      judgeDraft: {
        runId: "j1",
        problem: "p",
        decision: "ACCEPT",
        rationale: [],
        selectedEvidenceIds: [],
        rejectedOptions: [],
        acceptedAssumptionIds: [],
        unresolvedUnknownIds: [],
        tradeoffs: [],
        reviewTriggers: [],
        agentAgreementMethod: "UNAVAILABLE",
        confidenceLabel: "MEDIUM",
        confidenceScore: 50,
      },
    });
    const d = decideWorkflowStage({ session });
    expect(d.state).toBe("COMPLETED");
    expect(d.blockers).toContain("DECISION_READY");
    expect(d.shouldAdvance).toBe(false);
  });

  it("DECIDED → stop", () => {
    const session = baseSession({ status: "DECIDED" });
    const d = decideWorkflowStage({ session });
    expect(d.state).toBe("COMPLETED");
    expect(d.blockers).toContain("DECIDED");
  });

  it("new material constraint → backtrack OPTIONS", () => {
    const session = baseSession({
      latestSummary: "Framed",
      options: [
        {
          id: "o1",
          title: "A",
          description: "d",
          pros: [],
          cons: [],
          risks: [],
          evidenceIds: [],
          status: "PROPOSED",
        },
      ],
      constraints: [
        {
          id: "c1",
          statement: "Budget $100/month",
          source: "USER",
          confirmedByUser: true,
        },
      ],
      workflow: {
        ...emptyWorkflowMetadata("DEEP"),
        currentStage: "PREPARE",
        completedStages: ["FRAME", "OPTIONS", "CRITIQUE", "VERIFY"],
        artifacts: {
          OPTIONS: {
            agentRunIds: ["r2"],
            status: "CURRENT",
            updatedAt: "2026-09-10T00:00:00.000Z",
          },
        },
      },
    });
    const d = decideWorkflowStage({
      session,
      previousConstraintStatements: ["Budget $500/month"],
      lastHumanMessage: "Budget cut to $100/month only",
    });
    expect(d.invalidatedFromStage).toBe("OPTIONS");
    expect(d.nextStage).toBe("OPTIONS");
  });

  it("no-op information → no unnecessary backtrack", () => {
    expect(
      detectMaterialInvalidation({
        session: baseSession({
          options: [
            {
              id: "o1",
              title: "A",
              description: "d",
              pros: [],
              cons: [],
              risks: [],
              evidenceIds: [],
              status: "PROPOSED",
            },
          ],
        }),
        lastHumanMessage: "ok",
      })
    ).toBeNull();
  });
});

describe("resolveIntentForRun", () => {
  it("omitted intent uses StageController next stage", () => {
    const session = baseSession({
      objective: undefined,
      latestSummary: undefined,
      problem: "x",
    });
    const r = resolveIntentForRun({
      session,
      routeMode: "STANDARD",
    });
    expect(r.intent).toBe("FRAME_PROBLEM");
    expect(r.stage).toBe("FRAME");
  });

  it("explicit intent wins for Advanced/QA", () => {
    const r = resolveIntentForRun({
      session: baseSession(),
      routeMode: "DEEP",
      explicitIntent: "CRITIQUE",
    });
    expect(r.intent).toBe("CRITIQUE");
    expect(r.stage).toBe("CRITIQUE");
  });
});

describe("applyWorkflowProgress", () => {
  it("marks completed stage CURRENT and accumulates usage", () => {
    const wf = applyWorkflowProgress({
      workflow: emptyWorkflowMetadata("DEEP"),
      completedStage: "FRAME",
      agentRunIds: ["run-1"],
      usage: { calls: 1, costUsd: 0.01 },
    });
    expect(wf.completedStages).toContain("FRAME");
    expect(wf.artifacts.FRAME?.status).toBe("CURRENT");
    expect(wf.usage.calls).toBe(1);
  });
});
