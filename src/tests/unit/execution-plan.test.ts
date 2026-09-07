import { describe, expect, it } from "vitest";
import { decideRouting } from "@/ai/orchestration/execution-plan";
import { isRegisteredOutputSchema } from "@/ai/agents/schema-registry";
import { GENERIC_DECISION_WORKFLOW } from "@/domain-packs/generic";
import { ChallengeReadyDomainPack } from "@/domain-packs/challengeready";
import { buildCoreContext } from "@/ai/orchestration/context-builder";

describe("execution plan", () => {
  it("VERIFY uses tools only", () => {
    const r = decideRouting({
      routeMode: "DEEP",
      intent: "VERIFY",
      evidenceCoverage: 0.2,
      importance: "HIGH",
    });
    expect(r.runVerifyTools).toBe(true);
    expect(r.runAnalyst).toBe(false);
    expect(r.runCritic).toBe(false);
    expect(r.runJudge).toBe(false);
    expect(r.plan.stages).toEqual(["VERIFY_TOOLS"]);
  });

  it("DEEP FRAME_PROBLEM is Analyst only", () => {
    const r = decideRouting({
      routeMode: "DEEP",
      intent: "FRAME_PROBLEM",
      evidenceCoverage: 0.2,
      importance: "MEDIUM",
    });
    expect(r.runAnalyst).toBe(true);
    expect(r.runCritic).toBe(false);
    expect(r.runJudge).toBe(false);
    expect(r.plan.estimatedCalls).toBe(1);
  });

  it("DEEP CRITIQUE does not run Analyst or Judge", () => {
    const r = decideRouting({
      routeMode: "DEEP",
      intent: "CRITIQUE",
      evidenceCoverage: 0.5,
      importance: "HIGH",
      hasDeepseek: false,
    });
    expect(r.runAnalyst).toBe(false);
    expect(r.runCritic).toBe(true);
    expect(r.runJudge).toBe(false);
    expect(r.runSecondOpinion).toBe(false);
  });
});

describe("DomainPack output schemas", () => {
  it("every pack schema name maps to a real Zod schema", () => {
    for (const pack of [GENERIC_DECISION_WORKFLOW, ChallengeReadyDomainPack]) {
      for (const role of ["ANALYST", "CRITIC", "JUDGE", "SECOND_OPINION"] as const) {
        expect(isRegisteredOutputSchema(pack.getOutputSchemaName(role))).toBe(
          true
        );
      }
    }
  });
});

describe("context isolation", () => {
  it("buildCoreContext does not inject ANALYST role instructions", async () => {
    const ctx = await buildCoreContext({
      session: {
        id: "s",
        workspaceId: "w",
        ownerId: "u",
        title: "T",
        problem: "P",
        constraints: [],
        assumptions: [],
        unknowns: [],
        options: [],
        criteria: [],
        status: "DISCOVERY",
        createdAt: "2026-09-07T00:00:00.000Z",
        updatedAt: "2026-09-07T00:00:00.000Z",
      },
      messages: [],
      evidence: [],
      domainPack: ChallengeReadyDomainPack,
      userId: "u",
      userRequest: "hello",
    });
    expect(ctx.systemInstructions).not.toContain(
      ChallengeReadyDomainPack.getRoleInstructions("ANALYST")
    );
    expect(ctx.systemInstructions).toContain("SYSTEM SECURITY POLICY");
  });
});
