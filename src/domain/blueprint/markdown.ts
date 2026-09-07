import type { Blueprint } from "@/domain/blueprint/types";
import { blueprintToContent } from "@/domain/blueprint/validator";

export function blueprintToMarkdown(blueprint: Blueprint): string {
  const c = blueprintToContent(blueprint);
  const lines: string[] = [
    `# ${c.title}`,
    "",
    `Source DecisionRecord: \`${c.decisionReferences[0] ?? blueprint.sourceDecisionRecordId}\``,
    `Status: ${blueprint.status}`,
    "",
    "## Project Goal",
    c.projectGoal,
    "",
    "## Problem",
    c.problem,
    "",
    "## Target Users",
    ...c.targetUsers.map((u) => `- ${u}`),
    "",
    "## Scope",
    ...c.scope.map((s) => `- ${s}`),
    "",
    "## Non-goals",
    ...c.nonGoals.map((s) => `- ${s}`),
    "",
    "## Architecture",
    c.architecture.summary,
    "",
    "## Modules",
  ];
  for (const m of c.modules) {
    lines.push(
      `### ${m.name}`,
      `Job: ${m.jobToBeDone}`,
      `Inputs: ${m.inputs.join(", ")}`,
      `Outputs: ${m.outputs.join(", ")}`,
      `Dependencies: ${m.dependencies.join(", ") || "none"}`,
      "Acceptance:",
      ...m.acceptanceCriteria.map((a) => `- ${a}`),
      ""
    );
  }
  lines.push("## Data Model");
  for (const entity of c.dataModel) {
    if (typeof entity === "string") lines.push(`- ${entity}`);
    else {
      lines.push(`- **${entity.name}**: ${entity.purpose}`);
      lines.push(`  Fields: ${entity.fields.join(", ")}`);
    }
  }
  lines.push("", "## API Contracts");
  for (const api of c.apiContracts) {
    lines.push(`- \`${api.method} ${api.path}\` — ${api.purpose}`);
  }
  lines.push(
    "",
    "## AI Workflow",
    ...c.aiWorkflow.map((s) => `- ${s}`),
    "",
    "## Security",
    ...c.securityRequirements.map((s) => `- ${s}`),
    "",
    "## Observability",
    ...c.observabilityRequirements.map((s) => `- ${s}`),
    "",
    "## Testing",
    ...c.testRequirements.map((s) => `- ${s}`),
    "",
    "## Deployment",
    ...c.deploymentRequirements.map((s) => `- ${s}`),
    "",
    "## Acceptance Criteria",
    ...c.acceptanceCriteria.map((s) => `- ${s}`),
    "",
    "## Open Risks",
    ...(c.openRisks.length ? c.openRisks.map((s) => `- ${s}`) : ["- None recorded"]),
    "",
    "## Implementation Order",
    ...c.implementationOrder.map((s) => `- ${s}`),
    "",
    "## Decision References",
    ...c.decisionReferences.map((s) => `- ${s}`),
    ""
  );
  return lines.join("\n");
}
