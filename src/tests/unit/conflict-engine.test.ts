import { describe, expect, it } from "vitest";
import {
  detectFrameConflicts,
  summarizeParallelFraming,
  synthesizeConflicts,
} from "@/domain/decision/conflict-engine";
import type { IndependentFrame } from "@/domain/decision/types";

function frame(
  provider: IndependentFrame["provider"],
  overrides: Partial<IndependentFrame> = {}
): IndependentFrame {
  return {
    provider,
    reply: `${provider} reply`,
    problemFraming: overrides.problemFraming ?? `${provider} framing lens`,
    perspectiveName: overrides.perspectiveName,
    assumptions: overrides.assumptions ?? [],
    unknowns: overrides.unknowns ?? [],
    constraints: overrides.constraints ?? [],
    proposedOptions: overrides.proposedOptions,
  };
}

describe("Conflict Detection Engine", () => {
  it("extracts perspective disagreement across blind frames", () => {
    const frames = [
      frame("gemini", {
        problemFraming: "Product/UI first with Streamlit dashboard",
        perspectiveName: "Product/UI",
      }),
      frame("deepseek", {
        problemFraming: "Mathematical null-model and statistical edge tests",
        perspectiveName: "Null-model stats",
      }),
      frame("groq", {
        problemFraming: "Risk and overfitting critique of lottery strategies",
        perspectiveName: "Risk critic",
      }),
    ];
    const report = detectFrameConflicts({ frames });
    expect(report.providerCount).toBe(3);
    expect(report.conflictMap.coreDisagreements.length).toBeGreaterThan(0);
    expect(
      report.conflictMap.coreDisagreements[0]?.viewpoints.map((v) => v.provider)
    ).toEqual(["gemini", "deepseek", "groq"]);
    const summary = summarizeParallelFraming(frames, report);
    expect(summary).toContain("framers=3");
    expect(summary).toContain("gemini");
    expect(summary).toContain("deepseek");
    expect(summary).toContain("groq");
    expect(summary).not.toMatch(/Parallel Blind Framing complete/i);
  });

  it("flags assumptions raised by only one provider", () => {
    const report = detectFrameConflicts({
      frames: [
        frame("gemini", {
          assumptions: [
            {
              statement: "Historical draws are i.i.d.",
              importance: "HIGH",
              status: "UNVERIFIED",
            },
          ],
        }),
        frame("deepseek"),
        frame("groq"),
      ],
    });
    expect(
      report.assumptionDisagreements.some((d) => d.includes("i.i.d."))
    ).toBe(true);
  });

  it("synthesizeConflicts keeps all provider viewpoints (no LLM monopoly)", () => {
    const report = synthesizeConflicts({
      frames: [
        frame("gemini", {
          problemFraming: "UI-first Streamlit",
          perspectiveName: "Product",
          proposedOptions: [
            {
              title: "Dashboard MVP",
              description: "Ship UI",
              pros: [],
              cons: [],
              risks: [],
            },
          ],
        }),
        frame("deepseek", {
          problemFraming: "Null-model statistics",
          perspectiveName: "Stats",
          proposedOptions: [
            {
              title: "Chi-square battery",
              description: "Test uniformity",
              pros: [],
              cons: [],
              risks: [],
            },
          ],
        }),
      ],
    });
    const providers = new Set(
      report.conflictMap.coreDisagreements.flatMap((t) =>
        t.viewpoints.map((v) => v.provider)
      )
    );
    expect(providers.has("gemini")).toBe(true);
    expect(providers.has("deepseek")).toBe(true);
    expect(report.perspectives.map((p) => p.provider).sort()).toEqual([
      "deepseek",
      "gemini",
    ]);
  });
});
