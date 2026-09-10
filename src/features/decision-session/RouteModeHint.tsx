"use client";

/** DEEP is the only mode (v18 — see CLAUDE.md [[deep-only]]) — fixed copy, no per-mode lookup needed. */
export function RouteModeHint(props: { intent: string }) {
  const judgeNeeded = props.intent === "PREPARE_DECISION";

  return (
    <p
      className="w-full text-xs leading-snug"
      style={{ color: "var(--text-muted)" }}
      data-testid="route-mode-hint"
    >
      <span style={{ color: "var(--text)" }}>DEEP:</span> FRAME (parallel
      gemini∥deepseek∥groq) → VERIFY → OPTIONS → CRITIQUE → PREPARE. Parallel
      Blind Framing lúc đầu. HIGH Unknown không chặn pipeline (chỉ chặn DUYỆT
      quyết định) — Judge vẫn ra JudgeDraft. VERIFY trước CRITIQUE. DECIDED
      chỉ Human Approve.
      {judgeNeeded ? (
        <> Intent này sẽ chạy Judge để soạn Decision draft.</>
      ) : null}
    </p>
  );
}
