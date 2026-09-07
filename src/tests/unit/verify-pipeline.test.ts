import { describe, expect, it } from "vitest";
import { runVerifyPipeline } from "@/ai/orchestration/verify-pipeline";
import { GENERIC_DECISION_WORKFLOW } from "@/domain-packs/generic";
import type { DecisionSession } from "@/domain/decision/types";

function session(overrides: Partial<DecisionSession> = {}): DecisionSession {
  const now = "2026-09-07T00:00:00.000Z";
  return {
    id: "s1",
    workspaceId: "w1",
    ownerId: "u1",
    title: "T",
    problem: "P",
    constraints: [],
    assumptions: [
      {
        id: "a1",
        statement: "20 users × $15/month = $300 MRR",
        status: "UNVERIFIED",
        importance: "MEDIUM",
        evidenceIds: [],
      },
    ],
    unknowns: [],
    options: [],
    criteria: [],
    status: "VALIDATING",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("VERIFY pipeline", () => {
  it("runs calculator and marks CALCULATION evidence VERIFIED", async () => {
    const result = await runVerifyPipeline({
      session: session(),
      ownerId: "u1",
      domainPack: GENERIC_DECISION_WORKFLOW,
    });
    expect(result.events.some((e) => e.event === "tool.started")).toBe(true);
    expect(result.events.some((e) => e.event === "tool.completed")).toBe(true);
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0].type).toBe("CALCULATION");
    expect(result.evidence[0].verificationStatus).toBe("VERIFIED");
    expect(result.evidence[0].createdBy).toBe("TOOL");
    expect(result.sessionPatch.assumptions?.[0].status).toBe("SUPPORTED");
    expect(result.stopReason).toBe("ENOUGH_EVIDENCE");
  });

  it("does not invent verification when no arithmetic claim exists", async () => {
    const result = await runVerifyPipeline({
      session: session({
        assumptions: [
          {
            id: "a1",
            statement: "Users prefer a journal over a copier",
            status: "UNVERIFIED",
            importance: "HIGH",
            evidenceIds: [],
          },
        ],
      }),
      ownerId: "u1",
      domainPack: GENERIC_DECISION_WORKFLOW,
    });
    expect(result.evidence).toHaveLength(0);
    expect(result.stopReason).toBe("NOT_VERIFIABLE");
  });

  it("respects DomainPack tool allowlist", async () => {
    const pack = {
      ...GENERIC_DECISION_WORKFLOW,
      getToolConnectorIds: () => [] as string[],
    };
    const result = await runVerifyPipeline({
      session: session(),
      ownerId: "u1",
      domainPack: pack,
    });
    expect(result.stopReason).toBe("NOT_VERIFIABLE");
    expect(result.evidence).toHaveLength(0);
  });
});
