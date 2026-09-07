import { describe, expect, it, beforeEach } from "vitest";
import {
  MemoryDecisionRecordRepository,
  MemoryIdempotencyStore,
  resetMemoryDb,
} from "@/infrastructure/repositories/memory-store";

describe("idempotency", () => {
  beforeEach(() => resetMemoryDb());

  it("returns same artifact id for same key", async () => {
    const store = new MemoryIdempotencyStore();
    await store.set("owner:decision:key1", "rec-1");
    expect(await store.get("owner:decision:key1")).toBe("rec-1");
  });
});

describe("decision record immutability pattern", () => {
  beforeEach(() => resetMemoryDb());

  it("creates new records instead of editing", async () => {
    const repo = new MemoryDecisionRecordRepository();
    const now = new Date().toISOString();
    const first = await repo.create({
      workspaceId: "w1",
      sessionId: "s1",
      ownerId: "u1",
      problem: "p",
      decision: "ACCEPT",
      rationale: ["r"],
      selectedEvidenceIds: [],
      rejectedOptions: [],
      acceptedAssumptionIds: [],
      unresolvedUnknownIds: [],
      tradeoffs: [],
      confidence: {
        type: "HEURISTIC",
        label: "MEDIUM",
        score: 50,
        factors: {
          evidenceCoverage: 0.5,
          sourceReliability: 0.5,
          unresolvedUnknownPenalty: 0.1,
          assumptionPenalty: 0.1,
          agentAgreement: 0.5,
          experimentStrength: 0.2,
        },
      },
      reviewTriggers: ["revisit later"],
      approvedBy: "u1",
      approvedAt: now,
      createdAt: now,
    });
    const second = await repo.create({
      workspaceId: "w1",
      sessionId: "s1",
      ownerId: "u1",
      problem: "p",
      decision: "ACCEPT_WITH_CHANGES",
      rationale: ["r2"],
      selectedEvidenceIds: [],
      rejectedOptions: [],
      acceptedAssumptionIds: [],
      unresolvedUnknownIds: [],
      tradeoffs: [],
      confidence: first.confidence,
      reviewTriggers: ["new trigger"],
      supersedesDecisionRecordId: first.id,
      approvedBy: "u1",
      approvedAt: now,
      createdAt: now,
    });
    expect(second.id).not.toBe(first.id);
    expect(second.supersedesDecisionRecordId).toBe(first.id);
    expect(await repo.getById(first.id, "u1")).toEqual(first);
  });
});
