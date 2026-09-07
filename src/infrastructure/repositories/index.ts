import { getServerEnv } from "@/config/env";
import type { WorkspaceRepository } from "@/domain/workspace/repository";
import type { DecisionSessionRepository } from "@/domain/decision/repository";
import type {
  AgentRunRepository,
  BlueprintRepository,
  DecisionRecordRepository,
  EvidenceRepository,
  ExperimentRepository,
  IdempotencyStore,
  MessageRepository,
  RateLimitStore,
} from "@/domain/repositories";
import {
  MemoryAgentRunRepository,
  MemoryBlueprintRepository,
  MemoryDecisionRecordRepository,
  MemoryDecisionSessionRepository,
  MemoryEvidenceRepository,
  MemoryExperimentRepository,
  MemoryIdempotencyStore,
  MemoryMessageRepository,
  MemoryRateLimitStore,
  MemoryWorkspaceRepository,
} from "@/infrastructure/repositories/memory-store";
import { FirestoreWorkspaceRepository } from "@/infrastructure/repositories/firestore-workspace-repository";
import { FirestoreDecisionSessionRepository } from "@/infrastructure/repositories/firestore-session-repository";
import {
  FirestoreAgentRunRepository,
  FirestoreEvidenceRepository,
  FirestoreMessageRepository,
} from "@/infrastructure/repositories/firestore-message-repository";
import {
  FirestoreBlueprintRepository,
  FirestoreDecisionRecordRepository,
  FirestoreExperimentRepository,
  FirestoreIdempotencyStore,
  FirestoreRateLimitStore,
} from "@/infrastructure/repositories/firestore-decision-record-repository";

export interface Repositories {
  workspaces: WorkspaceRepository;
  sessions: DecisionSessionRepository;
  messages: MessageRepository;
  evidence: EvidenceRepository;
  agentRuns: AgentRunRepository;
  decisionRecords: DecisionRecordRepository;
  blueprints: BlueprintRepository;
  experiments: ExperimentRepository;
  idempotency: IdempotencyStore;
  rateLimit: RateLimitStore;
}

export function getRepositories(): Repositories {
  const env = getServerEnv();
  if (env.useMemoryStore) {
    return {
      workspaces: new MemoryWorkspaceRepository(),
      sessions: new MemoryDecisionSessionRepository(),
      messages: new MemoryMessageRepository(),
      evidence: new MemoryEvidenceRepository(),
      agentRuns: new MemoryAgentRunRepository(),
      decisionRecords: new MemoryDecisionRecordRepository(),
      blueprints: new MemoryBlueprintRepository(),
      experiments: new MemoryExperimentRepository(),
      idempotency: new MemoryIdempotencyStore(),
      rateLimit: new MemoryRateLimitStore(),
    };
  }

  return {
    workspaces: new FirestoreWorkspaceRepository(),
    sessions: new FirestoreDecisionSessionRepository(),
    messages: new FirestoreMessageRepository(),
    evidence: new FirestoreEvidenceRepository(),
    agentRuns: new FirestoreAgentRunRepository(),
    decisionRecords: new FirestoreDecisionRecordRepository(),
    blueprints: new FirestoreBlueprintRepository(),
    experiments: new FirestoreExperimentRepository(),
    idempotency: new FirestoreIdempotencyStore(),
    rateLimit: new FirestoreRateLimitStore(),
  };
}
