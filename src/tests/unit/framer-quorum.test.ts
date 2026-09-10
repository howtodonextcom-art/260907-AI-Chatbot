import { describe, expect, it } from "vitest";
import {
  assertFramerQuorum,
  InsufficientFramersError,
  MIN_FRAMER_QUORUM,
} from "@/domain/decision/framer-quorum";
import { synthesizeConflicts } from "@/domain/decision/conflict-engine";
import type { IndependentFrame } from "@/domain/decision/types";

function frame(
  provider: IndependentFrame["provider"],
  overrides: Partial<IndependentFrame> = {}
): IndependentFrame {
  return {
    provider,
    reply: `${provider} reply`,
    problemFraming: overrides.problemFraming ?? `${provider} framing`,
    assumptions: overrides.assumptions ?? [],
    unknowns: overrides.unknowns ?? [],
    constraints: overrides.constraints ?? [],
    proposedOptions: overrides.proposedOptions,
  };
}

describe("framer quorum (V1 Silent Quorum Degradation)", () => {
  it("throws InsufficientFramersError when 2 of 3 framers fail", () => {
    const frames = [frame("gemini")];
    const failures = [
      { provider: "deepseek", error: "timeout" },
      { provider: "groq", error: "429" },
    ];
    expect(() =>
      assertFramerQuorum({
        frames,
        failures,
        attemptedProviders: ["gemini", "deepseek", "groq"],
      })
    ).toThrow(InsufficientFramersError);

    try {
      assertFramerQuorum({
        frames,
        failures,
        attemptedProviders: ["gemini", "deepseek", "groq"],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(InsufficientFramersError);
      const e = error as InsufficientFramersError;
      expect(e.successfulCount).toBe(1);
      expect(e.failures).toHaveLength(2);
      expect(e.message).toContain(`≥${MIN_FRAMER_QUORUM}`);
    }
  });

  it("blocks synthesizeConflicts (Conflict Engine) below quorum", () => {
    expect(() => synthesizeConflicts({ frames: [frame("gemini")] })).toThrow(
      InsufficientFramersError
    );
  });

  it("allows Conflict Engine when quorum met", () => {
    const report = synthesizeConflicts({
      frames: [
        frame("gemini", { problemFraming: "A" }),
        frame("deepseek", { problemFraming: "B" }),
      ],
    });
    expect(report.providerCount).toBe(2);
  });
});
