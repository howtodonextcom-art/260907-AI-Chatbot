"use client";

import type {
  DecisionSessionStatus,
  WorkflowMetadata,
  WorkflowStage,
} from "@/domain/decision/types";

const STEPS: Array<{ stage: WorkflowStage; label: string }> = [
  { stage: "DISCUSS", label: "Thảo luận" },
  { stage: "FRAME", label: "Định khung" },
  { stage: "OPTIONS", label: "Sinh phương án" },
  { stage: "CRITIQUE", label: "Phản biện" },
  { stage: "VERIFY", label: "Xác minh" },
  { stage: "PREPARE", label: "Chuẩn bị quyết định" },
];

type StepStatus = "COMPLETED" | "RUNNING" | "PENDING" | "BLOCKED";

function stepStatus(args: {
  stage: WorkflowStage;
  workflow?: WorkflowMetadata;
  runningStage?: WorkflowStage;
  sessionStatus: DecisionSessionStatus;
}): StepStatus {
  const { stage, workflow, runningStage, sessionStatus } = args;
  if (
    workflow?.state === "PAUSED" ||
    workflow?.state === "BLOCKED" ||
    (workflow?.blockers?.length ?? 0) > 0
  ) {
    if (workflow?.currentStage === stage) return "BLOCKED";
  }
  if (runningStage === stage || workflow?.state === "RUNNING" && workflow.currentStage === stage) {
    return "RUNNING";
  }
  if (workflow?.completedStages?.includes(stage)) return "COMPLETED";
  if (
    stage === "PREPARE" &&
    (sessionStatus === "DECISION_READY" || sessionStatus === "DECIDED")
  ) {
    return "COMPLETED";
  }
  if (workflow?.artifacts?.[stage]?.status === "CURRENT") return "COMPLETED";
  return "PENDING";
}

const MARK: Record<StepStatus, string> = {
  COMPLETED: "✓",
  RUNNING: "●",
  PENDING: "○",
  BLOCKED: "!",
};

export function WorkflowStepper(props: {
  workflow?: WorkflowMetadata;
  runningStage?: WorkflowStage;
  sessionStatus: DecisionSessionStatus;
}) {
  return (
    <nav
      aria-label="Decision Process"
      data-testid="workflow-stepper"
      className="flex flex-wrap gap-x-3 gap-y-1 text-xs"
    >
      <span className="font-semibold" style={{ color: "var(--text-muted)" }}>
        Decision Process:
      </span>
      {STEPS.map(({ stage, label }) => {
        const status = stepStatus({
          stage,
          workflow: props.workflow,
          runningStage: props.runningStage,
          sessionStatus: props.sessionStatus,
        });
        return (
          <span
            key={stage}
            data-testid={`workflow-step-${stage}`}
            data-status={status}
            style={{
              color:
                status === "COMPLETED"
                  ? "var(--ok, #3dd68c)"
                  : status === "RUNNING"
                    ? "var(--analyst)"
                    : status === "BLOCKED"
                      ? "var(--danger-text)"
                      : "var(--text-muted)",
            }}
          >
            {MARK[status]} {label}
          </span>
        );
      })}
    </nav>
  );
}
