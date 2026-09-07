import type { EvidenceItem } from "@/domain/evidence/types";

export interface ToolConnector {
  id: string;
  name: string;
  capabilities: string[];

  execute<TInput = unknown, TOutput = unknown>(
    action: string,
    input: TInput
  ): Promise<{
    success: boolean;
    output?: TOutput;
    error?: string;
    evidence?: EvidenceItem[];
  }>;
}

export type ToolPermission = "READ" | "WRITE" | "EXECUTE";

export const TOOL_ACTION_PERMISSIONS: Record<string, ToolPermission> = {
  "calculator.evaluate": "READ",
};
