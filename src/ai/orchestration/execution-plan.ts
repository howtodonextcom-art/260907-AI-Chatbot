import type { RouteMode } from "@/domain/decision/types";
import { DEFAULT_BUDGETS } from "@/config/ai-budget";
import { getFeatureFlags } from "@/config/feature-flags";
import {
  INTENT_TO_STAGE,
  type WorkflowIntent,
} from "@/domain/decision/workflow-stage";
import type { WorkflowStage } from "@/domain/decision/types";

export type OrchestratorIntent = WorkflowIntent;

export type ExecutionStage =
  | "VERIFY_TOOLS"
  | "ANALYST"
  | "SECOND_OPINION"
  | "CRITIC"
  | "JUDGE";

export interface ExecutionPlan {
  intent: OrchestratorIntent;
  workflowStage: WorkflowStage;
  stages: ExecutionStage[];
  reasons: string[];
  estimatedCalls: number;
  estimatedMaxCostUsd: number;
}

export interface RoutingDecision {
  routeMode: RouteMode;
  runVerifyTools: boolean;
  runAnalyst: boolean;
  runSecondOpinion: boolean;
  runCritic: boolean;
  runJudge: boolean;
  /** Optional post-VERIFY Analyst explanation — must not change Evidence trust. */
  runPostVerifyExplanation?: boolean;
  reasons: string[];
  plan: ExecutionPlan;
}

function planFromFlags(args: {
  intent: OrchestratorIntent;
  routeMode: RouteMode;
  runVerifyTools: boolean;
  runAnalyst: boolean;
  runSecondOpinion: boolean;
  runCritic: boolean;
  runJudge: boolean;
  reasons: string[];
}): ExecutionPlan {
  const stages: ExecutionStage[] = [];
  if (args.runVerifyTools) stages.push("VERIFY_TOOLS");
  if (args.runAnalyst) stages.push("ANALYST");
  if (args.runSecondOpinion) stages.push("SECOND_OPINION");
  if (args.runCritic) stages.push("CRITIC");
  if (args.runJudge) stages.push("JUDGE");
  return {
    intent: args.intent,
    workflowStage: INTENT_TO_STAGE[args.intent],
    stages,
    reasons: args.reasons,
    estimatedCalls: stages.length,
    estimatedMaxCostUsd: DEFAULT_BUDGETS[args.routeMode].maxCostUsd,
  };
}

/**
 * Mode × Stage routing matrix (v17).
 * Mode controls depth, not which workflow stage runs.
 */
export function decideRouting(args: {
  routeMode: RouteMode;
  intent: string;
  evidenceCoverage: number;
  importance: "LOW" | "MEDIUM" | "HIGH";
  blockingUnknownCount?: number;
  userRequestedChallenge?: boolean;
  hasDeepseek?: boolean;
  /** High-impact / ambiguous framing heuristic for DEEP FRAME Critic. */
  frameNeedsChallenge?: boolean;
  /** True when SecondOpinion already contributed CURRENT OPTIONS artifact. */
  secondOpinionAlreadyContributed?: boolean;
  /** True when material new facts arrived since last SO. */
  materialFactsChanged?: boolean;
}): RoutingDecision {
  const flags = getFeatureFlags();
  const intent = args.intent as OrchestratorIntent;
  const stage = INTENT_TO_STAGE[intent] ?? "DISCUSS";
  const reasons: string[] = [];

  const wrap = (
    partial: Omit<RoutingDecision, "plan" | "reasons" | "routeMode"> & {
      reasons?: string[];
      routeMode?: RouteMode;
      runPostVerifyExplanation?: boolean;
    }
  ): RoutingDecision => {
    const allReasons = [...reasons, ...(partial.reasons ?? [])];
    const base = {
      routeMode: partial.routeMode ?? args.routeMode,
      runVerifyTools: partial.runVerifyTools,
      runAnalyst: partial.runAnalyst,
      runSecondOpinion: partial.runSecondOpinion,
      runCritic: partial.runCritic,
      runJudge: partial.runJudge,
      runPostVerifyExplanation: partial.runPostVerifyExplanation,
      reasons: allReasons,
    };
    return {
      ...base,
      plan: planFromFlags({
        intent,
        ...base,
      }),
    };
  };

  // VERIFY is always tools-first across modes.
  if (intent === "VERIFY" || stage === "VERIFY") {
    return wrap({
      runVerifyTools: true,
      runAnalyst: false,
      runSecondOpinion: false,
      runCritic: false,
      runJudge: false,
      runPostVerifyExplanation: args.routeMode === "DEEP",
      reasons: [
        "VERIFY is a deterministic tool pipeline",
        args.routeMode === "DEEP"
          ? "DEEP may add Analyst explanation after tools without changing Evidence trust"
          : "No post-verify LLM explanation outside DEEP",
      ],
    });
  }

  if (args.routeMode === "QUICK") {
    return wrap({
      runVerifyTools: false,
      runAnalyst: true,
      runSecondOpinion: false,
      runCritic: false,
      runJudge: false,
      reasons: ["QUICK: single economy Analyst call"],
    });
  }

  if (args.routeMode === "STANDARD") {
    if (stage === "PREPARE") {
      // Judge-only, mirroring DEEP PREPARE. Without this, Analyst-suggested
      // DECISION_READY (applyAnalystState) leaves the session with no
      // judgeDraft, and approveDecision requires judgeDraft to exist — so a
      // STANDARD session could reach DECISION_READY and then never be
      // approvable. STANDARD's own maxCalls budget (2) already accounted
      // for this second call; see DEFAULT_BUDGETS comment in ai-budget.ts.
      return wrap({
        runVerifyTools: false,
        runAnalyst: false,
        runSecondOpinion: false,
        runCritic: false,
        runJudge: flags.enableJudge,
        reasons: ["STANDARD PREPARE: Judge only, using prior Analyst artifacts"],
      });
    }
    // STANDARD full workflow stages, Analyst-only (no Critic/SO).
    return wrap({
      runVerifyTools: false,
      runAnalyst: true,
      runSecondOpinion: false,
      runCritic: false,
      runJudge: false,
      reasons: [`STANDARD ${stage}: Analyst only`],
    });
  }

  // --- DEEP ---
  const hasSo =
    flags.enableSecondOpinion && Boolean(args.hasDeepseek);

  if (stage === "DISCUSS") {
    return wrap({
      routeMode: "DEEP",
      runVerifyTools: false,
      runAnalyst: true,
      runSecondOpinion: false,
      runCritic: false,
      runJudge: false,
      reasons: ["DEEP DISCUSS: Analyst"],
    });
  }

  if (stage === "FRAME") {
    const runCritic =
      flags.enableCritic && Boolean(args.frameNeedsChallenge);
    return wrap({
      routeMode: "DEEP",
      runVerifyTools: false,
      runAnalyst: true,
      runSecondOpinion: false,
      runCritic,
      runJudge: false,
      reasons: [
        "DEEP FRAME: Analyst",
        runCritic
          ? "Critic joined due to ambiguity/high-impact framing"
          : "Critic skipped (framing not high-impact)",
      ],
    });
  }

  if (stage === "OPTIONS") {
    return wrap({
      routeMode: "DEEP",
      runVerifyTools: false,
      runAnalyst: true,
      runSecondOpinion: hasSo,
      runCritic: false,
      runJudge: false,
      reasons: [
        "DEEP OPTIONS: Analyst + independent SecondOpinion in parallel",
        hasSo ? "SecondOpinion enabled" : "SecondOpinion unavailable",
      ],
    });
  }

  if (stage === "CRITIQUE") {
    const runSo =
      hasSo &&
      (!args.secondOpinionAlreadyContributed ||
        Boolean(args.materialFactsChanged) ||
        Boolean(args.userRequestedChallenge));
    return wrap({
      routeMode: "DEEP",
      runVerifyTools: false,
      runAnalyst: false,
      runSecondOpinion: runSo,
      runCritic: flags.enableCritic,
      runJudge: false,
      reasons: [
        "DEEP CRITIQUE: Critic",
        runSo
          ? "SecondOpinion re-engaged"
          : "SecondOpinion skipped (already contributed or unavailable)",
      ],
    });
  }

  if (stage === "PREPARE") {
    // Judge only — use canonical prior artifacts; do not rerun Analyst+SO+Critic.
    return wrap({
      routeMode: "DEEP",
      runVerifyTools: false,
      runAnalyst: false,
      runSecondOpinion: false,
      runCritic: false,
      runJudge: flags.enableJudge,
      reasons: [
        "DEEP PREPARE: Judge only using prior Analyst/Critic/SO artifacts",
      ],
    });
  }

  return wrap({
    routeMode: "DEEP",
    runVerifyTools: false,
    runAnalyst: true,
    runSecondOpinion: false,
    runCritic: false,
    runJudge: false,
    reasons: [`DEEP fallback for ${intent}: Analyst`],
  });
}

/** Per-role output token ceilings (v17) — ceilings, not targets. */
export function roleTokenCeiling(
  role: "ANALYST" | "SECOND_OPINION" | "CRITIC" | "JUDGE",
  routeMode: RouteMode
): number {
  const table: Record<
    RouteMode,
    Partial<Record<"ANALYST" | "SECOND_OPINION" | "CRITIC" | "JUDGE", number>>
  > = {
    QUICK: { ANALYST: 2000 },
    STANDARD: { ANALYST: 3500, JUDGE: 3500 },
    DEEP: {
      ANALYST: 4000,
      SECOND_OPINION: 2500,
      CRITIC: 2500,
      JUDGE: 4000,
    },
  };
  const modeBudget = DEFAULT_BUDGETS[routeMode].maxOutputTokens;
  const cap = table[routeMode][role] ?? modeBudget;
  return Math.min(cap, modeBudget);
}
