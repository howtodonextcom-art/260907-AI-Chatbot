import type { ModelGateway } from "@/ai/gateway/model-gateway";
import type { NormalizedModelRequest } from "@/ai/gateway/model-provider";
import { getPrompt } from "@/ai/prompts/registry";
import { JudgeOutputSchema, type JudgeOutput } from "@/ai/agents/schemas";
import { resolveProviderForRole } from "@/ai/gateway/model-gateway";

export async function runJudge(args: {
  gateway: ModelGateway;
  request: Omit<NormalizedModelRequest, "role" | "systemInstructions"> & {
    systemInstructions: string;
  };
  analystContent: string;
  criticContent?: string;
  secondOpinionContent?: string;
}): Promise<{
  content: string;
  structured?: JudgeOutput;
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
  const prompt = getPrompt("JUDGE");
  const provider = resolveProviderForRole("JUDGE", args.request.routeMode);

  const baseRequest: NormalizedModelRequest = {
    ...args.request,
    role: "JUDGE",
    systemInstructions: `${prompt.template}\n\n${args.request.systemInstructions}`,
    outputSchemaName: "judge_output_v1",
    messages: [
      ...args.request.messages,
      {
        role: "user",
        content: [
          `Analyst:\n${args.analystContent}`,
          args.criticContent
            ? `Critic:\n${args.criticContent}`
            : "Critic: (unavailable / skipped)",
          args.secondOpinionContent
            ? `Independent second opinion (different provider):\n${args.secondOpinionContent}`
            : "Second opinion: (unavailable / skipped)",
        ].join("\n\n"),
      },
    ],
    metadata: {
      ...args.request.metadata,
      promptVersion: prompt.version,
    },
  };

  let result = await args.gateway.generate<JudgeOutput>(provider, baseRequest);
  let structured = result.structured
    ? JudgeOutputSchema.safeParse(result.structured)
    : JudgeOutputSchema.safeParse(safeJson(result.content));

  if (!structured.success) {
    result = await args.gateway.generate<JudgeOutput>(provider, {
      ...baseRequest,
      messages: [
        ...baseRequest.messages,
        {
          role: "user",
          content: `Schema error: ${structured.error.message}. Return corrected JSON only.`,
        },
      ],
    });
    structured = result.structured
      ? JudgeOutputSchema.safeParse(result.structured)
      : JudgeOutputSchema.safeParse(safeJson(result.content));
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

function safeJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return { reply: content, decision: "INSUFFICIENT_EVIDENCE" };
  }
}
