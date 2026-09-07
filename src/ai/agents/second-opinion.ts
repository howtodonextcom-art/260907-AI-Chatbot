import type { ModelGateway } from "@/ai/gateway/model-gateway";
import type { NormalizedModelRequest } from "@/ai/gateway/model-provider";
import { getPrompt } from "@/ai/prompts/registry";
import {
  SecondOpinionOutputSchema,
  parseLooseJson,
  type SecondOpinionOutput,
} from "@/ai/agents/schemas";

/**
 * Tries result.structured first; if that's absent OR present-but-invalid,
 * falls through to lenient re-parsing of the raw content string before
 * giving up (fixes the same fragility found live in Judge, 2026-09-08 —
 * see CLAUDE.md [[deepseek-second-opinion]]).
 */
function parseSecondOpinionOutput(result: {
  structured?: unknown;
  content: string;
}) {
  if (result.structured) {
    const direct = SecondOpinionOutputSchema.safeParse(result.structured);
    if (direct.success) return direct;
  }
  return SecondOpinionOutputSchema.safeParse(parseLooseJson(result.content));
}

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
  let structured = parseSecondOpinionOutput(result);

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
    structured = parseSecondOpinionOutput(result);
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
