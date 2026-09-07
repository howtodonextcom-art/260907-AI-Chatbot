import type { DecisionRecord, DecisionSession } from "@/domain/decision/types";
import type { Blueprint } from "@/domain/blueprint/types";
import {
  BlueprintContentSchema,
  type BlueprintContent,
} from "@/domain/blueprint/schema";

const FILLER = [
  "primary decision maker",
  "implementation team",
  "core module",
  "working mvp increment",
  "implement selected decision",
];

export function validateBlueprintSemantics(args: {
  content: BlueprintContent;
  session: DecisionSession;
  decision: DecisionRecord;
}): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (args.decision.sessionId !== args.session.id) {
    errors.push("DecisionRecord does not belong to this session");
  }
  if (
    args.decision.selectedOptionId &&
    !args.session.options.some((o) => o.id === args.decision.selectedOptionId)
  ) {
    errors.push("selected option is not on the session");
  }
  const parsed = BlueprintContentSchema.safeParse(args.content);
  if (!parsed.success) {
    errors.push(...parsed.error.issues.map((i) => i.message));
  }
  if (!args.content.modules.length) errors.push("modules required");
  if (!args.content.acceptanceCriteria.length) {
    errors.push("acceptance criteria required");
  }
  if (!args.content.securityRequirements.length) {
    errors.push("security section required");
  }
  if (!args.content.testRequirements.length) {
    errors.push("testing section required");
  }
  if (!args.content.decisionReferences.includes(args.decision.id)) {
    errors.push("DecisionRecord reference missing");
  }
  const blob = JSON.stringify(args.content).toLowerCase();
  for (const filler of FILLER) {
    if (blob.includes(filler)) {
      errors.push(`Filler phrase not allowed: ${filler}`);
    }
  }
  const nonGoals = args.content.nonGoals.map((n) => n.toLowerCase());
  for (const s of args.content.scope) {
    if (nonGoals.some((n) => n && s.toLowerCase().includes(n))) {
      errors.push("scope contradicts an explicit non-goal");
      break;
    }
  }
  return { ok: errors.length === 0, errors };
}

export function blueprintToContent(blueprint: Blueprint): BlueprintContent {
  return {
    title: blueprint.title,
    projectGoal: blueprint.projectGoal,
    problem: blueprint.problem,
    targetUsers: blueprint.targetUsers,
    scope: blueprint.scope,
    nonGoals: blueprint.nonGoals,
    modules: blueprint.modules,
    architecture: blueprint.architecture,
    dataModel: blueprint.dataModel,
    apiContracts: blueprint.apiContracts,
    aiWorkflow: blueprint.aiWorkflow,
    securityRequirements: blueprint.securityRequirements,
    observabilityRequirements: blueprint.observabilityRequirements,
    testRequirements: blueprint.testRequirements,
    deploymentRequirements: blueprint.deploymentRequirements,
    acceptanceCriteria: blueprint.acceptanceCriteria,
    openRisks: blueprint.openRisks,
    decisionReferences: blueprint.decisionReferences,
    implementationOrder:
      blueprint.implementationOrder?.length
        ? blueprint.implementationOrder
        : blueprint.modules.map((m, i) => `${i + 1}. ${m.name}`),
  };
}
