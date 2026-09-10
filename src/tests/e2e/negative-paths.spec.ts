import { test, expect } from "@playwright/test";

const AUTH_A = { Authorization: "Bearer dev:user-a" };
const AUTH_B = { Authorization: "Bearer dev:user-b" };

test.describe("negative paths", () => {
  test.setTimeout(60_000);

  test("invalid transition, cross-user isolation, evidence trust, duplicate decision", async ({
    request,
    page,
  }) => {
    await page.goto("/login");
    if (!(await page.getByRole("button", { name: /Dev Auth Bypass/i }).count())) {
      test.skip(true, "Connected Firebase mode");
    }

    const ws = await request.post("/api/workspaces", {
      headers: { ...AUTH_A, "Content-Type": "application/json" },
      data: {
        name: "Neg WS",
        defaultDomainPackId: "generic-decision",
      },
    });
    expect(ws.status()).toBe(201);
    const workspaceId = (await ws.json()).workspace.id as string;

    const sess = await request.post(`/api/workspaces/${workspaceId}/sessions`, {
      headers: { ...AUTH_A, "Content-Type": "application/json" },
      data: {
        title: "Neg session",
        problem: "Should we bypass the gate?",
        objective: "Keep the gate",
      },
    });
    expect(sess.status()).toBe(201);
    const session = (await sess.json()).session as {
      id: string;
      criteria: unknown[];
    };
    expect(session.criteria.length).toBeGreaterThan(0);

    const forbidden = await request.patch(`/api/sessions/${session.id}`, {
      headers: { ...AUTH_A, "Content-Type": "application/json" },
      data: { status: "DECIDED" },
    });
    expect([400, 409]).toContain(forbidden.status());

    const other = await request.get(`/api/sessions/${session.id}`, {
      headers: AUTH_B,
    });
    expect(other.status()).toBe(404);

    const evidence = await request.post(`/api/sessions/${session.id}/evidence`, {
      headers: { ...AUTH_A, "Content-Type": "application/json" },
      data: {
        type: "OFFICIAL_DOCUMENTATION",
        claim: "I am official",
        reliability: "HIGH",
      },
    });
    expect(evidence.status()).toBe(201);
    const item = (await evidence.json()).evidence;
    expect(item.verificationStatus).toBe("UNVERIFIED");
    expect(item.reliability).not.toBe("HIGH");

    const decision = await request.post(`/api/sessions/${session.id}/decision`, {
      headers: { ...AUTH_A, "Content-Type": "application/json" },
      data: {
        judgeRunId: "missing",
        approve: true,
        humanApproveProof: "invalid-proof-xxxxxxxxxxxxxxx",
      },
    });
    expect([400, 403, 409]).toContain(decision.status());

    const bp = await request.post(`/api/sessions/${session.id}/blueprint`, {
      headers: { ...AUTH_A, "Content-Type": "application/json" },
      data: { sourceDecisionRecordId: "missing" },
    });
    expect([404, 409]).toContain(bp.status());
  });
});
