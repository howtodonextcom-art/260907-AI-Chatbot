import { getAdminDb } from "@/infrastructure/firebase/admin";
import type { Message, EvidenceItem } from "@/domain/evidence/types";
import type { AgentRun } from "@/domain/blueprint/types";
import type {
  AgentRunRepository,
  EvidenceRepository,
  MessageRepository,
} from "@/domain/repositories";
import { AppError } from "@/infrastructure/api/errors";

function sessionPath(workspaceId: string, sessionId: string) {
  return getAdminDb()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("sessions")
    .doc(sessionId);
}

export class FirestoreMessageRepository implements MessageRepository {
  async create(input: Omit<Message, "id">): Promise<Message> {
    const ref = sessionPath(input.workspaceId, input.sessionId)
      .collection("messages")
      .doc();
    const message: Message = { ...input, id: ref.id };
    await ref.set(message);
    return message;
  }

  async listBySession(
    workspaceId: string,
    sessionId: string,
    ownerId: string
  ): Promise<Message[]> {
    const snap = await sessionPath(workspaceId, sessionId)
      .collection("messages")
      .where("ownerId", "==", ownerId)
      .orderBy("createdAt", "asc")
      .get();
    return snap.docs.map((d) => ({ ...(d.data() as Message), id: d.id }));
  }
}

export class FirestoreEvidenceRepository implements EvidenceRepository {
  async create(input: Omit<EvidenceItem, "id">): Promise<EvidenceItem> {
    const ref = sessionPath(input.workspaceId, input.sessionId)
      .collection("evidence")
      .doc();
    const item: EvidenceItem = { ...input, id: ref.id };
    await ref.set(item);
    return item;
  }

  async listBySession(
    workspaceId: string,
    sessionId: string,
    ownerId: string
  ): Promise<EvidenceItem[]> {
    const snap = await sessionPath(workspaceId, sessionId)
      .collection("evidence")
      .where("ownerId", "==", ownerId)
      .get();
    return snap.docs.map((d) => ({ ...(d.data() as EvidenceItem), id: d.id }));
  }

  async getById(
    workspaceId: string,
    sessionId: string,
    evidenceId: string,
    ownerId: string
  ): Promise<EvidenceItem | null> {
    const snap = await sessionPath(workspaceId, sessionId)
      .collection("evidence")
      .doc(evidenceId)
      .get();
    if (!snap.exists) return null;
    const data = snap.data() as EvidenceItem;
    if (data.ownerId !== ownerId) return null;
    return { ...data, id: snap.id };
  }
}

export class FirestoreAgentRunRepository implements AgentRunRepository {
  async create(input: Omit<AgentRun, "id">): Promise<AgentRun> {
    const ref = sessionPath(input.workspaceId, input.sessionId)
      .collection("agentRuns")
      .doc();
    const run: AgentRun = { ...input, id: ref.id };
    await ref.set(run);
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
    await sessionPath(workspaceId, sessionId)
      .collection("agentRuns")
      .doc(runId)
      .set(updated);
    return updated;
  }

  async listBySession(
    workspaceId: string,
    sessionId: string,
    ownerId: string
  ): Promise<AgentRun[]> {
    const snap = await sessionPath(workspaceId, sessionId)
      .collection("agentRuns")
      .where("ownerId", "==", ownerId)
      .orderBy("startedAt", "desc")
      .get();
    return snap.docs.map((d) => ({ ...(d.data() as AgentRun), id: d.id }));
  }

  async getById(
    workspaceId: string,
    sessionId: string,
    runId: string,
    ownerId: string
  ): Promise<AgentRun | null> {
    const snap = await sessionPath(workspaceId, sessionId)
      .collection("agentRuns")
      .doc(runId)
      .get();
    if (!snap.exists) return null;
    const data = snap.data() as AgentRun;
    if (data.ownerId !== ownerId) return null;
    return { ...data, id: snap.id };
  }
}
