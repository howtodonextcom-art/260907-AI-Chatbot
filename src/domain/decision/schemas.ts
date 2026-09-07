import { z } from "zod";

export const CreateSessionSchema = z.object({
  title: z.string().min(1).max(160),
  problem: z.string().min(1).max(10000),
  objective: z.string().max(5000).optional(),
  domainPackId: z.string().optional(),
});

export const ConstraintSchema = z.object({
  id: z.string(),
  statement: z.string(),
  source: z.enum(["USER", "SYSTEM", "DOMAIN_PACK", "AI"]),
  confirmedByUser: z.boolean(),
});

export const CriterionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  weight: z.number(),
  proposedBy: z.enum(["USER", "AI", "DOMAIN_PACK"]),
  confirmedByUser: z.boolean(),
});

export const OptionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  risks: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  status: z.enum(["PROPOSED", "SHORTLISTED", "REJECTED", "SELECTED"]),
  implementationComplexity: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  criterionScores: z.record(z.number()).optional(),
});

export const AssumptionSchema = z.object({
  id: z.string(),
  statement: z.string(),
  status: z.enum([
    "UNVERIFIED",
    "SUPPORTED",
    "CONTRADICTED",
    "ACCEPTED_FOR_NOW",
  ]),
  importance: z.enum(["LOW", "MEDIUM", "HIGH"]),
  evidenceIds: z.array(z.string()),
});

export const UnknownSchema = z.object({
  id: z.string(),
  question: z.string(),
  importance: z.enum(["LOW", "MEDIUM", "HIGH"]),
  resolution: z.enum([
    "OPEN",
    "VERIFY_NOW",
    "EXPERIMENT_REQUIRED",
    "HUMAN_DECISION_REQUIRED",
    "RESOLVED",
  ]),
  evidenceIds: z.array(z.string()),
});

/**
 * DECIDED is intentionally excluded here. It may only be assigned by
 * approveDecision() after HardPolicyGate passes (POST /api/sessions/:id/decision).
 * Allowing it through this generic PATCH would let a client skip JudgeDraft,
 * HardPolicyGate and DecisionRecord creation entirely.
 */
export const UpdateSessionSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  problem: z.string().min(1).max(10000).optional(),
  objective: z.string().max(5000).optional(),
  status: z
    .enum(["DISCOVERY", "VALIDATING", "DECISION_READY", "ARCHIVED"])
    .optional(),
  domainPackId: z.string().optional(),
  latestSummary: z.string().optional(),
  constraints: z.array(ConstraintSchema).optional(),
  assumptions: z.array(AssumptionSchema).optional(),
  unknowns: z.array(UnknownSchema).optional(),
  options: z.array(OptionSchema).optional(),
  criteria: z.array(CriterionSchema).optional(),
});

export const CreateMessageSchema = z.object({
  content: z.string().min(1).max(20000),
});

export const RunSessionSchema = z.object({
  routeMode: z.enum(["QUICK", "STANDARD", "DEEP"]),
  intent: z.enum([
    "DISCUSS",
    "FRAME_PROBLEM",
    "GENERATE_OPTIONS",
    "CRITIQUE",
    "VERIFY",
    "PREPARE_DECISION",
  ]),
  messageId: z.string().optional(),
});

export const ApproveDecisionSchema = z.object({
  judgeRunId: z.string(),
  approve: z.literal(true),
});

export const CreateBlueprintSchema = z.object({
  sourceDecisionRecordId: z.string(),
});

export const ApproveBlueprintSchema = z.object({
  approve: z.literal(true),
});

export const CreateEvidenceSchema = z.object({
  type: z.enum([
    "SOURCE_CODE",
    "OFFICIAL_DOCUMENTATION",
    "WEB_SOURCE",
    "USER_FACT",
    "USER_CLAIM",
    "CALCULATION",
    "EXPERIMENT",
    "AI_INFERENCE",
  ]),
  claim: z.string().min(1).max(5000),
  source: z.string().max(2000).optional(),
  reliability: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  supportsOptionIds: z.array(z.string()).default([]),
  contradictsOptionIds: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional(),
});

export function validateCriteriaWeights(
  criteria: Array<{ weight: number }>
): boolean {
  if (criteria.length === 0) return true;
  const sum = criteria.reduce((acc, c) => acc + c.weight, 0);
  return Math.abs(sum - 1) <= 0.001;
}
