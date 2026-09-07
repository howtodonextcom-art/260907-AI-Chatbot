import type { DecisionRecord, DecisionSession } from "@/domain/decision/types";
import type { EvidenceItem } from "@/domain/evidence/types";
import type { Blueprint } from "@/domain/blueprint/types";
import type { BlueprintContent } from "@/domain/blueprint/schema";
import { BlueprintContentSchema } from "@/domain/blueprint/schema";
import { validateBlueprintSemantics } from "@/domain/blueprint/validator";
import { getDomainPack } from "@/domain-packs/registry";

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
  const pack = getDomainPack(args.session.domainPackId);
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
    apiContracts: [
      {
        method: "POST",
        path: `/api/sessions/${args.session.id}/run`,
        purpose: "Run bounded decision orchestration for this session",
        authentication: "Bearer Firebase ID token",
      },
      {
        method: "POST",
        path: `/api/sessions/${args.session.id}/decision`,
        purpose: "Explicit human approval creating an immutable DecisionRecord",
        authentication: "Bearer Firebase ID token",
      },
    ],
    aiWorkflow: [
      `Domain pack: ${pack.id}`,
      "Analyst frames problem (FRAME/OPTIONS)",
      "Critic only on CRITIQUE / PREPARE_DECISION",
      "VERIFY uses allowlisted tools, never LLM-as-fact",
      "Judge draft → human approve → DecisionRecord → Blueprint DRAFT",
    ],
    securityRequirements: [
      "Owner-scoped authorization on every session route",
      "DECIDED only via approveDecision after HardPolicyGate",
      "Provider API keys remain server-side",
      "User evidence cannot self-upgrade verificationStatus",
    ],
    observabilityRequirements: [
      "Persist AgentRun provider/model/tokens/cost/latency",
      "Log executionPlan planned vs actual provider calls",
      "Emit tool.started / tool.completed for VERIFY",
    ],
    testRequirements: [
      "Unit: state gate, evidence trust, stop conditions, VERIFY calculator",
      "Integration: decision approval idempotency",
      "E2E: workspace → session → decision loop with test doubles",
    ],
    deploymentRequirements: [
      "Vercel (Next.js App Router)",
      "Firebase Auth + Firestore",
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
      "Lock DecisionRecord invariants and owner scoping",
      `Build ${selected?.title ?? args.session.title}`,
      "Add tests for critical paths listed above",
      "Deploy with production MemoryStore forbidden",
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
