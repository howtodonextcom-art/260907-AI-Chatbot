import type {
  AgentRole,
  EvidenceReliability,
  EvidenceType,
  ISODateTime,
} from "@/domain/decision/types";

export interface Message {
  id: string;
  workspaceId: string;
  sessionId: string;
  ownerId: string;
  role: "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";
  content: string;
  runId?: string;
  agentRole?: AgentRole;
  provider?: string;
  model?: string;
  createdAt: ISODateTime;
}

export type VerificationStatus =
  | "UNVERIFIED"
  | "VERIFIED"
  | "CONTRADICTED"
  | "NOT_VERIFIABLE";

export type VerificationActor = "TOOL" | "SYSTEM" | "USER" | "EXPERIMENT";

export interface VerificationMetadata {
  status: VerificationStatus;
  verifiedBy?: VerificationActor;
  verifiedAt?: ISODateTime;
  verifierId?: string;
  method?: string;
}

/**
 * How much of the original claim/question the verification actually covers.
 * A calculation can verify a numeric fragment of a compound claim ("20 x 15"
 * inside "20 users x $15 = $300 MRR and they will all subscribe") without
 * verifying the whole proposition — see CLAUDE.md [[ftmo-verify-classifier]].
 */
export type VerificationCoverage = "NONE" | "PARTIAL" | "FULL";

export interface EvidenceItem {
  id: string;
  workspaceId: string;
  sessionId: string;
  ownerId: string;
  type: EvidenceType;
  claim: string;
  source?: string;
  /** Provenance label — not the same as verification. */
  reliability: EvidenceReliability;
  createdBy: "USER" | "AI" | "TOOL" | "SYSTEM";
  supportsOptionIds: string[];
  contradictsOptionIds: string[];
  supportsAssumptionIds?: string[];
  contradictsAssumptionIds?: string[];
  supportsUnknownIds?: string[];
  verificationStatus: VerificationStatus;
  verifiedBy?: VerificationActor;
  verifiedAt?: ISODateTime;
  verificationMethod?: string;
  /** The full original assumption/unknown text this evidence was extracted from. */
  originalClaim?: string;
  /** The exact substring that was actually verified (may be a subset of originalClaim). */
  verifiedFragment?: string;
  verificationCoverage?: VerificationCoverage;
  metadata?: Record<string, unknown>;
  createdAt: ISODateTime;
}

export const DEFAULT_EVIDENCE_RELIABILITY: Record<
  EvidenceType,
  EvidenceReliability
> = {
  SOURCE_CODE: "HIGH",
  OFFICIAL_DOCUMENTATION: "HIGH",
  CALCULATION: "HIGH",
  EXPERIMENT: "HIGH",
  USER_FACT: "MEDIUM",
  WEB_SOURCE: "MEDIUM",
  USER_CLAIM: "LOW",
  AI_INFERENCE: "LOW",
};
