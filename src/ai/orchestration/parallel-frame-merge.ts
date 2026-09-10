import { v4 as uuidv4 } from "uuid";
import type {
  Assumption,
  Constraint,
  DecisionSession,
  IndependentFrame,
  Option,
  Unknown,
} from "@/domain/decision/types";
import {
  synthesizeConflicts,
  summarizeParallelFraming,
} from "@/domain/decision/conflict-engine";
import { gateStatusTransition } from "@/domain/decision/state-machine";
import { countBlockingHighUnknowns } from "@/domain/decision/unknown-policy";

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Merge N independent blind frames into session state WITHOUT privileging
 * any single provider's prose as the sole problemFraming.
 */
export function applyParallelFrameState(args: {
  session: DecisionSession;
  frames: IndependentFrame[];
}): {
  patch: Partial<DecisionSession>;
  framing: NonNullable<DecisionSession["workflow"]>["framing"];
} {
  const { session, frames } = args;
  const conflictReport = synthesizeConflicts({ frames });
  const latestSummary = summarizeParallelFraming(frames, conflictReport);

  const assumptions: Assumption[] = [...session.assumptions];
  const unknowns: Unknown[] = [...session.unknowns];
  const constraints: Constraint[] = [...session.constraints];
  const options: Option[] = [...session.options];

  const seenA = new Set(assumptions.map((a) => norm(a.statement)));
  const seenU = new Set(unknowns.map((u) => norm(u.question)));
  const seenC = new Set(constraints.map((c) => norm(c.statement)));
  const seenO = new Set(options.map((o) => norm(o.title)));

  for (const frame of frames) {
    for (const a of frame.assumptions) {
      const key = norm(a.statement);
      if (!key || seenA.has(key)) continue;
      seenA.add(key);
      assumptions.push({
        id: uuidv4(),
        statement: a.statement,
        importance: a.importance,
        status: a.status,
        evidenceIds: [],
      });
    }
    for (const u of frame.unknowns) {
      const key = norm(u.question);
      if (!key || seenU.has(key)) continue;
      seenU.add(key);
      unknowns.push({
        id: uuidv4(),
        question: u.question,
        importance: u.importance,
        resolution: u.resolution === "RESOLVED" ? "OPEN" : u.resolution,
        evidenceIds: [],
      });
    }
    for (const c of frame.constraints) {
      const key = norm(c.statement);
      if (!key || seenC.has(key)) continue;
      seenC.add(key);
      constraints.push({
        id: uuidv4(),
        statement: c.statement,
        source: "AI",
        confirmedByUser: false,
      });
    }
    for (const o of frame.proposedOptions ?? []) {
      const key = norm(o.title);
      if (!key || seenO.has(key)) continue;
      seenO.add(key);
      options.push({
        id: uuidv4(),
        title: o.title,
        description: o.description,
        pros: o.pros,
        cons: o.cons,
        risks: o.risks,
        evidenceIds: [],
        status: "PROPOSED",
        proposedBy: "ANALYST",
      });
    }
  }

  const gated = gateStatusTransition(
    session.status,
    "VALIDATING",
    {
      problem: session.problem,
      objective: session.objective,
      optionCount: options.length,
      assumptionCount: assumptions.length,
      highPriorityOpenUnknowns: countBlockingHighUnknowns(unknowns),
      domainValidationErrors: [],
      userAskedGenerateOptions: false,
      contradictedAssumptionCount: assumptions.filter(
        (a) => a.status === "CONTRADICTED"
      ).length,
    },
    { origin: "AI_AGENT" }
  );

  const framing = {
    frames,
    conflictReport,
  };

  return {
    framing,
    patch: {
      assumptions,
      unknowns,
      constraints,
      options,
      latestSummary,
      status: gated.applied ? gated.status : session.status,
      workflow: {
        ...(session.workflow ?? {
          currentStage: "FRAME",
          state: "RUNNING",
          completedStages: [],
          routeMode: "DEEP",
          artifacts: {},
          blockers: [],
          usage: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
        }),
        framing,
      },
    },
  };
}
