"use client";

import type { Message } from "@/domain/evidence/types";

const ROLE_COLOR: Record<string, string> = {
  USER: "var(--text)",
  ANALYST: "var(--analyst)",
  CRITIC: "var(--critic)",
  JUDGE: "var(--judge)",
  SECOND_OPINION: "var(--second-opinion)",
  SYSTEM: "var(--text-muted)",
  TOOL: "var(--text-muted)",
};

/** Neutral role chips — never prepend scripted phrases into model content. */
const ROLE_KICKER: Record<string, string> = {
  CRITIC: "Critic",
  SECOND_OPINION: "Second Opinion",
  ANALYST: "Analyst",
  JUDGE: "Judge",
};

export function MessageBubble({ message }: { message: Message }) {
  const label =
    message.role === "USER"
      ? "Bạn"
      : message.agentRole ?? message.role;
  const color =
    message.role === "USER"
      ? ROLE_COLOR.USER
      : ROLE_COLOR[message.agentRole ?? "ANALYST"];
  const kicker = message.agentRole
    ? ROLE_KICKER[message.agentRole]
    : undefined;

  return (
    <article
      className="lab-message-enter rounded-xl border px-3 py-2"
      style={{
        borderColor: "var(--border)",
        background:
          message.role === "USER" ? "transparent" : "var(--bg-panel)",
      }}
    >
      <div className="mb-1 flex items-center gap-2 text-xs">
        <span style={{ color }} className="font-semibold">
          {label}
        </span>
        {message.provider ? (
          <span style={{ color: "var(--text-muted)" }}>
            {message.provider}/{message.model}
          </span>
        ) : null}
        {kicker ? (
          <span
            className="lab-chip font-medium"
            data-testid="role-kicker"
            style={{ color }}
          >
            {kicker}
          </span>
        ) : null}
      </div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed">
        {message.content}
      </div>
    </article>
  );
}
