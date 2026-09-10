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
  | "PARALLEL_FRAME"
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
  /** DEEP FRAME: broadcast raw prompt to gemini∥deepseek∥groq, blind. */
  runParallelFraming: boolean;
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
  runParallelFraming: boolean;
  runSecondOpinion: boolean;
  runCritic: boolean;
  runJudge: boolean;
  reasons: string[];
}): ExecutionPlan {
  const stages: ExecutionStage[] = [];
  if (args.runVerifyTools) stages.push("VERIFY_TOOLS");
  if (args.runParallelFraming) stages.push("PARALLEL_FRAME");
  if (args.runAnalyst) stages.push("ANALYST");
  if (args.runSecondOpinion) stages.push("SECOND_OPINION");
  if (args.runCritic) stages.push("CRITIC");
  if (args.runJudge) stages.push("JUDGE");
  return {
    intent: args.intent,
    workflowStage: INTENT_TO_STAGE[args.intent],
    stages,
    reasons: args.reasons,
    // Parallel framing burns up to 3 provider calls in one stage.
    estimatedCalls: args.runParallelFraming
      ? Math.max(stages.length, 3)
      : stages.length,
    estimatedMaxCostUsd: DEFAULT_BUDGETS[args.routeMode].maxCostUsd,
  };
}

/**
 * Stage routing matrix (v18 — DEEP only). QUICK/STANDARD are no longer
 * selectable/creatable (RunSessionSchema locks routeMode to "DEEP" — see
 * CLAUDE.md [[deep-only]]); every intent routes through the DEEP-shaped
 * logic below regardless of what routeMode value is passed in, so a
 * legacy session that still has workflow.routeMode="QUICK"/"STANDARD"
 * stored (pre-existing Firestore data) safely falls through to full DEEP
 * behavior instead of crashing or silently degrading.
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
      runParallelFraming: partial.runParallelFraming ?? false,
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
      runParallelFraming: false,
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

  // --- DEEP (only mode) ---
  const hasSo =
    flags.enableSecondOpinion && Boolean(args.hasDeepseek);

  if (stage === "DISCUSS") {
    // Discovery chat still uses Parallel Blind Framing when DEEP — no Gemini monopoly.
    return wrap({
      routeMode: "DEEP",
      runVerifyTools: false,
      runAnalyst: false,
      runParallelFraming: true,
      runSecondOpinion: false,
      runCritic: false,
      runJudge: false,
      reasons: [
        "DEEP DISCUSS/DISCOVERY: Parallel Blind Framing (gemini∥deepseek∥groq; quorum≥2)",
      ],
    });
  }

  if (stage === "FRAME") {
    return wrap({
      routeMode: "DEEP",
      runVerifyTools: false,
      runAnalyst: false,
      runParallelFraming: true,
      runSecondOpinion: false,
      runCritic: false,
      runJudge: false,
      reasons: [
        "DEEP FRAME: Parallel Blind Framing — quorum≥2; raw prompt broadcast; no silent single-provider degrade",
      ],
    });
  }

  if (stage === "OPTIONS") {
    return wrap({
      routeMode: "DEEP",
      runVerifyTools: false,
      runAnalyst: true,
      runParallelFraming: false,
      runSecondOpinion: hasSo,
      runCritic: false,
      runJudge: false,
      reasons: [
        "DEEP OPTIONS: Analyst + independent SecondOpinion in parallel (post-Human framing gate)",
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
      runParallelFraming: false,
      runSecondOpinion: runSo,
      runCritic: flags.enableCritic,
      runJudge: false,
      reasons: [
        "DEEP CRITIQUE: Critic (only after VERIFY when required)",
        runSo
          ? "SecondOpinion re-engaged"
          : "SecondOpinion skipped (already contributed or unavailable)",
      ],
    });
  }

  if (stage === "PREPARE") {
    return wrap({
      routeMode: "DEEP",
      runVerifyTools: false,
      runAnalyst: false,
      runParallelFraming: false,
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
    runParallelFraming: false,
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
