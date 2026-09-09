import { describe, expect, it } from "vitest";
import {
  debateNotesHasContent,
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
});
