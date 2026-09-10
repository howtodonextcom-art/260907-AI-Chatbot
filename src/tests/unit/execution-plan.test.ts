import { describe, expect, it } from "vitest";
import {
  decideRouting,
  roleTokenCeiling,
} from "@/ai/orchestration/execution-plan";
import { isRegisteredOutputSchema } from "@/ai/agents/schema-registry";
import { GENERIC_DECISION_WORKFLOW } from "@/domain-packs/generic";
import { ChallengeReadyDomainPack } from "@/domain-packs/challengeready";
import { buildCoreContext } from "@/ai/orchestration/context-builder";
import type { RouteMode } from "@/domain/decision/types";

const MODES: RouteMode[] = ["QUICK", "STANDARD", "DEEP"];
const INTENTS = [
  "DISCUSS",
  "FRAME_PROBLEM",
  "GENERATE_OPTIONS",
  "CRITIQUE",
  "VERIFY",
  "PREPARE_DECISION",
] as const;

describe("execution plan — Mode × Stage matrix", () => {
  it("covers every Mode × Stage without throwing", () => {
    for (const routeMode of MODES) {
      for (const intent of INTENTS) {
        const r = decideRouting({
          routeMode,
          intent,
          evidenceCoverage: 0.3,
          importance: "HIGH",
          hasDeepseek: true,
        });
        expect(r.plan.workflowStage).toBeTruthy();
        expect(r.plan.estimatedCalls).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("VERIFY uses tools only across modes", () => {
    for (const routeMode of MODES) {
      const r = decideRouting({
        routeMode,
        intent: "VERIFY",
        evidenceCoverage: 0.2,
        importance: "HIGH",
      });
      expect(r.runVerifyTools).toBe(true);
      expect(r.runAnalyst).toBe(false);
      expect(r.runCritic).toBe(false);
      expect(r.runJudge).toBe(false);
      expect(r.plan.stages).toContain("VERIFY_TOOLS");
    }
  });

  it("DEEP FRAME uses Parallel Blind Framing — not Gemini monopoly", () => {
    const plain = decideRouting({
      routeMode: "DEEP",
      intent: "FRAME_PROBLEM",
      evidenceCoverage: 0.2,
      importance: "MEDIUM",
    });
    expect(plain.runParallelFraming).toBe(true);
    expect(plain.runAnalyst).toBe(false);
    expect(plain.runCritic).toBe(false);
    expect(plain.runSecondOpinion).toBe(false);
    expect(plain.plan.stages).toContain("PARALLEL_FRAME");

    const discuss = decideRouting({
      routeMode: "DEEP",
      intent: "DISCUSS",
      evidenceCoverage: 0.2,
      importance: "MEDIUM",
    });
    expect(discuss.runParallelFraming).toBe(true);
    expect(discuss.runAnalyst).toBe(false);
  });

  it("DEEP OPTIONS runs Analyst + SecondOpinion in parallel", () => {
    const r = decideRouting({
      routeMode: "DEEP",
      intent: "GENERATE_OPTIONS",
      evidenceCoverage: 0.2,
      importance: "MEDIUM",
      hasDeepseek: true,
    });
    expect(r.runAnalyst).toBe(true);
    expect(r.runSecondOpinion).toBe(true);
    expect(r.runCritic).toBe(false);
    expect(r.runJudge).toBe(false);
  });

  it("DEEP CRITIQUE skips SO when it already contributed", () => {
    const r = decideRouting({
      routeMode: "DEEP",
      intent: "CRITIQUE",
      evidenceCoverage: 0.5,
      importance: "HIGH",
      hasDeepseek: true,
      secondOpinionAlreadyContributed: true,
    });
    expect(r.runAnalyst).toBe(false);
    expect(r.runCritic).toBe(true);
    expect(r.runSecondOpinion).toBe(false);
  });

  it("DEEP CRITIQUE re-runs SO when userRequestedChallenge even if already contributed", () => {
    const r = decideRouting({
      routeMode: "DEEP",
      intent: "CRITIQUE",
      evidenceCoverage: 0.5,
      importance: "HIGH",
      hasDeepseek: true,
      secondOpinionAlreadyContributed: true,
      userRequestedChallenge: true,
    });
    expect(r.runSecondOpinion).toBe(true);
    expect(r.runCritic).toBe(true);
  });

  it("DEEP PREPARE is Judge only — no full council rerun", () => {
    const r = decideRouting({
      routeMode: "DEEP",
      intent: "PREPARE_DECISION",
      evidenceCoverage: 0.5,
      importance: "HIGH",
      hasDeepseek: true,
    });
    expect(r.runAnalyst).toBe(false);
    expect(r.runSecondOpinion).toBe(false);
    expect(r.runCritic).toBe(false);
    expect(r.runJudge).toBe(true);
    expect(r.plan.estimatedCalls).toBe(1);
  });

  // QUICK/STANDARD-specific routing behavior (Analyst-only debate,
  // single-call economy mode) no longer exists — v18, see CLAUDE.md
  // [[deep-only]]. RunSessionSchema now rejects any routeMode but "DEEP",
  // so a legacy routeMode="STANDARD" value can only ever reach
  // decideRouting() from a pre-existing Firestore session, in which case
  // it now falls through to identical DEEP behavior (proven by "covers
  // every Mode × Stage without throwing" and "VERIFY uses tools only
  // across modes" above, which still iterate MODES including the legacy
  // values) rather than crashing.
});

describe("role token ceilings", () => {
  it("uses v17 DEEP caps", () => {
    expect(roleTokenCeiling("ANALYST", "DEEP")).toBe(4000);
    expect(roleTokenCeiling("SECOND_OPINION", "DEEP")).toBe(2500);
    expect(roleTokenCeiling("CRITIC", "DEEP")).toBe(2500);
    expect(roleTokenCeiling("JUDGE", "DEEP")).toBe(4000);
    expect(roleTokenCeiling("ANALYST", "STANDARD")).toBe(3500);
    expect(roleTokenCeiling("JUDGE", "STANDARD")).toBe(3500);
    expect(roleTokenCeiling("ANALYST", "QUICK")).toBe(2000);
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
