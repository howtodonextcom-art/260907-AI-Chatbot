import { describe, expect, it } from "vitest";
import { gateStatusTransition } from "@/domain/decision/state-machine";
import { applyAnalystState } from "@/ai/orchestration/decision-orchestrator";
import type { DecisionSession } from "@/domain/decision/types";

describe("gateStatusTransition — single canonical authorization point", () => {
  it("never authorizes DECIDED, regardless of context", () => {
    const result = gateStatusTransition("DECISION_READY", "DECIDED", {
      problem: "p",
      objective: "o",
      optionCount: 5,
      assumptionCount: 5,
      highPriorityOpenUnknowns: 0,
      domainValidationErrors: [],
      contradictedAssumptionCount: 0,
    });
    expect(result.applied).toBe(false);
    expect(result.status).toBe("DECISION_READY");
  });

  it("rejects DECISION_READY when requirements are not met", () => {
    const result = gateStatusTransition("VALIDATING", "DECISION_READY", {
      problem: "p",
      objective: "o",
      optionCount: 0,
      assumptionCount: 0,
      highPriorityOpenUnknowns: 0,
      domainValidationErrors: [],
      contradictedAssumptionCount: 0,
    });
    expect(result.applied).toBe(false);
    expect(result.status).toBe("VALIDATING");
    expect(result.reason).toMatch(/canEnterDecisionReady/);
  });

  it("authorizes DECISION_READY when every requirement is met", () => {
    const result = gateStatusTransition("VALIDATING", "DECISION_READY", {
      problem: "p",
      objective: "o",
      optionCount: 1,
      assumptionCount: 1,
      highPriorityOpenUnknowns: 0,
      domainValidationErrors: [],
      contradictedAssumptionCount: 0,
    });
    expect(result.applied).toBe(true);
    expect(result.status).toBe("DECISION_READY");
  });

  it("rejects VALIDATING without an objective", () => {
    const result = gateStatusTransition("DISCOVERY", "VALIDATING", {
      problem: "p",
      objective: undefined,
      optionCount: 3,
      assumptionCount: 0,
      highPriorityOpenUnknowns: 0,
      domainValidationErrors: [],
      contradictedAssumptionCount: 0,
    });
    expect(result.applied).toBe(false);
  });

  it("rejects a structurally illegal edge even if content requirements are met", () => {
    const result = gateStatusTransition("DISCOVERY", "DECISION_READY", {
      problem: "p",
      objective: "o",
      optionCount: 5,
      assumptionCount: 5,
      highPriorityOpenUnknowns: 0,
      domainValidationErrors: [],
      contradictedAssumptionCount: 0,
    });
    expect(result.applied).toBe(false);
    expect(result.reason).toMatch(/Illegal transition/);
  });

  // P0-A: a CONTRADICTED assumption must block DECISION_READY even when
  // every other requirement (options, assumption count, no HIGH unknowns,
  // no domain errors) is otherwise satisfied — see CLAUDE.md
  // [[contradicted-decision-ready-gap]].
  it("rejects DECISION_READY when a CONTRADICTED assumption is present, even if all other requirements pass", () => {
    const result = gateStatusTransition("VALIDATING", "DECISION_READY", {
      problem: "p",
      objective: "o",
      optionCount: 1,
      assumptionCount: 2,
      highPriorityOpenUnknowns: 0,
      domainValidationErrors: [],
      contradictedAssumptionCount: 1,
    });
    expect(result.applied).toBe(false);
    expect(result.status).toBe("VALIDATING");
    expect(result.reason).toMatch(/canEnterDecisionReady/);
  });
});

function baseSession(overrides: Partial<DecisionSession>): DecisionSession {
  const now = new Date().toISOString();
  return {
    id: "s1",
    workspaceId: "w1",
    ownerId: "u1",
    title: "t",
    problem: "Should we do X?",
    objective: "Decide on X",
    constraints: [],
    assumptions: [],
    unknowns: [],
    options: [],
    criteria: [],
    status: "VALIDATING",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("applyAnalystState — Analyst cannot self-authorize DECISION_READY", () => {
  it("ignores a malicious/hallucinated suggestedStatus=DECISION_READY when the session has no options or assumptions", () => {
    const session = baseSession({ status: "VALIDATING", options: [], assumptions: [] });
    const patch = applyAnalystState(
      session,
      {
        assumptions: [],
        unknowns: [],
        options: [],
        suggestedStatus: "DECISION_READY",
      },
      "DISCUSS"
    );
    expect(patch.status).not.toBe("DECISION_READY");
    expect(patch.status).toBe("VALIDATING");
  });

  it("authorizes suggestedStatus=DECISION_READY when the session genuinely satisfies the gate", () => {
    const session = baseSession({
      status: "VALIDATING",
      options: [
        {
          id: "o1",
          title: "Option A",
          description: "d",
          pros: [],
          cons: [],
          risks: [],
          evidenceIds: [],
          status: "PROPOSED",
        },
      ],
      assumptions: [
        {
          id: "a1",
          statement: "assumption",
          status: "UNVERIFIED",
          importance: "LOW",
          evidenceIds: [],
        },
      ],
    });
    const patch = applyAnalystState(
      session,
      { assumptions: [], unknowns: [], options: [], suggestedStatus: "DECISION_READY" },
      "DISCUSS"
    );
    expect(patch.status).toBe("DECISION_READY");
  });

  it("ignores suggestedStatus=DECISION_READY when an existing assumption is CONTRADICTED, even though options/assumption-count requirements pass", () => {
    const session = baseSession({
      status: "VALIDATING",
      options: [
        {
          id: "o1",
          title: "Option A",
          description: "d",
          pros: [],
          cons: [],
          risks: [],
          evidenceIds: [],
          status: "PROPOSED",
        },
      ],
      assumptions: [
        {
          id: "a1",
          statement: "assumption believed false by evidence",
          status: "CONTRADICTED",
          importance: "HIGH",
          evidenceIds: [],
        },
      ],
    });
    const patch = applyAnalystState(
      session,
      { assumptions: [], unknowns: [], options: [], suggestedStatus: "DECISION_READY" },
      "DISCUSS"
    );
    expect(patch.status).not.toBe("DECISION_READY");
    expect(patch.status).toBe("VALIDATING");
  });

  it("still allows the conservative default advance DISCOVERY→VALIDATING when Analyst proposes nothing", () => {
    const session = baseSession({ status: "DISCOVERY", options: [] });
    const patch = applyAnalystState(
      session,
      {
        assumptions: [],
        unknowns: [],
        options: [{ title: "Opt", description: "d", pros: [], cons: [], risks: [] }],
      },
      "GENERATE_OPTIONS"
    );
    expect(patch.status).toBe("VALIDATING");
  });

  it("does not advance past DISCOVERY when there is no objective, even with options", () => {
    const session = baseSession({ status: "DISCOVERY", objective: undefined, options: [] });
    const patch = applyAnalystState(
      session,
      {
        assumptions: [],
        unknowns: [],
        options: [{ title: "Opt", description: "d", pros: [], cons: [], risks: [] }],
      },
      "GENERATE_OPTIONS"
    );
    expect(patch.status).toBe("DISCOVERY");
  });
});
