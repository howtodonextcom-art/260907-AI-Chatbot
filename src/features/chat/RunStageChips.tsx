"use client";

import type { WorkflowLastRun, WorkflowLastRunRole } from "@/domain/decision/types";

const ROLE_LABEL: Record<string, string> = {
  ANALYST: "Analyst",
  SECOND_OPINION: "2nd Opinion",
  CRITIC: "Critic",
  JUDGE: "Judge",
  VERIFY_TOOLS: "Tools",
  PARALLEL_FRAME: "Parallel Frame",
};

function mark(status: string | undefined): string {
  if (status === "COMPLETED") return "✓";
  if (status === "FAILED") return "✗";
  if (status === "SKIPPED") return "–";
  return "○";
}

function chipEntries(props: {
  lastRun?: WorkflowLastRun;
  plannedStages?: string[];
}): Array<{ key: string; label: string; role?: WorkflowLastRunRole }> {
  const planned =
    props.lastRun?.plannedStages ?? props.plannedStages ?? [];
  const roles = props.lastRun?.roles ?? [];

  // Parallel Blind Framing plans one stage but records N provider roles.
  if (planned.includes("PARALLEL_FRAME") && roles.length > 0) {
    return roles.map((role, idx) => ({
      key: `pf-${role.provider ?? role.role}-${idx}`,
      label: `Framer`,
      role,
    }));
  }

  const byRole = new Map(roles.map((r) => [r.role, r]));
  return planned.map((stage, idx) => ({
    key: `${stage}-${idx}`,
    label: ROLE_LABEL[stage] ?? stage,
    role: byRole.get(stage),
  }));
}

export function RunStageChips(props: {
  lastRun?: WorkflowLastRun;
  plannedStages?: string[];
  livePartials?: Array<{ role?: string; message?: string }>;
}) {
  const planned =
    props.lastRun?.plannedStages ?? props.plannedStages ?? [];
  if (planned.length === 0 && !(props.livePartials?.length)) return null;

  const entries = chipEntries(props);

  return (
    <div
      className="mb-3 rounded-lg border px-3 py-2"
      style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
      data-testid="run-stage-chips"
    >
      <div className="mb-1 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
        Lượt này
        {props.lastRun?.stage ? ` · ${props.lastRun.stage}` : ""}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {entries.map((entry, idx) => (
          <span key={entry.key} className="flex items-center gap-1.5">
            {idx > 0 ? (
              <span aria-hidden style={{ color: "var(--text-muted)" }}>
                →
              </span>
            ) : null}
            <span
              className="lab-chip"
              data-status={entry.role?.status ?? "PLANNED"}
              style={{
                color:
                  entry.role?.status === "FAILED"
                    ? "var(--danger-text)"
                    : entry.role?.status === "COMPLETED"
                      ? "var(--ok, #3dd68c)"
                      : "var(--text-muted)",
              }}
              title={entry.role?.message ?? entry.role?.provider}
            >
              {mark(entry.role?.status)} {entry.label}
              {entry.role?.provider ? ` · ${entry.role.provider}` : ""}
            </span>
          </span>
        ))}
      </div>
      {(props.livePartials ?? [])
        .filter((p) => p.message)
        .map((p, i) => (
          <p
            key={`partial-${i}`}
            className="mt-1 text-xs"
            style={{ color: "var(--warn)" }}
            data-testid="run-partial-note"
          >
            {p.role ? `${p.role}: ` : ""}
            {p.message}
          </p>
        ))}
      {(props.lastRun?.roles ?? [])
        .filter((r) => r.status === "FAILED" && r.message)
        .map((r, i) => (
          <p
            key={`fail-${r.role}-${r.provider ?? i}`}
            className="mt-1 text-xs"
            style={{ color: "var(--warn)" }}
            data-testid="run-partial-note"
          >
            {r.role}
            {r.provider ? `/${r.provider}` : ""}: {r.message}
          </p>
        ))}
    </div>
  );
}
