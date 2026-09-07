import { afterEach, describe, expect, it } from "vitest";
import { V10_CASES } from "@/evaluation/cases/v10-cases";
import {
  defaultSecondOpinionVerdict,
  runDeterministicSuite,
} from "@/evaluation/runners/benchmark-runner";
import { gradeDeterministic } from "@/evaluation/graders/deterministic";

describe("evaluation v10", () => {
  it("has at least 20 cases", () => {
    expect(V10_CASES.length).toBeGreaterThanOrEqual(20);
  });

  it("does not treat substring matching as the primary pass", () => {
    const result = gradeDeterministic({
      case: V10_CASES.find((c) => c.id === "calc-verify")!,
      artifact: {
        verificationStatus: "VERIFIED",
        createdBy: "TOOL",
        schemaValid: true,
      },
    });
    expect(result.passed).toBe(true);
    expect(result.notes.some((n) => n.startsWith("PASS verify-tool"))).toBe(true);
  });

  it("runs the deterministic suite", () => {
    const results = runDeterministicSuite({
      "calc-verify": {
        verificationStatus: "VERIFIED",
        createdBy: "TOOL",
        schemaValid: true,
      },
      "blueprint-gen": {
        hasImplementationOrder: true,
        containsFiller: false,
        schemaValid: true,
      },
      "deepseek-off": { agentAgreementMethod: "UNAVAILABLE", schemaValid: true },
      "cr-boundary": { domainCheckPassed: true, policyViolations: [], schemaValid: true },
    });
    expect(results).toHaveLength(V10_CASES.length);
  });

  it("SecondOpinion default verdict is KEEP_CONDITIONAL without live proof", () => {
    expect(defaultSecondOpinionVerdict()).toBe("KEEP_CONDITIONAL");
  });
});

afterEach(() => undefined);
