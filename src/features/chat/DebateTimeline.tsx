"use client";

import type { Message } from "@/domain/evidence/types";
import type { AgentRole } from "@/domain/decision/types";

const ROLE_LABEL: Record<AgentRole, string> = {
  ANALYST: "Analyst",
  CRITIC: "Critic",
  JUDGE: "Judge",
  SECOND_OPINION: "2nd Opinion",
};

const ROLE_COLOR: Record<AgentRole, string> = {
  ANALYST: "var(--analyst)",
  CRITIC: "var(--critic)",
  JUDGE: "var(--judge)",
  SECOND_OPINION: "var(--second-opinion)",
};

/** Last debate round: agent roles after the most recent USER message. */
export function extractLastDebateRoles(messages: Message[]): AgentRole[] {
  let lastUser = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "USER") {
      lastUser = i;
      break;
    }
  }
  const roles: AgentRole[] = [];
  for (let i = lastUser + 1; i < messages.length; i += 1) {
    const role = messages[i]?.agentRole;
    if (role) roles.push(role);
  }
  return roles;
}

export function DebateTimeline(props: {
  messages: Message[];
  activeRole?: string | null;
}) {
  const roles = extractLastDebateRoles(props.messages);
  const showActive =
    props.activeRole === "ANALYST" ||
    props.activeRole === "CRITIC" ||
    props.activeRole === "JUDGE" ||
    props.activeRole === "SECOND_OPINION"
      ? (props.activeRole as AgentRole)
      : null;

  if (roles.length === 0 && !showActive) {
    return (
      <div
        className="mb-3 rounded-lg border px-3 py-2 text-xs"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        data-testid="debate-timeline-empty"
      >
        Timeline tranh luận: mỗi bước một vai. OPTIONS mới có DeepSeek;
        CRITIQUE mới có Critic (Groq); PREPARE mới có Judge. Dùng{" "}
        <strong>Bắt đầu phân tích</strong> để chạy hết quy trình.
      </div>
    );
  }

  const display = [...roles];
  if (showActive && display[display.length - 1] !== showActive) {
    display.push(showActive);
  }

  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg border px-3 py-2"
      style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
      data-testid="debate-timeline"
      aria-label="Timeline tranh luận"
    >
      <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
        Vòng tranh luận
      </span>
      {display.map((role, idx) => (
        <span key={`${role}-${idx}`} className="flex items-center gap-1.5">
          {idx > 0 ? (
            <span aria-hidden style={{ color: "var(--text-muted)" }}>
              →
            </span>
          ) : null}
          <span
            className="lab-chip"
            style={{
              color: ROLE_COLOR[role],
              outline:
                showActive === role && idx === display.length - 1
                  ? `1px solid ${ROLE_COLOR[role]}`
                  : undefined,
            }}
          >
            {ROLE_LABEL[role]}
            {showActive === role && idx === display.length - 1 ? "…" : ""}
          </span>
        </span>
      ))}
    </div>
  );
}
