import type {
  DecisionSession,
  RouteMode,
  WorkflowArtifactStatus,
  WorkflowBlockerCode,
  WorkflowDecision,
  WorkflowMetadata,
  WorkflowStage,
  WorkflowStageArtifact,
  WorkflowState,
} from "@/domain/decision/types";
import {
  computeReadiness,
  countBlockingHighUnknowns,
  isUnknownResolutionTerminal,
} from "@/domain/decision/unknown-policy";

/** Internal orchestration primitive — mirrors API Intent / OrchestratorIntent. */
export type WorkflowIntent =
  | "DISCUSS"
  | "FRAME_PROBLEM"
  | "GENERATE_OPTIONS"
  | "CRITIQUE"
  | "VERIFY"
  | "PREPARE_DECISION";

export const WORKFLOW_STAGE_ORDER: WorkflowStage[] = [
  "DISCUSS",
  "FRAME",
  "OPTIONS",
  "CRITIQUE",
  "VERIFY",
  "PREPARE",
];

export const STAGE_TO_INTENT: Record<WorkflowStage, WorkflowIntent> = {
  DISCUSS: "DISCUSS",
  FRAME: "FRAME_PROBLEM",
  OPTIONS: "GENERATE_OPTIONS",
  CRITIQUE: "CRITIQUE",
  VERIFY: "VERIFY",
  PREPARE: "PREPARE_DECISION",
};

export const INTENT_TO_STAGE: Record<WorkflowIntent, WorkflowStage> = {
  DISCUSS: "DISCUSS",
  FRAME_PROBLEM: "FRAME",
  GENERATE_OPTIONS: "OPTIONS",
  CRITIQUE: "CRITIQUE",
  VERIFY: "VERIFY",
  PREPARE_DECISION: "PREPARE",
};

const STAGES_AFTER_OPTIONS: WorkflowStage[] = [
  "OPTIONS",
  "CRITIQUE",
  "VERIFY",
  "PREPARE",
];

export function emptyWorkflowMetadata(
  routeMode: RouteMode = "STANDARD"
): WorkflowMetadata {
  return {
    currentStage: "DISCUSS",
    state: "IDLE",
    completedStages: [],
    routeMode,
    artifacts: {},
    blockers: [],
    usage: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
  };
}

function artifactStatus(
  workflow: WorkflowMetadata | undefined,
  stage: WorkflowStage
): WorkflowArtifactStatus | undefined {
  return workflow?.artifacts[stage]?.status;
}

function hasCurrentArtifact(
  workflow: WorkflowMetadata | undefined,
  stage: WorkflowStage
): boolean {
  return artifactStatus(workflow, stage) === "CURRENT";
}

function hasFraming(session: DecisionSession): boolean {
  const summary = session.latestSummary?.trim() ?? "";
  // Objective alone is session metadata — FRAME must still produce problemFraming.
  return Boolean(summary);
}

function needsVerify(session: DecisionSession): boolean {
  const unverifiedAssumptions = session.assumptions.some(
    (a) => a.status === "UNVERIFIED" && a.importance !== "LOW"
  );
  const verifyUnknowns = session.unknowns.some(
    (u) =>
      !isUnknownResolutionTerminal(u.resolution) &&
      (u.resolution === "VERIFY_NOW" || u.importance === "HIGH")
  );
  const neverVerified = !hasCurrentArtifact(session.workflow, "VERIFY");
  return (
    (unverifiedAssumptions || verifyUnknowns || session.assumptions.length > 0) &&
    neverVerified
  );
}

function collectPauseBlockers(session: DecisionSession): WorkflowBlockerCode[] {
  const blockers: WorkflowBlockerCode[] = [];
  if (countBlockingHighUnknowns(session.unknowns) > 0) {
    blockers.push("HIGH_UNKNOWNS_OPEN");
  }
  if (
    session.unknowns.some(
      (u) =>
        u.importance === "HIGH" && u.resolution === "EXPERIMENT_REQUIRED"
    )
  ) {
    blockers.push("EXPERIMENT_REQUIRED");
  }
  if (
    session.unknowns.some(
      (u) =>
        u.importance === "HIGH" &&
        u.resolution === "HUMAN_DECISION_REQUIRED"
    )
  ) {
    blockers.push("HUMAN_DECISION_REQUIRED");
  }
  if (session.assumptions.some((a) => a.status === "CONTRADICTED")) {
    blockers.push("EVIDENCE_CONTRADICTION");
  }
  return blockers;
}

/**
 * Canonical server-owned stage controller. Content-driven — never currentStep++.
 * DecisionSession.status remains the legal gate; WorkflowStage is orchestration/UX only.
 */
export function decideWorkflowStage(args: {
  session: DecisionSession;
  routeMode?: RouteMode;
  lastHumanMessage?: string;
  previousConstraintStatements?: string[];
  budgetExhausted?: boolean;
}): WorkflowDecision {
  const session = args.session;
  const workflow = session.workflow ?? emptyWorkflowMetadata(args.routeMode);
  const routeMode = args.routeMode ?? workflow.routeMode ?? "STANDARD";

  if (session.status === "DECIDED" || session.status === "ARCHIVED") {
    return {
      currentStage: workflow.currentStage,
      nextStage: null,
      shouldAdvance: false,
      state: "COMPLETED",
      blockers: ["DECIDED"],
      rationale: "Session already decided — human owns approval; workflow stops.",
    };
  }

  if (session.status === "DECISION_READY") {
    return {
      currentStage: "PREPARE",
      nextStage: null,
      shouldAdvance: false,
      state: "COMPLETED",
      blockers: ["DECISION_READY"],
      rationale: "Judge draft ready — waiting for explicit human approval.",
    };
  }

  if (args.budgetExhausted) {
    return {
      currentStage: workflow.currentStage,
      nextStage: null,
      shouldAdvance: false,
      state: "PAUSED",
      blockers: ["BUDGET_EXHAUSTED"],
      rationale: "AI budget exhausted for this workflow.",
    };
  }

  const materialInvalidation = detectMaterialInvalidation({
    session,
    previousConstraintStatements: args.previousConstraintStatements,
    lastHumanMessage: args.lastHumanMessage,
  });

  const pauseBlockers = collectPauseBlockers(session);
  // After OPTIONS, still run CRITIQUE (DEEP: Groq Critic) even if HIGH
  // unknowns are OPEN — critique is not a legal Decision gate. Pause for
  // human unknown-resolution before PREPARE (and still block DECISION_READY).
  const pastOptions =
    session.options.length > 0 &&
    (hasCurrentArtifact(workflow, "OPTIONS") ||
      workflow.completedStages.includes("OPTIONS"));
  const critiquePending =
    routeMode !== "QUICK" && !hasCurrentArtifact(workflow, "CRITIQUE");

  if (pauseBlockers.length > 0 && pastOptions && !critiquePending) {
    // Still allow VERIFY to attempt tool resolution when unknowns ask VERIFY_NOW
    // and VERIFY artifact is missing — otherwise pause for human.
    const allowVerifyDespitePause =
      pauseBlockers.includes("HIGH_UNKNOWNS_OPEN") &&
      needsVerify(session) &&
      !hasCurrentArtifact(workflow, "VERIFY");
    if (!allowVerifyDespitePause) {
      return {
        currentStage: workflow.currentStage,
        nextStage: null,
        shouldAdvance: false,
        state: "PAUSED",
        blockers: pauseBlockers,
        rationale: `Paused for human action: ${pauseBlockers.join(", ")}`,
        invalidatedFromStage: materialInvalidation ?? undefined,
      };
    }
  }

  let next: WorkflowStage;

  if (materialInvalidation === "OPTIONS") {
    next = "OPTIONS";
  } else if (!hasFraming(session) && !hasCurrentArtifact(workflow, "FRAME")) {
    next = "FRAME";
  } else if (session.options.length === 0 || !hasCurrentArtifact(workflow, "OPTIONS")) {
    next =
      hasFraming(session) || hasCurrentArtifact(workflow, "FRAME")
        ? "OPTIONS"
        : "FRAME";
  } else if (
    !hasCurrentArtifact(workflow, "CRITIQUE") &&
    routeMode !== "QUICK"
  ) {
    next = "CRITIQUE";
  } else if (needsVerify(session)) {
    next = "VERIFY";
  } else {
    const readiness = computeReadiness({
      optionCount: session.options.length,
      assumptionCount: session.assumptions.length,
      unknowns: session.unknowns,
      contradictedAssumptionCount: session.assumptions.filter(
        (a) => a.status === "CONTRADICTED"
      ).length,
    });
    if (!session.judgeDraft || artifactStatus(workflow, "PREPARE") === "STALE") {
      if (!readiness.ready && pauseBlockers.length > 0) {
        return {
          currentStage: workflow.currentStage,
          nextStage: null,
          shouldAdvance: false,
          state: "PAUSED",
          blockers: pauseBlockers,
          rationale: "Readiness blockers require human before PREPARE.",
        };
      }
      next = "PREPARE";
    } else {
      return {
        currentStage: "PREPARE",
        nextStage: null,
        shouldAdvance: false,
        state: "COMPLETED",
        blockers: [],
        rationale: "Prepare complete — awaiting human approval if ready.",
      };
    }
  }

  // QUICK: single lightweight stage only (FRAME or DISCUSS), no full pipeline
  if (routeMode === "QUICK") {
    if (
      workflow.completedStages.includes("FRAME") ||
      hasCurrentArtifact(workflow, "FRAME") ||
      hasCurrentArtifact(workflow, "DISCUSS")
    ) {
      return {
        currentStage: workflow.currentStage === "DISCUSS" ? "DISCUSS" : "FRAME",
        nextStage: null,
        shouldAdvance: false,
        state: "COMPLETED",
        blockers: [],
        rationale: "QUICK mode: single economy call complete.",
      };
    }
    next = hasFraming(session) ? "DISCUSS" : "FRAME";
  }

  return {
    currentStage: workflow.currentStage,
    nextStage: next,
    shouldAdvance: true,
    state: "RUNNING",
    blockers: [],
    rationale: `Next stage ${next} based on session content.`,
    invalidatedFromStage: materialInvalidation ?? undefined,
  };
}

/**
 * Detect material new information that invalidates OPTIONS and downstream.
 * No-op chat (short acknowledgements) does not backtrack.
 */
export function detectMaterialInvalidation(args: {
  session: DecisionSession;
  previousConstraintStatements?: string[];
  lastHumanMessage?: string;
}): WorkflowStage | null {
  const prev = new Set(
    (args.previousConstraintStatements ?? []).map((s) =>
      s.toLowerCase().trim()
    )
  );
  const curr = args.session.constraints.map((c) =>
    c.statement.toLowerCase().trim()
  );
  const constraintChanged =
    prev.size > 0 &&
    (curr.some((s) => !prev.has(s)) ||
      [...prev].some((s) => !curr.includes(s)));

  if (constraintChanged) return "OPTIONS";

  const msg = args.lastHumanMessage?.trim() ?? "";
  if (!msg) return null;

  // No-op acknowledgements and automatic-workflow continue prompts
  if (
    /^(ok|okay|thanks|cảm ơn|tiếp|tiếp tục|continue|yes|no|ừ|được)\.?$/i.test(
      msg
    ) ||
    /tiếp tục quy trình/i.test(msg) ||
    /^continue the automatic decision workflow\.?$/i.test(msg) ||
    msg.length < 12
  ) {
    return null;
  }

  const budgetShift =
    /(\$?\d+)\s*(\/\s*month|\/\s*tháng|usd|\$)/i.test(msg) &&
    /(budget|ngân sách|giảm|cut|only|chỉ còn|xuống)/i.test(msg);
  const constraintLanguage =
    /(constraint|ràng buộc|must not|không được|deadline|phải|bắt buộc)/i.test(
      msg
    );

  if (
    (budgetShift || constraintLanguage) &&
    (args.session.options.length > 0 ||
      hasCurrentArtifact(args.session.workflow, "OPTIONS"))
  ) {
    return "OPTIONS";
  }

  return null;
}

export function markArtifactsStaleFrom(
  artifacts: Partial<Record<WorkflowStage, WorkflowStageArtifact>>,
  fromStage: WorkflowStage,
  now: string
): Partial<Record<WorkflowStage, WorkflowStageArtifact>> {
  const fromIdx = WORKFLOW_STAGE_ORDER.indexOf(fromStage);
  const next = { ...artifacts };
  for (const stage of STAGES_AFTER_OPTIONS) {
    const idx = WORKFLOW_STAGE_ORDER.indexOf(stage);
    if (idx < fromIdx) continue;
    const existing = next[stage];
    if (existing) {
      next[stage] = { ...existing, status: "STALE", updatedAt: now };
    }
  }
  return next;
}

export function applyWorkflowProgress(args: {
  workflow: WorkflowMetadata;
  completedStage: WorkflowStage;
  agentRunIds?: string[];
  usage?: Partial<WorkflowMetadata["usage"]>;
  decision?: WorkflowDecision;
  now?: string;
}): WorkflowMetadata {
  const now = args.now ?? new Date().toISOString();
  const completed = new Set(args.workflow.completedStages);
  completed.add(args.completedStage);

  const artifacts = { ...args.workflow.artifacts };
  const previous = artifacts[args.completedStage];
  artifacts[args.completedStage] = {
    ...previous,
    agentRunIds: [
      ...(previous?.agentRunIds ?? []),
      ...(args.agentRunIds ?? []),
    ],
    status: "CURRENT",
    updatedAt: now,
  };

  let invalidatedFromStage = args.workflow.invalidatedFromStage;
  let nextArtifacts = artifacts;
  if (args.decision?.invalidatedFromStage) {
    invalidatedFromStage = args.decision.invalidatedFromStage;
    nextArtifacts = markArtifactsStaleFrom(
      artifacts,
      args.decision.invalidatedFromStage,
      now
    );
    // Re-mark the stage we just completed as CURRENT
    nextArtifacts[args.completedStage] = artifacts[args.completedStage];
  }

  const nextDecision = args.decision;
  return {
    ...args.workflow,
    currentStage: args.completedStage,
    state: nextDecision?.state ?? args.workflow.state,
    completedStages: WORKFLOW_STAGE_ORDER.filter((s) => completed.has(s)),
    artifacts: nextArtifacts,
    blockers: nextDecision?.blockers ?? args.workflow.blockers,
    invalidatedFromStage,
    usage: {
      calls: args.workflow.usage.calls + (args.usage?.calls ?? 0),
      inputTokens:
        args.workflow.usage.inputTokens + (args.usage?.inputTokens ?? 0),
      outputTokens:
        args.workflow.usage.outputTokens + (args.usage?.outputTokens ?? 0),
      costUsd: args.workflow.usage.costUsd + (args.usage?.costUsd ?? 0),
    },
    updatedAt: now,
  };
}

export function resolveIntentForRun(args: {
  session: DecisionSession;
  routeMode: RouteMode;
  explicitIntent?: WorkflowIntent;
  lastHumanMessage?: string;
}): {
  intent: WorkflowIntent;
  decision: WorkflowDecision;
  stage: WorkflowStage;
} {
  if (args.explicitIntent) {
    const stage = INTENT_TO_STAGE[args.explicitIntent];
    const decision = decideWorkflowStage({
      session: args.session,
      routeMode: args.routeMode,
      lastHumanMessage: args.lastHumanMessage,
    });
    return { intent: args.explicitIntent, decision, stage };
  }

  const decision = decideWorkflowStage({
    session: args.session,
    routeMode: args.routeMode,
    lastHumanMessage: args.lastHumanMessage,
  });

  const stage = decision.nextStage ?? decision.currentStage;
  return {
    intent: STAGE_TO_INTENT[stage],
    decision,
    stage,
  };
}

export type { WorkflowState };
