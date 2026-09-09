import type {
  DebateNotes,
  WorkflowLastRunRole,
  WorkflowMetadata,
} from "@/domain/decision/types";

export function emptyDebateNotes(): DebateNotes {
  return {
    criticisms: [],
    unsupportedAssumptions: [],
    missingEvidence: [],
    divergentRisks: [],
  };
}

function uniq(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

export function mergeDebateNotes(
  base: DebateNotes | undefined,
  patch: Partial<DebateNotes>
): DebateNotes {
  const current = base ?? emptyDebateNotes();
  return {
    criticisms: uniq([
      ...(current.criticisms ?? []),
      ...(patch.criticisms ?? []),
    ]),
    unsupportedAssumptions: uniq([
      ...(current.unsupportedAssumptions ?? []),
      ...(patch.unsupportedAssumptions ?? []),
    ]),
    missingEvidence: uniq([
      ...(current.missingEvidence ?? []),
      ...(patch.missingEvidence ?? []),
    ]),
    divergentRisks: uniq([
      ...(current.divergentRisks ?? []),
      ...(patch.divergentRisks ?? []),
    ]),
    soRecommendedDirection:
      patch.soRecommendedDirection ?? current.soRecommendedDirection,
    soPreferredOptionTitle:
      patch.soPreferredOptionTitle ?? current.soPreferredOptionTitle,
    updatedAt: patch.updatedAt ?? current.updatedAt ?? new Date().toISOString(),
  };
}

export function debateNotesHasContent(notes: DebateNotes | undefined): boolean {
  if (!notes) return false;
  return (
    notes.criticisms.length > 0 ||
    notes.unsupportedAssumptions.length > 0 ||
    notes.missingEvidence.length > 0 ||
    notes.divergentRisks.length > 0 ||
    Boolean(notes.soRecommendedDirection) ||
    Boolean(notes.soPreferredOptionTitle)
  );
}

export function recordLastRunRole(
  roles: WorkflowLastRunRole[],
  entry: WorkflowLastRunRole
): WorkflowLastRunRole[] {
  const next = roles.filter((r) => r.role !== entry.role);
  next.push(entry);
  return next;
}

/** OPTIONS artifact (or debateNotes) already has a completed independent SO. */
export function hasSecondOpinionContribution(
  workflow: WorkflowMetadata | undefined
): boolean {
  if (!workflow) return false;
  if (
    workflow.artifacts.OPTIONS?.status === "CURRENT" &&
    workflow.artifacts.OPTIONS.contributions?.secondOpinion
  ) {
    return true;
  }
  const notes = workflow.debateNotes;
  return Boolean(
    notes?.soRecommendedDirection?.trim() || notes?.soPreferredOptionTitle?.trim()
  );
}
