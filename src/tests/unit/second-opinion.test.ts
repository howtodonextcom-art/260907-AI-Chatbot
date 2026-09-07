import { describe, expect, it } from "vitest";
import { SecondOpinionOutputSchema } from "@/ai/agents/schemas";
import { getPrompt } from "@/ai/prompts/registry";
import { calculateHeuristicConfidence } from "@/domain/decision/confidence";

describe("SecondOpinionOutputSchema", () => {
  it("accepts a well-formed payload", () => {
    const parsed = SecondOpinionOutputSchema.safeParse({
      reply: "I largely agree with the Analyst.",
      agreesWithAnalyst: true,
      agreementScore: 0.8,
      divergentPoints: ["Timeline seems optimistic"],
      additionalRisks: [],
    });
    expect(parsed.success).toBe(true);
  });

  it("defaults agreementScore/agreesWithAnalyst when omitted", () => {
    const parsed = SecondOpinionOutputSchema.parse({ reply: "ok" });
    expect(parsed.agreementScore).toBe(0.5);
    expect(parsed.agreesWithAnalyst).toBe(true);
    expect(parsed.divergentPoints).toEqual([]);
  });

  it("rejects agreementScore outside 0-1", () => {
    const parsed = SecondOpinionOutputSchema.safeParse({
      reply: "ok",
      agreementScore: 1.5,
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
      agentAgreement: 0.95,
    });
    const lowAgreement = calculateHeuristicConfidence({
      ...base,
      agentAgreement: 0.1,
    });
    expect(highAgreement.score).toBeGreaterThan(lowAgreement.score);
  });
});
