import { describe, expect, it } from "vitest";
import { deriveBlueprintContent } from "@/domain/blueprint/service";
import { validateBlueprintSemantics } from "@/domain/blueprint/validator";
import { blueprintToMarkdown } from "@/domain/blueprint/markdown";
import { contentToBlueprintFields } from "@/domain/blueprint/service";
import type { DecisionSession, DecisionRecord } from "@/domain/decision/types";
import type { EvidenceItem } from "@/domain/evidence/types";

const session: DecisionSession = {
  id: "sess-1",
  workspaceId: "ws-1",
  ownerId: "owner-1",
  title: "FTMO readiness product",
  problem: "How should we train challenge traders without live execution?",
  objective: "Ship a rehearsal lab",
  constraints: [{ id: "c1", statement: "No broker APIs", source: "USER", confirmedByUser: true }],
  assumptions: [
    {
      id: "a1",
      statement: "Traders will pay for rehearsal",
      status: "ACCEPTED_FOR_NOW",
      importance: "HIGH",
      evidenceIds: ["e1"],
    },
  ],
  unknowns: [],
  options: [
    {
      id: "opt-lab",
      title: "Readiness Lab MVP",
      description: "Journal and risk-guard checklists",
      pros: ["In scope"],
      cons: ["No live trades"],
      risks: ["Users ask for signals"],
      evidenceIds: [],
      status: "PROPOSED",
    },
  ],
  criteria: [{ id: "fit", name: "Fit", weight: 1, proposedBy: "DOMAIN_PACK", confirmedByUser: false }],
  status: "DECIDED",
  domainPackId: "challengeready",
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
};

const decision: DecisionRecord = {
  id: "dec-1",
  workspaceId: "ws-1",
  sessionId: "sess-1",
  ownerId: "owner-1",
  problem: session.problem,
  selectedOptionId: "opt-lab",
  decision: "ACCEPT",
  rationale: ["Matches training framing", "Keeps execution out of scope"],
  selectedEvidenceIds: ["e1"],
  rejectedOptions: [{ optionId: "signal-bot", reasons: ["Forbidden"] }],
  acceptedAssumptionIds: ["a1"],
  unresolvedUnknownIds: [],
  tradeoffs: ["Fidelity of simulation"],
  confidence: {
    type: "HEURISTIC",
    label: "MEDIUM",
    score: 60,
    factors: {
      evidenceCoverage: 0.4,
      sourceReliability: 0.5,
      unresolvedUnknownPenalty: 0,
      assumptionPenalty: 0.1,
      agentAgreement: 0.5,
      experimentStrength: 0,
    },
    agentAgreementMethod: "UNAVAILABLE",
    experimentStrengthMethod: "UNAVAILABLE",
  },
  reviewTriggers: ["If broker execution is requested"],
  approvedBy: "owner-1",
  approvedAt: "2026-09-07T00:00:00.000Z",
  createdAt: "2026-09-07T00:00:00.000Z",
};

const evidence: EvidenceItem[] = [
  {
    id: "e1",
    workspaceId: "ws-1",
    sessionId: "sess-1",
    ownerId: "owner-1",
    type: "CALCULATION",
    claim: "20*15 = 300",
    reliability: "HIGH",
    createdBy: "TOOL",
    supportsOptionIds: [],
    contradictsOptionIds: [],
    verificationStatus: "VERIFIED",
    verifiedBy: "TOOL",
    createdAt: "2026-09-07T00:00:00.000Z",
  },
];

describe("blueprint derive", () => {
  it("produces decision-derived content without filler phrases", () => {
    const content = deriveBlueprintContent({ session, decision, evidence });
    const semantic = validateBlueprintSemantics({ content, session, decision });
    expect(semantic.ok).toBe(true);
    const blob = JSON.stringify(content).toLowerCase();
    expect(blob).not.toContain("primary decision maker");
    expect(blob).not.toContain("core module");
    expect(content.dataModel.some((d) => typeof d !== "string" && d.name.includes("Fit"))).toBe(
      false
    );
    expect(content.decisionReferences).toContain("dec-1");
    expect(content.modules[0].name).toBe("Readiness Lab MVP");
  });

  it("describes the target product, not Layer A's own internals (H6 fix)", () => {
    const content = deriveBlueprintContent({ session, decision, evidence });
    const blob = JSON.stringify(content).toLowerCase();
    // Layer A's own routes/roles/infra must never leak into a Blueprint —
    // it should describe the product being built, not this decision tool.
    expect(blob).not.toContain("/api/sessions/");
    expect(blob).not.toContain("hardpolicygate");
    expect(blob).not.toContain("agentrun");
    expect(blob).not.toContain("executionplan");
    expect(blob).not.toContain("vercel");
    expect(blob).not.toContain("memorystore");
    expect(content.apiContracts.every((c) => !c.path.startsWith("/api/sessions/"))).toBe(
      true
    );
  });

  it("markdown export is usable as coding-agent input", () => {
    const content = deriveBlueprintContent({ session, decision, evidence });
    const fields = contentToBlueprintFields(content);
    const md = blueprintToMarkdown({
      id: "bp-1",
      workspaceId: "ws-1",
      sessionId: "sess-1",
      ownerId: "owner-1",
      sourceDecisionRecordId: "dec-1",
      status: "DRAFT",
      ...fields,
      createdAt: "2026-09-07T00:00:00.000Z",
    });
    expect(md).toMatch(/## Project Goal/);
    expect(md).toMatch(/## Non-goals/);
    expect(md).toMatch(/## Modules/);
    expect(md).toMatch(/## Data Model/);
    expect(md).toMatch(/## API Contracts/);
    expect(md).toMatch(/## Security/);
    expect(md).toMatch(/## Testing/);
    expect(md).toMatch(/## Implementation Order/);
    expect(md).toContain("Readiness Lab MVP");
    expect(md).toContain("dec-1");
  });
});
