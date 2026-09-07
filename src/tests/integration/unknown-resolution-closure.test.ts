import { beforeEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "@/config/env";
import {
  resetMemoryDb,
  MemoryDecisionSessionRepository,
  MemoryWorkspaceRepository,
  MemoryEvidenceRepository,
} from "@/infrastructure/repositories/memory-store";
import type { DecisionSession } from "@/domain/decision/types";
import { GET, PATCH } from "@/app/api/sessions/[sessionId]/route";
import { PATCH as patchUnknown } from "@/app/api/sessions/[sessionId]/unknowns/[unknownId]/route";
import { POST as postDecision } from "@/app/api/sessions/[sessionId]/decision/route";
import {
  POST as postBlueprint,
  PATCH as patchBlueprint,
} from "@/app/api/sessions/[sessionId]/blueprint/route";

/**
 * MASTER CODING PROMPT v13 §44 — mandatory release test: the full decision
 * closure loop, deterministically seeded (not through the live AI
 * orchestrator) so it never depends on paid API calls, exercising exactly
 * the HIGH-01 defect from the FTMO QA report: a HIGH Unknown stuck OPEN
 * must legitimately block, then legitimately unblock, DECISION_READY.
 */

const OWNER = "user-a";
const OTHER = "user-b";

function authHeaders(uid: string): Record<string, string> {
  return { authorization: `Bearer dev:${uid}` };
}

function req(method: string, body?: unknown, uid: string = OWNER): Request {
  return new Request("http://localhost/test", {
    method,
    headers: { ...authHeaders(uid), "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function seedWorkspace(ownerId: string) {
  const repo = new MemoryWorkspaceRepository();
  const now = new Date().toISOString();
  return repo.create({
    ownerId,
    name: "FTMO Trader Training Platform",
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });
}

async function seedSession(
  overrides: Partial<DecisionSession> & { workspaceId: string }
): Promise<DecisionSession> {
  const repo = new MemoryDecisionSessionRepository();
  const now = new Date().toISOString();
  return repo.create({
    ownerId: OWNER,
    title: "FTMO Challenge training MVP",
    problem: "Xay web app training giup trader vuot FTMO Challenge",
    objective: "Chot pham vi MVP",
    constraints: [],
    assumptions: [
      {
        id: "asm-1",
        statement: "Traders will rehearse risk discipline before a real Challenge",
        status: "UNVERIFIED",
        importance: "MEDIUM",
        evidenceIds: [],
      },
    ],
    unknowns: [
      {
        id: "unk-1",
        question: "Should FTMO data import use MT4/MT5 upload or API?",
        importance: "HIGH",
        resolution: "OPEN",
        evidenceIds: [],
      },
    ],
    options: [
      {
        id: "opt-1",
        title: "ChallengeGuard Simulator",
        description: "Kill-switch simulation for Daily/Max Loss rules",
        pros: [],
        cons: [],
        risks: [],
        evidenceIds: [],
        status: "PROPOSED",
      },
    ],
    criteria: [],
    status: "VALIDATING",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

beforeEach(() => {
  process.env.USE_MEMORY_STORE = "true";
  process.env.DEV_AUTH_BYPASS = "true";
  resetEnvCache();
  resetMemoryDb();
});

describe("Unknown resolution API — ownership and validation (v13 §11, §40)", () => {
  it("rejects an unknown ID that does not belong to the session", async () => {
    const ws = await seedWorkspace(OWNER);
    const session = await seedSession({ workspaceId: ws.id });
    const res = await patchUnknown(
      req("PATCH", { action: "VERIFY_NOW" }),
      { params: Promise.resolve({ sessionId: session.id, unknownId: "does-not-exist" }) }
    );
    expect(res.status).toBe(404);
  });

  it("cross-user: another user cannot resolve someone else's Unknown", async () => {
    const ws = await seedWorkspace(OWNER);
    const session = await seedSession({ workspaceId: ws.id });
    const res = await patchUnknown(
      req("PATCH", { action: "VERIFY_NOW" }, OTHER),
      { params: Promise.resolve({ sessionId: session.id, unknownId: "unk-1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("rejects an empty RESOLVE_WITH_EVIDENCE payload (no empty-resolve bypass)", async () => {
    const ws = await seedWorkspace(OWNER);
    const session = await seedSession({ workspaceId: ws.id });
    const res = await patchUnknown(
      req("PATCH", { action: "RESOLVE_WITH_EVIDENCE", evidenceIds: [] }),
      { params: Promise.resolve({ sessionId: session.id, unknownId: "unk-1" }) }
    );
    expect(res.status).toBe(400);
    const after = await GET(req("GET"), {
      params: Promise.resolve({ sessionId: session.id }),
    });
    const afterBody = await after.json();
    expect(afterBody.session.unknowns[0].resolution).toBe("OPEN");
  });

  it("the generic session PATCH can no longer set Unknown.resolution directly (bulk-array bypass closed)", async () => {
    const ws = await seedWorkspace(OWNER);
    const session = await seedSession({ workspaceId: ws.id });
    const res = await PATCH(
      req("PATCH", {
        unknowns: [{ ...session.unknowns[0], resolution: "RESOLVED" }],
      }),
      { params: Promise.resolve({ sessionId: session.id }) }
    );
    // UpdateSessionSchema no longer has `unknowns` — Zod strips unknown keys
    // by default, so this succeeds but silently ignores the field.
    expect(res.status).toBe(200);
    const after = await GET(req("GET"), {
      params: Promise.resolve({ sessionId: session.id }),
    });
    const afterBody = await after.json();
    expect(afterBody.session.unknowns[0].resolution).toBe("OPEN");
  });
});

describe("Full decision closure loop (v13 §44 — mandatory release test)", () => {
  it("HIGH Unknown blocks → legitimately resolved → DECISION_READY → DECIDED → Blueprint APPROVED", async () => {
    const ws = await seedWorkspace(OWNER);
    const session = await seedSession({
      workspaceId: ws.id,
      judgeDraft: {
        runId: "run-1",
        problem: "Xay web app training giup trader vuot FTMO Challenge",
        selectedOptionId: "opt-1",
        decision: "ACCEPT",
        rationale: ["ChallengeGuard fits MVP scope"],
        selectedEvidenceIds: [],
        rejectedOptions: [],
        acceptedAssumptionIds: ["asm-1"],
        unresolvedUnknownIds: ["unk-1"],
        tradeoffs: [],
        reviewTriggers: ["Revisit if FTMO rules change"],
        agentAgreementMethod: "UNAVAILABLE",
        confidenceLabel: "MEDIUM",
        confidenceScore: 50,
      },
    });

    // 1. PREPARE (already has judgeDraft) → DECISION_READY is rejected: HIGH
    // Unknown still OPEN. This is the exact HIGH-01 QA-observed behavior.
    const blockedTransition = await PATCH(
      req("PATCH", { status: "DECISION_READY" }),
      { params: Promise.resolve({ sessionId: session.id }) }
    );
    expect(blockedTransition.status).toBe(409);

    const blockedApprove = await postDecision(
      req("POST", { judgeRunId: "run-1", approve: true }),
      { params: Promise.resolve({ sessionId: session.id }) }
    );
    expect(blockedApprove.status).not.toBe(200);

    // 2. Legitimately resolve the HIGH Unknown with real VERIFIED evidence
    // (not a bare "Resolved" click with no justification — v13 §8).
    const evidenceRepo = new MemoryEvidenceRepository();
    const evidence = await evidenceRepo.create({
      workspaceId: ws.id,
      sessionId: session.id,
      ownerId: OWNER,
      type: "USER_FACT",
      claim: "Product decision: use MT4/MT5 file upload for v1, API integration later.",
      reliability: "MEDIUM",
      createdBy: "USER",
      supportsOptionIds: [],
      contradictsOptionIds: [],
      supportsUnknownIds: ["unk-1"],
      verificationStatus: "VERIFIED",
      verifiedBy: "USER",
      verifiedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    const resolved = await patchUnknown(
      req("PATCH", {
        action: "RESOLVE_WITH_EVIDENCE",
        evidenceIds: [evidence.id],
      }),
      { params: Promise.resolve({ sessionId: session.id, unknownId: "unk-1" }) }
    );
    expect(resolved.status).toBe(200);
    const resolvedBody = await resolved.json();
    expect(resolvedBody.session.unknowns[0].resolution).toBe("RESOLVED");
    expect(resolvedBody.session.unknowns[0].resolvedBy).toBe(OWNER);

    // 3. PREPARE again → gate reevaluates → DECISION_READY now succeeds.
    const unblocked = await PATCH(req("PATCH", { status: "DECISION_READY" }), {
      params: Promise.resolve({ sessionId: session.id }),
    });
    expect(unblocked.status).toBe(200);

    // 4. Explicit human approval → DECIDED + immutable DecisionRecord.
    const approved = await postDecision(
      req("POST", { judgeRunId: "run-1", approve: true }),
      { params: Promise.resolve({ sessionId: session.id }) }
    );
    expect(approved.status).toBe(201);
    const approvedBody = await approved.json();
    expect(approvedBody.decision.id).toBeTruthy();

    const afterDecision = await GET(req("GET"), {
      params: Promise.resolve({ sessionId: session.id }),
    });
    const afterDecisionBody = await afterDecision.json();
    expect(afterDecisionBody.session.status).toBe("DECIDED");

    // 5. Blueprint DRAFT → explicit approve → APPROVED.
    const blueprintCreated = await postBlueprint(
      req("POST", { sourceDecisionRecordId: approvedBody.decision.id }),
      { params: Promise.resolve({ sessionId: session.id }) }
    );
    expect(blueprintCreated.status).toBe(201);
    const blueprintBody = await blueprintCreated.json();
    expect(blueprintBody.blueprint.status).toBe("DRAFT");

    const blueprintApproved = await patchBlueprint(
      req("PATCH", { approve: true }),
      { params: Promise.resolve({ sessionId: session.id }) }
    );
    expect(blueprintApproved.status).toBe(200);
    const blueprintApprovedBody = await blueprintApproved.json();
    expect(blueprintApprovedBody.blueprint.status).toBe("APPROVED");
  });
});
