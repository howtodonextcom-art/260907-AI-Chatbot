import { getServerEnv } from "@/config/env";
import type {
  ModelProvider,
  ModelResult,
  NormalizedModelRequest,
} from "@/ai/gateway/model-provider";
import { GeminiProvider } from "@/ai/providers/gemini-provider";
import { GroqProvider } from "@/ai/providers/groq-provider";
import { AppError } from "@/infrastructure/api/errors";
import { logStructured } from "@/infrastructure/logging/logger";
import type { AgentRole, RouteMode } from "@/domain/decision/types";

export type PreferredProvider = "gemini" | "groq";

export function resolveProviderForRole(
  role: AgentRole,
  routeMode: RouteMode
): PreferredProvider {
  if (routeMode === "QUICK") return "groq";
  if (role === "CRITIC") return "groq";
  return "gemini";
}

export class ModelGateway {
  private providers: Map<string, ModelProvider> = new Map();

  constructor(providers?: ModelProvider[]) {
    if (providers) {
      for (const p of providers) this.providers.set(p.id, p);
      return;
    }
    const env = getServerEnv();
    if (env.hasGemini) this.providers.set("gemini", new GeminiProvider());
    if (env.hasGroq) this.providers.set("groq", new GroqProvider());
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
    options?: { allowFallback?: boolean }
  ): Promise<ModelResult<T>> {
    const order: PreferredProvider[] =
      preferred === "gemini" ? ["gemini", "groq"] : ["groq", "gemini"];
    const candidates = options?.allowFallback === false ? [preferred] : order;

    let lastError: unknown;
    for (const id of candidates) {
      if (!this.providers.has(id)) continue;
      try {
        const provider = this.getProvider(id);
        const result = await this.withRetry(() => provider.generate<T>(request));
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

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const retryable =
        error instanceof AppError &&
        (error.code === "PROVIDER_TIMEOUT" || error.code === "PROVIDER_ERROR");
      if (!retryable) throw error;
      const jitter = 500 + Math.floor(Math.random() * 500);
      await new Promise((r) => setTimeout(r, jitter));
      return fn();
    }
  }
}
