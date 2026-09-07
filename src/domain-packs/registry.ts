import { getFeatureFlags } from "@/config/feature-flags";
import {
  GENERIC_DECISION_WORKFLOW,
  type DomainPack,
} from "@/domain-packs/generic";
import { ChallengeReadyDomainPack } from "@/domain-packs/challengeready";

const PACKS: Record<string, DomainPack> = {
  [GENERIC_DECISION_WORKFLOW.id]: GENERIC_DECISION_WORKFLOW,
  [ChallengeReadyDomainPack.id]: ChallengeReadyDomainPack,
};

export function getDomainPack(id?: string): DomainPack {
  const flags = getFeatureFlags();
  if (!id || id === GENERIC_DECISION_WORKFLOW.id) {
    return GENERIC_DECISION_WORKFLOW;
  }
  if (id === ChallengeReadyDomainPack.id && !flags.enableChallengeReadyPack) {
    return GENERIC_DECISION_WORKFLOW;
  }
  return PACKS[id] ?? GENERIC_DECISION_WORKFLOW;
}

export function listDomainPacks(): DomainPack[] {
  const flags = getFeatureFlags();
  return Object.values(PACKS).filter((p) => {
    if (p.id === "challengeready") return flags.enableChallengeReadyPack;
    return true;
  });
}
