import type { EvidenceReliability, EvidenceType } from "@/domain/decision/types";
import type {
  VerificationActor,
  VerificationStatus,
} from "@/domain/evidence/types";

/** Client-submitted evidence never inherits HIGH trust from a source label. */
export const USER_SUBMITTED_RELIABILITY: Record<EvidenceType, EvidenceReliability> = {
  USER_CLAIM: "LOW",
  AI_INFERENCE: "LOW",
  USER_FACT: "MEDIUM",
  WEB_SOURCE: "MEDIUM",
  SOURCE_CODE: "MEDIUM",
  OFFICIAL_DOCUMENTATION: "MEDIUM",
  CALCULATION: "LOW",
  EXPERIMENT: "LOW",
};

export function userEvidenceDefaults(type: EvidenceType): {
  reliability: EvidenceReliability;
  createdBy: "USER";
  verificationStatus: VerificationStatus;
} {
  return {
    reliability: USER_SUBMITTED_RELIABILITY[type],
    createdBy: "USER",
    verificationStatus: "UNVERIFIED",
  };
}

export function toolCalculationDefaults(): {
  reliability: EvidenceReliability;
  createdBy: "TOOL";
  verificationStatus: VerificationStatus;
  verifiedBy: VerificationActor;
} {
  return {
    reliability: "HIGH",
    createdBy: "TOOL",
    verificationStatus: "VERIFIED",
    verifiedBy: "TOOL",
  };
}

export function experimentResultDefaults(): {
  reliability: EvidenceReliability;
  createdBy: "SYSTEM";
  verificationStatus: VerificationStatus;
  verifiedBy: VerificationActor;
} {
  return {
    reliability: "HIGH",
    createdBy: "SYSTEM",
    verificationStatus: "VERIFIED",
    verifiedBy: "EXPERIMENT",
  };
}
