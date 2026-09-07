import type { ISODateTime } from "@/domain/decision/types";

export interface EvaluationCase {
  id: string;
  name: string;
  suite?: string;
  input: Record<string, unknown>;
  expected?: Record<string, unknown>;
  rubric: string[];
}

export interface EvaluationRun {
  id: string;
  caseId: string;
  configurationId: string;
  startedAt: ISODateTime;
  completedAt?: ISODateTime;
  costUsd?: number;
  latencyMs?: number;
}

export interface EvaluationResult {
  id: string;
  runId: string;
  scores: Record<string, number>;
  notes: string[];
  passed?: boolean;
}

export const BASELINE_CONFIGURATIONS = [
  { id: "A", name: "Single Groq" },
  { id: "B", name: "Single Gemini" },
  { id: "C", name: "Gemini Analyst + Groq Critic" },
  { id: "D", name: "Analyst + Critic + Judge" },
  { id: "E", name: "Analyst + optional SecondOpinion + Critic + Judge" },
] as const;
