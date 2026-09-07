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
