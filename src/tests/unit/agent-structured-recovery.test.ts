import { describe, expect, it } from "vitest";
import { ModelGateway } from "@/ai/gateway/model-gateway";
import type {
  ModelCapabilities,
  ModelProvider,
  ModelResult,
  NormalizedModelRequest,
} from "@/ai/gateway/model-provider";
import { runJudge } from "@/ai/agents/judge";
import { runCritic } from "@/ai/agents/critic";
import { runAnalyst } from "@/ai/agents/analyst";

/**
 * Regression test for a real bug observed live (2026-09-08): PREPARE_DECISION
 * ran, Judge visibly replied in chat, AgentRun showed COMPLETED, and yet
 * judgeDraft was never written to the session. Root cause: when the
 * provider's own naive JSON.parse(content) produced a `structured` object
 * that FAILED schema validation (e.g. from markdown-fenced JSON only
 * partially parsed), the old code only ever attempted lenient re-parsing of
 * the raw content when `structured` was completely ABSENT — never when it
 * was present-but-invalid. This silently discarded real, valid model
 * output that was recoverable from `content`. Fixed identically across
 * judge.ts, analyst.ts, critic.ts, second-opinion.ts.
 */

const VALID_JUDGE_JSON = {
  reply: "Accept with changes.",
  decision: "ACCEPT_WITH_CHANGES",
  rationale: ["fits scope"],
};

function fakeProvider(
  sequence: ModelResult<unknown>[],
  id = "gemini"
): ModelProvider {
  let call = 0;
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
      const result = sequence[Math.min(call, sequence.length - 1)];
      call += 1;
      return result as ModelResult<T>;
    },
    async health() {
      return { ok: true };
    },
  };
}

function baseRequest(): Omit<NormalizedModelRequest, "role" | "systemInstructions"> & {
  systemInstructions: string;
} {
  return {
    routeMode: "DEEP",
    systemInstructions: "ctx",
    messages: [],
    maxOutputTokens: 1000,
    metadata: {
      requestId: "r1",
      workspaceId: "w1",
      sessionId: "s1",
      promptVersion: "v1",
    },
  };
}

describe("Judge structured-output recovery (regression, 2026-09-08 live finding)", () => {
  it("uses result.structured directly when it already validates", async () => {
    const gateway = new ModelGateway([
      fakeProvider([
        {
          provider: "gemini",
          model: "gemini-3.6-flash",
          content: JSON.stringify(VALID_JUDGE_JSON),
          structured: VALID_JUDGE_JSON,
          usage: {},
          latencyMs: 1,
        },
      ]),
    ]);
    const result = await runJudge({
      gateway,
      request: baseRequest(),
      analystContent: "analyst says X",
    });
    expect(result.structured?.decision).toBe("ACCEPT_WITH_CHANGES");
  });

  it("recovers via content when structured is markdown-fenced (JSON.parse failed upstream)", async () => {
    const fencedContent = "```json\n" + JSON.stringify(VALID_JUDGE_JSON) + "\n```";
    const gateway = new ModelGateway([
      fakeProvider([
        {
          provider: "gemini",
          model: "gemini-3.6-flash",
          content: fencedContent,
          structured: undefined,
          usage: {},
          latencyMs: 1,
        },
      ]),
    ]);
    const result = await runJudge({
      gateway,
      request: baseRequest(),
      analystContent: "analyst says X",
    });
    expect(result.structured?.decision).toBe("ACCEPT_WITH_CHANGES");
  });

  it("recovers via content when structured is PRESENT but schema-invalid — the actual live bug", async () => {
    // Simulates: provider's naive JSON.parse(content) succeeded on a
    // TRUNCATED/malformed slice, producing a structured object missing the
    // required `decision` field, while the raw `content` string still
    // contains the full valid JSON (e.g. wrapped in a fence the naive
    // parse didn't strip). Before the fix, this returned structured:
    // undefined and judgeDraft was silently never persisted.
    const invalidStructured = { reply: "partial, no decision field" };
    const gateway = new ModelGateway([
      fakeProvider([
        {
          provider: "gemini",
          model: "gemini-3.6-flash",
          content: "```json\n" + JSON.stringify(VALID_JUDGE_JSON) + "\n```",
          structured: invalidStructured,
          usage: {},
          latencyMs: 1,
        },
      ]),
    ]);
    const result = await runJudge({
      gateway,
      request: baseRequest(),
      analystContent: "analyst says X",
    });
    expect(result.structured).toBeDefined();
    expect(result.structured?.decision).toBe("ACCEPT_WITH_CHANGES");
  });

  it("degrades to a safe INSUFFICIENT_EVIDENCE default (never throws away the reply) when genuinely unparseable", async () => {
    const gateway = new ModelGateway([
      fakeProvider([
        {
          provider: "gemini",
          model: "gemini-3.6-flash",
          content: "I cannot comply with structured output right now.",
          structured: undefined,
          usage: {},
          latencyMs: 1,
        },
      ]),
    ]);
    const result = await runJudge({
      gateway,
      request: baseRequest(),
      analystContent: "analyst says X",
    });
    expect(result.structured?.decision).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.structured?.reply).toBe(
      "I cannot comply with structured output right now."
    );
  });
});

describe("Critic/Analyst structured-output recovery (same fix, same regression)", () => {
  it("Critic recovers via content when structured is present-but-invalid", async () => {
    const validCritic = { reply: "criticism", criticisms: ["x"] };
    const gateway = new ModelGateway([
      fakeProvider(
        [
          {
            provider: "groq",
            model: "openai/gpt-oss-120b",
            content: "```json\n" + JSON.stringify(validCritic) + "\n```",
            structured: { notReply: "missing required reply field is fine here" },
            usage: {},
            latencyMs: 1,
          },
        ],
        "groq"
      ),
    ]);
    const result = await runCritic({
      gateway,
      request: baseRequest(),
      analystContent: "analyst says X",
    });
    expect(result.structured?.reply).toBe("criticism");
  });

  it("Analyst recovers via content when structured is present-but-invalid", async () => {
    const validAnalyst = { reply: "framed", options: [] };
    const gateway = new ModelGateway([
      fakeProvider([
        {
          provider: "gemini",
          model: "gemini-3.6-flash",
          content: "```json\n" + JSON.stringify(validAnalyst) + "\n```",
          structured: 12345, // present but nonsense shape
          usage: {},
          latencyMs: 1,
        },
      ]),
    ]);
    const result = await runAnalyst({
      gateway,
      request: baseRequest(),
    });
    expect(result.structured?.reply).toBe("framed");
  });
});
