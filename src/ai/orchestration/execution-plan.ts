import type { RouteMode } from "@/domain/decision/types";
import { DEFAULT_BUDGETS } from "@/config/ai-budget";
import { getFeatureFlags } from "@/config/feature-flags";

export type OrchestratorIntent =
  | "DISCUSS"
  | "FRAME_PROBLEM"
  | "GENERATE_OPTIONS"
  | "CRITIQUE"
  | "VERIFY"
  | "PREPARE_DECISION";

export type ExecutionStage =
  | "VERIFY_TOOLS"
  | "ANALYST"
  | "SECOND_OPINION"
  | "CRITIC"
  | "JUDGE";

export interface ExecutionPlan {
  intent: OrchestratorIntent;
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
    stages,
    reasons: args.reasons,
    estimatedCalls: stages.length,
    estimatedMaxCostUsd: DEFAULT_BUDGETS[args.routeMode].maxCostUsd,
  };
}

export function decideRouting(args: {
  routeMode: RouteMode;
  intent: string;
  evidenceCoverage: number;
  importance: "LOW" | "MEDIUM" | "HIGH";
  blockingUnknownCount?: number;
  userRequestedChallenge?: boolean;
  hasDeepseek?: boolean;
}): RoutingDecision {
  const flags = getFeatureFlags();
  const intent = args.intent as OrchestratorIntent;
  const reasons: string[] = [];

  const wrap = (
    partial: Omit<RoutingDecision, "plan" | "reasons" | "routeMode"> & {
      reasons?: string[];
      routeMode?: RouteMode;
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

  if (args.routeMode === "QUICK") {
    if (intent === "VERIFY") {
      return wrap({
        runVerifyTools: true,
        runAnalyst: false,
        runSecondOpinion: false,
        runCritic: false,
        runJudge: false,
        reasons: ["VERIFY uses deterministic tools, not a model council"],
      });
    }
    return wrap({
      runVerifyTools: false,
      runAnalyst: true,
      runSecondOpinion: false,
      runCritic: false,
      runJudge: false,
      reasons: ["QUICK uses one economy call"],
    });
  }

  if (intent === "VERIFY") {
    return wrap({
      runVerifyTools: true,
      runAnalyst: false,
      runSecondOpinion: false,
      runCritic: false,
      runJudge: false,
      reasons: ["VERIFY is a tool pipeline, not an LLM debate"],
    });
  }

  if (args.routeMode === "STANDARD") {
    return wrap({
      runVerifyTools: false,
      runAnalyst: true,
      runSecondOpinion: false,
      runCritic: false,
      runJudge: false,
      reasons: ["STANDARD runs Analyst only"],
    });
  }

  // DEEP — intent-aware, not a full council every step.
  if (intent === "FRAME_PROBLEM" || intent === "GENERATE_OPTIONS" || intent === "DISCUSS") {
    return wrap({
      routeMode: "DEEP",
      runVerifyTools: false,
      runAnalyst: true,
      runSecondOpinion: false,
      runCritic: false,
      runJudge: false,
      reasons: [`${intent} in DEEP still uses Analyst only`],
    });
  }

  const secondOpinionWanted =
    flags.enableSecondOpinion &&
    Boolean(args.hasDeepseek) &&
    (intent === "CRITIQUE" ||
      intent === "PREPARE_DECISION" ||
      args.userRequestedChallenge ||
      args.evidenceCoverage < 0.4);

  if (intent === "CRITIQUE") {
    return wrap({
      routeMode: "DEEP",
      runVerifyTools: false,
      runAnalyst: false,
      runSecondOpinion: secondOpinionWanted,
      runCritic: flags.enableCritic,
      runJudge: false,
      reasons: [
        "CRITIQUE runs Critic",
        secondOpinionWanted
          ? "SecondOpinion enabled (independent DeepSeek)"
          : "SecondOpinion skipped",
      ],
    });
  }

  if (intent === "PREPARE_DECISION") {
    reasons.push("Formal decision requires Judge");
    return wrap({
      routeMode: "DEEP",
      runVerifyTools: false,
      runAnalyst: true,
      runSecondOpinion: secondOpinionWanted,
      runCritic: flags.enableCritic,
      runJudge: flags.enableJudge,
      reasons: ["PREPARE_DECISION: Analyst context + Critic + Judge"],
    });
  }

  let runCritic = flags.enableCritic;
  const runJudge = flags.enableJudge && args.importance === "HIGH";
  if (
    args.evidenceCoverage > 0.8 &&
    args.importance === "LOW" &&
    !args.userRequestedChallenge
  ) {
    runCritic = false;
    reasons.push("Skipped Critic: high evidence, low importance");
  }

  return wrap({
    routeMode: "DEEP",
    runVerifyTools: false,
    runAnalyst: true,
    runSecondOpinion: secondOpinionWanted,
    runCritic,
    runJudge,
    reasons,
  });
}
