import { beforeEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "@/config/env";
import { resetMemoryDb } from "@/infrastructure/repositories/memory-store";
import { getRepositories } from "@/infrastructure/repositories";
import { ModelGateway } from "@/ai/gateway/model-gateway";
import type {
  ModelCapabilities,
  ModelProvider,
  ModelResult,
} from "@/ai/gateway/model-provider";
import { runDecisionOrchestrator } from "@/ai/orchestration/decision-orchestrator";
import {
  decideWorkflowStage,
  emptyWorkflowMetadata,
} from "@/domain/decision/workflow-stage";
import type { DecisionSession } from "@/domain/decision/types";

function scriptedProvider(
  id: "gemini" | "groq" | "deepseek",
  replies: string[]
): ModelProvider {
  let n = 0;
  return {
    id,
    capabilities(): ModelCapabilities {
      return {
        structuredOutput: true,
        tools: false,
        streaming: false,
        vision: false,
        maxContextTokens: 32_000,
      };
    },
    async generate<T>(): Promise<ModelResult<T>> {
      const content = replies[Math.min(n, replies.length - 1)] ?? "{}";
      n += 1;
      let structured: unknown;
      try {
        structured = JSON.parse(content);
      } catch {
        structured = undefined;
      }
      return {
        content,
        structured: structured as T,
        provider: id,
        model: "scripted",
        usage: { inputTokens: 10, outputTokens: 20 },
        latencyMs: 1,
        estimatedCostUsd: 0.001,
      };
    },
    async health() {
      return { ok: true };
    },
  };
}

function frameJson() {
  return JSON.stringify({
    reply: "Đã định khung vấn đề FTMO training.",
    problemFraming: "Xây MVP huấn luyện trader trước FTMO Challenge",
    assumptions: [
      {
        statement: "Traders will pay $15/mo",
        importance: "HIGH",
        status: "UNVERIFIED",
      },
    ],
    unknowns: [],
    options: [],
    constraints: [{ statement: "No live trade execution" }],
    suggestedStatus: "VALIDATING",
  });
}

function optionsJson() {
  return JSON.stringify({
    reply: "Hai phương án MVP.",
    problemFraming: "Xây MVP huấn luyện trader trước FTMO Challenge",
    assumptions: [
      {
        statement: "Traders will pay $15/mo",
        importance: "HIGH",
        status: "UNVERIFIED",
      },
    ],
    unknowns: [],
    options: [
      {
        title: "Readiness Lab MVP",
        description: "Simulated challenges only",
        pros: ["Safe"],
        cons: ["Narrow"],
        risks: ["Low adoption"],
      },
      {
        title: "Full brokerage clone",
        description: "Live-like trading UI",
        pros: ["Realistic"],
        cons: ["Costly"],
        risks: ["Compliance"],
      },
    ],
    constraints: [],
  });
}

function critiqueJson() {
  return JSON.stringify({
    reply: "Phản bác Analyst: Adoption unproven.",
    criticisms: ["Adoption unproven"],
    unsupportedAssumptions: ["Traders will pay $15/mo"],
    missingEvidence: ["Willingness to pay survey"],
    contradictions: [],
  });
}

function soJson() {
  return JSON.stringify({
    reply: "Phương án khác: Challenge Gym.",
    recommendedDirection: "Challenge Gym",
    preferredOptionTitle: "Challenge Gym",
    independentOptions: [
      {
        title: "Challenge Gym",
        description: "Simulator days first",
        pros: ["Pressure test"],
        cons: ["Heavier"],
        risks: ["Scope creep"],
      },
    ],
    keyAssumptions: ["Traders pay for rehearsal"],
    divergentRisks: ["Over-claiming pass rates"],
    additionalRisks: [],
    confidenceLabel: "MEDIUM",
  });
}

function prepareJson() {
  return JSON.stringify({
    reply: "Chọn Readiness Lab MVP.",
    decision: "ACCEPT",
    selectedOptionTitle: "Readiness Lab MVP",
    rationale: ["Lower risk", "Fits no-live-trade constraint"],
    rejectedOptions: [
      { title: "Full brokerage clone", reasons: ["Compliance risk"] },
    ],
    tradeoffs: ["Narrower scope"],
    reviewTriggers: ["If paid users < 10"],
    confidenceLabel: "MEDIUM",
    confidenceScore: 55,
    unresolvedUnknowns: [],
  });
}

beforeEach(() => {
  process.env.USE_MEMORY_STORE = "true";
  process.env.DEV_AUTH_BYPASS = "true";
  process.env.ENABLE_SECOND_OPINION = "false";
  process.env.USE_STUB_MODELS = "false";
  resetEnvCache();
  resetMemoryDb();
});

async function seedSession(): Promise<DecisionSession> {
  const repos = getRepositories();
  const now = new Date().toISOString();
  const ws = await repos.workspaces.create({
    ownerId: "u1",
    name: "Lab",
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });
  return repos.sessions.create({
    workspaceId: ws.id,
    ownerId: "u1",
    title: "FTMO",
    problem:
      "Should we build a web app to help traders train for the FTMO challenge?",
    objective: undefined,
    constraints: [],
    assumptions: [],
    unknowns: [],
    options: [],
    criteria: [],
    status: "DISCOVERY",
    latestSummary: undefined,
    workflow: emptyWorkflowMetadata("DEEP"),
    createdAt: now,
    updatedAt: now,
  });
}

async function drain(
  gen: AsyncGenerator<{ event: string; data: Record<string, unknown> }>
) {
  const events: Array<{ event: string; data: Record<string, unknown> }> = [];
  for await (const e of gen) events.push(e);
  return events;
}

describe("automatic workflow without manual Intent (v17)", () => {
  it("progresses FRAME → OPTIONS → CRITIQUE with omitted intent", async () => {
    const repos = getRepositories();
    let session = await seedSession();
    await repos.messages.create({
      workspaceId: session.workspaceId,
      sessionId: session.id,
      ownerId: "u1",
      role: "USER",
      content: "Help me decide on an FTMO training MVP.",
      createdAt: new Date().toISOString(),
    });

    // Separate reply queues per provider so Critic (groq) and Analyst (gemini)
    // each get the right structured payload.
    const gemini = scriptedProvider("gemini", [frameJson(), optionsJson()]);
    const groq = scriptedProvider("groq", [critiqueJson(), prepareJson()]);
    const deepseek = scriptedProvider("deepseek", [optionsJson()]);
    const gateway = new ModelGateway([gemini, groq, deepseek]);

    const stages: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const events = await drain(
        runDecisionOrchestrator({
          repos,
          session,
          ownerId: "u1",
          routeMode: "DEEP",
          userRequest:
            i === 0
              ? "Help me decide on an FTMO training MVP."
              : "Continue the automatic decision workflow.",
          requestId: `req-${i}`,
          gateway,
        })
      );
      const started = events.find((e) => e.event === "workflow.stage.started");
      if (started?.data.stage) stages.push(String(started.data.stage));
      const completed = events.find((e) => e.event === "run.completed");
      session = (await repos.sessions.getBySessionId(session.id, "u1"))!;
      expect(events.some((e) => e.event === "run.failed")).toBe(false);
      if (
        completed?.data.workflowState === "PAUSED" ||
        completed?.data.workflowState === "COMPLETED" ||
        session.status === "DECISION_READY"
      ) {
        break;
      }
      if (completed?.data.shouldAdvance === false) break;
    }

    expect(stages[0]).toBe("FRAME");
    expect(stages).toContain("OPTIONS");
    expect(session.options.length).toBeGreaterThan(0);
    expect(session.workflow?.artifacts.FRAME?.status).toBe("CURRENT");
  });

  it("DEEP OPTIONS persists SecondOpinion lastRun, debateNotes, and proposedBy", async () => {
    process.env.ENABLE_SECOND_OPINION = "true";
    process.env.DEEPSEEK_API_KEY = "sk-test";
    resetEnvCache();

    const repos = getRepositories();
    let session = await seedSession();
    session = await repos.sessions.update(session.workspaceId, session.id, "u1", {
      latestSummary: "Framed FTMO training as rehearsal-only MVP.",
    });
    await repos.messages.create({
      workspaceId: session.workspaceId,
      sessionId: session.id,
      ownerId: "u1",
      role: "USER",
      content: "Generate options now.",
      createdAt: new Date().toISOString(),
    });

    const gemini = scriptedProvider("gemini", [optionsJson()]);
    const groq = scriptedProvider("groq", [critiqueJson()]);
    const deepseek = scriptedProvider("deepseek", [soJson()]);
    const gateway = new ModelGateway([gemini, groq, deepseek]);

    const events = await drain(
      runDecisionOrchestrator({
        repos,
        session,
        ownerId: "u1",
        routeMode: "DEEP",
        userRequest: "Generate options now.",
        requestId: "req-so",
        gateway,
      })
    );

    expect(events.some((e) => e.event === "run.failed")).toBe(false);
    session = (await repos.sessions.getBySessionId(session.id, "u1"))!;
    expect(session.workflow?.lastRun?.stage).toBe("OPTIONS");
    expect(session.workflow?.lastRun?.plannedStages).toContain("SECOND_OPINION");
    expect(
      session.workflow?.lastRun?.roles.some(
        (r) => r.role === "SECOND_OPINION" && r.status === "COMPLETED"
      )
    ).toBe(true);
    expect(session.workflow?.debateNotes?.divergentRisks).toContain(
      "Over-claiming pass rates"
    );
    expect(
      session.options.some(
        (o) => o.proposedBy === "SECOND_OPINION" && o.title === "Challenge Gym"
      )
    ).toBe(true);
    expect(session.workflow?.artifacts.OPTIONS?.contributions?.secondOpinion).toBe(
      true
    );
    expect(session.workflow?.artifacts.OPTIONS?.agentRunIds.length).toBeGreaterThan(
      0
    );

    const critiqueEvents = await drain(
      runDecisionOrchestrator({
        repos,
        session,
        ownerId: "u1",
        routeMode: "DEEP",
        userRequest: "Tiếp tục quy trình quyết định theo giai đoạn tiếp theo.",
        requestId: "req-critique",
        gateway,
      })
    );
    expect(critiqueEvents.some((e) => e.event === "run.failed")).toBe(false);
    session = (await repos.sessions.getBySessionId(session.id, "u1"))!;
    expect(session.workflow?.lastRun?.stage).toBe("CRITIQUE");
    expect(session.workflow?.lastRun?.plannedStages).not.toContain(
      "SECOND_OPINION"
    );
    const soRuns = (await repos.agentRuns.listBySession(
      session.workspaceId,
      session.id,
      "u1"
    )).filter((r) => r.role === "SECOND_OPINION");
    expect(soRuns).toHaveLength(1);
  });

  it("DEEP CRITIQUE runs Critic despite HIGH OPEN unknowns", async () => {
    process.env.ENABLE_SECOND_OPINION = "true";
    process.env.DEEPSEEK_API_KEY = "sk-test";
    resetEnvCache();

    const repos = getRepositories();
    const now = new Date().toISOString();
    let session = await seedSession();
    session = await repos.sessions.update(session.workspaceId, session.id, "u1", {
      latestSummary: "Framed FTMO training as rehearsal-only MVP.",
      options: [
        {
          id: "o1",
          title: "Readiness Lab MVP",
          description: "Simulated challenges only",
          pros: ["Safe"],
          cons: ["Narrow"],
          risks: ["Low adoption"],
          evidenceIds: [],
          status: "PROPOSED",
          proposedBy: "ANALYST",
        },
      ],
      unknowns: [
        {
          id: "u1",
          question: "Latest FTMO news-trading rules?",
          importance: "HIGH",
          resolution: "OPEN",
          evidenceIds: [],
        },
      ],
      workflow: {
        ...emptyWorkflowMetadata("DEEP"),
        currentStage: "OPTIONS",
        completedStages: ["FRAME", "OPTIONS"],
        artifacts: {
          FRAME: { agentRunIds: ["r1"], status: "CURRENT", updatedAt: now },
          OPTIONS: {
            agentRunIds: ["so-1"],
            status: "CURRENT",
            updatedAt: now,
            contributions: { secondOpinion: true },
          },
        },
        debateNotes: {
          criticisms: [],
          unsupportedAssumptions: [],
          missingEvidence: [],
          divergentRisks: ["Over-claiming"],
          soPreferredOptionTitle: "Readiness Lab MVP",
        },
      },
    });
    await repos.messages.create({
      workspaceId: session.workspaceId,
      sessionId: session.id,
      ownerId: "u1",
      role: "USER",
      content: "Tiếp tục quy trình quyết định theo giai đoạn tiếp theo.",
      createdAt: now,
    });

    const gemini = scriptedProvider("gemini", [optionsJson()]);
    const groq = scriptedProvider("groq", [critiqueJson()]);
    const deepseek = scriptedProvider("deepseek", [soJson()]);
    const gateway = new ModelGateway([gemini, groq, deepseek]);

    const events = await drain(
      runDecisionOrchestrator({
        repos,
        session,
        ownerId: "u1",
        routeMode: "DEEP",
        userRequest: "Tiếp tục quy trình quyết định theo giai đoạn tiếp theo.",
        requestId: "req-groq-critique",
        gateway,
      })
    );

    expect(events.some((e) => e.event === "run.failed")).toBe(false);
    session = (await repos.sessions.getBySessionId(session.id, "u1"))!;
    expect(session.workflow?.lastRun?.stage).toBe("CRITIQUE");
    expect(session.workflow?.lastRun?.plannedStages).toContain("CRITIC");
    expect(session.workflow?.lastRun?.plannedStages).not.toContain(
      "SECOND_OPINION"
    );
    const critic = (await repos.agentRuns.listBySession(
      session.workspaceId,
      session.id,
      "u1"
    )).find((r) => r.role === "CRITIC");
    expect(critic?.provider).toBe("groq");
    expect(critic?.status).toBe("COMPLETED");
  });

  it("pauses on HIGH Unknown and resumes after resolution", async () => {
    const repos = getRepositories();
    const now = new Date().toISOString();
    let session = await seedSession();
    session = await repos.sessions.update(session.workspaceId, session.id, "u1", {
      latestSummary: "Framed",
      options: [
        {
          id: "o1",
          title: "Readiness Lab MVP",
          description: "d",
          pros: [],
          cons: [],
          risks: [],
          evidenceIds: [],
          status: "PROPOSED",
          proposedBy: "ANALYST",
        },
      ],
      assumptions: [
        {
          id: "a1",
          statement: "Users exist",
          status: "SUPPORTED",
          importance: "MEDIUM",
          evidenceIds: ["e1"],
        },
      ],
      unknowns: [
        {
          id: "u1",
          question: "Upload MT4 or API?",
          importance: "HIGH",
          resolution: "OPEN",
          evidenceIds: [],
        },
      ],
      workflow: {
        ...emptyWorkflowMetadata("DEEP"),
        currentStage: "VERIFY",
        completedStages: ["FRAME", "OPTIONS", "CRITIQUE", "VERIFY"],
        artifacts: {
          FRAME: { agentRunIds: [], status: "CURRENT", updatedAt: now },
          OPTIONS: { agentRunIds: [], status: "CURRENT", updatedAt: now },
          CRITIQUE: { agentRunIds: [], status: "CURRENT", updatedAt: now },
          VERIFY: { agentRunIds: [], status: "CURRENT", updatedAt: now },
        },
      },
    });

    const paused = decideWorkflowStage({ session, routeMode: "DEEP" });
    expect(paused.state).toBe("PAUSED");
    expect(paused.blockers).toContain("HIGH_UNKNOWNS_OPEN");

    session = await repos.sessions.update(session.workspaceId, session.id, "u1", {
      unknowns: [
        {
          id: "u1",
          question: "Upload MT4 or API?",
          importance: "HIGH",
          resolution: "HUMAN_DECISION",
          evidenceIds: [],
          resolutionNote: "Use API",
          resolvedAt: now,
          resolvedBy: "u1",
        },
      ],
    });

    const gateway = new ModelGateway([
      scriptedProvider("gemini", [prepareJson()]),
      scriptedProvider("groq", [prepareJson()]),
      scriptedProvider("deepseek", [prepareJson()]),
    ]);

    const events = await drain(
      runDecisionOrchestrator({
        repos,
        session,
        ownerId: "u1",
        routeMode: "DEEP",
        userRequest: "Continue after resolving unknown",
        requestId: "resume-1",
        gateway,
      })
    );
    const stage = events.find((e) => e.event === "workflow.stage.started");
    expect(stage?.data.stage).toBe("PREPARE");
    expect(
      events.some(
        (e) =>
          e.event === "workflow.resumed" || e.event === "workflow.started"
      )
    ).toBe(true);
  });
});
