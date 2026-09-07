import type { AiBudget, RouteMode } from "@/domain/decision/types";

export const DEFAULT_BUDGETS: Record<RouteMode, AiBudget> = {
  QUICK: {
    maxCalls: 1,
    maxInputTokens: 12000,
    maxOutputTokens: 2000,
    maxCostUsd: 0.02,
    maxRounds: 1,
  },
  STANDARD: {
    maxCalls: 2,
    maxInputTokens: 24000,
    maxOutputTokens: 5000,
    maxCostUsd: 0.08,
    maxRounds: 1,
  },
  DEEP: {
    maxCalls: 4,
    maxInputTokens: 50000,
    maxOutputTokens: 10000,
    maxCostUsd: 0.25,
    maxRounds: 1,
  },
};
