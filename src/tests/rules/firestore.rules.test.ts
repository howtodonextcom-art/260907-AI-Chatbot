import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { setDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";

/**
 * P0-03: independently verifies the Firestore security rules — the
 * defense-in-depth layer behind the API-layer authorization checks. Requires
 * the Firestore emulator (`pnpm test:rules` starts it via
 * `firebase emulators:exec`). Not part of `pnpm test` since it needs a live
 * emulator process, not just Node — see CLAUDE.md [[firestore-rules-testing]].
 */

const RULES_PATH = path.resolve(
  __dirname,
  "../../infrastructure/firebase/rules/firestore.rules"
);

const OWNER = "owner-uid";
const OTHER = "other-uid";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "rules-test-project",
    firestore: {
      rules: readFileSync(RULES_PATH, "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

async function seedWorkspace(ownerId: string, workspaceId = "ws-1") {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "workspaces", workspaceId), {
      ownerId,
      name: "W",
      status: "ACTIVE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });
  return workspaceId;
}

async function seedSession(
  ownerId: string,
  workspaceId: string,
  overrides: Record<string, unknown> = {},
  sessionId = "sess-1"
) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), "workspaces", workspaceId, "sessions", sessionId),
      {
        ownerId,
        workspaceId,
        title: "S",
        problem: "p",
        status: "DISCOVERY",
        options: [],
        assumptions: [],
        ...overrides,
      }
    );
  });
  return sessionId;
}

async function seedDecisionRecord(ownerId: string, id = "dr-1") {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "decisionRecords", id), {
      ownerId,
      decision: "ACCEPT",
    });
  });
  return id;
}

async function seedBlueprint(ownerId: string, id = "bp-1") {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "blueprints", id), {
      ownerId,
      status: "DRAFT",
    });
  });
  return id;
}

describe("workspaces — ownership", () => {
  it("owner can read their own workspace", async () => {
    const wsId = await seedWorkspace(OWNER);
    const ownerCtx = testEnv.authenticatedContext(OWNER);
    await assertSucceeds(
      (async () => {
        const { getDoc } = await import("firebase/firestore");
        return getDoc(doc(ownerCtx.firestore(), "workspaces", wsId));
      })()
    );
  });

  it("non-owner cannot read another user's workspace", async () => {
    const wsId = await seedWorkspace(OWNER);
    const otherCtx = testEnv.authenticatedContext(OTHER);
    const { getDoc } = await import("firebase/firestore");
    await assertFails(getDoc(doc(otherCtx.firestore(), "workspaces", wsId)));
  });

  it("owner cannot transfer ownerId via direct update (P0-03 fix)", async () => {
    const wsId = await seedWorkspace(OWNER);
    const ownerCtx = testEnv.authenticatedContext(OWNER);
    await assertFails(
      updateDoc(doc(ownerCtx.firestore(), "workspaces", wsId), {
        ownerId: OTHER,
      })
    );
  });

  it("owner can still update non-ownership fields", async () => {
    const wsId = await seedWorkspace(OWNER);
    const ownerCtx = testEnv.authenticatedContext(OWNER);
    await assertSucceeds(
      updateDoc(doc(ownerCtx.firestore(), "workspaces", wsId), {
        name: "Renamed",
      })
    );
  });

  it("no one can delete a workspace via client rules", async () => {
    const wsId = await seedWorkspace(OWNER);
    const ownerCtx = testEnv.authenticatedContext(OWNER);
    await assertFails(deleteDoc(doc(ownerCtx.firestore(), "workspaces", wsId)));
  });
});

describe("sessions — server-controlled fields and status gate", () => {
  it("client cannot forge server-controlled fields via direct update", async () => {
    const wsId = await seedWorkspace(OWNER);
    const sessionId = await seedSession(OWNER, wsId);
    const ownerCtx = testEnv.authenticatedContext(OWNER);
    await assertFails(
      updateDoc(
        doc(ownerCtx.firestore(), "workspaces", wsId, "sessions", sessionId),
        { judgeDraft: { runId: "fake" } }
      )
    );
    await assertFails(
      updateDoc(
        doc(ownerCtx.firestore(), "workspaces", wsId, "sessions", sessionId),
        { activeDecisionRecordId: "fake" }
      )
    );
  });

  it("client cannot set status=DECIDED via direct update", async () => {
    const wsId = await seedWorkspace(OWNER);
    const sessionId = await seedSession(OWNER, wsId, {
      status: "DECISION_READY",
    });
    const ownerCtx = testEnv.authenticatedContext(OWNER);
    await assertFails(
      updateDoc(
        doc(ownerCtx.firestore(), "workspaces", wsId, "sessions", sessionId),
        { status: "DECIDED" }
      )
    );
  });

  it("client cannot transfer session ownerId via direct update", async () => {
    const wsId = await seedWorkspace(OWNER);
    const sessionId = await seedSession(OWNER, wsId);
    const ownerCtx = testEnv.authenticatedContext(OWNER);
    await assertFails(
      updateDoc(
        doc(ownerCtx.firestore(), "workspaces", wsId, "sessions", sessionId),
        { ownerId: OTHER }
      )
    );
  });

  it("non-owner cannot read or write another user's session", async () => {
    const wsId = await seedWorkspace(OWNER);
    const sessionId = await seedSession(OWNER, wsId);
    const otherCtx = testEnv.authenticatedContext(OTHER);
    const { getDoc } = await import("firebase/firestore");
    await assertFails(
      getDoc(doc(otherCtx.firestore(), "workspaces", wsId, "sessions", sessionId))
    );
    await assertFails(
      updateDoc(
        doc(otherCtx.firestore(), "workspaces", wsId, "sessions", sessionId),
        { title: "hijacked" }
      )
    );
  });
});

describe("decisionRecords — server-only writes (Admin SDK bypasses rules)", () => {
  it("client cannot create a DecisionRecord directly", async () => {
    const ownerCtx = testEnv.authenticatedContext(OWNER);
    await assertFails(
      setDoc(doc(ownerCtx.firestore(), "decisionRecords", "dr-x"), {
        ownerId: OWNER,
        decision: "ACCEPT",
      })
    );
  });

  it("client cannot mutate an approved DecisionRecord", async () => {
    const id = await seedDecisionRecord(OWNER);
    const ownerCtx = testEnv.authenticatedContext(OWNER);
    await assertFails(
      updateDoc(doc(ownerCtx.firestore(), "decisionRecords", id), {
        decision: "REJECT",
      })
    );
  });

  it("owner can still read their own DecisionRecord", async () => {
    const id = await seedDecisionRecord(OWNER);
    const ownerCtx = testEnv.authenticatedContext(OWNER);
    const { getDoc } = await import("firebase/firestore");
    await assertSucceeds(
      getDoc(doc(ownerCtx.firestore(), "decisionRecords", id))
    );
  });
});

describe("blueprints — server-only writes (Admin SDK bypasses rules)", () => {
  it("client cannot create a Blueprint directly", async () => {
    const ownerCtx = testEnv.authenticatedContext(OWNER);
    await assertFails(
      setDoc(doc(ownerCtx.firestore(), "blueprints", "bp-x"), {
        ownerId: OWNER,
        status: "DRAFT",
      })
    );
  });

  it("client cannot mutate Blueprint server-only fields (e.g. forging APPROVED)", async () => {
    const id = await seedBlueprint(OWNER);
    const ownerCtx = testEnv.authenticatedContext(OWNER);
    await assertFails(
      updateDoc(doc(ownerCtx.firestore(), "blueprints", id), {
        status: "APPROVED",
      })
    );
  });
});
