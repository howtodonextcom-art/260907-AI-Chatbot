import type { ExperimentDefinition } from "@/domain/blueprint/types";
import { AppError } from "@/infrastructure/api/errors";

const ALLOWED: Record<
  ExperimentDefinition["status"],
  ExperimentDefinition["status"][]
> = {
  DRAFT: ["READY", "CANCELLED"],
  READY: ["RUNNING", "CANCELLED"],
  RUNNING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionExperiment(
  from: ExperimentDefinition["status"],
  to: ExperimentDefinition["status"]
): boolean {
  if (from === to) return true;
  return ALLOWED[from].includes(to);
}

export function assertExperimentTransition(
  from: ExperimentDefinition["status"],
  to: ExperimentDefinition["status"]
): void {
  if (!canTransitionExperiment(from, to)) {
    throw new AppError(
      "SESSION_INVALID_STATE",
      `Invalid experiment transition ${from} → ${to}`,
      409
    );
  }
}

export function experimentDraftInput(args: {
  workspaceId: string;
  sessionId: string;
  ownerId: string;
  hypothesis: string;
  source?: string;
}): Omit<ExperimentDefinition, "id"> {
  return {
    workspaceId: args.workspaceId,
    sessionId: args.sessionId,
    ownerId: args.ownerId,
    hypothesis: args.hypothesis,
    type: "COMPARISON",
    variants: [
      { id: "control", name: "Current path", config: {} },
      { id: "challenger", name: "Alternative path", config: {} },
    ],
    metrics: [{ name: "decisionQuality", direction: "HIGHER_BETTER" }],
    runConfig: { source: args.source ?? "EXPERIMENT_REQUIRED" },
    status: "DRAFT",
    limitations: [
      "A plan is not evidence. Only COMPLETED results may create EXPERIMENT evidence.",
    ],
  };
}
