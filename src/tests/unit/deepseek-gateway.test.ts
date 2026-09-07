import { afterEach, describe, expect, it, vi } from "vitest";
import { getServerEnv, resetEnvCache } from "@/config/env";
import {
  ModelGateway,
  resolveProviderForRole,
} from "@/ai/gateway/model-gateway";
import type {
  ModelProvider,
  ModelResult,
  NormalizedModelRequest,
} from "@/ai/gateway/model-provider";
import { AppError } from "@/infrastructure/api/errors";
import { getDefaultModel } from "@/ai/gateway/model-registry";

afterEach(() => {
  resetEnvCache();
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;
  vi.useRealTimers();
});

function mockRequest(): NormalizedModelRequest {
  return {
    role: "ANALYST",
    routeMode: "STANDARD",
    systemInstructions: "test",
    messages: [{ role: "user", content: "hi" }],
    maxOutputTokens: 16,
    metadata: {
      requestId: "test",
      workspaceId: "w",
      sessionId: "s",
      promptVersion: "v1",
    },
  };
}

function mockProvider(
  id: string,
  behavior: "ok" | "fail"
): ModelProvider & { calls: number } {
  const provider = {
    id,
    calls: 0,
    capabilities: () => ({
      structuredOutput: true,
      tools: false,
      streaming: false,
      vision: false,
      maxContextTokens: 128000,
    }),
    async generate<T = unknown>(): Promise<ModelResult<T>> {
      provider.calls += 1;
      if (behavior === "fail") {
        throw new AppError("PROVIDER_ERROR", `${id} down`, 502);
      }
      return {
        provider: id,
        model: `${id}-model`,
        content: `from-${id}`,
        usage: {},
        latencyMs: 1,
      };
    },
    async health() {
      return { ok: behavior === "ok" };
    },
  };
  return provider;
}

describe("hasDeepseek env flag", () => {
  it("is true when DEEPSEEK_API_KEY is set", () => {
    process.env.DEEPSEEK_API_KEY = "sk-test";
    expect(getServerEnv().hasDeepseek).toBe(true);
  });

  it("is false when DEEPSEEK_API_KEY is missing", () => {
    delete process.env.DEEPSEEK_API_KEY;
    expect(getServerEnv().hasDeepseek).toBe(false);
  });
});

describe("deepseek registry", () => {
  it("defaults to deepseek-chat", () => {
    expect(getDefaultModel("deepseek")).toBe("deepseek-chat");
  });
});

describe("resolveProviderForRole unchanged", () => {
  it("keeps QUICK/CRITIC on groq and others on gemini", () => {
    expect(resolveProviderForRole("ANALYST", "QUICK")).toBe("groq");
    expect(resolveProviderForRole("CRITIC", "STANDARD")).toBe("groq");
    expect(resolveProviderForRole("ANALYST", "STANDARD")).toBe("gemini");
    expect(resolveProviderForRole("JUDGE", "DEEP")).toBe("gemini");
  });
});

describe("ModelGateway deepseek fallback order", () => {
  it("falls gemini → groq → deepseek", async () => {
    vi.useFakeTimers();
    const gemini = mockProvider("gemini", "fail");
    const groq = mockProvider("groq", "fail");
    const deepseek = mockProvider("deepseek", "ok");
    const gateway = new ModelGateway([gemini, groq, deepseek]);

    const pending = gateway.generate("gemini", mockRequest());
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(result.provider).toBe("deepseek");
    expect(gemini.calls).toBeGreaterThan(0);
    expect(groq.calls).toBeGreaterThan(0);
    expect(deepseek.calls).toBe(1);
  });

  it("falls groq → gemini → deepseek", async () => {
    vi.useFakeTimers();
    const gemini = mockProvider("gemini", "fail");
    const groq = mockProvider("groq", "fail");
    const deepseek = mockProvider("deepseek", "ok");
    const gateway = new ModelGateway([gemini, groq, deepseek]);

    const pending = gateway.generate("groq", mockRequest());
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(result.provider).toBe("deepseek");
    expect(groq.calls).toBeGreaterThan(0);
    expect(gemini.calls).toBeGreaterThan(0);
    expect(deepseek.calls).toBe(1);
  });

  it("falls deepseek → groq → gemini", async () => {
    vi.useFakeTimers();
    const deepseek = mockProvider("deepseek", "fail");
    const groq = mockProvider("groq", "fail");
    const gemini = mockProvider("gemini", "ok");
    const gateway = new ModelGateway([gemini, groq, deepseek]);

    const pending = gateway.generate("deepseek", mockRequest());
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(result.provider).toBe("gemini");
    expect(deepseek.calls).toBeGreaterThan(0);
    expect(groq.calls).toBeGreaterThan(0);
    expect(gemini.calls).toBe(1);
  });
});
