import type { ModelGateway, PreferredProvider } from "@/ai/gateway/model-gateway";
import type { NormalizedModelRequest } from "@/ai/gateway/model-provider";
import { getPrompt } from "@/ai/prompts/registry";
import {
  AnalystOutputSchema,
  type AnalystOutput,
  normalizeAnalystPayload,
  parseLooseJson,
} from "@/ai/agents/schemas";
import type { IndependentFrame } from "@/domain/decision/types";

/**
 * Independent framer pinned to one provider — used for Parallel Blind Framing.
 * Same Analyst schema, but allowFallback:false so a missing DeepSeek/Groq
 * never silently becomes Gemini (which would recreate framing monopoly).
 */
export async function runIndependentFramer(args: {
  gateway: ModelGateway;
  provider: PreferredProvider;
  request: Omit<NormalizedModelRequest, "role" | "systemInstructions"> & {
    systemInstructions: string;
  };
}): Promise<{
  frame: IndependentFrame;
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
  const prompt = getPrompt("ANALYST");
  const blindInstructions = `${prompt.template}

PARALLEL BLIND FRAMING RULES:
- You are one independent framer. You do NOT see other models' outputs.
- Frame the RAW human problem only. Do not assume another agent already framed it.
- Return JSON with reply, problemFraming, assumptions, unknowns, constraints, options (optional proposals).
- Keep problemFraming to 2-4 sentences naming your primary analytical lens.

${args.request.systemInstructions}`;

  const baseRequest: NormalizedModelRequest = {
    ...args.request,
    role: "ANALYST",
    systemInstructions: blindInstructions,
    outputSchemaName: args.request.outputSchemaName ?? "analyst_output_v1",
    metadata: {
      ...args.request.metadata,
      promptVersion: prompt.version,
    },
  };

  let result = await args.gateway.generate<AnalystOutput>(
    args.provider,
    baseRequest,
    { allowFallback: false }
  );

  let structured = parseFramerOutput(result);
  if (!structured.success) {
    result = await args.gateway.generate<AnalystOutput>(
      args.provider,
      {
        ...baseRequest,
        messages: [
          ...baseRequest.messages,
          {
            role: "user",
            content: `Previous output failed schema validation: ${structured.error.message}. Return corrected JSON only.`,
          },
        ],
      },
      { allowFallback: false }
    );
    structured = parseFramerOutput(result);
  }

  const data = structured.success ? structured.data : undefined;
  const frame: IndependentFrame = {
    provider: args.provider,
    reply: data?.reply ?? result.content,
    problemFraming: data?.problemFraming,
    perspectiveName: data?.problemFraming?.split(/[.!?]/)[0]?.trim().slice(0, 80),
    assumptions: (data?.assumptions ?? []).map((a) => ({
      statement: a.statement,
      importance: a.importance,
      status: a.status,
    })),
    unknowns: (data?.unknowns ?? []).map((u) => ({
      question: u.question,
      importance: u.importance,
      resolution: u.resolution,
    })),
    constraints: (data?.constraints ?? []).map((c) => ({
      statement: c.statement,
    })),
    proposedOptions: (data?.options ?? []).map((o) => ({
      title: o.title,
      description: o.description,
      pros: o.pros,
      cons: o.cons,
      risks: o.risks,
    })),
  };

  return {
    frame,
    content: data?.reply ?? result.content,
    structured: data,
    provider: result.provider,
    model: result.model,
    usage: result.usage,
    latencyMs: result.latencyMs,
    estimatedCostUsd: result.estimatedCostUsd,
    promptVersion: prompt.version,
    schemaVersion: prompt.schemaVersion,
  };
}

function parseFramerStructured(raw: unknown) {
  const parsed =
    typeof raw === "string" ? parseLooseJson(raw) : (raw ?? {});
  return AnalystOutputSchema.safeParse(normalizeAnalystPayload(parsed));
}

function parseFramerOutput(result: { structured?: unknown; content: string }) {
  if (result.structured) {
    const direct = parseFramerStructured(result.structured);
    if (direct.success) return direct;
  }
  return parseFramerStructured(result.content);
}
