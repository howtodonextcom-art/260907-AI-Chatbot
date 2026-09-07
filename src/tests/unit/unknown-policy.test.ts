import { describe, expect, it } from "vitest";
import {
  computeReadiness,
  countBlockingHighUnknowns,
  isUnknownBlocking,
  resolveUnknown,
} from "@/domain/decision/unknown-policy";
import type { Unknown } from "@/domain/decision/types";
import type { EvidenceItem } from "@/domain/evidence/types";

function unknown(overrides: Partial<Unknown> = {}): Unknown {
  return {
    id: "u1",
    question: "Should FTMO data import use MT4/MT5 upload or API?",
    importance: "HIGH",
    resolution: "OPEN",
    evidenceIds: [],
    ...overrides,
  };
}

function verifiedEvidence(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    id: "e1",
    workspaceId: "w1",
    sessionId: "s1",
    ownerId: "u1",
    type: "CALCULATION",
    claim: "4/5 = 0.8",
    reliability: "HIGH",
    createdBy: "TOOL",
    supportsOptionIds: [],
    contradictsOptionIds: [],
    verificationStatus: "VERIFIED",
    createdAt: "2026-09-08T00:00:00.000Z",
    ...overrides,
  };
}

describe("isUnknownBlocking / countBlockingHighUnknowns (v13 §10, §40)", () => {
  it("HIGH + OPEN blocks", () => {
    expect(isUnknownBlocking(unknown({ resolution: "OPEN" }))).toBe(true);
  });

  it("HIGH + VERIFY_NOW still blocks — flagged, not resolved", () => {
    expect(isUnknownBlocking(unknown({ resolution: "VERIFY_NOW" }))).toBe(true);
  });

  it("HIGH + EXPERIMENT_REQUIRED still blocks", () => {
    expect(isUnknownBlocking(unknown({ resolution: "EXPERIMENT_REQUIRED" }))).toBe(
      true
    );
  });

  it("HIGH + HUMAN_DECISION_REQUIRED still blocks — requested, not decided", () => {
    expect(
      isUnknownBlocking(unknown({ resolution: "HUMAN_DECISION_REQUIRED" }))
    ).toBe(true);
  });

  it("HIGH + RESOLVED no longer blocks", () => {
    expect(isUnknownBlocking(unknown({ resolution: "RESOLVED" }))).toBe(false);
  });

  it("HIGH + HUMAN_DECISION (actually decided) no longer blocks", () => {
    expect(isUnknownBlocking(unknown({ resolution: "HUMAN_DECISION" }))).toBe(
      false
    );
  });

  it("HIGH + ACCEPTED_RISK no longer blocks", () => {
    expect(isUnknownBlocking(unknown({ resolution: "ACCEPTED_RISK" }))).toBe(
      false
    );
  });

  it("MEDIUM/LOW never blocks regardless of resolution", () => {
    expect(isUnknownBlocking(unknown({ importance: "MEDIUM", resolution: "OPEN" }))).toBe(
      false
    );
    expect(isUnknownBlocking(unknown({ importance: "LOW", resolution: "OPEN" }))).toBe(
      false
    );
  });

  it("counts only blocking HIGH unknowns", () => {
    const list = [
      unknown({ id: "a", resolution: "OPEN" }),
      unknown({ id: "b", resolution: "RESOLVED" }),
      unknown({ id: "c", importance: "MEDIUM", resolution: "OPEN" }),
      unknown({ id: "d", resolution: "HUMAN_DECISION" }),
      unknown({ id: "e", resolution: "OPEN" }),
    ];
    expect(countBlockingHighUnknowns(list)).toBe(2);
  });
});

describe("resolveUnknown (v13 §8-9)", () => {
  const ctx = (evidence: EvidenceItem[] = []) => ({
    ownerId: "owner-1",
    now: "2026-09-08T00:00:00.000Z",
    sessionEvidence: evidence,
  });

  it("VERIFY_NOW just flags — does not resolve", () => {
    const result = resolveUnknown(unknown(), { kind: "VERIFY_NOW" }, ctx());
    expect(result.applied).toBe(true);
    expect(result.unknown.resolution).toBe("VERIFY_NOW");
    expect(isUnknownBlocking(result.unknown)).toBe(true);
  });

  it("MARK_EXPERIMENT just flags — does not resolve", () => {
    const result = resolveUnknown(unknown(), { kind: "MARK_EXPERIMENT" }, ctx());
    expect(result.unknown.resolution).toBe("EXPERIMENT_REQUIRED");
    expect(isUnknownBlocking(result.unknown)).toBe(true);
  });

  it("rejects RESOLVE_WITH_EVIDENCE with empty evidenceIds (no empty-resolve bypass)", () => {
    const result = resolveUnknown(
      unknown(),
      { kind: "RESOLVE_WITH_EVIDENCE", evidenceIds: [] },
      ctx()
    );
    expect(result.applied).toBe(false);
    expect(result.unknown.resolution).toBe("OPEN");
  });

  it("rejects RESOLVE_WITH_EVIDENCE referencing evidence outside this session", () => {
    const result = resolveUnknown(
      unknown(),
      { kind: "RESOLVE_WITH_EVIDENCE", evidenceIds: ["does-not-exist"] },
      ctx([])
    );
    expect(result.applied).toBe(false);
  });

  it("rejects RESOLVE_WITH_EVIDENCE referencing unverified evidence", () => {
    const ev = verifiedEvidence({ verificationStatus: "UNVERIFIED" });
    const result = resolveUnknown(
      unknown(),
      { kind: "RESOLVE_WITH_EVIDENCE", evidenceIds: [ev.id] },
      ctx([ev])
    );
    expect(result.applied).toBe(false);
  });

  it("accepts RESOLVE_WITH_EVIDENCE with real VERIFIED evidence and records provenance", () => {
    const ev = verifiedEvidence();
    const result = resolveUnknown(
      unknown(),
      { kind: "RESOLVE_WITH_EVIDENCE", evidenceIds: [ev.id] },
      ctx([ev])
    );
    expect(result.applied).toBe(true);
    expect(result.unknown.resolution).toBe("RESOLVED");
    expect(result.unknown.evidenceIds).toContain(ev.id);
    expect(result.unknown.resolvedBy).toBe("owner-1");
    expect(result.unknown.resolvedAt).toBe("2026-09-08T00:00:00.000Z");
    expect(isUnknownBlocking(result.unknown)).toBe(false);
  });

  it("rejects empty resolution note for HUMAN_DECISION", () => {
    const result = resolveUnknown(
      unknown(),
      { kind: "HUMAN_DECISION", resolutionNote: "   " },
      ctx()
    );
    expect(result.applied).toBe(false);
  });

  it("HUMAN_DECISION with a note is recorded as HUMAN_DECISION, not RESOLVED/verified fact", () => {
    const result = resolveUnknown(
      unknown(),
      {
        kind: "HUMAN_DECISION",
        resolutionNote: "Product owner chose MT4/MT5 upload for MVP scope.",
      },
      ctx()
    );
    expect(result.applied).toBe(true);
    expect(result.unknown.resolution).toBe("HUMAN_DECISION");
    expect(result.unknown.resolution).not.toBe("RESOLVED");
    expect(result.unknown.resolutionNote).toMatch(/MT4\/MT5/);
    expect(isUnknownBlocking(result.unknown)).toBe(false);
  });

  it("rejects empty resolution note for ACCEPT_RISK", () => {
    const result = resolveUnknown(
      unknown(),
      { kind: "ACCEPT_RISK", resolutionNote: "" },
      ctx()
    );
    expect(result.applied).toBe(false);
  });

  it("ACCEPT_RISK with a note unblocks and preserves provenance", () => {
    const result = resolveUnknown(
      unknown(),
      {
        kind: "ACCEPT_RISK",
        resolutionNote: "Accepted as residual risk for MVP launch.",
      },
      ctx()
    );
    expect(result.applied).toBe(true);
    expect(result.unknown.resolution).toBe("ACCEPTED_RISK");
    expect(result.unknown.resolvedBy).toBe("owner-1");
    expect(isUnknownBlocking(result.unknown)).toBe(false);
  });
});

describe("computeReadiness (v13 §31 — deterministic, no LLM)", () => {
  it("ready=true with no blockers when everything is satisfied", () => {
    const readiness = computeReadiness({
      optionCount: 2,
      assumptionCount: 3,
      unknowns: [unknown({ resolution: "RESOLVED" })],
      contradictedAssumptionCount: 0,
    });
    expect(readiness.ready).toBe(true);
    expect(readiness.blocking).toHaveLength(0);
  });

  it("reports machine-readable blocker codes, not just strings", () => {
    const readiness = computeReadiness({
      optionCount: 0,
      assumptionCount: 0,
      unknowns: [unknown({ resolution: "OPEN" }), unknown({ resolution: "OPEN" })],
      contradictedAssumptionCount: 1,
    });
    expect(readiness.ready).toBe(false);
    const codes = readiness.blocking.map((b) => b.code);
    expect(codes).toContain("NO_OPTIONS");
    expect(codes).toContain("NO_ASSUMPTIONS");
    expect(codes).toContain("HIGH_UNKNOWNS_OPEN");
    expect(codes).toContain("CONTRADICTED_ASSUMPTIONS");
  });

  it("non-HIGH open unknowns are reported as non-blocking", () => {
    const readiness = computeReadiness({
      optionCount: 1,
      assumptionCount: 1,
      unknowns: [unknown({ importance: "MEDIUM", resolution: "OPEN" })],
      contradictedAssumptionCount: 0,
    });
    expect(readiness.ready).toBe(true);
    expect(readiness.nonBlocking.map((b) => b.code)).toContain(
      "NON_HIGH_UNKNOWNS_OPEN"
    );
  });
});
