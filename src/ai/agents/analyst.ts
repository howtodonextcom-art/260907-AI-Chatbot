import type { ModelGateway } from "@/ai/gateway/model-gateway";
import type { NormalizedModelRequest } from "@/ai/gateway/model-provider";
import { getPrompt } from "@/ai/prompts/registry";
import {
  AnalystOutputSchema,
  type AnalystOutput,
  normalizeAnalystPayload,
  parseLooseJson,
} from "@/ai/agents/schemas";
import { resolveProviderForRole } from "@/ai/gateway/model-gateway";

export async function runAnalyst(args: {
  gateway: ModelGateway;
  request: Omit<NormalizedModelRequest, "role" | "systemInstructions"> & {
    systemInstructions: string;
  };
  profile?: string;
}): Promise<{
  content: string;
  structured?: AnalystOutput;
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
  const prompt = getPrompt("ANALYST", args.profile);
  const provider = resolveProviderForRole(
    "ANALYST",
    args.request.routeMode
  );

  const baseRequest: NormalizedModelRequest = {
    ...args.request,
    role: "ANALYST",
    systemInstructions: `${prompt.template}\n\n${args.request.systemInstructions}`,
    outputSchemaName: args.request.outputSchemaName ?? "analyst_output_v1",
    metadata: {
      ...args.request.metadata,
      promptVersion: prompt.version,
    },
  };

  let result = await args.gateway.generate<AnalystOutput>(
    provider,
    baseRequest
  );

  let structured = parseAnalystOutput(result);

  if (!structured.success) {
    result = await args.gateway.generate<AnalystOutput>(provider, {
      ...baseRequest,
      messages: [
        ...baseRequest.messages,
        {
          role: "user",
          content: `Previous output failed schema validation: ${structured.error.message}. Return corrected JSON only with keys: reply, assumptions[{statement,importance,status}], unknowns[{question,importance,resolution}], options[{title,description,pros,cons,risks}], problemFraming?, suggestedStatus?.`,
        },
      ],
    });
    structured = parseAnalystOutput(result);
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

function parseAnalystStructured(raw: unknown) {
  const parsed =
    typeof raw === "string" ? parseLooseJson(raw) : (raw ?? {});
  return AnalystOutputSchema.safeParse(normalizeAnalystPayload(parsed));
}

/**
 * Tries result.structured first; if that's absent OR present-but-invalid
 * (e.g. markdown-fenced JSON the provider's own naive JSON.parse only
 * partially handled), falls through to lenient re-parsing of the raw
 * content string before giving up. Fixes the same class of silent-loss bug
 * found live in Judge (2026-09-08) — see CLAUDE.md
 * [[deepseek-second-opinion]] for the original SecondOpinion instance of
 * this fragility.
 */
function parseAnalystOutput(result: { structured?: unknown; content: string }) {
  if (result.structured) {
    const direct = parseAnalystStructured(result.structured);
    if (direct.success) return direct;
  }
  return parseAnalystStructured(result.content);
}

