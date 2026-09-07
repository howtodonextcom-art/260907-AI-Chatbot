import type { DecisionSession } from "@/domain/decision/types";

export interface DecisionSessionRepository {
  create(input: Omit<DecisionSession, "id">): Promise<DecisionSession>;
  getById(
    workspaceId: string,
    sessionId: string,
    ownerId: string
  ): Promise<DecisionSession | null>;
  getBySessionId(
    sessionId: string,
    ownerId: string
  ): Promise<DecisionSession | null>;
  listByWorkspace(
    workspaceId: string,
    ownerId: string
  ): Promise<DecisionSession[]>;
  update(
    workspaceId: string,
    sessionId: string,
    ownerId: string,
    patch: Partial<DecisionSession>
  ): Promise<DecisionSession>;
}
