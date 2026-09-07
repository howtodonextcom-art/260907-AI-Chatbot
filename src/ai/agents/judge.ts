import type { ModelGateway } from "@/ai/gateway/model-gateway";
import type { NormalizedModelRequest } from "@/ai/gateway/model-provider";
import { getPrompt } from "@/ai/prompts/registry";
import {
  JudgeOutputSchema,
  parseLooseJson,
  type JudgeOutput,
} from "@/ai/agents/schemas";
import { resolveProviderForRole } from "@/ai/gateway/model-gateway";
import type { z } from "zod";

/**
 * Judge's structured JSON draft is not optional decoration — losing it
 * silently means PREPARE_DECISION runs, costs real money, visibly replies
 * in chat, and yet never writes judgeDraft to the session (observed live,
 * 2026-09-08: Gemini returned a structured object whose shape narrowly
 * failed JudgeOutputSchema — e.g. markdown-fenced JSON the provider's own
 * naive JSON.parse only partially handled — and the old code only ever
 * retried lenient content-based recovery when result.structured was
 * COMPLETELY absent, never when it was present-but-invalid). This mirrors
 * the DeepSeek truncation bug already fixed for SecondOpinion (see
 * CLAUDE.md [[deepseek-second-opinion]]) — same fragility, different
 * provider. parseLooseJson (fenced-block + brace-slice extraction) is tried
 * on the raw content whenever the direct parse fails, before giving up.
 */
function parseJudgeOutput(result: {
  structured?: unknown;
  content: string;
}): z.SafeParseReturnType<unknown, JudgeOutput> {
  if (result.structured) {
    const direct = JudgeOutputSchema.safeParse(result.structured);
    if (direct.success) return direct;
  }
  const loose = JudgeOutputSchema.safeParse(parseLooseJson(result.content));
  if (loose.success) return loose;
  return JudgeOutputSchema.safeParse(safeJson(result.content));
}

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
    outputSchemaName: args.request.outputSchemaName ?? "judge_output_v1",
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
  let structured = parseJudgeOutput(result);

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
    structured = parseJudgeOutput(result);
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
