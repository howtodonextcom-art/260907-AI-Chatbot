import { V10_CASES } from "@/evaluation/cases/v10-cases";
import { BASELINE_CONFIGURATIONS } from "@/evaluation/types";
import type { EvaluationResult, EvaluationRun } from "@/evaluation/types";
import {
  gradeDeterministic,
  secondOpinionVerdictFromBenchmark,
  type ArtifactForGrading,
} from "@/evaluation/graders/deterministic";
import { v4 as uuidv4 } from "uuid";
import { getDomainPack } from "@/domain-packs/registry";

export function listBenchmarkMatrix(suiteId?: string) {
  const packSuite = suiteId ?? getDomainPack().getEvaluationSuiteId?.();
  const cases = packSuite
    ? V10_CASES.filter((c) => !c.suite || c.suite === packSuite)
    : V10_CASES;
  return {
    cases: cases.length ? cases : V10_CASES,
    configurations: BASELINE_CONFIGURATIONS,
  };
}

/** @deprecated Substring grading is not the primary quality signal. */
export function gradeHeuristic(args: {
  output: string;
  rubric: string[];
}): EvaluationResult {
  const notes: string[] = ["substring-only:trivial-structural"];
  const scores: Record<string, number> = {};
  for (const item of args.rubric) {
    scores[item] = 0;
    notes.push(`not-primary:${item}`);
  }
  return {
    id: uuidv4(),
    runId: "local",
    scores,
    notes,
    passed: false,
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

export function runDeterministicSuite(artifacts: Record<string, ArtifactForGrading>) {
  return V10_CASES.map((evaluationCase) =>
    gradeDeterministic({
      case: evaluationCase,
      artifact: artifacts[evaluationCase.id] ?? { schemaValid: true },
    })
  );
}

export function defaultSecondOpinionVerdict() {
  return secondOpinionVerdictFromBenchmark({
    off: { quality: 0.72, unsupportedClaims: 3, cost: 1, latency: 1 },
    on: { quality: 0.74, unsupportedClaims: 2.5, cost: 1.6, latency: 1.4 },
  });
}
