import type { EntityStatus, ISODateTime } from "@/domain/decision/types";

export interface Workspace {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  status: EntityStatus;
  defaultDomainPackId?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  archivedAt?: ISODateTime;
}
