export interface ConfidenceFactors {
  evidenceCoverage: number;
  sourceReliability: number;
  unresolvedUnknownPenalty: number;
  assumptionPenalty: number;
  agentAgreement: number;
  experimentStrength: number;
  knownFactsCoverage?: number;
}

export interface HeuristicConfidence {
  type: "HEURISTIC";
  label: "LOW" | "MEDIUM" | "HIGH";
  score: number;
  factors: {
    evidenceCoverage: number;
    sourceReliability: number;
    unresolvedUnknownPenalty: number;
    assumptionPenalty: number;
    agentAgreement: number;
    experimentStrength: number;
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function calculateHeuristicConfidence(
  factors: ConfidenceFactors
): HeuristicConfidence {
  const knownFacts = factors.knownFactsCoverage ?? factors.evidenceCoverage;
  const base =
    0.3 * factors.evidenceCoverage +
    0.2 * factors.sourceReliability +
    0.15 * factors.agentAgreement +
    0.2 * factors.experimentStrength +
    0.15 * knownFacts;

  const penalty =
    0.15 * factors.unresolvedUnknownPenalty +
    0.1 * factors.assumptionPenalty;

  const score = Math.round(clamp((base - penalty) * 100, 0, 100));
  const label: "LOW" | "MEDIUM" | "HIGH" =
    score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";

  return {
    type: "HEURISTIC",
    label,
    score,
    factors: {
      evidenceCoverage: factors.evidenceCoverage,
      sourceReliability: factors.sourceReliability,
      unresolvedUnknownPenalty: factors.unresolvedUnknownPenalty,
      assumptionPenalty: factors.assumptionPenalty,
      agentAgreement: factors.agentAgreement,
      experimentStrength: factors.experimentStrength,
    },
  };
}
