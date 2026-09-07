import type { ModelGateway } from "@/ai/gateway/model-gateway";
import type { NormalizedModelRequest } from "@/ai/gateway/model-provider";
import { getPrompt } from "@/ai/prompts/registry";
import {
  SecondOpinionOutputSchema,
  parseLooseJson,
  type SecondOpinionOutput,
} from "@/ai/agents/schemas";

/**
 * Runs an independent DeepSeek pass in parallel with the Analyst. Always
 * targets "deepseek" directly (never resolveProviderForRole/fallback) — a
 * second opinion that silently fell back to Gemini would just be comparing
 * Gemini against itself, defeating the point of a different-provider voice.
 * Callers must catch failures themselves and treat this as skippable
 * (DEEP must still work when DeepSeek is unavailable or errors).
 */
export async function runSecondOpinion(args: {
  gateway: ModelGateway;
  request: Omit<NormalizedModelRequest, "role" | "systemInstructions"> & {
    systemInstructions: string;
  };
}): Promise<{
  content: string;
  structured?: SecondOpinionOutput;
  provider: string;
  model: string;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    cachedTokens?: number;
  };
  latencyMs: number;
  estimatedCostUsd?: number;
  promptVersion: string;
  schemaVersion: string;
}> {
  const prompt = getPrompt("SECOND_OPINION");

  const baseRequest: NormalizedModelRequest = {
    ...args.request,
    role: "SECOND_OPINION",
    systemInstructions: `${prompt.template}\n\n${args.request.systemInstructions}`,
    outputSchemaName: args.request.outputSchemaName ?? "second_opinion_output_v1",
    metadata: {
      ...args.request.metadata,
      promptVersion: prompt.version,
    },
  };

  let result = await args.gateway.generate<SecondOpinionOutput>(
    "deepseek",
    baseRequest,
    { allowFallback: false }
  );
  let structured = result.structured
    ? SecondOpinionOutputSchema.safeParse(result.structured)
    : SecondOpinionOutputSchema.safeParse(parseLooseJson(result.content));

  if (!structured.success) {
    result = await args.gateway.generate<SecondOpinionOutput>(
      "deepseek",
      {
        ...baseRequest,
        messages: [
          ...baseRequest.messages,
          {
            role: "user",
            content: `Schema error: ${structured.error.message}. Return corrected JSON only.`,
          },
        ],
      },
      { allowFallback: false }
    );
    structured = result.structured
      ? SecondOpinionOutputSchema.safeParse(result.structured)
      : SecondOpinionOutputSchema.safeParse(parseLooseJson(result.content));
  }

  return {
    content: result.content,
    structured: structured.success ? structured.data : undefined,
    provider: result.provider,
    model: result.model,
    usage: result.usage,
    latencyMs: result.latencyMs,
    estimatedCostUsd: result.estimatedCostUsd,
    promptVersion: prompt.version,
    schemaVersion: prompt.schemaVersion,
  };
}
