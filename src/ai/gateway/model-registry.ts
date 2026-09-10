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
  tools: true,
  streaming: true,
  vision: true,
  maxContextTokens: 1000000,
};

export const MODEL_REGISTRY: ModelRegistryEntry[] = [
  {
    provider: "gemini",
    // Official Gemini API models page lists 3.1 Pro Preview as the current
    // advanced Pro model for complex reasoning / agentic coding.
    model: "gemini-3.1-pro-preview",
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
    // Official DeepSeek docs list deepseek-flash as DeepSeek-V4.1-Flash and
    // note V4.1 Flash has surpassed V4 Pro across performance/cost/speed.
    model: "deepseek-flash",
    capabilities: DEEPSEEK_CAPS,
    enabled: true,
    routingTags: ["fallback", "economy", "deepseek"],
    // Peak cache-miss pricing from DeepSeek model docs.
    pricing: { inputPerMillion: 0.3, outputPerMillion: 1.2 },
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
