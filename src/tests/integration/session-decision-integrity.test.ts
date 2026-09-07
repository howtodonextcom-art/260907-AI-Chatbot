import { beforeEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "@/config/env";
import {
  resetMemoryDb,
  MemoryDecisionSessionRepository,
  MemoryWorkspaceRepository,
} from "@/infrastructure/repositories/memory-store";
import type { DecisionSession } from "@/domain/decision/types";
import { GET, PATCH } from "@/app/api/sessions/[sessionId]/route";
import { POST as postDecision } from "@/app/api/sessions/[sessionId]/decision/route";
import {
  POST as postBlueprint,
  PATCH as patchBlueprint,
} from "@/app/api/sessions/[sessionId]/blueprint/route";

const OWNER = "user-a";
const OTHER = "user-b";

function authHeaders(uid: string): Record<string, string> {
  return { authorization: `Bearer dev:${uid}` };
}

function req(
  method: string,
  body?: unknown,
  uid: string = OWNER
): Request {
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
    name: "W",
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
    title: "Test session",
    problem: "Should we do X?",
    objective: "Decide on X",
    constraints: [],
    assumptions: [],
    unknowns: [],
    options: [],
    criteria: [],
    status: "DISCOVERY",
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

describe("PATCH /api/sessions/:id — decision integrity (Test A/B/C)", () => {
  it("rejects a direct client attempt to set status=DECIDED", async () => {
    const ws = await seedWorkspace(OWNER);
    const session = await seedSession({
      workspaceId: ws.id,
      status: "DECISION_READY",
    });
    const res = await PATCH(req("PATCH", { status: "DECIDED" }), {
      params: Promise.resolve({ sessionId: session.id }),
    });
    expect(res.status).not.toBe(200);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");

    const after = await GET(req("GET", undefined), {
      params: Promise.resolve({ sessionId: session.id }),
    });
    const afterBody = await after.json();
    expect(afterBody.session.status).toBe("DECISION_READY");
  });

  it("strips judgeDraft/activeDecisionRecordId from client PATCH body", async () => {
    const ws = await seedWorkspace(OWNER);
    const session = await seedSession({ workspaceId: ws.id });
    const res = await PATCH(
      req("PATCH", {
        title: "Renamed",
        judgeDraft: { runId: "fake" },
        activeDecisionRecordId: "fake-record",
      }),
      { params: Promise.resolve({ sessionId: session.id }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session.title).toBe("Renamed");
    expect(body.session.judgeDraft).toBeUndefined();
    expect(body.session.activeDecisionRecordId).toBeUndefined();
  });

  it("rejects entering DECISION_READY when requirements are not met", async () => {
    const ws = await seedWorkspace(OWNER);
    const session = await seedSession({
      workspaceId: ws.id,
      status: "VALIDATING",
      options: [],
      assumptions: [],
    });
    const res = await PATCH(req("PATCH", { status: "DECISION_READY" }), {
      params: Promise.resolve({ sessionId: session.id }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("SESSION_INVALID_STATE");
  });
});

describe("POST /api/sessions/:id/decision — approval gate (Test D)", () => {
  it("fails when there is no JudgeDraft", async () => {
    const ws = await seedWorkspace(OWNER);
    const session = await seedSession({
      workspaceId: ws.id,
      status: "DECISION_READY",
    });
    const res = await postDecision(
      req("POST", { judgeRunId: "run-1", approve: true }),
      { params: Promise.resolve({ sessionId: session.id }) }
    );
    expect(res.status).toBe(409);
  });
});

describe("POST/PATCH /api/sessions/:id/blueprint — DRAFT lifecycle (Test F/G)", () => {
  it("cannot be created from an unapproved DecisionRecord", async () => {
    const ws = await seedWorkspace(OWNER);
    const session = await seedSession({ workspaceId: ws.id });
    const res = await postBlueprint(
      req("POST", { sourceDecisionRecordId: "does-not-exist" }),
      { params: Promise.resolve({ sessionId: session.id }) }
    );
    expect(res.status).toBe(404);
  });

  it("starts DRAFT and only becomes APPROVED via explicit PATCH approve", async () => {
    const { approveDecision } = await import(
      "@/ai/orchestration/decision-orchestrator"
    );
    const { getRepositories } = await import("@/infrastructure/repositories");
    const repos = getRepositories();
    const ws = await seedWorkspace(OWNER);
    const now = new Date().toISOString();
    const session = await seedSession({
      workspaceId: ws.id,
      status: "DECISION_READY",
      options: [
        {
          id: "opt-1",
          title: "Option A",
          description: "desc",
          pros: [],
          cons: [],
          risks: [],
          evidenceIds: [],
          status: "SELECTED",
        },
      ],
      assumptions: [],
      judgeDraft: {
        runId: "run-1",
        problem: "Should we do X?",
        selectedOptionId: "opt-1",
        decision: "ACCEPT",
        rationale: ["good"],
        selectedEvidenceIds: [],
        rejectedOptions: [],
        acceptedAssumptionIds: [],
        unresolvedUnknownIds: [],
        tradeoffs: [],
        reviewTriggers: ["revisit if scope changes"],
        confidenceLabel: "MEDIUM",
        confidenceScore: 50,
        agentAgreementMethod: "UNAVAILABLE" as const,
      },
    });

    const record = await approveDecision({
      repos,
      session,
      ownerId: OWNER,
      judgeRunId: "run-1",
    });
    void now;

    const created = await postBlueprint(
      req("POST", { sourceDecisionRecordId: record.id }),
      { params: Promise.resolve({ sessionId: session.id }) }
    );
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    expect(createdBody.blueprint.status).toBe("DRAFT");

    const approved = await patchBlueprint(req("PATCH", { approve: true }), {
      params: Promise.resolve({ sessionId: session.id }),
    });
    expect(approved.status).toBe(200);
    const approvedBody = await approved.json();
    expect(approvedBody.blueprint.status).toBe("APPROVED");
    expect(approvedBody.blueprint.approvedAt).toBeTruthy();
  });
});

describe("cross-user isolation (Test H)", () => {
  it("user B cannot read or patch user A's session", async () => {
    const ws = await seedWorkspace(OWNER);
    const session = await seedSession({ workspaceId: ws.id });

    const getRes = await GET(req("GET", undefined, OTHER), {
      params: Promise.resolve({ sessionId: session.id }),
    });
    expect(getRes.status).toBe(404);

    const patchRes = await PATCH(
      req("PATCH", { title: "hijacked" }, OTHER),
      { params: Promise.resolve({ sessionId: session.id }) }
    );
    expect(patchRes.status).toBe(404);
  });
});

describe("idempotent decision approval (race safety)", () => {
  it("concurrent approvals with the same key never create two DecisionRecords", async () => {
    const { approveDecision } = await import(
      "@/ai/orchestration/decision-orchestrator"
    );
    const { getRepositories } = await import("@/infrastructure/repositories");
    const repos = getRepositories();
    const ws = await seedWorkspace(OWNER);
    const session = await seedSession({
      workspaceId: ws.id,
      status: "DECISION_READY",
      options: [
        {
          id: "opt-1",
          title: "Option A",
          description: "desc",
          pros: [],
          cons: [],
          risks: [],
          evidenceIds: [],
          status: "SELECTED",
        },
      ],
      judgeDraft: {
        runId: "run-1",
        problem: "Should we do X?",
        selectedOptionId: "opt-1",
        decision: "ACCEPT",
        rationale: ["good"],
        selectedEvidenceIds: [],
        rejectedOptions: [],
        acceptedAssumptionIds: [],
        unresolvedUnknownIds: [],
        tradeoffs: [],
        reviewTriggers: ["revisit if scope changes"],
        confidenceLabel: "MEDIUM",
        confidenceScore: 50,
        agentAgreementMethod: "UNAVAILABLE" as const,
      },
    });

    const key = "same-key";
    const [a, b] = await Promise.all([
      approveDecision({
        repos,
        session,
        ownerId: OWNER,
        judgeRunId: "run-1",
        idempotencyKey: key,
      }),
      approveDecision({
        repos,
        session,
        ownerId: OWNER,
        judgeRunId: "run-1",
        idempotencyKey: key,
      }),
    ]);
    expect(a.id).toBe(b.id);
    const all = [...(await import("@/infrastructure/repositories/memory-store")).getMemoryDb().decisionRecords.values()];
    expect(all.filter((r) => r.sessionId === session.id)).toHaveLength(1);
  });
});
