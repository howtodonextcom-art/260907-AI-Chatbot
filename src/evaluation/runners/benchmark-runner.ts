import { SAMPLE_CASES } from "@/evaluation/cases/sample-cases";
import { BASELINE_CONFIGURATIONS } from "@/evaluation/types";
import type { EvaluationResult, EvaluationRun } from "@/evaluation/types";
import { v4 as uuidv4 } from "uuid";

/**
 * Dev/test benchmark runner scaffold.
 * Full live provider comparison is opt-in and does not mutate production data.
 */
export function listBenchmarkMatrix() {
  return {
    cases: SAMPLE_CASES,
    configurations: BASELINE_CONFIGURATIONS,
  };
}

export function gradeHeuristic(args: {
  output: string;
  rubric: string[];
}): EvaluationResult {
  const notes: string[] = [];
  const scores: Record<string, number> = {};
  for (const item of args.rubric) {
    const hit = args.output.toLowerCase().includes(item.toLowerCase().slice(0, 12));
    scores[item] = hit ? 1 : 0;
    notes.push(hit ? `Matched: ${item}` : `Missing: ${item}`);
  }
  const avg =
    Object.values(scores).reduce((a, b) => a + b, 0) /
    Math.max(1, Object.values(scores).length);
  return {
    id: uuidv4(),
    runId: "local",
    scores,
    notes,
    passed: avg >= 0.5,
  };
}

export function createEvaluationRun(
  caseId: string,
  configurationId: string
): EvaluationRun {
  return {
    id: uuidv4(),
    caseId,
    configurationId,
    startedAt: new Date().toISOString(),
  };
}
