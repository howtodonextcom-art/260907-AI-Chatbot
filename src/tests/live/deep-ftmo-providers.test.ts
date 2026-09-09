import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function loadEnvLocal() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    /* CI without .env.local */
  }
  process.env.USE_MEMORY_STORE = "true";
  process.env.USE_STUB_MODELS = "false";
}

describe("live DEEP FTMO providers (P2)", () => {
  it("OPTIONS calls Gemini+DeepSeek and CRITIQUE calls Groq", async () => {
    loadEnvLocal();
    const { resetEnvCache, getServerEnv } = await import("@/config/env");
    resetEnvCache();
    const env = getServerEnv();
    expect(env.hasGemini).toBe(true);
    expect(env.hasGroq).toBe(true);
    expect(env.hasDeepseek).toBe(true);
    expect(env.useStubModels).toBe(false);
    expect(env.useMemoryStore).toBe(true);

    const { resetMemoryDb } = await import(
      "@/infrastructure/repositories/memory-store"
    );
    const { getRepositories } = await import("@/infrastructure/repositories");
    const { ModelGateway } = await import("@/ai/gateway/model-gateway");
    const { runDecisionOrchestrator } = await import(
      "@/ai/orchestration/decision-orchestrator"
    );
    const { emptyWorkflowMetadata } = await import(
      "@/domain/decision/workflow-stage"
    );

    resetMemoryDb();
    const repos = getRepositories();
    const now = new Date().toISOString();
    const ws = await repos.workspaces.create({
      ownerId: "live-p2",
      name: "Live FTMO P2",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });
    let session = await repos.sessions.create({
      workspaceId: ws.id,
      ownerId: "live-p2",
      title: "FTMO live provider check",
      problem:
        "I want to build a web application to help FTMO challenge traders train before taking the real challenge, focusing on risk management and psychological discipline. No live broker execution.",
      objective: "Choose an MVP that trains readiness without live trade execution.",
      constraints: [],
      assumptions: [],
      unknowns: [],
      options: [],
      criteria: [],
      status: "DISCOVERY",
      workflow: emptyWorkflowMetadata("DEEP"),
      createdAt: now,
      updatedAt: now,
    });

    const gateway = new ModelGateway();
    const steps = [
      "I want to build a web app to help FTMO challenge traders train before the real evaluation. Focus on risk rules and psychological discipline. Do not execute live trades.",
      "Tiếp tục quy trình — sinh phương án.",
      "Tiếp tục quy trình — phản biện các phương án.",
    ];

    for (const [i, userRequest] of steps.entries()) {
      await repos.messages.create({
        workspaceId: session.workspaceId,
        sessionId: session.id,
        ownerId: "live-p2",
        role: "USER",
        content: userRequest,
        createdAt: new Date().toISOString(),
      });
      for await (const _event of runDecisionOrchestrator({
        repos,
        session,
        ownerId: "live-p2",
        routeMode: "DEEP",
        userRequest,
        requestId: `live-p2-${i}`,
        gateway,
      })) {
        /* drain SSE */
      }
      session = (await repos.sessions.getBySessionId(session.id, "live-p2"))!;
      // eslint-disable-next-line no-console
      console.log("step", i, JSON.stringify(session.workflow?.lastRun));
    }

    const runs = await repos.agentRuns.listBySession(
      session.workspaceId,
      session.id,
      "live-p2"
    );
    const messages = await repos.messages.listBySession(
      session.workspaceId,
      session.id,
      "live-p2"
    );

    const table = runs.map((r) => ({
      role: r.role,
      provider: r.provider,
      model: r.model,
      status: r.status,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      costUsd: r.costUsd,
      bubble: messages.some((m) => m.runId === r.id && m.role === "ASSISTANT"),
    }));
    // eslint-disable-next-line no-console
    console.log("---TABLE---\n", JSON.stringify(table, null, 2));

    const so = runs.find((r) => r.role === "SECOND_OPINION");
    const critic = runs.find((r) => r.role === "CRITIC");
    const analysts = runs.filter((r) => r.role === "ANALYST");

    expect(analysts.some((r) => r.provider === "gemini" && r.status === "COMPLETED")).toBe(
      true
    );
    expect(so?.provider).toBe("deepseek");
    expect(so?.status).toBe("COMPLETED");
    expect(critic?.provider).toBe("groq");
    expect(critic?.status).toBe("COMPLETED");
    expect(so && messages.some((m) => m.runId === so.id)).toBe(true);
    expect(critic && messages.some((m) => m.runId === critic.id)).toBe(true);
  });
});
