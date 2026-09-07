import { describe, expect, it } from "vitest";
import {
  assertExperimentTransition,
  canTransitionExperiment,
  experimentDraftInput,
} from "@/domain/experiment/lifecycle";

describe("experiment lifecycle", () => {
  it("allows DRAFT → READY → RUNNING → COMPLETED", () => {
    expect(canTransitionExperiment("DRAFT", "READY")).toBe(true);
    expect(canTransitionExperiment("READY", "RUNNING")).toBe(true);
    expect(canTransitionExperiment("RUNNING", "COMPLETED")).toBe(true);
  });

  it("rejects COMPLETED → RUNNING", () => {
    expect(canTransitionExperiment("COMPLETED", "RUNNING")).toBe(false);
    expect(() => assertExperimentTransition("COMPLETED", "RUNNING")).toThrow();
  });

  it("draft input is not evidence", () => {
    const draft = experimentDraftInput({
      workspaceId: "w",
      sessionId: "s",
      ownerId: "u",
      hypothesis: "Price sensitivity",
    });
    expect(draft.status).toBe("DRAFT");
    expect(draft.limitations[0].toLowerCase()).toContain("not evidence");
  });
});
