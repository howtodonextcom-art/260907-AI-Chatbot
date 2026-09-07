import { z } from "zod";

export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  defaultDomainPackId: z.string().optional(),
});

export const UpdateWorkspaceSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
});

export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceSchema>;
