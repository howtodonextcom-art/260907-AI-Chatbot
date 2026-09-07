import { v4 as uuidv4 } from "uuid";
import type { Workspace } from "@/domain/workspace/types";
import type { DecisionSession, DecisionRecord } from "@/domain/decision/types";
import type { Message, EvidenceItem } from "@/domain/evidence/types";
import type { AgentRun, Blueprint, ExperimentDefinition } from "@/domain/blueprint/types";
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
import { AppError } from "@/infrastructure/api/errors";

export interface MemoryDb {
  workspaces: Map<string, Workspace>;
  sessions: Map<string, DecisionSession>;
  messages: Map<string, Message>;
  evidence: Map<string, EvidenceItem>;
  agentRuns: Map<string, AgentRun>;
  decisionRecords: Map<string, DecisionRecord>;
  blueprints: Map<string, Blueprint>;
  experiments: Map<string, ExperimentDefinition>;
  idempotency: Map<string, string>;
  rateLimits: Map<string, number[]>;
}

const globalStore = globalThis as unknown as { __layerAMemory?: MemoryDb };

export function getMemoryDb(): MemoryDb {
  if (!globalStore.__layerAMemory) {
    globalStore.__layerAMemory = {
      workspaces: new Map(),
      sessions: new Map(),
      messages: new Map(),
      evidence: new Map(),
      agentRuns: new Map(),
      decisionRecords: new Map(),
      blueprints: new Map(),
      experiments: new Map(),
      idempotency: new Map(),
      rateLimits: new Map(),
    };
  }
  return globalStore.__layerAMemory;
}

export function resetMemoryDb(): void {
  globalStore.__layerAMemory = undefined;
}

export class MemoryWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly db = getMemoryDb()) {}

  async create(input: Omit<Workspace, "id">): Promise<Workspace> {
    const workspace: Workspace = { ...input, id: uuidv4() };
    this.db.workspaces.set(workspace.id, workspace);
    return workspace;
  }

  async getById(id: string, ownerId: string): Promise<Workspace | null> {
    const ws = this.db.workspaces.get(id);
    if (!ws || ws.ownerId !== ownerId) return null;
    return ws;
  }

  async listByOwner(ownerId: string): Promise<Workspace[]> {
    return [...this.db.workspaces.values()]
      .filter((w) => w.ownerId === ownerId && w.status === "ACTIVE")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async update(
    id: string,
    ownerId: string,
    patch: Partial<Pick<Workspace, "name" | "description" | "status">>
  ): Promise<Workspace> {
    const existing = await this.getById(id, ownerId);
    if (!existing) throw new AppError("NOT_FOUND", "Workspace not found", 404);
    const updated: Workspace = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
      archivedAt:
        patch.status === "ARCHIVED"
          ? new Date().toISOString()
          : existing.archivedAt,
    };
    this.db.workspaces.set(id, updated);
    return updated;
  }
}

export class MemoryDecisionSessionRepository
  implements DecisionSessionRepository
{
  constructor(private readonly db = getMemoryDb()) {}

  async create(input: Omit<DecisionSession, "id">): Promise<DecisionSession> {
    const session: DecisionSession = { ...input, id: uuidv4() };
    this.db.sessions.set(session.id, session);
    return session;
  }

  async getById(
    workspaceId: string,
    sessionId: string,
    ownerId: string
  ): Promise<DecisionSession | null> {
    const s = this.db.sessions.get(sessionId);
    if (!s || s.workspaceId !== workspaceId || s.ownerId !== ownerId) {
      return null;
    }
    return s;
  }

  async getBySessionId(
    sessionId: string,
    ownerId: string
  ): Promise<DecisionSession | null> {
    const s = this.db.sessions.get(sessionId);
    if (!s || s.ownerId !== ownerId) return null;
    return s;
  }

  async listByWorkspace(
    workspaceId: string,
    ownerId: string
  ): Promise<DecisionSession[]> {
    return [...this.db.sessions.values()]
      .filter((s) => s.workspaceId === workspaceId && s.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async update(
    workspaceId: string,
    sessionId: string,
    ownerId: string,
    patch: Partial<DecisionSession>
  ): Promise<DecisionSession> {
    const existing = await this.getById(workspaceId, sessionId, ownerId);
    if (!existing) throw new AppError("NOT_FOUND", "Session not found", 404);
    const updated: DecisionSession = {
      ...existing,
      ...patch,
      id: existing.id,
      workspaceId: existing.workspaceId,
      ownerId: existing.ownerId,
      updatedAt: new Date().toISOString(),
    };
    this.db.sessions.set(sessionId, updated);
    return updated;
  }
}

export class MemoryMessageRepository implements MessageRepository {
  constructor(private readonly db = getMemoryDb()) {}

  async create(input: Omit<Message, "id">): Promise<Message> {
    const message: Message = { ...input, id: uuidv4() };
    this.db.messages.set(message.id, message);
    return message;
  }

  async listBySession(
    workspaceId: string,
    sessionId: string,
    ownerId: string
  ): Promise<Message[]> {
    return [...this.db.messages.values()]
      .filter(
        (m) =>
          m.workspaceId === workspaceId &&
          m.sessionId === sessionId &&
          m.ownerId === ownerId
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}

export class MemoryEvidenceRepository implements EvidenceRepository {
  constructor(private readonly db = getMemoryDb()) {}

  async create(input: Omit<EvidenceItem, "id">): Promise<EvidenceItem> {
    if (input.type === "AI_INFERENCE" && input.createdBy === "USER") {
      throw new AppError(
        "VALIDATION_ERROR",
        "AI_INFERENCE cannot be stored as USER_FACT automatically",
        400
      );
    }
    const item: EvidenceItem = { ...input, id: uuidv4() };
    this.db.evidence.set(item.id, item);
    return item;
  }

  async listBySession(
    workspaceId: string,
    sessionId: string,
    ownerId: string
  ): Promise<EvidenceItem[]> {
    return [...this.db.evidence.values()].filter(
      (e) =>
        e.workspaceId === workspaceId &&
        e.sessionId === sessionId &&
        e.ownerId === ownerId
    );
  }

  async getById(
    workspaceId: string,
    sessionId: string,
    evidenceId: string,
    ownerId: string
  ): Promise<EvidenceItem | null> {
    const item = this.db.evidence.get(evidenceId);
    if (
      !item ||
      item.workspaceId !== workspaceId ||
      item.sessionId !== sessionId ||
      item.ownerId !== ownerId
    ) {
      return null;
    }
    return item;
  }
}

export class MemoryAgentRunRepository implements AgentRunRepository {
  constructor(private readonly db = getMemoryDb()) {}

  async create(input: Omit<AgentRun, "id">): Promise<AgentRun> {
    const run: AgentRun = { ...input, id: uuidv4() };
    this.db.agentRuns.set(run.id, run);
    return run;
  }

  async update(
    workspaceId: string,
    sessionId: string,
    runId: string,
    ownerId: string,
    patch: Partial<AgentRun>
  ): Promise<AgentRun> {
    const existing = await this.getById(workspaceId, sessionId, runId, ownerId);
    if (!existing) throw new AppError("NOT_FOUND", "AgentRun not found", 404);
    const updated = { ...existing, ...patch, id: existing.id };
    this.db.agentRuns.set(runId, updated);
    return updated;
  }

  async listBySession(
    workspaceId: string,
    sessionId: string,
    ownerId: string
  ): Promise<AgentRun[]> {
    return [...this.db.agentRuns.values()]
      .filter(
        (r) =>
          r.workspaceId === workspaceId &&
          r.sessionId === sessionId &&
          r.ownerId === ownerId
      )
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async getById(
    workspaceId: string,
    sessionId: string,
    runId: string,
    ownerId: string
  ): Promise<AgentRun | null> {
    const run = this.db.agentRuns.get(runId);
    if (
      !run ||
      run.workspaceId !== workspaceId ||
      run.sessionId !== sessionId ||
      run.ownerId !== ownerId
    ) {
      return null;
    }
    return run;
  }
}

export class MemoryDecisionRecordRepository
  implements DecisionRecordRepository
{
  constructor(private readonly db = getMemoryDb()) {}

  async create(input: Omit<DecisionRecord, "id">): Promise<DecisionRecord> {
    const record: DecisionRecord = { ...input, id: uuidv4() };
    this.db.decisionRecords.set(record.id, record);
    return record;
  }

  async getById(id: string, ownerId: string): Promise<DecisionRecord | null> {
    const r = this.db.decisionRecords.get(id);
    if (!r || r.ownerId !== ownerId) return null;
    return r;
  }

  async getBySession(
    sessionId: string,
    ownerId: string
  ): Promise<DecisionRecord | null> {
    const records = [...this.db.decisionRecords.values()]
      .filter((r) => r.sessionId === sessionId && r.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return records[0] ?? null;
  }
}

export class MemoryBlueprintRepository implements BlueprintRepository {
  constructor(private readonly db = getMemoryDb()) {}

  async create(input: Omit<Blueprint, "id">): Promise<Blueprint> {
    const bp: Blueprint = { ...input, id: uuidv4() };
    this.db.blueprints.set(bp.id, bp);
    return bp;
  }

  async getById(id: string, ownerId: string): Promise<Blueprint | null> {
    const bp = this.db.blueprints.get(id);
    if (!bp || bp.ownerId !== ownerId) return null;
    return bp;
  }

  async getBySession(
    sessionId: string,
    ownerId: string
  ): Promise<Blueprint | null> {
    const list = [...this.db.blueprints.values()]
      .filter((b) => b.sessionId === sessionId && b.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list[0] ?? null;
  }

  async updateStatus(
    id: string,
    ownerId: string,
    status: Blueprint["status"],
    approvedAt?: string
  ): Promise<Blueprint> {
    const existing = await this.getById(id, ownerId);
    if (!existing) throw new AppError("NOT_FOUND", "Blueprint not found", 404);
    const updated = {
      ...existing,
      status,
      approvedAt: approvedAt ?? existing.approvedAt,
    };
    this.db.blueprints.set(id, updated);
    return updated;
  }
}

export class MemoryExperimentRepository implements ExperimentRepository {
  constructor(private readonly db = getMemoryDb()) {}

  async create(
    input: Omit<ExperimentDefinition, "id">
  ): Promise<ExperimentDefinition> {
    const exp: ExperimentDefinition = { ...input, id: uuidv4() };
    this.db.experiments.set(exp.id, exp);
    return exp;
  }

  async listBySession(
    workspaceId: string,
    sessionId: string
  ): Promise<ExperimentDefinition[]> {
    return [...this.db.experiments.values()].filter(
      (e) => e.workspaceId === workspaceId && e.sessionId === sessionId
    );
  }
}

export class MemoryIdempotencyStore implements IdempotencyStore {
  constructor(private readonly db = getMemoryDb()) {}
  async get(key: string): Promise<string | null> {
    return this.db.idempotency.get(key) ?? null;
  }
  async set(key: string, artifactId: string): Promise<void> {
    this.db.idempotency.set(key, artifactId);
  }
}

export class MemoryRateLimitStore implements RateLimitStore {
  constructor(private readonly db = getMemoryDb()) {}
  async consume(
    uid: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    const key = `ai-run:${uid}`;
    const stamps = (this.db.rateLimits.get(key) ?? []).filter(
      (t) => now - t < windowMs
    );
    if (stamps.length >= limit) {
      this.db.rateLimits.set(key, stamps);
      return { allowed: false, remaining: 0 };
    }
    stamps.push(now);
    this.db.rateLimits.set(key, stamps);
    return { allowed: true, remaining: limit - stamps.length };
  }
}
