import type { ModelGateway } from "@/ai/gateway/model-gateway";
import type { NormalizedModelRequest } from "@/ai/gateway/model-provider";
import { getPrompt } from "@/ai/prompts/registry";
import { CriticOutputSchema, type CriticOutput } from "@/ai/agents/schemas";
import { resolveProviderForRole } from "@/ai/gateway/model-gateway";

export async function runCritic(args: {
  gateway: ModelGateway;
  request: Omit<NormalizedModelRequest, "role" | "systemInstructions"> & {
    systemInstructions: string;
  };
  analystContent: string;
  secondOpinionContent?: string;
  profile?: string;
}): Promise<{
  content: string;
  structured?: CriticOutput;
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
  const prompt = getPrompt("CRITIC", args.profile);
  const provider = resolveProviderForRole("CRITIC", args.request.routeMode);

  const baseRequest: NormalizedModelRequest = {
    ...args.request,
    role: "CRITIC",
    systemInstructions: `${prompt.template}\n\n${args.request.systemInstructions}`,
    outputSchemaName: "critic_output_v1",
    messages: [
      ...args.request.messages,
      {
        role: "user",
        content: [
          `Analyst output to critique:\n${args.analystContent}`,
          args.secondOpinionContent
            ? `Independent second opinion (different provider) to weigh against the Analyst:\n${args.secondOpinionContent}`
            : null,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    metadata: {
      ...args.request.metadata,
      promptVersion: prompt.version,
    },
  };

  let result = await args.gateway.generate<CriticOutput>(provider, baseRequest);
  let structured = result.structured
    ? CriticOutputSchema.safeParse(result.structured)
    : CriticOutputSchema.safeParse(safeJson(result.content));

  if (!structured.success) {
    result = await args.gateway.generate<CriticOutput>(provider, {
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
      ? CriticOutputSchema.safeParse(result.structured)
      : CriticOutputSchema.safeParse(safeJson(result.content));
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
    return { reply: content };
  }
}
