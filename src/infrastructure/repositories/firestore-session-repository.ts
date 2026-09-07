import { getAdminDb } from "@/infrastructure/firebase/admin";
import type { DecisionSession } from "@/domain/decision/types";
import type { DecisionSessionRepository } from "@/domain/decision/repository";
import { AppError } from "@/infrastructure/api/errors";

export class FirestoreDecisionSessionRepository
  implements DecisionSessionRepository
{
  private col(workspaceId: string) {
    return getAdminDb()
      .collection("workspaces")
      .doc(workspaceId)
      .collection("sessions");
  }

  async create(input: Omit<DecisionSession, "id">): Promise<DecisionSession> {
    const ref = this.col(input.workspaceId).doc();
    const session: DecisionSession = { ...input, id: ref.id };
    await ref.set(session);
    await getAdminDb().collection("sessionIndex").doc(ref.id).set({
      sessionId: ref.id,
      workspaceId: input.workspaceId,
      ownerId: input.ownerId,
    });
    return session;
  }

  async getById(
    workspaceId: string,
    sessionId: string,
    ownerId: string
  ): Promise<DecisionSession | null> {
    const snap = await this.col(workspaceId).doc(sessionId).get();
    if (!snap.exists) return null;
    const data = snap.data() as DecisionSession;
    if (data.ownerId !== ownerId) return null;
    return { ...data, id: snap.id };
  }

  async getBySessionId(
    sessionId: string,
    ownerId: string
  ): Promise<DecisionSession | null> {
    const index = await getAdminDb().collection("sessionIndex").doc(sessionId).get();
    if (!index.exists) return null;
    const { workspaceId } = index.data() as {
      workspaceId: string;
      ownerId: string;
    };
    return this.getById(workspaceId, sessionId, ownerId);
  }

  async listByWorkspace(
    workspaceId: string,
    ownerId: string
  ): Promise<DecisionSession[]> {
    const snap = await this.col(workspaceId)
      .where("ownerId", "==", ownerId)
      .orderBy("updatedAt", "desc")
      .get();
    return snap.docs.map((d) => ({
      ...(d.data() as DecisionSession),
      id: d.id,
    }));
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
    await this.col(workspaceId).doc(sessionId).set(updated);
    return updated;
  }
}
