import type { Workspace } from "@/domain/workspace/types";

export interface WorkspaceRepository {
  create(input: Omit<Workspace, "id">): Promise<Workspace>;
  getById(id: string, ownerId: string): Promise<Workspace | null>;
  listByOwner(ownerId: string): Promise<Workspace[]>;
  update(
    id: string,
    ownerId: string,
    patch: Partial<Pick<Workspace, "name" | "description" | "status">>
  ): Promise<Workspace>;
}
