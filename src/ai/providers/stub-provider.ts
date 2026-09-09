import type {
  ModelCapabilities,
  ModelProvider,
  ModelResult,
  NormalizedModelRequest,
} from "@/ai/gateway/model-provider";
import { cancelledError } from "@/ai/gateway/abort";

/**
 * Deterministic ModelProvider for CI / Playwright. Never calls a paid API.
 */
export class StubModelProvider implements ModelProvider {
  constructor(public readonly id: string) {}

  capabilities(): ModelCapabilities {
    return {
      structuredOutput: true,
      tools: false,
      streaming: false,
      vision: false,
      maxContextTokens: 32_000,
    };
  }

  async generate<T = unknown>(
    request: NormalizedModelRequest
  ): Promise<ModelResult<T>> {
    if (request.signal?.aborted) throw cancelledError();
    const payload = stubStructured(request);
    const content = JSON.stringify(payload);
    return {
      provider: this.id,
      model: `stub-${this.id}`,
      content,
      structured: payload as T,
      usage: { inputTokens: 12, outputTokens: 40 },
      latencyMs: 2,
      estimatedCostUsd: 0,
    };
  }

  async health() {
    return { ok: true, latencyMs: 1 };
  }
}

function stubStructured(request: NormalizedModelRequest): Record<string, unknown> {
  if (request.role === "CRITIC") {
    return {
      reply:
        "Phản bác Analyst: Readiness Lab MVP vẫn giả định người dùng trả tiền rehearsal mà chưa có evidence chuyển đổi.",
      criticisms: [
        "Do not treat unverified user claims as HIGH reliability",
        "Broker execution is a non-goal",
      ],
      unsupportedAssumptions: ["Demand at $15/month is still a hypothesis"],
      missingEvidence: ["No completed experiment yet"],
      contradictions: [],
    };
  }
  if (request.role === "JUDGE") {
    return {
      reply:
        "Accept Readiness Lab MVP. It matches the training/decision-support framing and keeps execution out of scope.",
      decision: "ACCEPT",
      selectedOptionTitle: "Readiness Lab MVP",
      rationale: [
        "Fits ChallengeReady non-goals (no live trading)",
        "Arithmetic claim is tool-verifiable",
        "Rejected options expand into execution or guaranteed-pass claims",
      ],
      rejectedOptions: [
        {
          title: "Live signal copier",
          reasons: ["Forbidden: trade execution / signal bot"],
        },
      ],
      tradeoffs: [
        "Training quality depends on scenario fidelity",
        "Does not replace a real prop-firm challenge",
      ],
      reviewTriggers: [
        "If the product starts executing broker orders",
        "If pricing or user-count assumptions change by >30%",
      ],
      confidenceLabel: "MEDIUM",
      confidenceScore: 62,
      unresolvedUnknowns: [],
    };
  }
  if (request.role === "SECOND_OPINION") {
    return {
      reply:
        "Phương án khác: Simulator-first Challenge Gym — tập trung ngày giả lập trước checklist, không copier.",
      recommendedDirection: "Simulator-first Challenge Gym",
      preferredOptionTitle: "Simulator-first Challenge Gym",
      independentOptions: [
        {
          title: "Simulator-first Challenge Gym",
          description:
            "Independent take: ship simulated challenge days before a journal-heavy lab.",
          pros: ["Tests process under time pressure"],
          cons: ["Heavier to build than a checklist MVP"],
          risks: ["Scope creep into broker APIs"],
        },
      ],
      keyAssumptions: ["Traders will pay for rehearsal, not signals"],
      divergentRisks: ["Over-claiming pass rates"],
      additionalRisks: ["Scope creep into broker APIs"],
      confidenceLabel: "MEDIUM",
    };
  }

  return {
    reply:
      "Frame the problem as a training/readiness product. Do not build live trading signals. Suggested first slice: Readiness Lab MVP.",
    problemFraming:
      "Help FTMO-style challenge traders rehearse risk and process before a real evaluation — education only.",
    assumptions: [
      {
        statement: "20 paying users × $15/month = $300 MRR",
        importance: "MEDIUM",
        status: "UNVERIFIED",
      },
      {
        statement: "Users want rehearsal tools, not live buy/sell signals",
        importance: "HIGH",
        status: "ACCEPTED_FOR_NOW",
      },
    ],
    unknowns: [
      {
        question: "Will paid rehearsal convert without a guaranteed-pass claim?",
        importance: "MEDIUM",
        resolution: "OPEN",
      },
    ],
    options: [
      {
        title: "Readiness Lab MVP",
        description:
          "Journal, risk-guard checklists, and simulated challenge days. No broker execution.",
        pros: ["Matches DomainPack non-goals", "Shippable with current stack"],
        cons: ["Does not place real trades"],
        risks: ["Users may still ask for a signal bot"],
      },
      {
        title: "Live signal copier",
        description: "Copy buy/sell signals into a broker account.",
        pros: ["Looks like automation"],
        cons: ["Forbidden by ChallengeReady pack"],
        risks: ["Regulatory and safety failure"],
      },
    ],
    suggestedStatus: "VALIDATING",
  };
}
