import { z } from "zod";

export const BlueprintModuleSchema = z.object({
  name: z.string().min(1),
  jobToBeDone: z.string().min(1),
  inputs: z.array(z.string()).min(1),
  outputs: z.array(z.string()).min(1),
  dependencies: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()).min(1),
  purpose: z.string().optional(),
  businessRules: z.array(z.string()).optional(),
  edgeCases: z.array(z.string()).optional(),
  testsRequired: z.array(z.string()).optional(),
});

export const BlueprintEntitySchema = z.object({
  name: z.string().min(1),
  purpose: z.string().min(1),
  fields: z.array(z.string()).min(1),
  ownership: z.string().optional(),
});

export const BlueprintApiContractSchema = z.object({
  method: z.string().min(1),
  path: z.string().min(1),
  purpose: z.string().min(1),
  authentication: z.string().optional(),
});

export const BlueprintContentSchema = z.object({
  title: z.string().min(1),
  projectGoal: z.string().min(1),
  problem: z.string().min(1),
  targetUsers: z.array(z.string()).min(1),
  scope: z.array(z.string()).min(1),
  nonGoals: z.array(z.string()).min(1),
  modules: z.array(BlueprintModuleSchema).min(1),
  architecture: z.object({
    summary: z.string().min(1),
    mermaid: z.string().optional(),
  }),
  dataModel: z.array(z.union([z.string(), BlueprintEntitySchema])).min(1),
  apiContracts: z.array(BlueprintApiContractSchema).min(1),
  aiWorkflow: z.array(z.string()).min(1),
  securityRequirements: z.array(z.string()).min(1),
  observabilityRequirements: z.array(z.string()).min(1),
  testRequirements: z.array(z.string()).min(1),
  deploymentRequirements: z.array(z.string()).min(1),
  acceptanceCriteria: z.array(z.string()).min(1),
  openRisks: z.array(z.string()),
  decisionReferences: z.array(z.string()).min(1),
  implementationOrder: z.array(z.string()).min(1),
});

export const BlueprintGenerationInputSchema = z.object({
  sessionTitle: z.string(),
  problem: z.string(),
  objective: z.string().optional(),
  selectedOptionTitle: z.string().optional(),
  selectedOptionDescription: z.string().optional(),
  constraints: z.array(z.string()),
  acceptedAssumptions: z.array(z.string()),
  openRisks: z.array(z.string()),
  evidenceClaims: z.array(z.string()),
  domainPackId: z.string().optional(),
  decisionId: z.string(),
  rationale: z.array(z.string()),
});

export type BlueprintContent = z.infer<typeof BlueprintContentSchema>;
export type BlueprintGenerationInput = z.infer<
  typeof BlueprintGenerationInputSchema
>;
