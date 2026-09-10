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
  it("runs calculator on a compound claim but only PARTIALLY covers it — does not auto-SUPPORT (v13 §18/§46)", async () => {
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
    expect(result.evidence[0].verificationCoverage).toBe("PARTIAL");
    expect(result.evidence[0].originalClaim).toBe(session().assumptions[0].statement);
    // Evidence is still attached (visible, linked) but the compound claim
    // (MRR, "all users") was never verified — must not be auto-SUPPORTED.
    expect(result.sessionPatch.assumptions?.[0].status).toBe("UNVERIFIED");
    expect(result.sessionPatch.assumptions?.[0].evidenceIds).toHaveLength(1);
    expect(result.stopReason).toBe("ENOUGH_EVIDENCE");
  });

  it("marks a PURE arithmetic assumption SUPPORTED — FULL coverage (v13 §21)", async () => {
    const result = await runVerifyPipeline({
      session: session({
        assumptions: [
          {
            id: "a1",
            statement: "20*15",
            status: "UNVERIFIED",
            importance: "MEDIUM",
            evidenceIds: [],
          },
        ],
      }),
      ownerId: "u1",
      domainPack: GENERIC_DECISION_WORKFLOW,
    });
    expect(result.evidence[0].verificationCoverage).toBe("FULL");
    expect(result.sessionPatch.assumptions?.[0].status).toBe("SUPPORTED");
  });

  it("does NOT invoke the calculator on an identifier that merely contains digit/digit (MT4/MT5) — v13 §14-16/§45", async () => {
    const result = await runVerifyPipeline({
      session: session({
        assumptions: [],
        unknowns: [
          {
            id: "u1",
            question: "Should FTMO data import use MT4/MT5 upload or API?",
            importance: "HIGH",
            resolution: "OPEN",
            evidenceIds: [],
          },
        ],
      }),
      ownerId: "u1",
      domainPack: GENERIC_DECISION_WORKFLOW,
    });
    expect(result.events.some((e) => e.event === "tool.started")).toBe(false);
    expect(result.evidence).toHaveLength(0);
    expect(result.sessionPatch.unknowns?.[0].resolution).toBe("OPEN");
    expect(result.sessionPatch.unknowns?.[0].evidenceIds).toHaveLength(0);
    expect(result.stopReason).toBe("NOT_VERIFIABLE");
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

  it("runs stats.describe on a DATA=[...] unknown and marks it RESOLVED at FULL coverage", async () => {
    const result = await runVerifyPipeline({
      session: session({
        assumptions: [],
        unknowns: [
          {
            id: "u1",
            question: "DATA=[10,20,10,30,20,10]",
            importance: "HIGH",
            resolution: "OPEN",
            evidenceIds: [],
          },
        ],
      }),
      ownerId: "u1",
      domainPack: GENERIC_DECISION_WORKFLOW,
    });
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0].source).toBe("stats.describe");
    expect(result.evidence[0].verificationStatus).toBe("VERIFIED");
    expect(result.evidence[0].verificationCoverage).toBe("FULL");
    expect(result.sessionPatch.unknowns?.[0].resolution).toBe("RESOLVED");
  });

  it("attaches stats evidence to a compound claim but does not auto-SUPPORT it (PARTIAL coverage)", async () => {
    const result = await runVerifyPipeline({
      session: session({
        assumptions: [
          {
            id: "a1",
            statement:
              "Lottery draws should be uniform across numbers: DATA=[4,6,5,5,4,6,5] and users will trust the app more once we show this",
            status: "UNVERIFIED",
            importance: "HIGH",
            evidenceIds: [],
          },
        ],
      }),
      ownerId: "u1",
      domainPack: GENERIC_DECISION_WORKFLOW,
    });
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0].verificationCoverage).toBe("PARTIAL");
    expect(result.sessionPatch.assumptions?.[0].status).toBe("UNVERIFIED");
  });

  it("does not invoke stats when the DomainPack does not allow it", async () => {
    const pack = {
      ...GENERIC_DECISION_WORKFLOW,
      getToolConnectorIds: () => ["calculator"],
    };
    const result = await runVerifyPipeline({
      session: session({
        assumptions: [],
        unknowns: [
          {
            id: "u1",
            question: "DATA=[1,2,3,4]",
            importance: "HIGH",
            resolution: "OPEN",
            evidenceIds: [],
          },
        ],
      }),
      ownerId: "u1",
      domainPack: pack,
    });
    expect(result.evidence).toHaveLength(0);
    expect(result.sessionPatch.unknowns?.[0].resolution).toBe("OPEN");
  });
});
