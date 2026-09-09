import { describe, expect, it } from "vitest";
import {
  debateNotesHasContent,
  hasSecondOpinionContribution,
  mergeDebateNotes,
  recordLastRunRole,
} from "@/domain/decision/debate-notes";

describe("debate notes", () => {
  it("merges and dedupes critic/SO contributions", () => {
    const merged = mergeDebateNotes(
      { criticisms: ["A"], unsupportedAssumptions: [], missingEvidence: [], divergentRisks: [] },
      {
        criticisms: ["a", "B"],
        divergentRisks: ["Lock-in"],
        soPreferredOptionTitle: "Gym",
      }
    );
    expect(merged.criticisms).toEqual(["A", "B"]);
    expect(merged.divergentRisks).toEqual(["Lock-in"]);
    expect(merged.soPreferredOptionTitle).toBe("Gym");
    expect(debateNotesHasContent(merged)).toBe(true);
  });

  it("treats empty notes as no content", () => {
    expect(
      debateNotesHasContent({
        criticisms: [],
        unsupportedAssumptions: [],
        missingEvidence: [],
        divergentRisks: [],
      })
    ).toBe(false);
  });

  it("records last-run roles including FAILED without dropping COMPLETED peers", () => {
    let roles = recordLastRunRole([], {
      role: "ANALYST",
      status: "COMPLETED",
      provider: "gemini",
    });
    roles = recordLastRunRole(roles, {
      role: "SECOND_OPINION",
      status: "FAILED",
      provider: "deepseek",
      message: "timeout",
    });
    expect(roles).toHaveLength(2);
    expect(roles.find((r) => r.role === "SECOND_OPINION")?.status).toBe("FAILED");
  });

  it("hasSecondOpinionContribution requires OPTIONS CURRENT + flag or debateNotes", () => {
    expect(hasSecondOpinionContribution(undefined)).toBe(false);
    expect(
      hasSecondOpinionContribution({
        currentStage: "OPTIONS",
        state: "IDLE",
        completedStages: ["OPTIONS"],
        routeMode: "DEEP",
        artifacts: {
          OPTIONS: {
            agentRunIds: ["analyst-only"],
            status: "CURRENT",
            updatedAt: "2026-09-10T00:00:00.000Z",
          },
        },
        blockers: [],
        usage: { calls: 1, inputTokens: 0, outputTokens: 0, costUsd: 0 },
      })
    ).toBe(false);
    expect(
      hasSecondOpinionContribution({
        currentStage: "OPTIONS",
        state: "IDLE",
        completedStages: ["OPTIONS"],
        routeMode: "DEEP",
        artifacts: {
          OPTIONS: {
            agentRunIds: ["so-1"],
            status: "CURRENT",
            updatedAt: "2026-09-10T00:00:00.000Z",
            contributions: { secondOpinion: true },
          },
        },
        blockers: [],
        usage: { calls: 2, inputTokens: 0, outputTokens: 0, costUsd: 0 },
      })
    ).toBe(true);
  });
});
