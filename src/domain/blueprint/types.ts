import type {
  AgentRole,
  BlueprintStatus,
  ISODateTime,
  RouteMode,
  RunStatus,
} from "@/domain/decision/types";

export interface AgentRun {
  id: string;
  workspaceId: string;
  sessionId: string;
  ownerId: string;
  role: AgentRole;
  routeMode: RouteMode;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  latencyMs?: number;
  costUsd?: number;
  status: RunStatus;
  errorCode?: string;
  errorMessage?: string;
  startedAt: ISODateTime;
  finishedAt?: ISODateTime;
}

export interface BlueprintModule {
  name: string;
  jobToBeDone: string;
  inputs: string[];
  outputs: string[];
  dependencies: string[];
  acceptanceCriteria: string[];
}

export interface BlueprintApiContract {
  method: string;
  path: string;
  purpose: string;
}

export interface Blueprint {
  id: string;
  workspaceId: string;
  sessionId: string;
  ownerId: string;
  sourceDecisionRecordId: string;
  status: BlueprintStatus;
  title: string;
  projectGoal: string;
  problem: string;
  targetUsers: string[];
  scope: string[];
  nonGoals: string[];
  modules: BlueprintModule[];
  architecture: {
    summary: string;
    mermaid?: string;
  };
  dataModel: string[];
  apiContracts: BlueprintApiContract[];
  aiWorkflow: string[];
  securityRequirements: string[];
  observabilityRequirements: string[];
  testRequirements: string[];
  deploymentRequirements: string[];
  acceptanceCriteria: string[];
  openRisks: string[];
  decisionReferences: string[];
  createdAt: ISODateTime;
  approvedAt?: ISODateTime;
  supersededAt?: ISODateTime;
}

export type ExperimentType =
  | "COMPARISON"
  | "CALCULATION"
  | "SIMULATION"
  | "BENCHMARK"
  | "CONTROLLED_EXPERIMENT"
  | "AB_TEST";

export interface ExperimentDefinition {
  id: string;
  workspaceId: string;
  sessionId: string;
  hypothesis: string;
  type: ExperimentType;
  variants: Array<{
    id: string;
    name: string;
    config: Record<string, unknown>;
  }>;
  metrics: Array<{
    name: string;
    direction: "HIGHER_BETTER" | "LOWER_BETTER";
  }>;
  datasetId?: string;
  sampleSize?: number;
  runConfig: Record<string, unknown>;
  budget?: import("@/domain/decision/types").AiBudget;
  status: "DRAFT" | "READY" | "RUNNING" | "COMPLETED" | "CANCELLED";
  results?: Record<string, unknown>;
  winnerVariantId?: string;
  limitations: string[];
}
