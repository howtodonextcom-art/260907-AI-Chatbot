export type ISODateTime = string;
export type EntityStatus = "ACTIVE" | "ARCHIVED";

export type DecisionSessionStatus =
  | "DISCOVERY"
  | "VALIDATING"
  | "DECISION_READY"
  | "DECIDED"
  | "ARCHIVED";

export type EvidenceType =
  | "SOURCE_CODE"
  | "OFFICIAL_DOCUMENTATION"
  | "WEB_SOURCE"
  | "USER_FACT"
  | "USER_CLAIM"
  | "CALCULATION"
  | "EXPERIMENT"
  | "AI_INFERENCE";

export type EvidenceReliability = "HIGH" | "MEDIUM" | "LOW";
export type OptionStatus = "PROPOSED" | "SHORTLISTED" | "REJECTED" | "SELECTED";
export type BlueprintStatus = "DRAFT" | "REVIEW" | "APPROVED" | "SUPERSEDED";
/**
 * SECOND_OPINION is a deliberate deviation from spec v5's 3-role limit,
 * chosen by the user: DeepSeek runs in parallel with Analyst in DEEP mode
 * as an independent 4th voice, so Critic/Judge see two genuinely different
 * providers' takes instead of just Gemini's. See CLAUDE.md for the tradeoff
 * this accepts (extra cost/latency per DEEP round).
 */
export type AgentRole = "ANALYST" | "CRITIC" | "JUDGE" | "SECOND_OPINION";
export type RouteMode = "QUICK" | "STANDARD" | "DEEP";
export type RunStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED"
  | "CANCELLED";

export interface AiBudget {
  maxCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxCostUsd: number;
  maxRounds: number;
}

export interface Constraint {
  id: string;
  statement: string;
  source: "USER" | "SYSTEM" | "DOMAIN_PACK" | "AI";
  confirmedByUser: boolean;
}

export interface Assumption {
  id: string;
  statement: string;
  status: "UNVERIFIED" | "SUPPORTED" | "CONTRADICTED" | "ACCEPTED_FOR_NOW";
  importance: "LOW" | "MEDIUM" | "HIGH";
  evidenceIds: string[];
}

/**
 * OPEN/VERIFY_NOW/EXPERIMENT_REQUIRED/HUMAN_DECISION_REQUIRED are all
 * NON-TERMINAL — they describe what should happen next, not that anything
 * has actually been resolved. Only RESOLVED (evidence/experiment-backed),
 * HUMAN_DECISION (explicit human call, never reported as verified fact —
 * see CLAUDE.md [[unknown-resolution-workflow]]), and ACCEPTED_RISK
 * (explicit residual-risk acceptance) are terminal and may stop a HIGH
 * Unknown from blocking DECISION_READY. See
 * src/domain/decision/unknown-policy.ts for the single authoritative
 * blocking-policy implementation (MASTER CODING PROMPT v13 §10).
 */
export type UnknownResolution =
  | "OPEN"
  | "VERIFY_NOW"
  | "EXPERIMENT_REQUIRED"
  | "HUMAN_DECISION_REQUIRED"
  | "RESOLVED"
  | "HUMAN_DECISION"
  | "ACCEPTED_RISK";

export interface Unknown {
  id: string;
  question: string;
  importance: "LOW" | "MEDIUM" | "HIGH";
  resolution: UnknownResolution;
  evidenceIds: string[];
  /** Required when resolution is HUMAN_DECISION or ACCEPTED_RISK. */
  resolutionNote?: string;
  resolvedAt?: ISODateTime;
  /** ownerId of the user who resolved it (never AI/system for these two). */
  resolvedBy?: string;
}

export interface Criterion {
  id: string;
  name: string;
  description?: string;
  weight: number;
  proposedBy: "USER" | "AI" | "DOMAIN_PACK";
  confirmedByUser: boolean;
}

export interface Option {
  id: string;
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  risks: string[];
  estimatedCost?: {
    value?: number;
    currency?: string;
    note?: string;
  };
  implementationComplexity?: "LOW" | "MEDIUM" | "HIGH";
  evidenceIds: string[];
  criterionScores?: Record<string, number>;
  status: OptionStatus;
}

export interface DecisionSession {
  id: string;
  workspaceId: string;
  ownerId: string;
  title: string;
  problem: string;
  objective?: string;
  constraints: Constraint[];
  assumptions: Assumption[];
  unknowns: Unknown[];
  options: Option[];
  criteria: Criterion[];
  domainPackId?: string;
  status: DecisionSessionStatus;
  activeDecisionRecordId?: string;
  activeBlueprintId?: string;
  latestSummary?: string;
  judgeDraft?: JudgeDraft;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  archivedAt?: ISODateTime;
}

export interface JudgeDraft {
  runId: string;
  problem: string;
  selectedOptionId?: string;
  decision:
    | "ACCEPT"
    | "ACCEPT_WITH_CHANGES"
    | "EXPERIMENT_FIRST"
    | "REJECT"
    | "INSUFFICIENT_EVIDENCE";
  rationale: string[];
  selectedEvidenceIds: string[];
  rejectedOptions: Array<{ optionId: string; reasons: string[] }>;
  acceptedAssumptionIds: string[];
  unresolvedUnknownIds: string[];
  tradeoffs: string[];
  reviewTriggers: string[];
  /**
   * Derived from Judge's HEURISTIC secondOpinionAgreement label (Judge is
   * the only agent that has seen both Analyst's and SecondOpinion's actual
   * output) — never a self-report from SecondOpinion itself, which never
   * saw Analyst's output. See CLAUDE.md
   * [[second-opinion-agreement-semantics]].
   */
  agentAgreement?: number;
  agentAgreementMethod: "JUDGE_HEURISTIC" | "UNAVAILABLE";
  agentAgreementRationale?: string;
  confidenceLabel: "LOW" | "MEDIUM" | "HIGH";
  confidenceScore: number;
}

export interface DecisionRecord {
  id: string;
  workspaceId: string;
  sessionId: string;
  ownerId: string;
  problem: string;
  selectedOptionId?: string;
  decision:
    | "ACCEPT"
    | "ACCEPT_WITH_CHANGES"
    | "EXPERIMENT_FIRST"
    | "REJECT"
    | "INSUFFICIENT_EVIDENCE";
  rationale: string[];
  selectedEvidenceIds: string[];
  rejectedOptions: Array<{
    optionId: string;
    reasons: string[];
  }>;
  acceptedAssumptionIds: string[];
  unresolvedUnknownIds: string[];
  tradeoffs: string[];
  confidence: {
    type: "HEURISTIC";
    label: "LOW" | "MEDIUM" | "HIGH";
    score: number;
    factors: {
      evidenceCoverage: number;
      sourceReliability: number;
      unresolvedUnknownPenalty: number;
      assumptionPenalty: number;
      agentAgreement: number;
      experimentStrength: number;
    };
    /** How agentAgreement was derived — never fake statistical precision. */
    agentAgreementMethod: "JUDGE_HEURISTIC" | "UNAVAILABLE";
    agentAgreementRationale?: string;
    experimentStrengthMethod?: "COMPLETED_EXPERIMENTS" | "UNAVAILABLE";
  };
  reviewTriggers: string[];
  supersedesDecisionRecordId?: string;
  approvedBy: string;
  approvedAt: ISODateTime;
  createdAt: ISODateTime;
}
