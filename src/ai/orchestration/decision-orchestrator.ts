import { v4 as uuidv4 } from "uuid";
import { DEFAULT_BUDGETS } from "@/config/ai-budget";
import { ModelGateway, resolveProviderForRole } from "@/ai/gateway/model-gateway";
import { runAnalyst } from "@/ai/agents/analyst";
import { runCritic } from "@/ai/agents/critic";
import { runJudge } from "@/ai/agents/judge";
import { runSecondOpinion } from "@/ai/agents/second-opinion";
import { runIndependentFramer } from "@/ai/agents/independent-framer";
import { applyParallelFrameState } from "@/ai/orchestration/parallel-frame-merge";
import {
  assertFramerQuorum,
  assertFramingProviderCapacity,
  InsufficientFramersError,
  selectFramingProviders,
} from "@/ai/orchestration/parallel-framing";
import type { PreferredProvider } from "@/ai/gateway/model-gateway";
import { getServerEnv } from "@/config/env";
import { buildCoreContext } from "@/ai/orchestration/context-builder";
import { decideRouting, roleTokenCeiling } from "@/ai/orchestration/routing-policy";
import {
  applyWorkflowProgress,
  decideWorkflowStage,
  emptyWorkflowMetadata,
  resolveIntentForRun,
} from "@/domain/decision/workflow-stage";
import {
  canSpend,
  createBudgetTracker,
  evaluateStop,
  sessionStopFlags,
} from "@/ai/orchestration/stop-conditions";
import { runVerifyPipeline } from "@/ai/orchestration/verify-pipeline";
import { getDomainPack } from "@/domain-packs/registry";
import type {
  Assumption,
  Constraint,
  DecisionSession,
  JudgeDraft,
  Option,
  RouteMode,
  Unknown,
  WorkflowLastRunRole,
} from "@/domain/decision/types";
import type { Repositories } from "@/infrastructure/repositories";
import { logStructured } from "@/infrastructure/logging/logger";
import {
  gateStatusTransition,
  type GatedTransitionContext,
} from "@/domain/decision/state-machine";
import { AppError, humanizeProviderError } from "@/infrastructure/api/errors";
import { cancelledError, isCancelledError } from "@/ai/gateway/abort";
import { parseLooseJson } from "@/ai/agents/schemas";
import {
  contentToBlueprintFields,
  deriveBlueprintContent,
} from "@/domain/blueprint/service";
import { experimentDraftInput } from "@/domain/experiment/lifecycle";
import {
  countBlockingHighUnknowns,
  isUnknownResolutionTerminal,
} from "@/domain/decision/unknown-policy";
import {
  mergeDebateNotes,
  recordLastRunRole,
  hasSecondOpinionContribution,
} from "@/domain/decision/debate-notes";

/**
 * Transparent, documented heuristic mapping — not statistical precision.
 * Judge assigns the label after seeing both Analyst's and SecondOpinion's
 * real output; this only converts that label to the numeric confidence
 * factor scale (0-1) used by calculateHeuristicConfidence.
 */
export const AGREEMENT_LABEL_TO_SCORE: Record<"LOW" | "MEDIUM" | "HIGH", number> = {
  LOW: 0.25,
  MEDIUM: 0.6,
  HIGH: 0.9,
};

/** Neutral (not confidently-good) default when no agreement signal exists. */
export const AGREEMENT_UNAVAILABLE_SCORE = 0.5;

/**
 * Pure, independently-testable derivation of the agentAgreement fields from
 * Judge's structured output. Judge is the only agent that has seen both
 * Analyst's and SecondOpinion's real output, so its secondOpinionAgreement
 * label is the ONLY legitimate source for this signal — never a self-report
 * from SecondOpinion, which never saw Analyst's output (see CLAUDE.md
 * [[second-opinion-agreement-semantics]]). Returns UNAVAILABLE (not a fake
 * default) whenever Judge omitted it — no second opinion ran, or Judge's
 * structured output itself failed to parse.
 */
export function deriveAgentAgreement(
  secondOpinionAgreement:
    | { label: "LOW" | "MEDIUM" | "HIGH"; rationale: string }
    | undefined
): {
  agentAgreement?: number;
  agentAgreementMethod: "JUDGE_HEURISTIC" | "UNAVAILABLE";
  agentAgreementRationale?: string;
} {
  if (!secondOpinionAgreement) {
    return { agentAgreementMethod: "UNAVAILABLE" };
  }
  return {
    agentAgreement: AGREEMENT_LABEL_TO_SCORE[secondOpinionAgreement.label],
    agentAgreementMethod: "JUDGE_HEURISTIC",
    agentAgreementRationale: secondOpinionAgreement.rationale,
  };
}

export type SseEventName =
  | "run.started"
  | "agent.started"
  | "token.delta"
  | "agent.completed"
  | "tool.started"
  | "tool.completed"
  | "decision.state.updated"
  | "run.partial"
  | "run.completed"
  | "run.failed"
  | "workflow.started"
  | "workflow.stage.started"
  | "workflow.stage.completed"
  | "workflow.paused"
  | "workflow.resumed"
  | "workflow.completed";

export interface SseEvent {
  event: SseEventName;
  data: Record<string, unknown>;
}

export async function* runDecisionOrchestrator(args: {
  repos: Repositories;
  session: DecisionSession;
  ownerId: string;
  routeMode: RouteMode;
  /** Optional — StageController resolves when omitted (v17 automatic workflow). */
  intent?:
    | "DISCUSS"
    | "FRAME_PROBLEM"
    | "GENERATE_OPTIONS"
    | "CRITIQUE"
    | "VERIFY"
    | "PREPARE_DECISION";
  userRequest: string;
  requestId: string;
  gateway?: ModelGateway;
  signal?: AbortSignal;
}): AsyncGenerator<SseEvent> {
  const gateway = args.gateway ?? new ModelGateway();
  const domainPack = getDomainPack(
    args.session.domainPackId ?? "generic-decision"
  );
  const budget = DEFAULT_BUDGETS[args.routeMode];
  const tracker = createBudgetTracker();
  gateway.bindTracker(tracker);
  const correlationId = uuidv4();

  const throwIfAborted = () => {
    if (args.signal?.aborted) {
      throw cancelledError();
    }
  };

  const resolved = resolveIntentForRun({
    session: args.session,
    routeMode: args.routeMode,
    explicitIntent: args.intent,
    lastHumanMessage: args.userRequest,
  });
  const intent = resolved.intent;
  const workflowStage = resolved.stage;
  let workflowDecision = resolved.decision;

  // Hard HITL pause: do not run agents while StageController is PAUSED
  // (HIGH unknowns / human gates) unless caller forced an explicit intent.
  if (
    !args.intent &&
    workflowDecision.state === "PAUSED" &&
    !workflowDecision.shouldAdvance
  ) {
    const pausedWorkflow = {
      ...(args.session.workflow ?? emptyWorkflowMetadata(args.routeMode)),
      routeMode: args.routeMode,
      state: "PAUSED" as const,
      blockers: workflowDecision.blockers,
      updatedAt: new Date().toISOString(),
    };
    await args.repos.sessions.update(
      args.session.workspaceId,
      args.session.id,
      args.ownerId,
      { workflow: pausedWorkflow }
    );
    yield {
      event: "workflow.paused",
      data: {
        correlationId,
        blockers: workflowDecision.blockers,
        rationale: workflowDecision.rationale,
      },
    };
    yield {
      event: "run.completed",
      data: {
        correlationId,
        status: "COMPLETED",
        stopReason: "WORKFLOW_PAUSED",
        calls: 0,
        workflow: pausedWorkflow,
        shouldAdvance: false,
        nextStage: null,
        workflowState: "PAUSED",
      },
    };
    return;
  }

  if (workflowDecision.invalidatedFromStage) {
    const now = new Date().toISOString();
    const baseWf =
      args.session.workflow ?? emptyWorkflowMetadata(args.routeMode);
    args.session = {
      ...args.session,
      workflow: applyWorkflowProgress({
        workflow: {
          ...baseWf,
          routeMode: args.routeMode,
          state: "RUNNING",
          invalidatedFromStage: workflowDecision.invalidatedFromStage,
        },
        completedStage: baseWf.currentStage,
        decision: workflowDecision,
        now,
      }),
    };
  }

  const messages = await args.repos.messages.listBySession(
    args.session.workspaceId,
    args.session.id,
    args.ownerId
  );
  const evidence = await args.repos.evidence.listBySession(
    args.session.workspaceId,
    args.session.id,
    args.ownerId
  );

  const highUnknownCount = countBlockingHighUnknowns(args.session.unknowns);
  const frameNeedsChallenge =
    highUnknownCount >= 2 ||
    (args.session.problem.trim().length < 80 &&
      args.session.constraints.length === 0);
  const secondOpinionAlreadyContributed = hasSecondOpinionContribution(
    args.session.workflow
  );

  const routing = decideRouting({
    routeMode: args.routeMode,
    intent,
    evidenceCoverage: evidence.length > 0 ? Math.min(1, evidence.length / 5) : 0.2,
    importance:
      intent === "PREPARE_DECISION"
        ? "HIGH"
        : intent === "CRITIQUE"
          ? "HIGH"
          : "MEDIUM",
    blockingUnknownCount: highUnknownCount,
    hasDeepseek: getServerEnv().hasDeepseek,
    frameNeedsChallenge,
    secondOpinionAlreadyContributed,
    materialFactsChanged: Boolean(workflowDecision.invalidatedFromStage),
    userRequestedChallenge: args.intent === "CRITIQUE",
  });

  // #region agent log
  {
    const env = getServerEnv();
    fetch("http://127.0.0.1:7741/ingest/bc7d4cca-eded-4559-8e61-3c173f46bff4", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "74ad39",
      },
      body: JSON.stringify({
        sessionId: "74ad39",
        runId: "mcp-verify",
        hypothesisId: "A2-A5",
        location: "decision-orchestrator.ts:after-routing",
        message: "parallel framing routing decision",
        data: {
          workflowStage,
          nextStage: workflowDecision.nextStage,
          wfState: workflowDecision.state,
          blockers: workflowDecision.blockers,
          runParallelFraming: routing.runParallelFraming,
          runAnalyst: routing.runAnalyst,
          planStages: routing.plan.stages,
          hasGemini: env.hasGemini,
          hasDeepseek: env.hasDeepseek,
          hasGroq: env.hasGroq,
          highUnknownCount,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion

  const priorState = args.session.workflow?.state;
  yield {
    event: priorState === "PAUSED" ? "workflow.resumed" : "workflow.started",
    data: {
      correlationId,
      sessionId: args.session.id,
      stage: workflowStage,
      state: "RUNNING",
      decision: workflowDecision,
    },
  };
  yield {
    event: "workflow.stage.started",
    data: {
      correlationId,
      stage: workflowStage,
      intent,
      executionPlan: routing.plan,
    },
  };

  yield {
    event: "run.started",
    data: {
      correlationId,
      sessionId: args.session.id,
      routeMode: args.routeMode,
      intent,
      workflowStage,
      routing,
      executionPlan: routing.plan,
    },
  };

  const { systemInstructions, userContent } = await buildCoreContext({
    session: args.session,
    messages,
    evidence,
    domainPack,
    userId: args.ownerId,
    userRequest: args.userRequest,
  });

  const domainChecks = await domainPack.runDeterministicChecks({
    problem: args.session.problem,
    intent,
    userRequest: args.userRequest,
  });
  const failedDomain = domainChecks.filter((c) => !c.passed);
  if (failedDomain.length) {
    yield {
      event: "run.failed",
      data: {
        code: "SCHEMA_INVALID",
        message: failedDomain.map((f) => f.message).join("; "),
      },
    };
    return;
  }

  throwIfAborted();

  if (routing.runVerifyTools) {
    const verified = await runVerifyPipeline({
      session: args.session,
      ownerId: args.ownerId,
      domainPack,
    });
    for (const ev of verified.events) {
      yield ev;
    }
    for (const item of verified.evidence) {
      await args.repos.evidence.create(item);
    }
    const verifyPatch = verified.sessionPatch;
    const flags = sessionStopFlags({
      assumptions: (verifyPatch.assumptions ?? args.session.assumptions),
      unknowns: (verifyPatch.unknowns ?? args.session.unknowns),
      evidence: [...evidence, ...verified.evidence],
    });
    const stop = evaluateStop({
      ...flags,
      budget,
      tracker,
      disagreementScore: undefined,
      newInformationScore: undefined,
    });
    const mergedAfterVerify: DecisionSession = {
      ...args.session,
      ...verifyPatch,
      assumptions: verifyPatch.assumptions ?? args.session.assumptions,
      unknowns: verifyPatch.unknowns ?? args.session.unknowns,
    };
    const postVerify = decideWorkflowStage({
      session: {
        ...mergedAfterVerify,
        workflow: applyWorkflowProgress({
          workflow: {
            ...(args.session.workflow ?? emptyWorkflowMetadata(args.routeMode)),
            routeMode: args.routeMode,
          },
          completedStage: "VERIFY",
        }),
      },
      routeMode: args.routeMode,
    });
    const verifyWorkflow = applyWorkflowProgress({
      workflow: {
        ...(args.session.workflow ?? emptyWorkflowMetadata(args.routeMode)),
        routeMode: args.routeMode,
        state: postVerify.state,
        blockers: postVerify.blockers,
      },
      completedStage: "VERIFY",
      usage: {
        calls: tracker.calls,
        inputTokens: tracker.inputTokens,
        outputTokens: tracker.outputTokens,
        costUsd: 0,
      },
      decision: postVerify,
    });
    const updated = await args.repos.sessions.update(
      args.session.workspaceId,
      args.session.id,
      args.ownerId,
      { ...verifyPatch, workflow: verifyWorkflow }
    );
    yield {
      event: "decision.state.updated",
      data: {
        sessionId: updated.id,
        patch: {
          status: updated.status,
          assumptions: updated.assumptions,
          unknowns: updated.unknowns,
          workflow: updated.workflow,
        },
      },
    };
    yield {
      event: "workflow.stage.completed",
      data: {
        correlationId,
        stage: "VERIFY",
        nextStage: postVerify.nextStage,
        shouldAdvance: postVerify.shouldAdvance,
        state: postVerify.state,
        blockers: postVerify.blockers,
      },
    };
    if (postVerify.state === "PAUSED") {
      yield {
        event: "workflow.paused",
        data: { correlationId, blockers: postVerify.blockers },
      };
    }
    yield {
      event: "run.completed",
      data: {
        correlationId,
        status: "COMPLETED",
        stopReason: verified.stopReason ?? stop.reason,
        calls: tracker.calls,
        executionPlan: routing.plan,
        workflow: verifyWorkflow,
        shouldAdvance: postVerify.shouldAdvance,
        nextStage: postVerify.nextStage,
        workflowState: postVerify.state,
      },
    };
    return;
  }

  let analystContent = "";
  let criticContent: string | undefined;
  let secondOpinionContent: string | undefined;
  let partial = false;
  let sessionPatch: Partial<DecisionSession> = {};
  let totalCost = 0;
  let debateNotes = args.session.workflow?.debateNotes;
  let lastRunRoles: WorkflowLastRunRole[] = [];
  const completedRunIds: string[] = [];
  let secondOpinionRunId: string | undefined;

  const spend = canSpend(tracker, budget);
  if (!spend.ok) {
    yield {
      event: "run.failed",
      data: { code: "AI_BUDGET_EXCEEDED", message: spend.reason },
    };
    return;
  }

  // --- Parallel Blind Framing (DEEP FRAME/DISCUSS) ---
  // Broadcast raw human prompt to available providers concurrently.
  // No framer sees another framer's output (allowFallback:false per pin).
  if (routing.runParallelFraming) {
    const env = getServerEnv();
    let providers: PreferredProvider[] = [];
    try {
      providers = assertFramingProviderCapacity(selectFramingProviders(env));
    } catch (error) {
      const message =
        error instanceof InsufficientFramersError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Framer capacity check failed";
      yield {
        event: "run.failed",
        data: {
          code: "INSUFFICIENT_FRAMER_QUORUM",
          message,
          failures:
            error instanceof InsufficientFramersError ? error.failures : [],
        },
      };
      return;
    }

    for (const provider of providers) {
      yield {
        event: "agent.started",
        data: { role: "ANALYST", provider, parallelFraming: true },
      };
    }

    const settled = await Promise.allSettled(
      providers.map(async (provider) => {
        const run = await args.repos.agentRuns.create({
          workspaceId: args.session.workspaceId,
          sessionId: args.session.id,
          ownerId: args.ownerId,
          role: "ANALYST",
          routeMode: args.routeMode,
          provider,
          model: "pending",
          promptVersion: "v1",
          schemaVersion: "1.0",
          status: "RUNNING",
          startedAt: new Date().toISOString(),
        });
        try {
          const result = await runIndependentFramer({
            gateway,
            provider,
            request: {
              routeMode: args.routeMode,
              systemInstructions: `${systemInstructions}\n\n${domainPack.getRoleInstructions("ANALYST")}`,
              messages: [{ role: "user", content: userContent }],
              signal: args.signal,
              maxOutputTokens: roleTokenCeiling("ANALYST", args.routeMode),
              metadata: {
                requestId: args.requestId,
                workspaceId: args.session.workspaceId,
                sessionId: args.session.id,
                promptVersion: "v1",
              },
              outputSchemaName: domainPack.getOutputSchemaName("ANALYST"),
            },
          });
          await args.repos.agentRuns.update(
            args.session.workspaceId,
            args.session.id,
            run.id,
            args.ownerId,
            {
              provider: result.provider,
              model: result.model,
              promptVersion: result.promptVersion,
              schemaVersion: result.schemaVersion,
              inputTokens: result.usage.inputTokens,
              outputTokens: result.usage.outputTokens,
              latencyMs: result.latencyMs,
              costUsd: result.estimatedCostUsd,
              status: "COMPLETED",
              finishedAt: new Date().toISOString(),
            }
          );
          await args.repos.messages.create({
            workspaceId: args.session.workspaceId,
            sessionId: args.session.id,
            ownerId: args.ownerId,
            role: "ASSISTANT",
            content: `[Parallel Frame · ${result.provider}]\n${result.content}`,
            runId: run.id,
            agentRole: "ANALYST",
            provider: result.provider,
            model: result.model,
            createdAt: new Date().toISOString(),
          });
          return {
            ok: true as const,
            provider,
            runId: run.id,
            result,
          };
        } catch (error) {
          await args.repos.agentRuns.update(
            args.session.workspaceId,
            args.session.id,
            run.id,
            args.ownerId,
            {
              status: "FAILED",
              errorCode: "PROVIDER_ERROR",
              errorMessage:
                error instanceof Error ? error.message : "Framer failed",
              finishedAt: new Date().toISOString(),
            }
          );
          return {
            ok: false as const,
            provider,
            runId: run.id,
            error:
              error instanceof Error ? error.message.slice(0, 200) : "failed",
          };
        }
      })
    );

    const framerRuns = settled.map((item, index) => {
      if (item.status === "fulfilled") return item.value;
      const provider = providers[index] ?? "gemini";
      return {
        ok: false as const,
        provider,
        runId: undefined as string | undefined,
        error:
          item.reason instanceof Error
            ? item.reason.message.slice(0, 200)
            : "framer rejected",
      };
    });

    const frames = [];
    const failures: Array<{ provider: string; error: string; runId?: string }> =
      [];
    for (const item of framerRuns) {
      if (item.ok) {
        totalCost += item.result.estimatedCostUsd ?? 0;
        completedRunIds.push(item.runId);
        frames.push({ ...item.result.frame, runId: item.runId });
        lastRunRoles = recordLastRunRole(lastRunRoles, {
          role: "ANALYST",
          status: "COMPLETED",
          provider: item.provider,
          message: "parallel blind frame",
        });
        yield {
          event: "agent.completed",
          data: {
            runId: item.runId,
            role: "ANALYST",
            provider: item.provider,
            parallelFraming: true,
          },
        };
      } else {
        partial = true;
        failures.push({
          provider: item.provider,
          error: item.error,
          runId: item.runId,
        });
        lastRunRoles = recordLastRunRole(lastRunRoles, {
          role: "ANALYST",
          status: "FAILED",
          provider: item.provider,
          message: item.error,
        });
        yield {
          event: "run.partial",
          data: {
            role: "ANALYST",
            provider: item.provider,
            message: `Parallel framer ${item.provider} failed: ${item.error}`,
            retryable: true,
          },
        };
      }
    }

    try {
      assertFramerQuorum({
        frames,
        failures,
        attemptedProviders: providers,
      });
    } catch (error) {
      // #region agent log
      fetch("http://127.0.0.1:7741/ingest/bc7d4cca-eded-4559-8e61-3c173f46bff4", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "74ad39",
        },
        body: JSON.stringify({
          sessionId: "74ad39",
          runId: "post-fix",
          hypothesisId: "V1-quorum",
          location: "decision-orchestrator.ts:quorum-fail",
          message: "framer quorum rejected",
          data: {
            frameCount: frames.length,
            failureCount: failures.length,
            providers,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      yield {
        event: "run.failed",
        data: {
          code: "INSUFFICIENT_FRAMER_QUORUM",
          message:
            error instanceof Error
              ? error.message
              : "Insufficient framer quorum",
          failures:
            error instanceof InsufficientFramersError ? error.failures : failures,
        },
      };
      return;
    }

    const merged = applyParallelFrameState({
      session: args.session,
      frames,
    });
    sessionPatch = { ...sessionPatch, ...merged.patch };
    analystContent = merged.patch.latestSummary ?? "";
    debateNotes = mergeDebateNotes(debateNotes, {
      divergentRisks: merged.framing?.conflictReport.coreDisagreements ?? [],
      updatedAt: new Date().toISOString(),
    });

    // #region agent log
    fetch("http://127.0.0.1:7741/ingest/bc7d4cca-eded-4559-8e61-3c173f46bff4", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "74ad39",
      },
      body: JSON.stringify({
        sessionId: "74ad39",
        runId: "post-fix",
        hypothesisId: "V1-quorum",
        location: "decision-orchestrator.ts:parallel-frame-done",
        message: "parallel blind framing completed with quorum",
        data: {
          providersAttempted: providers,
          providersCompleted: frames.map((f) => f.provider),
          frameCount: frames.length,
          conflictTopics:
            merged.framing?.conflictReport.conflictMap.coreDisagreements
              .length ?? 0,
          unknownCount: merged.patch.unknowns?.length ?? 0,
          highUnknowns: countBlockingHighUnknowns(
            merged.patch.unknowns ?? []
          ),
          assumptionCount: merged.patch.assumptions?.length ?? 0,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    // Skip sequential Analyst/SO/Critic for this FRAME tick — council already ran.
  }

  // Kick off DeepSeek's independent second opinion CONCURRENTLY with Analyst
  // (not awaited yet) — see [[deepseek-second-opinion]] in CLAUDE.md for why
  // this exists. Only in DEEP, only when DeepSeek is actually configured;
  // never falls back to another provider (see runSecondOpinion).
  const secondOpinionPromise =
    routing.runSecondOpinion
      ? runSecondOpinion({
          gateway,
          request: {
            routeMode: args.routeMode,
            systemInstructions: `${systemInstructions}\n\n${domainPack.getRoleInstructions("SECOND_OPINION")}`,
            messages: [{ role: "user", content: userContent }],
            signal: args.signal,
            maxOutputTokens: roleTokenCeiling("SECOND_OPINION", args.routeMode),
            metadata: {
              requestId: args.requestId,
              workspaceId: args.session.workspaceId,
              sessionId: args.session.id,
              promptVersion: "v1",
            },
            outputSchemaName: domainPack.getOutputSchemaName("SECOND_OPINION"),
          },
        })
      : null;

  // --- Analyst ---
  if (routing.runAnalyst) {
  yield {
    event: "agent.started",
    data: { role: "ANALYST", provider: args.routeMode === "QUICK" ? "groq" : "gemini" },
  };

  const analystRun = await args.repos.agentRuns.create({
    workspaceId: args.session.workspaceId,
    sessionId: args.session.id,
    ownerId: args.ownerId,
    role: "ANALYST",
    routeMode: args.routeMode,
    provider: "pending",
    model: "pending",
    promptVersion: "v1",
    schemaVersion: "1.0",
    status: "RUNNING",
    startedAt: new Date().toISOString(),
  });

  try {
    const analyst = await runAnalyst({
      gateway,
      request: {
        routeMode: args.routeMode,
        systemInstructions: `${systemInstructions}\n\n${domainPack.getRoleInstructions("ANALYST")}`,
        messages: [{ role: "user", content: userContent }],
        signal: args.signal,
        maxOutputTokens: roleTokenCeiling("ANALYST", args.routeMode),
        metadata: {
          requestId: args.requestId,
          workspaceId: args.session.workspaceId,
          sessionId: args.session.id,
          promptVersion: "v1",
        },
        outputSchemaName: domainPack.getOutputSchemaName("ANALYST"),
      },
    });

    analystContent =
      analyst.structured?.reply ??
      extractReply(analyst.content) ??
      analyst.content;

    totalCost += analyst.estimatedCostUsd ?? 0;

    await args.repos.agentRuns.update(
      args.session.workspaceId,
      args.session.id,
      analystRun.id,
      args.ownerId,
      {
        provider: analyst.provider,
        model: analyst.model,
        promptVersion: analyst.promptVersion,
        schemaVersion: analyst.schemaVersion,
        inputTokens: analyst.usage.inputTokens,
        outputTokens: analyst.usage.outputTokens,
        latencyMs: analyst.latencyMs,
        costUsd: analyst.estimatedCostUsd,
        status: "COMPLETED",
        finishedAt: new Date().toISOString(),
      }
    );

    if (analyst.structured) {
      sessionPatch = applyAnalystState(args.session, analyst.structured, intent);
      const experimentUnknowns = (
        sessionPatch.unknowns ?? args.session.unknowns
      ).filter((u) => u.resolution === "EXPERIMENT_REQUIRED");
      if (experimentUnknowns.length) {
        await args.repos.experiments.create(
          experimentDraftInput({
            workspaceId: args.session.workspaceId,
            sessionId: args.session.id,
            ownerId: args.ownerId,
            hypothesis: experimentUnknowns[0].question,
            source: `unknown:${experimentUnknowns[0].id}`,
          })
        );
      }
    }

    await args.repos.messages.create({
      workspaceId: args.session.workspaceId,
      sessionId: args.session.id,
      ownerId: args.ownerId,
      role: "ASSISTANT",
      content: analystContent,
      runId: analystRun.id,
      agentRole: "ANALYST",
      provider: analyst.provider,
      model: analyst.model,
      createdAt: new Date().toISOString(),
    });

    for (const chunk of chunkText(analystContent, 48)) {
      yield {
        event: "token.delta",
        data: { runId: analystRun.id, role: "ANALYST", text: chunk },
      };
    }

    yield {
      event: "agent.completed",
      data: {
        runId: analystRun.id,
        role: "ANALYST",
        provider: analyst.provider,
        model: analyst.model,
      },
    };
    lastRunRoles = recordLastRunRole(lastRunRoles, {
      role: "ANALYST",
      status: "COMPLETED",
      provider: analyst.provider,
    });
    completedRunIds.push(analystRun.id);
  } catch (error) {
    const cancelled = isCancelledError(error) || Boolean(args.signal?.aborted);
    await args.repos.agentRuns.update(
      args.session.workspaceId,
      args.session.id,
      analystRun.id,
      args.ownerId,
      {
        status: cancelled ? "CANCELLED" : "FAILED",
        errorCode: cancelled ? "PROVIDER_ERROR" : "PROVIDER_ERROR",
        errorMessage: cancelled
          ? "Run cancelled"
          : humanizeProviderError(error),
        finishedAt: new Date().toISOString(),
      }
    );
    yield {
      event: "run.failed",
      data: {
        code: cancelled ? "PROVIDER_ERROR" : "PROVIDER_ERROR",
        message: cancelled ? "Run cancelled" : humanizeProviderError(error),
        cancelled,
      },
    };
    return;
  }
  } else {
    // Prefer canonical stage artifacts over lossy latestSummary.
    const frameSummary = args.session.workflow?.artifacts.FRAME?.summary;
    const optionsSummary = args.session.workflow?.artifacts.OPTIONS?.summary;
    const artifactText = [frameSummary, optionsSummary]
      .filter(Boolean)
      .join("\n\n");
    const optionsBlock =
      args.session.options.length > 0
        ? `Canonical options:\n${args.session.options
            .map(
              (o) =>
                `- [${o.proposedBy ?? "UNKNOWN"}] ${o.title}: ${o.description}`
            )
            .join("\n")}`
        : "";
    analystContent =
      artifactText ||
      optionsBlock ||
      args.session.latestSummary ||
      args.userRequest;
  }

  const afterAnalystFlags = sessionStopFlags({
    assumptions: sessionPatch.assumptions ?? args.session.assumptions,
    unknowns: sessionPatch.unknowns ?? args.session.unknowns,
    evidence,
  });
  const afterAnalystStop = evaluateStop({
    ...afterAnalystFlags,
    budget,
    tracker,
    disagreementScore: undefined,
    newInformationScore: undefined,
  });
  const skipRemainder =
    afterAnalystStop.stop &&
    (afterAnalystStop.reason === "EXPERIMENT_REQUIRED" ||
      afterAnalystStop.reason === "HUMAN_DECISION_REQUIRED" ||
      afterAnalystStop.reason === "BUDGET_EXHAUSTED" ||
      afterAnalystStop.reason === "MAX_ROUNDS_REACHED");
  if (secondOpinionPromise && skipRemainder) {
    void secondOpinionPromise.catch(() => undefined);
    lastRunRoles = recordLastRunRole(lastRunRoles, {
      role: "SECOND_OPINION",
      status: "SKIPPED",
      message: afterAnalystStop.reason ?? "Skipped after Analyst stop",
    });
  }

  // --- Second Opinion (optional, DEEP + DeepSeek configured only) ---
  // Was already running concurrently with Analyst above; this just collects
  // the result. A DeepSeek failure here is non-fatal — Analyst's output
  // stands on its own, matching the existing Critic/Judge partial-failure
  // philosophy (spec v5 §30).
  if (secondOpinionPromise && !skipRemainder) {
    yield {
      event: "agent.started",
      data: { role: "SECOND_OPINION", provider: "deepseek" },
    };
    const secondOpinionRun = await args.repos.agentRuns.create({
      workspaceId: args.session.workspaceId,
      sessionId: args.session.id,
      ownerId: args.ownerId,
      role: "SECOND_OPINION",
      routeMode: args.routeMode,
      provider: "deepseek",
      model: "pending",
      promptVersion: "v1",
      schemaVersion: "1.0",
      status: "RUNNING",
      startedAt: new Date().toISOString(),
    });

    try {
      const secondOpinion = await secondOpinionPromise;
      secondOpinionContent =
        secondOpinion.structured?.reply ??
        extractReply(secondOpinion.content) ??
        secondOpinion.content;

      totalCost += secondOpinion.estimatedCostUsd ?? 0;

      await args.repos.agentRuns.update(
        args.session.workspaceId,
        args.session.id,
        secondOpinionRun.id,
        args.ownerId,
        {
          provider: secondOpinion.provider,
          model: secondOpinion.model,
          promptVersion: secondOpinion.promptVersion,
          schemaVersion: secondOpinion.schemaVersion,
          inputTokens: secondOpinion.usage.inputTokens,
          outputTokens: secondOpinion.usage.outputTokens,
          latencyMs: secondOpinion.latencyMs,
          costUsd: secondOpinion.estimatedCostUsd,
          status: "COMPLETED",
          finishedAt: new Date().toISOString(),
        }
      );

      await args.repos.messages.create({
        workspaceId: args.session.workspaceId,
        sessionId: args.session.id,
        ownerId: args.ownerId,
        role: "ASSISTANT",
        content: secondOpinionContent,
        runId: secondOpinionRun.id,
        agentRole: "SECOND_OPINION",
        provider: secondOpinion.provider,
        model: secondOpinion.model,
        createdAt: new Date().toISOString(),
      });

      for (const chunk of chunkText(secondOpinionContent, 48)) {
        yield {
          event: "token.delta",
          data: { runId: secondOpinionRun.id, role: "SECOND_OPINION", text: chunk },
        };
      }

      yield {
        event: "agent.completed",
        data: {
          runId: secondOpinionRun.id,
          role: "SECOND_OPINION",
          provider: secondOpinion.provider,
        },
      };
      lastRunRoles = recordLastRunRole(lastRunRoles, {
        role: "SECOND_OPINION",
        status: "COMPLETED",
        provider: secondOpinion.provider,
      });
      completedRunIds.push(secondOpinionRun.id);
      secondOpinionRunId = secondOpinionRun.id;
      debateNotes = mergeDebateNotes(debateNotes, {
        divergentRisks: secondOpinion.structured?.divergentRisks ?? [],
        soRecommendedDirection: secondOpinion.structured?.recommendedDirection,
        soPreferredOptionTitle: secondOpinion.structured?.preferredOptionTitle,
        updatedAt: new Date().toISOString(),
      });

      // Merge independent options into canonical DecisionState (dedupe by title).
      if (
        secondOpinion.structured?.independentOptions?.length ||
        secondOpinion.structured?.preferredOptionTitle
      ) {
        const baseOptions =
          sessionPatch.options ?? args.session.options ?? [];
        const soOptions = (
          secondOpinion.structured.independentOptions?.length
            ? secondOpinion.structured.independentOptions
            : secondOpinion.structured.preferredOptionTitle
              ? [
                  {
                    title: secondOpinion.structured.preferredOptionTitle,
                    description:
                      secondOpinion.structured.recommendedDirection ?? "",
                    pros: [] as string[],
                    cons: [] as string[],
                    risks: secondOpinion.structured.divergentRisks ?? [],
                  },
                ]
              : []
        ).map((o) => ({
          id: uuidv4(),
          title: o.title,
          description: o.description,
          pros: o.pros,
          cons: o.cons,
          risks: o.risks,
          evidenceIds: [] as string[],
          status: "PROPOSED" as const,
          proposedBy: "SECOND_OPINION" as const,
        }));
        sessionPatch = {
          ...sessionPatch,
          options: mergeOptionsPreserveIds(baseOptions, soOptions),
        };
      }
    } catch (error) {
      await args.repos.agentRuns.update(
        args.session.workspaceId,
        args.session.id,
        secondOpinionRun.id,
        args.ownerId,
        {
          status: "FAILED",
          errorCode: "PROVIDER_ERROR",
          errorMessage:
            error instanceof Error ? error.message : "Second opinion failed",
          finishedAt: new Date().toISOString(),
        }
      );
      yield {
        event: "run.partial",
        data: {
          role: "SECOND_OPINION",
          message: "DeepSeek second opinion failed; Analyst output preserved",
          retryable: true,
        },
      };
      lastRunRoles = recordLastRunRole(lastRunRoles, {
        role: "SECOND_OPINION",
        status: "FAILED",
        provider: "deepseek",
        message: "DeepSeek second opinion failed; Analyst output preserved",
      });
    }
  }

  // --- Critic (optional) ---

  if (routing.runCritic && !skipRemainder) {
    throwIfAborted();
    const criticSpend = canSpend(tracker, budget);
    if (!criticSpend.ok) {
      yield {
        event: "run.partial",
        data: { reason: criticSpend.reason, preserved: "ANALYST" },
      };
      partial = true;
    } else {
      yield {
        event: "agent.started",
        data: { role: "CRITIC", provider: "groq" },
      };
      const criticRun = await args.repos.agentRuns.create({
        workspaceId: args.session.workspaceId,
        sessionId: args.session.id,
        ownerId: args.ownerId,
        role: "CRITIC",
        routeMode: args.routeMode,
        provider: "pending",
        model: "pending",
        promptVersion: "v1",
        schemaVersion: "1.0",
        status: "RUNNING",
        startedAt: new Date().toISOString(),
      });

      try {
        const critic = await runCritic({
          gateway,
          analystContent,
          secondOpinionContent,
          request: {
            routeMode: args.routeMode,
            systemInstructions: `${systemInstructions}\n\n${domainPack.getRoleInstructions("CRITIC")}`,
            messages: [{ role: "user", content: userContent }],
            signal: args.signal,
            maxOutputTokens: roleTokenCeiling("CRITIC", args.routeMode),
            metadata: {
              requestId: args.requestId,
              workspaceId: args.session.workspaceId,
              sessionId: args.session.id,
              promptVersion: "v1",
            },
            outputSchemaName: domainPack.getOutputSchemaName("CRITIC"),
          },
        });
        criticContent =
          critic.structured?.reply ??
          extractReply(critic.content) ??
          critic.content;
        totalCost += critic.estimatedCostUsd ?? 0;

        await args.repos.agentRuns.update(
          args.session.workspaceId,
          args.session.id,
          criticRun.id,
          args.ownerId,
          {
            provider: critic.provider,
            model: critic.model,
            promptVersion: critic.promptVersion,
            schemaVersion: critic.schemaVersion,
            inputTokens: critic.usage.inputTokens,
            outputTokens: critic.usage.outputTokens,
            latencyMs: critic.latencyMs,
            costUsd: critic.estimatedCostUsd,
            status: "COMPLETED",
            finishedAt: new Date().toISOString(),
          }
        );

        await args.repos.messages.create({
          workspaceId: args.session.workspaceId,
          sessionId: args.session.id,
          ownerId: args.ownerId,
          role: "ASSISTANT",
          content: criticContent,
          runId: criticRun.id,
          agentRole: "CRITIC",
          provider: critic.provider,
          model: critic.model,
          createdAt: new Date().toISOString(),
        });

        for (const chunk of chunkText(criticContent, 48)) {
          yield {
            event: "token.delta",
            data: { runId: criticRun.id, role: "CRITIC", text: chunk },
          };
        }

        yield {
          event: "agent.completed",
          data: {
            runId: criticRun.id,
            role: "CRITIC",
            provider: critic.provider,
          },
        };
        const preferredCritic = resolveProviderForRole("CRITIC", args.routeMode);
        lastRunRoles = recordLastRunRole(lastRunRoles, {
          role: "CRITIC",
          status: "COMPLETED",
          provider: critic.provider,
          message:
            critic.provider !== preferredCritic
              ? `fallback from ${preferredCritic}`
              : undefined,
        });
        completedRunIds.push(criticRun.id);
        if (critic.provider !== preferredCritic) {
          yield {
            event: "run.partial",
            data: {
              role: "CRITIC",
              message: `Critic fallback from ${preferredCritic} → ${critic.provider}`,
            },
          };
        }
        debateNotes = mergeDebateNotes(debateNotes, {
          criticisms:
            critic.structured?.criticisms?.length
              ? critic.structured.criticisms
              : criticContent
                ? [criticContent.slice(0, 500)]
                : [],
          unsupportedAssumptions: critic.structured?.unsupportedAssumptions ?? [],
          missingEvidence: critic.structured?.missingEvidence ?? [],
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        partial = true;
        await args.repos.agentRuns.update(
          args.session.workspaceId,
          args.session.id,
          criticRun.id,
          args.ownerId,
          {
            status: "FAILED",
            errorCode: "PROVIDER_TIMEOUT",
            errorMessage:
              error instanceof Error ? error.message : "Critic failed",
            finishedAt: new Date().toISOString(),
          }
        );
        yield {
          event: "run.partial",
          data: {
            role: "CRITIC",
            message: "Critic failed; Analyst output preserved",
            retryable: true,
          },
        };
        lastRunRoles = recordLastRunRole(lastRunRoles, {
          role: "CRITIC",
          status: "FAILED",
          provider: "groq",
          message: "Critic failed; Analyst output preserved",
        });
      }
    }
  }

  // --- Judge (optional) ---
  let judgeDraft: JudgeDraft | undefined;
  if (
    routing.runJudge &&
    !skipRemainder &&
    (!partial || intent === "PREPARE_DECISION")
  ) {
    throwIfAborted();
    const judgeSpend = canSpend(tracker, budget);
    if (!judgeSpend.ok) {
      partial = true;
      yield {
        event: "run.partial",
        data: { reason: judgeSpend.reason, preserved: "ANALYST" },
      };
    } else {
      yield {
        event: "agent.started",
        data: { role: "JUDGE", provider: "gemini" },
      };
      const judgeRun = await args.repos.agentRuns.create({
        workspaceId: args.session.workspaceId,
        sessionId: args.session.id,
        ownerId: args.ownerId,
        role: "JUDGE",
        routeMode: args.routeMode,
        provider: "pending",
        model: "pending",
        promptVersion: "v1",
        schemaVersion: "1.0",
        status: "RUNNING",
        startedAt: new Date().toISOString(),
      });

      try {
        const judge = await runJudge({
          gateway,
          analystContent,
          criticContent,
          secondOpinionContent,
          request: {
            routeMode: args.routeMode,
            systemInstructions: `${systemInstructions}\n\n${domainPack.getRoleInstructions("JUDGE")}`,
            messages: [{ role: "user", content: userContent }],
            signal: args.signal,
            maxOutputTokens: roleTokenCeiling("JUDGE", args.routeMode),
            metadata: {
              requestId: args.requestId,
              workspaceId: args.session.workspaceId,
              sessionId: args.session.id,
              promptVersion: "v1",
            },
            outputSchemaName: domainPack.getOutputSchemaName("JUDGE"),
          },
        });

        const judgeReply =
          judge.structured?.reply ??
          extractReply(judge.content) ??
          judge.content;

        totalCost += judge.estimatedCostUsd ?? 0;

        await args.repos.agentRuns.update(
          args.session.workspaceId,
          args.session.id,
          judgeRun.id,
          args.ownerId,
          {
            provider: judge.provider,
            model: judge.model,
            promptVersion: judge.promptVersion,
            schemaVersion: judge.schemaVersion,
            inputTokens: judge.usage.inputTokens,
            outputTokens: judge.usage.outputTokens,
            latencyMs: judge.latencyMs,
            costUsd: judge.estimatedCostUsd,
            status: "COMPLETED",
            finishedAt: new Date().toISOString(),
          }
        );

        if (judge.structured) {
          const options = sessionPatch.options ?? args.session.options;
          const selected = options.find(
            (o) => o.title === judge.structured?.selectedOptionTitle
          );
          judgeDraft = {
            runId: judgeRun.id,
            problem: args.session.problem,
            selectedOptionId: selected?.id,
            decision: judge.structured.decision,
            rationale: judge.structured.rationale,
            // Only VERIFIED evidence backs the decision — CONTRADICTED /
            // UNVERIFIED / NOT_VERIFIABLE items must not be stamped as
            // "selected" just because they exist in the session (H8 fix).
            selectedEvidenceIds: evidence
              .filter((e) => e.verificationStatus === "VERIFIED")
              .map((e) => e.id),
            rejectedOptions: judge.structured.rejectedOptions.map((r) => ({
              optionId:
                options.find((o) => o.title === r.title)?.id ?? r.title,
              reasons: r.reasons,
            })),
            // A CONTRADICTED assumption cannot simultaneously be "accepted"
            // into the decision — exclude it rather than stamping every
            // assumption in the session as accepted regardless of status
            // (H8 fix).
            acceptedAssumptionIds: (
              sessionPatch.assumptions ?? args.session.assumptions
            )
              .filter((a) => a.status !== "CONTRADICTED")
              .map((a) => a.id),
            unresolvedUnknownIds: (
              sessionPatch.unknowns ?? args.session.unknowns
            )
              .filter((u) => !isUnknownResolutionTerminal(u.resolution))
              .map((u) => u.id),
            tradeoffs: judge.structured.tradeoffs,
            reviewTriggers: judge.structured.reviewTriggers,
            ...deriveAgentAgreement(judge.structured.secondOpinionAgreement),
            confidenceLabel: judge.structured.confidenceLabel,
            confidenceScore: judge.structured.confidenceScore,
          };
          sessionPatch.judgeDraft = judgeDraft;
          const mergedOptions = sessionPatch.options ?? args.session.options;
          const mergedAssumptions =
            sessionPatch.assumptions ?? args.session.assumptions;
          const mergedUnknowns =
            sessionPatch.unknowns ?? args.session.unknowns;
          const highPriorityOpenUnknowns =
            countBlockingHighUnknowns(mergedUnknowns);
          if (
            judge.structured.decision === "EXPERIMENT_FIRST"
          ) {
            await args.repos.experiments.create(
              experimentDraftInput({
                workspaceId: args.session.workspaceId,
                sessionId: args.session.id,
                ownerId: args.ownerId,
                hypothesis:
                  judge.structured.unresolvedUnknowns[0] ??
                  "Judge required an experiment before deciding",
                source: `judge:${judgeRun.id}`,
              })
            );
          }
          if (
            judge.structured.decision === "ACCEPT" ||
            judge.structured.decision === "ACCEPT_WITH_CHANGES"
          ) {
            const gated = gateStatusTransition(
              sessionPatch.status ?? args.session.status,
              "DECISION_READY",
              {
                problem: args.session.problem,
                objective: args.session.objective,
                optionCount: mergedOptions.length,
                assumptionCount: mergedAssumptions.length,
                highPriorityOpenUnknowns,
                // domainChecks already gated this run at entry (see above);
                // no additional domain validation errors can exist here.
                domainValidationErrors: [],
              }
            );
            if (gated.applied) {
              sessionPatch.status = gated.status;
            } else if (gated.reason) {
              logStructured("info", "transition.rejected", {
                sessionId: args.session.id,
                proposedBy: "JUDGE",
                to: "DECISION_READY",
                reason: gated.reason,
              });
            }
          }
        }

        await args.repos.messages.create({
          workspaceId: args.session.workspaceId,
          sessionId: args.session.id,
          ownerId: args.ownerId,
          role: "ASSISTANT",
          content: judgeReply,
          runId: judgeRun.id,
          agentRole: "JUDGE",
          provider: judge.provider,
          model: judge.model,
          createdAt: new Date().toISOString(),
        });

        for (const chunk of chunkText(judgeReply, 48)) {
          yield {
            event: "token.delta",
            data: { runId: judgeRun.id, role: "JUDGE", text: chunk },
          };
        }

        yield {
          event: "agent.completed",
          data: { runId: judgeRun.id, role: "JUDGE", provider: judge.provider },
        };
        lastRunRoles = recordLastRunRole(lastRunRoles, {
          role: "JUDGE",
          status: "COMPLETED",
          provider: judge.provider,
        });
        completedRunIds.push(judgeRun.id);
      } catch (error) {
        partial = true;
        await args.repos.agentRuns.update(
          args.session.workspaceId,
          args.session.id,
          judgeRun.id,
          args.ownerId,
          {
            status: "FAILED",
            errorCode: "PROVIDER_ERROR",
            errorMessage:
              error instanceof Error ? error.message : "Judge failed",
            finishedAt: new Date().toISOString(),
          }
        );
        yield {
          event: "run.partial",
          data: {
            role: "JUDGE",
            message: "Judge failed; no DecisionRecord created",
          },
        };
        lastRunRoles = recordLastRunRole(lastRunRoles, {
          role: "JUDGE",
          status: "FAILED",
          message: "Judge failed; no DecisionRecord created",
        });
      }
    }
  }

  tracker.rounds += 1;

  // Persist workflow metadata + stage artifacts (refresh durability).
  const mergedSession: DecisionSession = {
    ...args.session,
    ...sessionPatch,
    assumptions: sessionPatch.assumptions ?? args.session.assumptions,
    unknowns: sessionPatch.unknowns ?? args.session.unknowns,
    options: sessionPatch.options ?? args.session.options,
    constraints: sessionPatch.constraints ?? args.session.constraints,
    judgeDraft: sessionPatch.judgeDraft ?? args.session.judgeDraft,
    latestSummary: sessionPatch.latestSummary ?? args.session.latestSummary,
    status: sessionPatch.status ?? args.session.status,
  };
  const postDecision = decideWorkflowStage({
    session: {
      ...mergedSession,
      workflow: applyWorkflowProgress({
        workflow: {
          ...(args.session.workflow ?? emptyWorkflowMetadata(args.routeMode)),
          routeMode: args.routeMode,
        },
        completedStage: workflowStage,
        agentRunIds: completedRunIds,
        usage: {
          calls: tracker.calls,
          inputTokens: tracker.inputTokens,
          outputTokens: tracker.outputTokens,
          costUsd: totalCost,
        },
      }),
    },
    routeMode: args.routeMode,
  });
  const stageSummary =
    analystContent ||
    secondOpinionContent ||
    criticContent ||
    mergedSession.latestSummary;
  const nextWorkflow = applyWorkflowProgress({
    workflow: {
      ...(args.session.workflow ?? emptyWorkflowMetadata(args.routeMode)),
      routeMode: args.routeMode,
      state: postDecision.state,
      blockers: postDecision.blockers,
    },
    completedStage: workflowStage,
    agentRunIds: completedRunIds,
    usage: {
      calls: tracker.calls,
      inputTokens: tracker.inputTokens,
      outputTokens: tracker.outputTokens,
      costUsd: totalCost,
    },
    decision: postDecision,
  });
  if (stageSummary && nextWorkflow.artifacts[workflowStage]) {
    nextWorkflow.artifacts[workflowStage] = {
      ...nextWorkflow.artifacts[workflowStage]!,
      summary: stageSummary.slice(0, 8000),
    };
  }
  if (secondOpinionRunId) {
    const optionsArt = nextWorkflow.artifacts.OPTIONS;
    const nowIso = new Date().toISOString();
    const ids = [...(optionsArt?.agentRunIds ?? [])];
    if (!ids.includes(secondOpinionRunId)) ids.push(secondOpinionRunId);
    nextWorkflow.artifacts.OPTIONS = {
      agentRunIds: ids,
      status: optionsArt?.status ?? "CURRENT",
      updatedAt: nowIso,
      summary: optionsArt?.summary,
      contributions: {
        ...optionsArt?.contributions,
        secondOpinion: true,
      },
    };
  }
  nextWorkflow.debateNotes = debateNotes;
  nextWorkflow.framing =
    sessionPatch.workflow?.framing ?? args.session.workflow?.framing;
  nextWorkflow.lastRun = {
    stage: workflowStage,
    plannedStages: routing.plan.stages,
    roles: lastRunRoles,
    at: new Date().toISOString(),
  };
  sessionPatch = { ...sessionPatch, workflow: nextWorkflow };
  workflowDecision = postDecision;

  if (Object.keys(sessionPatch).length > 0) {
    const updated = await args.repos.sessions.update(
      args.session.workspaceId,
      args.session.id,
      args.ownerId,
      sessionPatch
    );
    yield {
      event: "decision.state.updated",
      data: {
        sessionId: updated.id,
        patch: {
          status: updated.status,
          assumptions: updated.assumptions,
          unknowns: updated.unknowns,
          options: updated.options,
          constraints: updated.constraints,
          judgeDraft: updated.judgeDraft,
          workflow: updated.workflow,
        },
      },
    };
  }

  yield {
    event: "workflow.stage.completed",
    data: {
      correlationId,
      stage: workflowStage,
      nextStage: postDecision.nextStage,
      shouldAdvance: postDecision.shouldAdvance,
      state: postDecision.state,
      blockers: postDecision.blockers,
    },
  };
  if (postDecision.state === "PAUSED" || postDecision.state === "BLOCKED") {
    yield {
      event: "workflow.paused",
      data: {
        correlationId,
        blockers: postDecision.blockers,
        rationale: postDecision.rationale,
      },
    };
  } else if (postDecision.state === "COMPLETED") {
    yield {
      event: "workflow.completed",
      data: {
        correlationId,
        blockers: postDecision.blockers,
      },
    };
  }

  logStructured("info", "orchestrator.completed", {
    requestId: args.requestId,
    sessionId: args.session.id,
    routeMode: args.routeMode,
    costUsd: totalCost,
    partial,
    calls: tracker.calls,
    workflowStage,
  });

  yield {
    event: partial ? "run.partial" : "run.completed",
    data: {
      correlationId,
      status: partial ? "PARTIAL" : "COMPLETED",
      costUsd: totalCost,
      calls: tracker.calls,
      plannedCalls: routing.plan.estimatedCalls,
      actualProviderCalls: tracker.calls,
      plannedCost: routing.plan.estimatedMaxCostUsd,
      stopReason: skipRemainder ? afterAnalystStop.reason : null,
      executionPlan: routing.plan,
      workflow: nextWorkflow,
      shouldAdvance: postDecision.shouldAdvance,
      nextStage: postDecision.nextStage,
      workflowState: postDecision.state,
    },
  };
}

export function applyAnalystState(
  session: DecisionSession,
  structured: {
    assumptions: Array<{
      statement: string;
      importance: "LOW" | "MEDIUM" | "HIGH";
      status:
        | "UNVERIFIED"
        | "SUPPORTED"
        | "CONTRADICTED"
        | "ACCEPTED_FOR_NOW";
    }>;
    unknowns: Array<{
      question: string;
      importance: "LOW" | "MEDIUM" | "HIGH";
      resolution:
        | "OPEN"
        | "VERIFY_NOW"
        | "EXPERIMENT_REQUIRED"
        | "HUMAN_DECISION_REQUIRED"
        | "RESOLVED";
    }>;
    options: Array<{
      title: string;
      description: string;
      pros: string[];
      cons: string[];
      risks: string[];
    }>;
    constraints?: Array<{ statement: string }>;
    suggestedStatus?: "DISCOVERY" | "VALIDATING" | "DECISION_READY";
    problemFraming?: string;
  },
  intent: string
): Partial<DecisionSession> {
  const assumptions: Assumption[] = [
    ...session.assumptions,
    ...structured.assumptions.map((a) => ({
      id: uuidv4(),
      statement: a.statement,
      status: a.status,
      importance: a.importance,
      evidenceIds: [] as string[],
    })),
  ];

  const unknowns: Unknown[] = [
    ...session.unknowns,
    ...structured.unknowns.map((u) => ({
      id: uuidv4(),
      question: u.question,
      importance: u.importance,
      resolution: u.resolution,
      evidenceIds: [] as string[],
    })),
  ];

  const options: Option[] = [
    ...session.options,
    ...structured.options.map((o) => ({
      id: uuidv4(),
      title: o.title,
      description: o.description,
      pros: o.pros,
      cons: o.cons,
      risks: o.risks,
      evidenceIds: [] as string[],
      status: "PROPOSED" as const,
      proposedBy: "ANALYST" as const,
    })),
  ];

  const constraints: Constraint[] = [
    ...session.constraints,
    ...(structured.constraints ?? []).map((c) => ({
      id: uuidv4(),
      statement: c.statement,
      source: "AI" as const,
      confirmedByUser: false,
    })),
  ];

  // AI may PROPOSE a transition (suggestedStatus); only gateStatusTransition
  // may AUTHORIZE one. Analyst structured output alone must never be able
  // to move a session into DECISION_READY without meeting the real
  // requirements — see CLAUDE.md [[transition-gate-unification]].
  const gateCtx: GatedTransitionContext = {
    problem: session.problem,
    objective: session.objective,
    optionCount: options.length,
    assumptionCount: assumptions.length,
    highPriorityOpenUnknowns: countBlockingHighUnknowns(unknowns),
    domainValidationErrors: [],
    userAskedGenerateOptions: intent === "GENERATE_OPTIONS",
  };

  let status = session.status;
  const suggested = structured.suggestedStatus;
  if (suggested) {
    const gated = gateStatusTransition(status, suggested, gateCtx);
    if (gated.applied) {
      status = gated.status;
    } else if (gated.reason) {
      logStructured("info", "transition.rejected", {
        sessionId: session.id,
        proposedBy: "ANALYST",
        from: status,
        to: suggested,
        reason: gated.reason,
      });
    }
  }
  if (
    status === session.status &&
    (intent === "GENERATE_OPTIONS" || intent === "FRAME_PROBLEM")
  ) {
    // Analyst didn't propose an accepted transition — still allow the
    // conservative default advance to VALIDATING, but only through the
    // same gate (requires problem+objective, and options when required).
    const gated = gateStatusTransition(status, "VALIDATING", gateCtx);
    if (gated.applied) status = gated.status;
  }

  return {
    assumptions: dedupeByKey(assumptions, (a) => a.statement),
    unknowns: dedupeByKey(unknowns, (u) => u.question),
    options: mergeOptionsPreserveIds([], options),
    constraints: dedupeByKey(constraints, (c) => c.statement),
    status,
    latestSummary: structured.problemFraming ?? session.latestSummary,
  };
}

/** Keep first-seen option ID when titles collide; merge provenance. */
export function mergeOptionsPreserveIds(
  existing: Option[],
  incoming: Option[]
): Option[] {
  const byTitle = new Map<string, Option>();
  for (const o of existing) {
    byTitle.set(o.title.toLowerCase().trim(), o);
  }
  for (const o of incoming) {
    const key = o.title.toLowerCase().trim();
    if (!byTitle.has(key)) {
      byTitle.set(key, o);
    }
  }
  return Array.from(byTitle.values());
}

function dedupeByKey<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const k = key(item).toLowerCase().trim();
    if (seen.has(k)) continue;
    seen.add(k);
    result.push(item);
  }
  return result;
}

function extractReply(content: string): string | null {
  const parsed = parseLooseJson(content);
  if (parsed && typeof parsed === "object" && "reply" in parsed) {
    const reply = (parsed as { reply?: unknown }).reply;
    return typeof reply === "string" && reply.trim() ? reply : null;
  }
  return null;
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks.length ? chunks : [""];
}

export function encodeSse(event: SseEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

export async function approveDecision(args: {
  repos: Repositories;
  session: DecisionSession;
  ownerId: string;
  judgeRunId: string;
  idempotencyKey?: string;
}) {
  const { gateDecisionApproval } = await import("@/ai/safety/hard-policy-gate");
  const { calculateHeuristicConfidence } = await import(
    "@/domain/decision/confidence"
  );
  const domainPack = getDomainPack(args.session.domainPackId);
  const idempotencyKey = args.idempotencyKey
    ? `${args.ownerId}:decision:${args.idempotencyKey}`
    : undefined;

  if (idempotencyKey) {
    const existingId = await args.repos.idempotency.get(idempotencyKey);
    if (existingId) {
      const existing = await args.repos.decisionRecords.getById(
        existingId,
        args.ownerId
      );
      if (existing) return existing;
    }
  }

  const draft = args.session.judgeDraft;
  if (!draft || draft.runId !== args.judgeRunId) {
    throw new AppError(
      "SESSION_INVALID_STATE",
      "Judge draft mismatch",
      409
    );
  }

  const provisional = {
    id: "provisional",
    workspaceId: args.session.workspaceId,
    sessionId: args.session.id,
    ownerId: args.ownerId,
    problem: draft.problem,
    selectedOptionId: draft.selectedOptionId,
    decision: draft.decision,
    rationale: draft.rationale,
    selectedEvidenceIds: draft.selectedEvidenceIds,
    rejectedOptions: draft.rejectedOptions,
    acceptedAssumptionIds: draft.acceptedAssumptionIds,
    unresolvedUnknownIds: draft.unresolvedUnknownIds,
    tradeoffs: draft.tradeoffs,
    confidence: {
      type: "HEURISTIC" as const,
      label: draft.confidenceLabel,
      score: draft.confidenceScore,
      factors: {
        evidenceCoverage: 0.5,
        sourceReliability: 0.5,
        unresolvedUnknownPenalty: 0.2,
        assumptionPenalty: 0.2,
        agentAgreement: 0.6,
        experimentStrength: 0.3,
      },
      // Placeholder for the pre-approval domain-validation gate only; the
      // real confidence (with the real method/rationale) is computed below
      // and this provisional object is discarded before persistence.
      agentAgreementMethod: "UNAVAILABLE" as const,
    },
    reviewTriggers: draft.reviewTriggers,
    approvedBy: args.ownerId,
    approvedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const domainValidation = await domainPack.validateDecision(provisional);
  const gate = gateDecisionApproval({
    sessionStatus: args.session.status,
    approve: true,
    hasJudgeDraft: true,
    domainErrors: domainValidation.errors,
    budgetExceeded: false,
    actionOrigin: "HUMAN_APPROVE",
  });
  if (!gate.passed) {
    throw new AppError(
      "SESSION_INVALID_STATE",
      gate.errors.map((e) => e.message).join("; "),
      409
    );
  }

  const gatedDecided = gateStatusTransition(
    args.session.status,
    "DECIDED",
    {
      problem: args.session.problem,
      objective: args.session.objective,
      optionCount: args.session.options.length,
      assumptionCount: args.session.assumptions.length,
      highPriorityOpenUnknowns: countBlockingHighUnknowns(
        args.session.unknowns
      ),
      domainValidationErrors: domainValidation.errors,
    },
    { origin: "HUMAN_APPROVE", approve: true }
  );
  if (!gatedDecided.applied || gatedDecided.status !== "DECIDED") {
    throw new AppError(
      "SESSION_INVALID_STATE",
      gatedDecided.reason ??
        "DECIDED requires action.origin=HUMAN_APPROVE from explicit human approve",
      409
    );
  }

  const evidence = await args.repos.evidence.listBySession(
    args.session.workspaceId,
    args.session.id,
    args.ownerId
  );
  const experiments = await args.repos.experiments.listBySession(
    args.session.workspaceId,
    args.session.id
  );
  const completedExperiments = experiments.filter((e) => e.status === "COMPLETED");
  const confidence = calculateHeuristicConfidence({
    evidenceCoverage: Math.min(1, evidence.length / 5),
    sourceReliability:
      evidence.length === 0
        ? 0.3
        : evidence.filter((e) => e.reliability === "HIGH").length /
          evidence.length,
    unresolvedUnknownPenalty: Math.min(
      1,
      draft.unresolvedUnknownIds.length / 5
    ),
    assumptionPenalty: Math.min(1, args.session.assumptions.length / 10),
    agentAgreement: draft.agentAgreement ?? AGREEMENT_UNAVAILABLE_SCORE,
    experimentStrength:
      completedExperiments.length === 0
        ? 0
        : Math.min(1, completedExperiments.length / 2),
    experimentStrengthMethod:
      completedExperiments.length === 0
        ? "UNAVAILABLE"
        : "COMPLETED_EXPERIMENTS",
  });

  const previous = await args.repos.decisionRecords.getBySession(
    args.session.id,
    args.ownerId
  );

  const { id: _omitId, ...provisionalWithoutId } = provisional;
  void _omitId;

  let recordId: string | undefined;
  if (idempotencyKey) {
    const candidateId = uuidv4();
    const claim = await args.repos.idempotency.claim(
      idempotencyKey,
      candidateId
    );
    if (claim.won) {
      recordId = candidateId;
    } else {
      // Another concurrent request already won this key — return its
      // record instead of creating a duplicate DecisionRecord.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const winner = await args.repos.decisionRecords.getById(
          claim.artifactId,
          args.ownerId
        );
        if (winner) return winner;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      throw new AppError(
        "IDEMPOTENCY_CONFLICT",
        "Concurrent decision approval in progress; retry with the same key",
        409
      );
    }
  }

  const record = await args.repos.decisionRecords.create({
    ...provisionalWithoutId,
    id: recordId,
    confidence: {
      ...confidence,
      agentAgreementMethod: draft.agentAgreementMethod,
      agentAgreementRationale: draft.agentAgreementRationale,
    },
    supersedesDecisionRecordId: previous?.id,
  });

  await args.repos.sessions.update(
    args.session.workspaceId,
    args.session.id,
    args.ownerId,
    {
      status: gatedDecided.status,
      activeDecisionRecordId: record.id,
    }
  );

  return record;
}

export async function createBlueprintFromDecision(args: {
  repos: Repositories;
  session: DecisionSession;
  ownerId: string;
  sourceDecisionRecordId: string;
  idempotencyKey?: string;
}) {
  const { gateBlueprintCreation } = await import("@/ai/safety/hard-policy-gate");
  const idempotencyKey = args.idempotencyKey
    ? `${args.ownerId}:blueprint:${args.idempotencyKey}`
    : undefined;

  if (idempotencyKey) {
    const existingId = await args.repos.idempotency.get(idempotencyKey);
    if (existingId) {
      const existing = await args.repos.blueprints.getById(
        existingId,
        args.ownerId
      );
      if (existing) return existing;
    }
  }

  const decision = await args.repos.decisionRecords.getById(
    args.sourceDecisionRecordId,
    args.ownerId
  );
  if (!decision) {
    throw new AppError("NOT_FOUND", "DecisionRecord not found", 404);
  }

  const gate = gateBlueprintCreation({ hasApprovedDecisionRecord: true });
  if (!gate.passed) {
    throw new AppError("SESSION_INVALID_STATE", gate.errors[0]?.message ?? "Gate failed", 409);
  }

  const selected = args.session.options.find(
    (o) => o.id === decision.selectedOptionId
  );
  void selected;

  const evidenceForBlueprint = await args.repos.evidence.listBySession(
    args.session.workspaceId,
    args.session.id,
    args.ownerId
  );
  const derived = deriveBlueprintContent({
    session: args.session,
    decision,
    evidence: evidenceForBlueprint,
  });
  const fields = contentToBlueprintFields(derived);

  let blueprintId: string | undefined;
  if (idempotencyKey) {
    const candidateId = uuidv4();
    const claim = await args.repos.idempotency.claim(
      idempotencyKey,
      candidateId
    );
    if (claim.won) {
      blueprintId = candidateId;
    } else {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const winner = await args.repos.blueprints.getById(
          claim.artifactId,
          args.ownerId
        );
        if (winner) return winner;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      throw new AppError(
        "IDEMPOTENCY_CONFLICT",
        "Concurrent blueprint generation in progress; retry with the same key",
        409
      );
    }
  }

  const blueprint = await args.repos.blueprints.create({
    id: blueprintId,
    workspaceId: args.session.workspaceId,
    sessionId: args.session.id,
    ownerId: args.ownerId,
    sourceDecisionRecordId: decision.id,
    status: "DRAFT",
    ...fields,
    createdAt: new Date().toISOString(),
  });

  await args.repos.sessions.update(
    args.session.workspaceId,
    args.session.id,
    args.ownerId,
    { activeBlueprintId: blueprint.id }
  );

  return blueprint;
}

/**
 * Blueprint starts DRAFT (see createBlueprintFromDecision) and can only
 * reach APPROVED through this explicit, human-triggered transition — never
 * automatically at creation time.
 */
export async function approveBlueprint(args: {
  repos: Repositories;
  blueprintId: string;
  ownerId: string;
}) {
  const blueprint = await args.repos.blueprints.getById(
    args.blueprintId,
    args.ownerId
  );
  if (!blueprint) {
    throw new AppError("NOT_FOUND", "Blueprint not found", 404);
  }
  if (blueprint.status === "APPROVED") {
    return blueprint;
  }
  if (blueprint.status !== "DRAFT" && blueprint.status !== "REVIEW") {
    throw new AppError(
      "SESSION_INVALID_STATE",
      `Cannot approve Blueprint from status ${blueprint.status}`,
      409
    );
  }
  return args.repos.blueprints.updateStatus(
    args.blueprintId,
    args.ownerId,
    "APPROVED",
    new Date().toISOString()
  );
}
