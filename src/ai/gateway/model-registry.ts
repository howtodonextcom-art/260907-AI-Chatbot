import type {
  ModelCapabilities,
  ModelRegistryEntry,
} from "@/ai/gateway/model-provider";

const GEMINI_CAPS: ModelCapabilities = {
  structuredOutput: true,
  tools: true,
  streaming: true,
  vision: true,
  maxContextTokens: 1000000,
};

const GROQ_CAPS: ModelCapabilities = {
  structuredOutput: true,
  tools: false,
  streaming: true,
  vision: false,
  maxContextTokens: 128000,
};

const DEEPSEEK_CAPS: ModelCapabilities = {
  structuredOutput: true,
  tools: false,
  streaming: true,
  vision: false,
  maxContextTokens: 128000,
};

export const MODEL_REGISTRY: ModelRegistryEntry[] = [
  {
    provider: "gemini",
    // Gemini 2.0 Flash retired; API directs clients to 3.6 Flash.
    model: "gemini-3.6-flash",
    capabilities: GEMINI_CAPS,
    enabled: true,
    routingTags: ["analyst", "judge", "standard", "deep"],
    pricing: { inputPerMillion: 0.1, outputPerMillion: 0.4 },
  },
  {
    provider: "groq",
    // llama-3.3-70b-versatile deprecated (Aug 2026); Groq recommends gpt-oss-120b.
    model: "openai/gpt-oss-120b",
    capabilities: GROQ_CAPS,
    enabled: true,
    routingTags: ["quick", "critic", "economy"],
    pricing: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  },
  {
    provider: "deepseek",
    // OpenAI-compatible Chat Completions; deepseek-chat aliases non-thinking flash.
    model: "deepseek-chat",
    capabilities: DEEPSEEK_CAPS,
    enabled: true,
    routingTags: ["fallback", "economy", "deepseek"],
    // Estimate: cache-miss list rates for deepseek-chat / V4-Flash alias.
    pricing: { inputPerMillion: 0.14, outputPerMillion: 0.28 },
  },
];

export function estimateCostUsd(
  provider: string,
  model: string,
  inputTokens?: number,
  outputTokens?: number
): number | undefined {
  const entry = MODEL_REGISTRY.find(
    (e) => e.provider === provider && e.model === model
  );
  if (!entry?.pricing) return undefined;
  const input = ((inputTokens ?? 0) / 1_000_000) * (entry.pricing.inputPerMillion ?? 0);
  const output =
    ((outputTokens ?? 0) / 1_000_000) * (entry.pricing.outputPerMillion ?? 0);
  return Number((input + output).toFixed(6));
}

export function getDefaultModel(provider: string): string {
  const entry = MODEL_REGISTRY.find((e) => e.provider === provider && e.enabled);
  return entry?.model ?? "unknown";
}
