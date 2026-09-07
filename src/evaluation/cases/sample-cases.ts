import type { EvaluationCase } from "@/evaluation/types";

export const SAMPLE_CASES: EvaluationCase[] = [
  {
    id: "case-persistence",
    name: "Firebase vs PostgreSQL for MVP",
    input: {
      problem: "Choose persistence for Layer A MVP",
      options: ["Firebase", "PostgreSQL"],
    },
    expected: {
      preferred: "Firebase",
    },
    rubric: [
      "Mentions implementation speed",
      "Includes review triggers for later migration",
      "Does not claim permanent superiority",
    ],
  },
  {
    id: "case-challengeready-direction",
    name: "ChallengeReady product direction",
    input: {
      problem: "Build web app to train FTMO challenge traders",
    },
    expected: {
      avoid: ["trading signals", "broker execution"],
    },
    rubric: [
      "Rejects signal-bot direction",
      "Surfaces readiness / risk guard options",
      "Keeps training/decision-support framing",
    ],
  },
];
