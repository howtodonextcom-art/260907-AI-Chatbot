import type { PreferredProvider } from "@/ai/gateway/model-gateway";
import {
  assertFramerQuorum,
  InsufficientFramersError,
  MIN_FRAMER_QUORUM,
  type FramerFailureMeta,
} from "@/domain/decision/framer-quorum";

export {
  assertFramerQuorum,
  InsufficientFramersError,
  MIN_FRAMER_QUORUM,
  type FramerFailureMeta,
};

export function selectFramingProviders(env: {
  hasGemini: boolean;
  hasDeepseek: boolean;
  hasGroq: boolean;
  useStubModels: boolean;
}): PreferredProvider[] {
  const providers: PreferredProvider[] = [];
  if (env.hasGemini || env.useStubModels) providers.push("gemini");
  if (env.hasDeepseek || env.useStubModels) providers.push("deepseek");
  if (env.hasGroq || env.useStubModels) providers.push("groq");
  return providers;
}

/** Fail closed when fewer than quorum providers are even configured. */
export function assertFramingProviderCapacity(
  providers: PreferredProvider[]
): PreferredProvider[] {
  if (providers.length < MIN_FRAMER_QUORUM) {
    throw new InsufficientFramersError({
      successfulCount: 0,
      failures: [
        {
          provider: "config",
          error: `Need ≥${MIN_FRAMER_QUORUM} AI providers for Parallel Blind Framing; configured: ${providers.join(",") || "none"}`,
        },
      ],
      attemptedProviders: providers,
    });
  }
  return providers;
}
