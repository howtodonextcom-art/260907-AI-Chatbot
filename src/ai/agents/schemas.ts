import { z } from "zod";

export const AnalystOutputSchema = z.object({
  reply: z.string(),
  problemFraming: z.string().optional(),
  assumptions: z
    .array(
      z.object({
        statement: z.string(),
        importance: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
        status: z
          .enum([
            "UNVERIFIED",
            "SUPPORTED",
            "CONTRADICTED",
            "ACCEPTED_FOR_NOW",
          ])
          .default("UNVERIFIED"),
      })
    )
    .default([]),
  unknowns: z
    .array(
      z.object({
        question: z.string(),
        importance: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
        resolution: z
          .enum([
            "OPEN",
            "VERIFY_NOW",
            "EXPERIMENT_REQUIRED",
            "HUMAN_DECISION_REQUIRED",
            "RESOLVED",
          ])
          .default("OPEN"),
      })
    )
    .default([]),
  options: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        pros: z.array(z.string()).default([]),
        cons: z.array(z.string()).default([]),
        risks: z.array(z.string()).default([]),
      })
    )
    .default([]),
  suggestedStatus: z
    .enum(["DISCOVERY", "VALIDATING", "DECISION_READY"])
    .optional(),
});

export const CriticOutputSchema = z.object({
  reply: z.string(),
  criticisms: z.array(z.string()).default([]),
  unsupportedAssumptions: z.array(z.string()).default([]),
  missingEvidence: z.array(z.string()).default([]),
  contradictions: z.array(z.string()).default([]),
});

export const JudgeOutputSchema = z.object({
  reply: z.string(),
  decision: z.enum([
    "ACCEPT",
    "ACCEPT_WITH_CHANGES",
    "EXPERIMENT_FIRST",
    "REJECT",
    "INSUFFICIENT_EVIDENCE",
  ]),
  selectedOptionTitle: z.string().optional(),
  rationale: z.array(z.string()).default([]),
  rejectedOptions: z
    .array(
      z.object({
        title: z.string(),
        reasons: z.array(z.string()),
      })
    )
    .default([]),
  tradeoffs: z.array(z.string()).default([]),
  reviewTriggers: z.array(z.string()).default([]),
  confidenceLabel: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  confidenceScore: z.number().min(0).max(100).default(50),
  unresolvedUnknowns: z.array(z.string()).default([]),
});

export const SecondOpinionOutputSchema = z.object({
  reply: z.string(),
  agreesWithAnalyst: z.boolean().default(true),
  /** 0 = fully disagrees, 1 = fully agrees. Feeds confidence.agentAgreement. */
  agreementScore: z.number().min(0).max(1).default(0.5),
  divergentPoints: z.array(z.string()).default([]),
  additionalRisks: z.array(z.string()).default([]),
});

export type AnalystOutput = z.infer<typeof AnalystOutputSchema>;
export type CriticOutput = z.infer<typeof CriticOutputSchema>;
export type JudgeOutput = z.infer<typeof JudgeOutputSchema>;
export type SecondOpinionOutput = z.infer<typeof SecondOpinionOutputSchema>;

const IMPORTANCE = new Set(["LOW", "MEDIUM", "HIGH"]);
const ASSUMPTION_STATUS = new Set([
  "UNVERIFIED",
  "SUPPORTED",
  "CONTRADICTED",
  "ACCEPTED_FOR_NOW",
]);
const UNKNOWN_RESOLUTION = new Set([
  "OPEN",
  "VERIFY_NOW",
  "EXPERIMENT_REQUIRED",
  "HUMAN_DECISION_REQUIRED",
  "RESOLVED",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(...candidates: unknown[]): string | undefined {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return undefined;
}

function pickImportance(value: unknown): "LOW" | "MEDIUM" | "HIGH" {
  return typeof value === "string" && IMPORTANCE.has(value)
    ? (value as "LOW" | "MEDIUM" | "HIGH")
    : "MEDIUM";
}

/** Coerce freer model JSON into AnalystOutputSchema-compatible shape. */
export function normalizeAnalystPayload(raw: unknown): unknown {
  const o = asRecord(raw);
  if (!o) return raw;

  const assumptions = Array.isArray(o.assumptions)
    ? o.assumptions
        .map((item) => {
          const a = asRecord(item);
          if (!a) return null;
          const statement = pickString(a.statement, a.text, a.description, a.title);
          if (!statement) return null;
          const status =
            typeof a.status === "string" && ASSUMPTION_STATUS.has(a.status)
              ? a.status
              : "UNVERIFIED";
          return {
            statement,
            importance: pickImportance(a.importance),
            status,
          };
        })
        .filter(Boolean)
    : [];

  const unknowns = Array.isArray(o.unknowns)
    ? o.unknowns
        .map((item) => {
          const u = asRecord(item);
          if (!u) return null;
          const question = pickString(
            u.question,
            u.description,
            u.text,
            u.title,
            u.impact
          );
          if (!question) return null;
          const resolution =
            typeof u.resolution === "string" && UNKNOWN_RESOLUTION.has(u.resolution)
              ? u.resolution
              : "OPEN";
          return {
            question,
            importance: pickImportance(u.importance),
            resolution,
          };
        })
        .filter(Boolean)
    : [];

  const options = Array.isArray(o.options)
    ? o.options
        .map((item) => {
          const opt = asRecord(item);
          if (!opt) return null;
          const title = pickString(opt.title, opt.name);
          const description = pickString(opt.description, opt.summary, opt.details) ?? "";
          if (!title) return null;
          return {
            title,
            description,
            pros: Array.isArray(opt.pros) ? opt.pros.map(String) : [],
            cons: Array.isArray(opt.cons) ? opt.cons.map(String) : [],
            risks: Array.isArray(opt.risks) ? opt.risks.map(String) : [],
          };
        })
        .filter(Boolean)
    : [];

  const reply = pickString(o.reply, o.message, o.summary, o.answer);
  if (!reply) return raw;

  return {
    reply,
    problemFraming: pickString(o.problemFraming, o.problem_framing, o.framing),
    assumptions,
    unknowns,
    options,
    suggestedStatus: o.suggestedStatus ?? o.suggested_status,
  };
}

export function parseLooseJson(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // ignore
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // ignore
    }
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      // ignore
    }
  }

  // Truncated JSON: recover reply string if present.
  const replyMatch = trimmed.match(/"reply"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (replyMatch?.[1]) {
    try {
      return {
        reply: JSON.parse(`"${replyMatch[1]}"`) as string,
        assumptions: [],
        unknowns: [],
        options: [],
      };
    } catch {
      return {
        reply: replyMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'),
        assumptions: [],
        unknowns: [],
        options: [],
      };
    }
  }

  return { reply: trimmed };
}
