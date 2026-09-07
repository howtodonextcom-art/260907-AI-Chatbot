import type { RouteMode } from "@/domain/decision/types";
import { getFeatureFlags } from "@/config/feature-flags";

export interface RoutingDecision {
  routeMode: RouteMode;
  runAnalyst: boolean;
  runCritic: boolean;
  runJudge: boolean;
  reasons: string[];
}

export function decideRouting(args: {
  routeMode: RouteMode;
  intent: string;
  evidenceCoverage: number;
  importance: "LOW" | "MEDIUM" | "HIGH";
  userRequestedChallenge?: boolean;
}): RoutingDecision {
  const flags = getFeatureFlags();
  const reasons: string[] = [];

  if (args.routeMode === "QUICK") {
    return {
      routeMode: "QUICK",
      runAnalyst: true,
      runCritic: false,
      runJudge: false,
      reasons: ["QUICK uses one economy call"],
    };
  }

  if (args.routeMode === "STANDARD") {
    return {
      routeMode: "STANDARD",
      runAnalyst: true,
      runCritic: false,
      runJudge: false,
      reasons: ["STANDARD runs Analyst only"],
    };
  }

  let runCritic = flags.enableCritic;
  let runJudge =
    flags.enableJudge &&
    (args.intent === "PREPARE_DECISION" ||
      args.intent === "CRITIQUE" ||
      args.importance === "HIGH");

  if (
    args.evidenceCoverage > 0.8 &&
    args.importance === "LOW" &&
    !args.userRequestedChallenge
  ) {
    runCritic = false;
    reasons.push("Skipped Critic: high evidence, low importance");
  } else if (runCritic) {
    reasons.push("DEEP default includes Critic");
  }

  if (args.evidenceCoverage < 0.4 || args.importance === "HIGH") {
    runCritic = flags.enableCritic;
    runJudge = flags.enableJudge;
    reasons.push("Escalated due to uncertainty or importance");
  }

  if (args.intent === "PREPARE_DECISION") {
    runJudge = flags.enableJudge;
    reasons.push("Formal decision requires Judge");
  }

  return {
    routeMode: "DEEP",
    runAnalyst: true,
    runCritic,
    runJudge,
    reasons,
  };
}
