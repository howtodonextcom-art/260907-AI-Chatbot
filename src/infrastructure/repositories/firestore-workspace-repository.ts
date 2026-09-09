import { getAdminDb } from "@/infrastructure/firebase/admin";
import type { Workspace } from "@/domain/workspace/types";
import type { WorkspaceRepository } from "@/domain/workspace/repository";
import { AppError } from "@/infrastructure/api/errors";

export class FirestoreWorkspaceRepository implements WorkspaceRepository {
  private col() {
    return getAdminDb().collection("workspaces");
  }

  async create(input: Omit<Workspace, "id">): Promise<Workspace> {
    const ref = this.col().doc();
    const workspace: Workspace = { ...input, id: ref.id };
    await ref.set(workspace);
    return workspace;
  }

  async getById(id: string, ownerId: string): Promise<Workspace | null> {
    const snap = await this.col().doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as Workspace;
    if (data.ownerId !== ownerId) return null;
    return { ...data, id: snap.id };
  }

  async listByOwner(ownerId: string): Promise<Workspace[]> {
    const snap = await this.col().where("ownerId", "==", ownerId).get();
    return snap.docs
      .map((d) => ({ ...(d.data() as Workspace), id: d.id }))
      .filter((w) => w.status === "ACTIVE")
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
    await this.col().doc(id).set(updated);
    return updated;
  }
}
