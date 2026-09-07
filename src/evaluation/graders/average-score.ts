import type { EvaluationResult } from "@/evaluation/types";

export function averageScore(result: EvaluationResult): number {
  const values = Object.values(result.scores);
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
