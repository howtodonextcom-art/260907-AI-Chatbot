import type { AgentRole, RouteMode } from "@/domain/decision/types";

export interface ModelCapabilities {
  structuredOutput: boolean;
  tools: boolean;
  streaming: boolean;
  vision: boolean;
  maxContextTokens: number;
}

export interface NormalizedModelRequest {
  role: AgentRole;
  routeMode: RouteMode;
  systemInstructions: string;
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string;
  }>;
  outputSchemaName?: string;
  maxOutputTokens: number;
  temperature?: number;
  signal?: AbortSignal;
  metadata: {
    requestId: string;
    workspaceId: string;
    sessionId: string;
    promptVersion: string;
  };
}

export interface ModelResult<T = unknown> {
  provider: string;
  model: string;
  content: string;
  structured?: T;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    cachedTokens?: number;
  };
  latencyMs: number;
  estimatedCostUsd?: number;
}

export interface ModelStreamEvent {
  type: "token" | "done" | "error";
  text?: string;
  result?: ModelResult;
  error?: string;
}

export interface ModelProvider {
  id: string;
  capabilities(): ModelCapabilities;
  generate<T = unknown>(
    request: NormalizedModelRequest
  ): Promise<ModelResult<T>>;
  stream?(
    request: NormalizedModelRequest
  ): AsyncIterable<ModelStreamEvent>;
  health(): Promise<{ ok: boolean; latencyMs?: number }>;
}

export interface ModelRegistryEntry {
  provider: string;
  model: string;
  capabilities: ModelCapabilities;
  enabled: boolean;
  routingTags: string[];
  pricing?: {
    inputPerMillion?: number;
    outputPerMillion?: number;
  };
}
