import type { EvaluationCase, EvaluationResult } from "@/evaluation/types";
import { v4 as uuidv4 } from "uuid";

export interface ArtifactForGrading {
  schemaValid?: boolean;
  verificationStatus?: string;
  createdBy?: string;
  decision?: string;
  containsFiller?: boolean;
  hasImplementationOrder?: boolean;
  agentAgreementMethod?: string;
  stopReason?: string;
  cancelled?: boolean;
  policyViolations?: string[];
  unsupportedClaimCount?: number;
  domainCheckPassed?: boolean;
  secondOpinionRan?: boolean;
  providerCalls?: number;
}

/**
 * Primary graders are deterministic. Substring matching is only a labeled
 * trivial structural signal and never the pass/fail source.
 */
export function gradeDeterministic(args: {
  case: EvaluationCase;
  artifact: ArtifactForGrading;
}): EvaluationResult {
  const notes: string[] = [];
  const scores: Record<string, number> = {};

  const expect = args.case.expected ?? {};
  for (const item of args.case.rubric) {
    let pass = false;
    switch (item) {
      case "schema":
        pass = args.artifact.schemaValid !== false;
        break;
      case "evidence-discipline":
        pass =
          args.artifact.verificationStatus !== "VERIFIED" ||
          args.artifact.createdBy === "TOOL" ||
          args.artifact.createdBy === "SYSTEM";
        break;
      case "verify-tool":
        pass =
          args.artifact.verificationStatus === "VERIFIED" &&
          args.artifact.createdBy === "TOOL";
        break;
      case "policy":
      case "domain-check":
        pass =
          (args.artifact.policyViolations?.length ?? 0) === 0 &&
          args.artifact.domainCheckPassed !== false;
        break;
      case "blueprint":
        pass =
          args.artifact.hasImplementationOrder === true &&
          args.artifact.containsFiller !== true;
        break;
      case "agreement-method":
        pass =
          args.artifact.agentAgreementMethod === "UNAVAILABLE" ||
          args.artifact.agentAgreementMethod === "JUDGE_HEURISTIC";
        break;
      case "budget":
        pass =
          (expect.stopReason
            ? args.artifact.stopReason === expect.stopReason
            : true) && (args.artifact.providerCalls ?? 0) >= 0;
        break;
      case "cancellation":
        pass = args.artifact.cancelled === true;
        break;
      case "experiment":
        pass =
          args.artifact.decision === "EXPERIMENT_FIRST" ||
          expect.nextAction === "EXPERIMENT";
        break;
      case "human-gate":
        pass = expect.nextAction === "HUMAN";
        break;
      case "no-fake-success":
        pass = args.artifact.schemaValid !== true || args.artifact.decision !== "ACCEPT";
        break;
      case "unsupported-claims":
        pass = (args.artifact.unsupportedClaimCount ?? 0) >= 0;
        break;
      default:
        pass = true;
        notes.push(`trivial-structural:${item}`);
    }
    scores[item] = pass ? 1 : 0;
    notes.push(pass ? `PASS ${item}` : `FAIL ${item}`);
  }

  const avg =
    Object.values(scores).reduce((a, b) => a + b, 0) /
    Math.max(1, Object.values(scores).length);
  return {
    id: uuidv4(),
    runId: "deterministic",
    scores,
    notes,
    passed: avg >= 0.99,
  };
}

export type SecondOpinionVerdict =
  | "KEEP_DEFAULT"
  | "KEEP_CONDITIONAL"
  | "EXPERIMENTAL_ONLY"
  | "REMOVE";

/** Live provider proof is not in CI. Default remains conditional. */
export function secondOpinionVerdictFromBenchmark(args: {
  on: { quality: number; unsupportedClaims: number; cost: number; latency: number };
  off: { quality: number; unsupportedClaims: number; cost: number; latency: number };
}): SecondOpinionVerdict {
  const qualityDelta = args.on.quality - args.off.quality;
  const costDelta = args.on.cost - args.off.cost;
  if (qualityDelta > 0.08 && costDelta < args.off.cost * 0.8) {
    return "KEEP_DEFAULT";
  }
  if (qualityDelta < -0.05) return "EXPERIMENTAL_ONLY";
  return "KEEP_CONDITIONAL";
}
