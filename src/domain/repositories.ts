import type { Message, EvidenceItem } from "@/domain/evidence/types";
import type { AgentRun, Blueprint, ExperimentDefinition } from "@/domain/blueprint/types";
import type { DecisionRecord } from "@/domain/decision/types";

export interface MessageRepository {
  create(input: Omit<Message, "id">): Promise<Message>;
  listBySession(
    workspaceId: string,
    sessionId: string,
    ownerId: string
  ): Promise<Message[]>;
}

export interface EvidenceRepository {
  create(input: Omit<EvidenceItem, "id">): Promise<EvidenceItem>;
  listBySession(
    workspaceId: string,
    sessionId: string,
    ownerId: string
  ): Promise<EvidenceItem[]>;
  getById(
    workspaceId: string,
    sessionId: string,
    evidenceId: string,
    ownerId: string
  ): Promise<EvidenceItem | null>;
}

export interface AgentRunRepository {
  create(input: Omit<AgentRun, "id">): Promise<AgentRun>;
  update(
    workspaceId: string,
    sessionId: string,
    runId: string,
    ownerId: string,
    patch: Partial<AgentRun>
  ): Promise<AgentRun>;
  listBySession(
    workspaceId: string,
    sessionId: string,
    ownerId: string
  ): Promise<AgentRun[]>;
  getById(
    workspaceId: string,
    sessionId: string,
    runId: string,
    ownerId: string
  ): Promise<AgentRun | null>;
}

export interface DecisionRecordRepository {
  create(
    input: Omit<DecisionRecord, "id"> & { id?: string }
  ): Promise<DecisionRecord>;
  getById(id: string, ownerId: string): Promise<DecisionRecord | null>;
  getBySession(
    sessionId: string,
    ownerId: string
  ): Promise<DecisionRecord | null>;
}

export interface BlueprintRepository {
  create(input: Omit<Blueprint, "id"> & { id?: string }): Promise<Blueprint>;
  getById(id: string, ownerId: string): Promise<Blueprint | null>;
  getBySession(sessionId: string, ownerId: string): Promise<Blueprint | null>;
  updateStatus(
    id: string,
    ownerId: string,
    status: Blueprint["status"],
    approvedAt?: string
  ): Promise<Blueprint>;
}

export interface ExperimentRepository {
  create(input: Omit<ExperimentDefinition, "id">): Promise<ExperimentDefinition>;
  getById(
    workspaceId: string,
    sessionId: string,
    experimentId: string
  ): Promise<ExperimentDefinition | null>;
  listBySession(
    workspaceId: string,
    sessionId: string
  ): Promise<ExperimentDefinition[]>;
  update(
    workspaceId: string,
    sessionId: string,
    experimentId: string,
    patch: Partial<
      Pick<ExperimentDefinition, "status" | "results" | "winnerVariantId" | "limitations">
    >
  ): Promise<ExperimentDefinition>;
}

export interface IdempotencyStore {
  get(key: string): Promise<string | null>;
  set(key: string, artifactId: string): Promise<void>;
  /**
   * Atomically reserves `key` for `artifactId` unless another caller has
   * already claimed it — closes the read-then-write race a plain
   * get()+set() has under concurrent requests. Returns won:true when this
   * call owns the key, or won:false with the artifactId that won instead.
   */
  claim(
    key: string,
    artifactId: string
  ): Promise<{ won: boolean; artifactId: string }>;
}

export interface RateLimitStore {
  consume(uid: string, limit: number, windowMs: number): Promise<{
    allowed: boolean;
    remaining: number;
  }>;
}
