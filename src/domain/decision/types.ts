export type ISODateTime = string;
export type EntityStatus = "ACTIVE" | "ARCHIVED";

export type DecisionSessionStatus =
  | "DISCOVERY"
  | "VALIDATING"
  | "DECISION_READY"
  | "DECIDED"
  | "ARCHIVED";

export type StatusTransitionOrigin =
  | "AI_AGENT"
  | "SYSTEM"
  | "USER_PATCH"
  | "HUMAN_APPROVE";

export interface StatusTransitionAction {
  origin: StatusTransitionOrigin;
  approve?: boolean;
}

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

export type OptionProposedBy = "ANALYST" | "SECOND_OPINION" | "USER";

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
  /** Provenance — who proposed this option into canonical DecisionState. */
  proposedBy?: OptionProposedBy;
}

/**
 * Orchestration/UX stage — independent of DecisionSessionStatus legal gates.
 * Human still owns DECIDED via approveDecision(); StageController never
 * auto-approves.
 */
export type WorkflowStage =
  | "DISCUSS"
  | "FRAME"
  | "OPTIONS"
  | "CRITIQUE"
  | "VERIFY"
  | "PREPARE";

export type WorkflowState =
  | "IDLE"
  | "RUNNING"
  | "PAUSED"
  | "BLOCKED"
  | "COMPLETED";

export type WorkflowArtifactStatus = "CURRENT" | "STALE";

export type WorkflowBlockerCode =
  | "HIGH_UNKNOWNS_OPEN"
  | "UNVERIFIED_ASSUMPTIONS"
  | "EXPERIMENT_REQUIRED"
  | "HUMAN_DECISION_REQUIRED"
  | "EVIDENCE_CONTRADICTION"
  | "BUDGET_EXHAUSTED"
  | "DECISION_READY"
  | "DECIDED";

export interface WorkflowStageArtifact {
  agentRunIds: string[];
  status: WorkflowArtifactStatus;
  updatedAt: ISODateTime;
  /** Canonical prose/JSON substrate for later stages (not CoT). */
  summary?: string;
  /** Optional structured contribution flags for cost/information-gain eval. */
  contributions?: {
    newOption?: boolean;
    newAssumption?: boolean;
    newRisk?: boolean;
    newContradiction?: boolean;
    newEvidenceRequirement?: boolean;
    materialDecisionChange?: boolean;
    /** True when DeepSeek SecondOpinion completed for CURRENT OPTIONS. */
    secondOpinion?: boolean;
  };
}

export interface IndependentFrame {
  provider: "gemini" | "groq" | "deepseek";
  runId?: string;
  reply: string;
  problemFraming?: string;
  /** Optional human-readable stance label for ConflictMap UI. */
  perspectiveName?: string;
  assumptions: Array<{
    statement: string;
    importance: "LOW" | "MEDIUM" | "HIGH";
    status: "UNVERIFIED" | "SUPPORTED" | "CONTRADICTED" | "ACCEPTED_FOR_NOW";
  }>;
  unknowns: Array<{
    question: string;
    importance: "LOW" | "MEDIUM" | "HIGH";
    resolution:
      | "OPEN"
      | "VERIFY_NOW"
      | "EXPERIMENT_REQUIRED"
      | "HUMAN_DECISION_REQUIRED"
      | "RESOLVED"
      | "HUMAN_DECISION"
      | "ACCEPTED_RISK";
  }>;
  constraints: Array<{ statement: string }>;
  proposedOptions?: Array<{
    title: string;
    description: string;
    pros: string[];
    cons: string[];
    risks: string[];
  }>;
}

/** Alias used by Parallel Blind Framing API / docs. */
export type AgentFrameOutput = IndependentFrame;

export interface ConflictViewpoint {
  provider: string;
  stance: string;
}

export interface ConflictTopic {
  topic: string;
  viewpoints: ConflictViewpoint[];
}

/**
 * ConflictMap is the Canvas-facing view of FrameConflictReport.
 * `coreDisagreements` carries structured multi-provider stances.
 */
export interface ConflictMap {
  coreDisagreements: ConflictTopic[];
}

export interface FrameConflictReport {
  providerCount: number;
  /** Flattened labels for debate notes / chips. */
  coreDisagreements: string[];
  /** Structured map for Decision Canvas (Illusion-of-council antidote). */
  conflictMap: ConflictMap;
  assumptionDisagreements: string[];
  unknownDisagreements: string[];
  perspectives: Array<{
    provider: "gemini" | "groq" | "deepseek";
    framing?: string;
    perspectiveName?: string;
    assumptionCount: number;
    unknownCount: number;
  }>;
  generatedAt: ISODateTime;
}

export interface ParallelFramingSnapshot {
  frames: IndependentFrame[];
  conflictReport: FrameConflictReport;
}

/** Canonical disagreement substrate for Canvas — not chat prose. */
export interface DebateNotes {
  criticisms: string[];
  unsupportedAssumptions: string[];
  missingEvidence: string[];
  divergentRisks: string[];
  soRecommendedDirection?: string;
  soPreferredOptionTitle?: string;
  updatedAt?: ISODateTime;
}

export interface WorkflowLastRunRole {
  role: string;
  status: "COMPLETED" | "FAILED" | "SKIPPED";
  provider?: string;
  message?: string;
}

/** Last orchestrator tick — chips after refresh, including silent failures. */
export interface WorkflowLastRun {
  stage: WorkflowStage;
  plannedStages: string[];
  roles: WorkflowLastRunRole[];
  at: ISODateTime;
}

export interface WorkflowMetadata {
  currentStage: WorkflowStage;
  state: WorkflowState;
  completedStages: WorkflowStage[];
  routeMode: RouteMode;
  artifacts: Partial<Record<WorkflowStage, WorkflowStageArtifact>>;
  blockers: WorkflowBlockerCode[];
  usage: {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
  framing?: ParallelFramingSnapshot;
  debateNotes?: DebateNotes;
  lastRun?: WorkflowLastRun;
  invalidatedFromStage?: WorkflowStage;
  updatedAt?: ISODateTime;
}

export interface WorkflowDecision {
  currentStage: WorkflowStage;
  nextStage: WorkflowStage | null;
  shouldAdvance: boolean;
  state: WorkflowState;
  blockers: WorkflowBlockerCode[];
  rationale: string;
  invalidatedFromStage?: WorkflowStage;
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
  /** Server-owned automatic decision workflow (v17). */
  workflow?: WorkflowMetadata;
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
