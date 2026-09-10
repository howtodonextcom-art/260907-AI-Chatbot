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
      .get();
    return snap.docs
      .map((d) => ({
        ...(d.data() as DecisionSession),
        id: d.id,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  /**
   * Transactional read-modify-write. The orchestrator's SSE stream and any
   * concurrent client PATCH (e.g. UnknownsPanel resolve) can both target the
   * same session doc; the previous get()-then-set() had no isolation, so a
   * slow request's stale read could silently clobber a faster request's
   * write. runTransaction() reads and writes inside one Firestore
   * transaction, which auto-retries on conflicting concurrent writes instead
   * of losing one. See CLAUDE.md [[firestore-atomic-writes]].
   */
  async update(
    workspaceId: string,
    sessionId: string,
    ownerId: string,
    patch: Partial<DecisionSession>
  ): Promise<DecisionSession> {
    const ref = this.col(workspaceId).doc(sessionId);
    return getAdminDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new AppError("NOT_FOUND", "Session not found", 404);
      }
      const existing = { ...(snap.data() as DecisionSession), id: snap.id };
      if (existing.ownerId !== ownerId) {
        throw new AppError("NOT_FOUND", "Session not found", 404);
      }
      const updated: DecisionSession = {
        ...existing,
        ...patch,
        id: existing.id,
        workspaceId: existing.workspaceId,
        ownerId: existing.ownerId,
        updatedAt: new Date().toISOString(),
      };
      tx.set(ref, updated);
      return updated;
    });
  }
}
