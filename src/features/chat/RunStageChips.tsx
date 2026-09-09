"use client";

import type { WorkflowLastRun } from "@/domain/decision/types";

const ROLE_LABEL: Record<string, string> = {
  ANALYST: "Analyst",
  SECOND_OPINION: "2nd Opinion",
  CRITIC: "Critic",
  JUDGE: "Judge",
  VERIFY_TOOLS: "Tools",
};

function mark(status: string | undefined): string {
  if (status === "COMPLETED") return "✓";
  if (status === "FAILED") return "✗";
  if (status === "SKIPPED") return "–";
  return "○";
}

export function RunStageChips(props: {
  lastRun?: WorkflowLastRun;
  plannedStages?: string[];
  livePartials?: Array<{ role?: string; message?: string }>;
}) {
  const planned =
    props.lastRun?.plannedStages ?? props.plannedStages ?? [];
  if (planned.length === 0 && !(props.livePartials?.length)) return null;

  const byRole = new Map(
    (props.lastRun?.roles ?? []).map((r) => [r.role, r])
  );

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
        {planned.map((stage, idx) => {
          const role = byRole.get(stage);
          return (
            <span key={`${stage}-${idx}`} className="flex items-center gap-1.5">
              {idx > 0 ? (
                <span aria-hidden style={{ color: "var(--text-muted)" }}>
                  →
                </span>
              ) : null}
              <span
                className="rounded px-1.5 py-0.5 text-xs font-semibold"
                data-status={role?.status ?? "PLANNED"}
                style={{
                  color:
                    role?.status === "FAILED"
                      ? "var(--danger)"
                      : role?.status === "COMPLETED"
                        ? "var(--ok, #3dd68c)"
                        : "var(--text-muted)",
                  background:
                    "color-mix(in oklab, currentColor 14%, transparent)",
                }}
                title={role?.message ?? role?.provider}
              >
                {mark(role?.status)} {ROLE_LABEL[stage] ?? stage}
                {role?.provider ? ` · ${role.provider}` : ""}
              </span>
            </span>
          );
        })}
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
        .map((r) => (
          <p
            key={`fail-${r.role}`}
            className="mt-1 text-xs"
            style={{ color: "var(--warn)" }}
            data-testid="run-partial-note"
          >
            {r.role}: {r.message}
          </p>
        ))}
    </div>
  );
}
