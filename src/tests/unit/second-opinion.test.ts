import { describe, expect, it } from "vitest";
import { SecondOpinionOutputSchema, JudgeOutputSchema } from "@/ai/agents/schemas";
import type { JudgeOutput } from "@/ai/agents/schemas";
import { getPrompt } from "@/ai/prompts/registry";
import { calculateHeuristicConfidence } from "@/domain/decision/confidence";
import {
  deriveAgentAgreement,
  AGREEMENT_LABEL_TO_SCORE,
} from "@/ai/orchestration/decision-orchestrator";

describe("SecondOpinionOutputSchema — independent opinion only, no self-reported agreement", () => {
  it("accepts a well-formed independent-opinion payload", () => {
    const parsed = SecondOpinionOutputSchema.safeParse({
      reply: "Prefer option B given the constraints.",
      recommendedDirection: "Go with a managed backend to reduce ops load.",
      preferredOptionTitle: "Option B",
      keyAssumptions: ["Team has no dedicated DevOps"],
      divergentRisks: ["Vendor lock-in"],
      additionalRisks: [],
      confidenceLabel: "MEDIUM",
    });
    expect(parsed.success).toBe(true);
  });

  it("has no agreesWithAnalyst/agreementScore fields — it never saw Analyst's output", () => {
    const parsed = SecondOpinionOutputSchema.parse({
      reply: "ok",
      recommendedDirection: "direction",
    });
    expect(parsed).not.toHaveProperty("agreesWithAnalyst");
    expect(parsed).not.toHaveProperty("agreementScore");
  });

  it("defaults optional fields when omitted", () => {
    const parsed = SecondOpinionOutputSchema.parse({
      reply: "ok",
      recommendedDirection: "direction",
    });
    expect(parsed.keyAssumptions).toEqual([]);
    expect(parsed.divergentRisks).toEqual([]);
    expect(parsed.confidenceLabel).toBe("MEDIUM");
  });

  it("requires recommendedDirection", () => {
    const parsed = SecondOpinionOutputSchema.safeParse({ reply: "ok" });
    expect(parsed.success).toBe(false);
  });
});

describe("JudgeOutputSchema.secondOpinionAgreement — Judge is the only legitimate source", () => {
  const baseJudge = {
    reply: "ok",
    decision: "ACCEPT" as const,
  };

  it("is valid when omitted (no second opinion ran this turn)", () => {
    const parsed = JudgeOutputSchema.safeParse(baseJudge);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.secondOpinionAgreement).toBeUndefined();
  });

  it("accepts a HIGH agreement with rationale (same recommendation case)", () => {
    const parsed = JudgeOutputSchema.safeParse({
      ...baseJudge,
      secondOpinionAgreement: {
        label: "HIGH",
        rationale: "Both recommended the same option for the same reasons.",
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a LOW agreement with rationale (different recommendation case)", () => {
    const parsed = JudgeOutputSchema.safeParse({
      ...baseJudge,
      secondOpinionAgreement: {
        label: "LOW",
        rationale: "Second opinion preferred a different option entirely.",
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a malformed agreement label", () => {
    const parsed = JudgeOutputSchema.safeParse({
      ...baseJudge,
      secondOpinionAgreement: { label: "VERY_HIGH", rationale: "x" },
    });
    expect(parsed.success).toBe(false);
  });
});

describe("prompt registry SECOND_OPINION", () => {
  it("returns a distinct prompt for SECOND_OPINION role", () => {
    const prompt = getPrompt("SECOND_OPINION");
    expect(prompt.role).toBe("SECOND_OPINION");
    expect(prompt.template).toMatch(/independent/i);
    expect(prompt.template).not.toBe(getPrompt("ANALYST").template);
  });

  it("explicitly tells SecondOpinion not to self-report agreement", () => {
    const prompt = getPrompt("SECOND_OPINION");
    expect(prompt.template).toMatch(/must not report any "agreement"/i);
  });
});

describe("deriveAgentAgreement — pure, testable derivation from Judge output", () => {
  it("returns UNAVAILABLE when second opinion did not run (Judge omitted it)", () => {
    const result = deriveAgentAgreement(undefined);
    expect(result.agentAgreementMethod).toBe("UNAVAILABLE");
    expect(result.agentAgreement).toBeUndefined();
    expect(result.agentAgreementRationale).toBeUndefined();
  });

  it("returns UNAVAILABLE when Judge's structured output failed to parse (malformed)", () => {
    // Simulates the orchestrator calling this with judge.structured === undefined
    // after schema validation + repair retry both failed.
    const judgeStructured = undefined as JudgeOutput | undefined;
    const result = deriveAgentAgreement(judgeStructured?.secondOpinionAgreement);
    expect(result.agentAgreementMethod).toBe("UNAVAILABLE");
  });

  it("maps HIGH label (same recommendation) to a high numeric score via JUDGE_HEURISTIC", () => {
    const result = deriveAgentAgreement({
      label: "HIGH",
      rationale: "Both picked the same option.",
    });
    expect(result.agentAgreementMethod).toBe("JUDGE_HEURISTIC");
    expect(result.agentAgreement).toBe(AGREEMENT_LABEL_TO_SCORE.HIGH);
    expect(result.agentAgreementRationale).toMatch(/same option/);
  });

  it("maps LOW label (different recommendation) to a low numeric score", () => {
    const result = deriveAgentAgreement({
      label: "LOW",
      rationale: "Recommended a different architecture entirely.",
    });
    expect(result.agentAgreementMethod).toBe("JUDGE_HEURISTIC");
    expect(result.agentAgreement).toBe(AGREEMENT_LABEL_TO_SCORE.LOW);
    expect(result.agentAgreement).toBeLessThan(AGREEMENT_LABEL_TO_SCORE.HIGH);
  });

  it("DeepSeek/second-opinion failure never reaches this function with a value — orchestrator omits the field, same as unavailable", () => {
    // A failed second-opinion run (network error, timeout) means
    // secondOpinionContent is never set, so it's never passed into Judge,
    // so Judge has nothing to compare and must omit secondOpinionAgreement.
    const result = deriveAgentAgreement(undefined);
    expect(result.agentAgreementMethod).toBe("UNAVAILABLE");
  });
});

describe("confidence uses real agentAgreement when provided", () => {
  it("a low second-opinion agreement score lowers confidence vs a high one", () => {
    const base = {
      evidenceCoverage: 0.6,
      sourceReliability: 0.6,
      unresolvedUnknownPenalty: 0.1,
      assumptionPenalty: 0.1,
      experimentStrength: 0.2,
    };
    const highAgreement = calculateHeuristicConfidence({
      ...base,
      agentAgreement: AGREEMENT_LABEL_TO_SCORE.HIGH,
    });
    const lowAgreement = calculateHeuristicConfidence({
      ...base,
      agentAgreement: AGREEMENT_LABEL_TO_SCORE.LOW,
    });
    expect(highAgreement.score).toBeGreaterThan(lowAgreement.score);
  });
});
