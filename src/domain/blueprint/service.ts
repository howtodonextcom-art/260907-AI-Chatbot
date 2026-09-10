import type { DecisionRecord, DecisionSession } from "@/domain/decision/types";
import type { EvidenceItem } from "@/domain/evidence/types";
import type { Blueprint } from "@/domain/blueprint/types";
import type { BlueprintContent } from "@/domain/blueprint/schema";
import { BlueprintContentSchema } from "@/domain/blueprint/schema";
import { validateBlueprintSemantics } from "@/domain/blueprint/validator";

function entityNameFromTitle(title: string): string {
  const cleaned = title.replace(/[^a-zA-Z0-9\s]/g, " ").trim();
  const parts = cleaned.split(/\s+/).slice(0, 3);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("") || "Workspace";
}

export function deriveBlueprintContent(args: {
  session: DecisionSession;
  decision: DecisionRecord;
  evidence: EvidenceItem[];
}): BlueprintContent {
  const selected = args.session.options.find(
    (o) => o.id === args.decision.selectedOptionId
  );
  const accepted = args.session.assumptions.filter((a) =>
    args.decision.acceptedAssumptionIds.includes(a.id)
  );
  const verified = args.evidence.filter((e) => e.verificationStatus === "VERIFIED");
  const entity = entityNameFromTitle(selected?.title ?? args.session.title);
  const users = args.session.objective
    ? [`Operator responsible for: ${args.session.objective}`]
    : [`Owner of workspace "${args.session.title}"`];

  const nonGoals = [
    ...args.decision.rejectedOptions.map(
      (r) => `Do not implement rejected option ${r.optionId}: ${r.reasons[0] ?? "rejected"}`
    ),
    "Do not expand beyond the approved DecisionRecord",
  ];

  const content: BlueprintContent = {
    title: `${args.session.title} — implementation blueprint`,
    projectGoal: args.session.objective ?? selected?.title ?? args.session.title,
    problem: args.session.problem,
    targetUsers: users,
    scope: selected
      ? [selected.title, selected.description, ...args.session.constraints.map((c) => c.statement)]
      : [args.session.problem, ...args.decision.rationale.slice(0, 3)],
    nonGoals,
    modules: [
      {
        name: selected?.title ?? args.session.title,
        jobToBeDone: selected?.description ?? args.session.problem,
        purpose: selected?.description ?? args.session.objective,
        inputs: [
          `Approved DecisionRecord ${args.decision.id}`,
          ...verified.map((e) => e.claim).slice(0, 5),
        ].filter(Boolean) as string[],
        outputs: ["Shipped increment matching selected option", "Auditable DecisionRecord trail"],
        dependencies: args.session.constraints.map((c) => c.statement),
        acceptanceCriteria: [
          ...args.decision.rationale.slice(0, 3),
          "Respect listed non-goals",
        ],
        businessRules: accepted.map((a) => a.statement),
        edgeCases: selected?.risks ?? args.decision.tradeoffs,
        testsRequired: ["State-machine transitions", "Owner-scoped API access"],
      },
    ],
    architecture: {
      summary: selected
        ? `${selected.title}: ${selected.description}`
        : args.decision.rationale[0] ?? args.session.problem,
    },
    dataModel: [
      {
        name: entity,
        purpose: `Persist artifacts for ${args.session.title}`,
        fields: ["id", "ownerId", "status", "createdAt", "updatedAt"],
        ownership: "session owner",
      },
    ],
    // NOTE: apiContracts/aiWorkflow/security/observability/test/deployment
    // below describe the TARGET PRODUCT being decided about (e.g. the
    // approved option's own API, its own AI usage if any) — never Layer A's
    // own routes (/api/sessions/...) or Layer A's own Analyst/Critic/Judge
    // pipeline. Layer A genuinely does not know the target product's real
    // API design or deployment platform, so these are honest, decision-
    // derived placeholders to refine during implementation, not a
    // description of this decision tool (H6 fix).
    apiContracts: [
      {
        method: "POST",
        path: `/api/${entity.toLowerCase()}`,
        purpose: `Create a ${entity} record within the approved scope: ${selected?.title ?? args.session.title}`,
        authentication: "Define for the target product's own auth model",
      },
      {
        method: "GET",
        path: `/api/${entity.toLowerCase()}`,
        purpose: `List ${entity} records owned by the current user`,
        authentication: "Define for the target product's own auth model",
      },
    ],
    aiWorkflow: selected?.description
      ? [
          `Any AI/automation in this product must stay within the approved scope: ${selected.description}`,
          "Do not add AI features beyond what the approved option specifies without a new decision.",
        ]
      : [
          "The approved option does not specify AI/automation — do not add any without a new decision.",
        ],
    securityRequirements: [
      `Owner-scoped access control for every ${entity} record`,
      ...args.session.constraints.map((c) => `Enforce constraint: ${c.statement}`),
      `Never implement a rejected option: ${
        args.decision.rejectedOptions.map((r) => r.optionId).join(", ") || "n/a"
      }`,
    ],
    observabilityRequirements: [
      `Log ${entity} lifecycle events (created/updated/completed)`,
      "Track real usage against the acceptance criteria below",
    ],
    testRequirements: [
      `Unit: ${entity} business rules and edge cases listed above`,
      "Integration: the API contracts above",
      "E2E: the primary user journey for the approved option",
    ],
    deploymentRequirements: [
      "Deployment platform is not determined by this decision — choose based on the target product's own constraints.",
      ...(selected?.risks.length
        ? [`Mitigate before deploy: ${selected.risks.join("; ")}`]
        : []),
    ],
    acceptanceCriteria: [
      `Implements selected option: ${selected?.title ?? "as recorded"}`,
      "Does not implement rejected options",
      "Keeps evidence provenance and verification separate",
    ],
    openRisks: args.decision.tradeoffs.length
      ? args.decision.tradeoffs
      : args.session.unknowns
          .filter((u) => u.resolution !== "RESOLVED")
          .map((u) => u.question),
    decisionReferences: [args.decision.id, ...args.decision.rationale.slice(0, 3)],
    implementationOrder: [
      `Confirm scope: ${selected?.title ?? args.session.title}`,
      `Build the ${entity} data model and API contracts above`,
      "Add tests for the business rules and edge cases listed above",
      "Ship the primary user journey behind the acceptance criteria above",
    ],
  };

  const parsed = BlueprintContentSchema.safeParse(content);
  if (!parsed.success) {
    throw new Error(
      `Derived blueprint failed schema: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const semantic = validateBlueprintSemantics({
    content: parsed.data,
    session: args.session,
    decision: args.decision,
  });
  if (!semantic.ok) {
    throw new Error(semantic.errors.join("; "));
  }
  return parsed.data;
}

export function contentToBlueprintFields(
  content: BlueprintContent
): Pick<
  Blueprint,
  | "title"
  | "projectGoal"
  | "problem"
  | "targetUsers"
  | "scope"
  | "nonGoals"
  | "modules"
  | "architecture"
  | "dataModel"
  | "apiContracts"
  | "aiWorkflow"
  | "securityRequirements"
  | "observabilityRequirements"
  | "testRequirements"
  | "deploymentRequirements"
  | "acceptanceCriteria"
  | "openRisks"
  | "decisionReferences"
  | "implementationOrder"
> {
  return {
    title: content.title,
    projectGoal: content.projectGoal,
    problem: content.problem,
    targetUsers: content.targetUsers,
    scope: content.scope,
    nonGoals: content.nonGoals,
    modules: content.modules.map((m) => ({
      name: m.name,
      jobToBeDone: m.jobToBeDone,
      inputs: m.inputs,
      outputs: m.outputs,
      dependencies: m.dependencies,
      acceptanceCriteria: m.acceptanceCriteria,
    })),
    architecture: content.architecture,
    dataModel: content.dataModel.map((d) =>
      typeof d === "string" ? d : d.name
    ),
    apiContracts: content.apiContracts.map((a) => ({
      method: a.method,
      path: a.path,
      purpose: a.purpose,
    })),
    aiWorkflow: content.aiWorkflow,
    securityRequirements: content.securityRequirements,
    observabilityRequirements: content.observabilityRequirements,
    testRequirements: content.testRequirements,
    deploymentRequirements: content.deploymentRequirements,
    acceptanceCriteria: content.acceptanceCriteria,
    openRisks: content.openRisks,
    decisionReferences: content.decisionReferences,
    implementationOrder: content.implementationOrder,
  };
}
