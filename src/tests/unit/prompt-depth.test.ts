import { describe, expect, it } from "vitest";
import {
  CRITIC_BASE_V1,
  JUDGE_BASE_V1,
  SECOND_OPINION_BASE_V1,
  getPrompt,
} from "@/ai/prompts/registry";

describe("prompt depth (v17)", () => {
  it("DEEP SecondOpinion no longer contains fixed 3-4 sentence ceiling", () => {
    expect(SECOND_OPINION_BASE_V1.template).not.toMatch(/3-4 sentences/i);
    expect(SECOND_OPINION_BASE_V1.template).toContain("independentOptions");
    expect(SECOND_OPINION_BASE_V1.template).toContain("divergentRisks");
    expect(SECOND_OPINION_BASE_V1.template).toContain("keyAssumptions");
  });

  it("Critic covers required challenge responsibilities", () => {
    expect(CRITIC_BASE_V1.template).toMatch(/strongest counterargument/i);
    expect(CRITIC_BASE_V1.template).toMatch(/failure modes/i);
    expect(CRITIC_BASE_V1.template).toMatch(/missing evidence/i);
    expect(CRITIC_BASE_V1.template).toContain("Phản bác Analyst:");
    expect(CRITIC_BASE_V1.template).toMatch(/valid JSON only/i);
  });

  it("SecondOpinion reply must open with a divergent option prefix", () => {
    expect(SECOND_OPINION_BASE_V1.template).toContain("Phương án khác:");
  });

  it("Judge covers agreement / disagreement / remaining uncertainty", () => {
    expect(JUDGE_BASE_V1.template).toMatch(/material disagreement/i);
    expect(JUDGE_BASE_V1.template).toMatch(/remaining uncertainty/i);
    expect(JUDGE_BASE_V1.template).toMatch(/why the chosen option wins/i);
  });

  it("getPrompt returns updated SecondOpinion template", () => {
    const p = getPrompt("SECOND_OPINION");
    expect(p.template).not.toMatch(/3-4 sentences/i);
  });
});
