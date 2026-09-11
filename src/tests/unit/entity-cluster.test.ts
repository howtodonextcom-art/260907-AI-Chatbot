import { describe, expect, it } from "vitest";
import {
  clusterAssumptions,
  clusterUnknowns,
  evidenceTopicallySupportsUnknown,
  HIGH_SIMILARITY_THRESHOLD,
  jaccardSimilarity,
} from "@/domain/decision/entity-cluster";
import { countBlockingHighUnknowns } from "@/domain/decision/unknown-policy";
import { applyAnalystState } from "@/ai/orchestration/decision-orchestrator";
import { applyParallelFrameState } from "@/ai/orchestration/parallel-frame-merge";
import type {
  Assumption,
  DecisionSession,
  IndependentFrame,
  Unknown,
} from "@/domain/decision/types";
import type { EvidenceItem } from "@/domain/evidence/types";

function unknown(overrides: Partial<Unknown> = {}): Unknown {
  return {
    id: "u1",
    question: "What is the historical frequency distribution of Mega 6/45 draws?",
    importance: "HIGH",
    resolution: "OPEN",
    evidenceIds: [],
    ...overrides,
  };
}

function assumption(overrides: Partial<Assumption> = {}): Assumption {
  return {
    id: "a1",
    statement: "Historical Mega 6/45 draws are independently sampled",
    status: "UNVERIFIED",
    importance: "HIGH",
    evidenceIds: [],
    ...overrides,
  };
}

function nearDupQuestions(count: number): string[] {
  const stems = [
    "What is the historical frequency distribution of Mega 6/45 draws",
    "What is the historical frequency distribution of Mega 6/45 draws?",
    "What's the historical frequency distribution of Mega 6/45 draws?",
    "What is the historical frequency distribution of Mega 6/45 draws over time?",
    "What is historical frequency distribution of Mega 6/45 draws?",
    "What is the historical frequency distribution for Mega 6/45 draws?",
    "What is the historical frequency distribution of Mega 645 draws?",
    "What is the historical frequency-distribution of Mega 6/45 draws?",
    "What is the historical frequency distribution of Mega 6/45 draw results?",
    "What is the historical frequency distribution of Mega 6/45 draws historically?",
  ];
  const extras = [
    "What is the historical frequency distribution of Mega 6/45 draws please?",
    "What is the historical frequency distribution of Mega 6/45 draws now?",
    "What is the historical frequency distribution of those Mega 6/45 draws?",
    "What is the historical frequency distribution of Mega 6/45 lottery draws?",
    "What is the historical frequency distribution of Mega 6/45 draws overall?",
    "What is the historical frequency distribution of Mega 6/45 draws data?",
    "What is the historical frequency distribution of Mega 6/45 draws sample?",
    "What is the historical frequency distribution of Mega 6/45 draws set?",
    "What is the historical frequency distribution of Mega 6/45 draws list?",
    "What is the historical frequency distribution of Mega 6/45 draws numbers?",
  ];
  return [...stems, ...extras].slice(0, count);
}

function baseSession(overrides: Partial<DecisionSession> = {}): DecisionSession {
  const now = new Date().toISOString();
  return {
    id: "s1",
    workspaceId: "w1",
    ownerId: "u1",
    title: "t",
    problem: "Should we model Mega 6/45 frequencies?",
    objective: "Decide a statistical approach",
    constraints: [],
    assumptions: [],
    unknowns: [],
    options: [],
    criteria: [],
    status: "DISCOVERY",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function frame(overrides: Partial<IndependentFrame> = {}): IndependentFrame {
  return {
    provider: "gemini",
    reply: "frame",
    assumptions: [],
    unknowns: [],
    constraints: [],
    ...overrides,
  };
}

describe("jaccardSimilarity — conservative threshold", () => {
  it("scores near-paraphrases of the same Mega 6/45 question above the merge threshold", () => {
    const a = "What is the historical frequency distribution of Mega 6/45 draws?";
    const b = "What's the historical frequency distribution of Mega 6/45 draws?";
    expect(jaccardSimilarity(a, b)).toBeGreaterThanOrEqual(
      HIGH_SIMILARITY_THRESHOLD
    );
  });

  it("does not treat unrelated HIGH questions as near-dups", () => {
    const a = "What is the historical frequency distribution of Mega 6/45 draws?";
    const b = "Should we upload MT4/MT5 statements or use a broker API?";
    expect(jaccardSimilarity(a, b)).toBeLessThan(HIGH_SIMILARITY_THRESHOLD);
  });
});

describe("clusterUnknowns — fail-safe with HIGH blockers", () => {
  it("collapses 20 near-duplicate HIGH OPEN unknowns into one still-blocking item", () => {
    const items = nearDupQuestions(20).map((question, i) =>
      unknown({
        id: `u-${i}`,
        question,
        importance: "HIGH",
        resolution: "OPEN",
      })
    );
    expect(items).toHaveLength(20);
    expect(countBlockingHighUnknowns(items)).toBe(20);

    const clustered = clusterUnknowns(items);
    expect(clustered.length).toBeLessThanOrEqual(2);
    expect(clustered.length).toBeGreaterThanOrEqual(1);
    expect(countBlockingHighUnknowns(clustered)).toBeGreaterThanOrEqual(1);
    expect(clustered.every((u) => u.resolution !== "RESOLVED")).toBe(true);
    expect(clustered.some((u) => u.importance === "HIGH")).toBe(true);
  });

  it("never swallows a HIGH OPEN blocker into a near-dup RESOLVED sibling", () => {
    const clustered = clusterUnknowns([
      unknown({
        id: "open",
        resolution: "OPEN",
        importance: "HIGH",
      }),
      unknown({
        id: "resolved",
        question:
          "What is the historical frequency distribution of Mega 6/45 draws over time?",
        resolution: "RESOLVED",
        importance: "HIGH",
        resolvedAt: "2026-09-11T00:00:00.000Z",
        resolvedBy: "u1",
      }),
    ]);
    expect(clustered).toHaveLength(1);
    expect(clustered[0].resolution).toBe("OPEN");
    expect(countBlockingHighUnknowns(clustered)).toBe(1);
    expect(clustered[0].resolvedBy).toBeUndefined();
  });

  it("keeps importance = max when a HIGH and a MEDIUM paraphrase merge", () => {
    const clustered = clusterUnknowns([
      unknown({ id: "med", importance: "MEDIUM", resolution: "OPEN" }),
      unknown({
        id: "high",
        question: "What's the historical frequency distribution of Mega 6/45 draws?",
        importance: "HIGH",
        resolution: "VERIFY_NOW",
      }),
    ]);
    expect(clustered).toHaveLength(1);
    expect(clustered[0].importance).toBe("HIGH");
    expect(countBlockingHighUnknowns(clustered)).toBe(1);
  });

  it("does not merge unrelated questions", () => {
    const clustered = clusterUnknowns([
      unknown({ id: "mega" }),
      unknown({
        id: "mt4",
        question: "Should we upload MT4/MT5 statements or use a broker API?",
        importance: "HIGH",
        resolution: "OPEN",
      }),
    ]);
    expect(clustered).toHaveLength(2);
    expect(countBlockingHighUnknowns(clustered)).toBe(2);
  });
});

describe("clusterAssumptions — never drop CONTRADICTED", () => {
  it("keeps CONTRADICTED when a SUPPORTED near-dup is merged", () => {
    const clustered = clusterAssumptions([
      assumption({
        id: "bad",
        status: "CONTRADICTED",
        evidenceIds: ["e-contra"],
      }),
      assumption({
        id: "good",
        statement: "Historical Mega 6/45 draws are independently sampled over time",
        status: "SUPPORTED",
        evidenceIds: ["e-ok"],
      }),
    ]);
    expect(clustered).toHaveLength(1);
    expect(clustered[0].status).toBe("CONTRADICTED");
    expect(clustered[0].evidenceIds).toEqual(
      expect.arrayContaining(["e-contra", "e-ok"])
    );
  });

  it("does not upgrade UNVERIFIED to SUPPORTED via a near-dup", () => {
    const clustered = clusterAssumptions([
      assumption({ id: "u", status: "UNVERIFIED" }),
      assumption({
        id: "s",
        statement: "Historical Mega 6/45 draws are independently sampled over time",
        status: "SUPPORTED",
      }),
    ]);
    expect(clustered).toHaveLength(1);
    expect(clustered[0].status).toBe("UNVERIFIED");
  });
});

describe("applyAnalystState / applyParallelFrameState — cluster after merge", () => {
  it("applyAnalystState clusters near-dup HIGH unknowns and still blocks DECISION_READY", () => {
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
      assumptions: [assumption()],
      unknowns: [unknown({ id: "existing" })],
    });
    const patch = applyAnalystState(
      session,
      {
        assumptions: [],
        unknowns: nearDupQuestions(8).slice(1).map((question) => ({
          question,
          importance: "HIGH" as const,
          resolution: "OPEN" as const,
        })),
        options: [],
        suggestedStatus: "DECISION_READY",
      },
      "DISCUSS"
    );
    expect((patch.unknowns ?? []).length).toBeLessThan(8);
    expect(countBlockingHighUnknowns(patch.unknowns ?? [])).toBeGreaterThanOrEqual(
      1
    );
    expect(patch.status).not.toBe("DECISION_READY");
  });

  it("applyParallelFrameState clusters paraphrases across blind frames and keeps HIGH open", () => {
    const session = baseSession();
    const questions = nearDupQuestions(6);
    const merged = applyParallelFrameState({
      session,
      frames: [
        frame({
          provider: "gemini",
          unknowns: [
            { question: questions[0], importance: "HIGH", resolution: "OPEN" },
            { question: questions[1], importance: "HIGH", resolution: "OPEN" },
          ],
          assumptions: [
            {
              statement: "Historical Mega 6/45 draws are independently sampled",
              importance: "HIGH",
              status: "UNVERIFIED",
            },
          ],
        }),
        frame({
          provider: "deepseek",
          unknowns: [
            { question: questions[2], importance: "HIGH", resolution: "RESOLVED" },
            { question: questions[3], importance: "MEDIUM", resolution: "OPEN" },
          ],
          assumptions: [
            {
              statement:
                "Historical Mega 6/45 draws are independently sampled over time",
              importance: "MEDIUM",
              status: "SUPPORTED",
            },
          ],
        }),
        frame({
          provider: "groq",
          unknowns: [
            { question: questions[4], importance: "HIGH", resolution: "OPEN" },
          ],
        }),
      ],
    });
    expect(merged.patch.unknowns?.length).toBeLessThan(5);
    expect(countBlockingHighUnknowns(merged.patch.unknowns ?? [])).toBeGreaterThanOrEqual(
      1
    );
    expect(
      merged.patch.assumptions?.some((a) => a.status === "UNVERIFIED")
    ).toBe(true);
  });
});

describe("evidenceTopicallySupportsUnknown", () => {
  const ev = (overrides: Partial<EvidenceItem> = {}): EvidenceItem => ({
    id: "e1",
    workspaceId: "w1",
    sessionId: "s1",
    ownerId: "u1",
    type: "USER_FACT",
    claim: "unrelated arithmetic 4/5 = 0.8",
    reliability: "HIGH",
    createdBy: "TOOL",
    supportsOptionIds: [],
    contradictsOptionIds: [],
    verificationStatus: "VERIFIED",
    createdAt: "2026-09-11T00:00:00.000Z",
    ...overrides,
  });

  it("accepts an explicit supportsUnknownIds link", () => {
    expect(
      evidenceTopicallySupportsUnknown(
        ev({ supportsUnknownIds: ["u1"] }),
        unknown()
      )
    ).toBe(true);
  });

  it("accepts token overlap with the question even without an id link", () => {
    expect(
      evidenceTopicallySupportsUnknown(
        ev({
          claim:
            "Official Mega 6/45 draw history shows the frequency distribution of each number.",
        }),
        unknown()
      )
    ).toBe(true);
  });

  it("rejects verified evidence that is topically unrelated", () => {
    expect(
      evidenceTopicallySupportsUnknown(ev(), unknown())
    ).toBe(false);
  });
});
