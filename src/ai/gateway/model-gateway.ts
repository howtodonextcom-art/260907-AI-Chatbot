import { getServerEnv } from "@/config/env";
import type {
  ModelProvider,
  ModelResult,
  NormalizedModelRequest,
} from "@/ai/gateway/model-provider";
import { cancelledError, isCancelledError } from "@/ai/gateway/abort";
import { DeepSeekProvider } from "@/ai/providers/deepseek-provider";
import { GeminiProvider } from "@/ai/providers/gemini-provider";
import { GroqProvider } from "@/ai/providers/groq-provider";
import { StubModelProvider } from "@/ai/providers/stub-provider";
import { AppError } from "@/infrastructure/api/errors";
import { logStructured } from "@/infrastructure/logging/logger";
import type { AgentRole, RouteMode } from "@/domain/decision/types";
import {
  recordUsage,
  type BudgetTracker,
} from "@/ai/orchestration/stop-conditions";

export type PreferredProvider = "gemini" | "groq" | "deepseek";

export function resolveProviderForRole(
  role: AgentRole,
  routeMode: RouteMode
): PreferredProvider {
  if (routeMode === "QUICK") return "groq";
  if (role === "CRITIC") return "groq";
  return "gemini";
}

export function fallbackOrder(preferred: PreferredProvider): PreferredProvider[] {
  if (preferred === "gemini") return ["gemini", "groq", "deepseek"];
  if (preferred === "groq") return ["groq", "gemini", "deepseek"];
  return ["deepseek", "groq", "gemini"];
}

export class ModelGateway {
  private providers: Map<string, ModelProvider> = new Map();
  private tracker?: BudgetTracker;

  bindTracker(tracker: BudgetTracker): void {
    this.tracker = tracker;
  }

  constructor(providers?: ModelProvider[]) {
    if (providers) {
      for (const p of providers) this.providers.set(p.id, p);
      return;
    }
    const env = getServerEnv();
    if (env.useStubModels) {
      this.providers.set("gemini", new StubModelProvider("gemini"));
      this.providers.set("groq", new StubModelProvider("groq"));
      this.providers.set("deepseek", new StubModelProvider("deepseek"));
      return;
    }
    if (env.hasGemini) this.providers.set("gemini", new GeminiProvider());
    if (env.hasGroq) this.providers.set("groq", new GroqProvider());
    if (env.hasDeepseek) this.providers.set("deepseek", new DeepSeekProvider());
  }

  getProvider(id: string): ModelProvider {
    const p = this.providers.get(id);
    if (!p) {
      throw new AppError(
        "PROVIDER_ERROR",
        `Provider not configured: ${id}`,
        502
      );
    }
    return p;
  }

  listProviders(): string[] {
    return [...this.providers.keys()];
  }

  async generate<T = unknown>(
    preferred: PreferredProvider,
    request: NormalizedModelRequest,
    options?: { allowFallback?: boolean; tracker?: BudgetTracker }
  ): Promise<ModelResult<T>> {
    if (request.signal?.aborted) {
      throw cancelledError();
    }
    const order = fallbackOrder(preferred);
    const candidates = options?.allowFallback === false ? [preferred] : order;

    let lastError: unknown;
    for (const id of candidates) {
      if (request.signal?.aborted) {
        throw cancelledError();
      }
      if (!this.providers.has(id)) continue;
      try {
        const provider = this.getProvider(id);
        const result = await this.withRetry(
          () => provider.generate<T>(request),
          options?.tracker ?? this.tracker
        );
        if (id !== preferred) {
          logStructured("warn", "provider.fallback", {
            from: preferred,
            to: id,
            role: request.role,
            requestId: request.metadata.requestId,
          });
        }
        return result;
      } catch (error) {
        if (isCancelledError(error)) throw error;
        lastError = error;
        logStructured("warn", "provider.failed", {
          provider: id,
          role: request.role,
          requestId: request.metadata.requestId,
          message: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    throw (
      lastError ??
      new AppError("PROVIDER_ERROR", "No AI providers available", 502)
    );
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    tracker?: BudgetTracker
  ): Promise<T> {
    const run = async () => {
      const result = await fn();
      if (tracker && result && typeof result === "object" && "usage" in result) {
        const usage = (result as { usage?: { inputTokens?: number; outputTokens?: number }; estimatedCostUsd?: number });
        recordUsage(tracker, {
          inputTokens: usage.usage?.inputTokens,
          outputTokens: usage.usage?.outputTokens,
          costUsd: usage.estimatedCostUsd,
        });
      }
      return result;
    };
    try {
      return await run();
    } catch (error) {
      if (isCancelledError(error)) throw error;
        const retryable =
        error instanceof AppError &&
        (error.code === "PROVIDER_TIMEOUT" || error.code === "PROVIDER_ERROR");
      if (!retryable) throw error;
      const jitter = 500 + Math.floor(Math.random() * 500);
      await new Promise((r) => setTimeout(r, jitter));
      return run();
    }
  }
}
