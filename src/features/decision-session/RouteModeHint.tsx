"use client";

import type { RouteMode } from "@/domain/decision/types";

const MODE_HINT: Record<
  RouteMode,
  { pipeline: string; debate: string }
> = {
  QUICK: {
    pipeline: "1 lần gọi nhẹ",
    debate: "Không chạy đủ quy trình quyết định",
  },
  STANDARD: {
    pipeline: "Quy trình đầy đủ (Analyst theo giai đoạn)",
    debate: "Không Critic/SecondOpinion/Judge — chọn DEEP để đa góc nhìn",
  },
  DEEP: {
    pipeline: "FRAME (parallel gemini∥deepseek∥groq) → VERIFY → OPTIONS → CRITIQUE → PREPARE",
    debate:
      "Parallel Blind Framing lúc đầu. HIGH Unknown không chặn pipeline (chỉ chặn DUYỆT quyết định) — Judge vẫn ra JudgeDraft. VERIFY trước CRITIQUE. DECIDED chỉ Human Approve.",
  },
};

export function RouteModeHint(props: {
  routeMode: RouteMode;
  intent: string;
}) {
  const hint = MODE_HINT[props.routeMode];
  const judgeNeeded = props.intent === "PREPARE_DECISION";

  return (
    <p
      className="w-full text-xs leading-snug"
      style={{ color: "var(--text-muted)" }}
      data-testid="route-mode-hint"
    >
      <span style={{ color: "var(--text)" }}>{props.routeMode}:</span>{" "}
      {hint.pipeline}. {hint.debate}.
      {judgeNeeded && props.routeMode !== "DEEP" ? (
        <>
          {" "}
          Intent nâng cao <strong>Chuẩn bị quyết định</strong> cần Mode{" "}
          <strong>DEEP</strong> để có bản nháp Judge.
        </>
      ) : null}
      {judgeNeeded && props.routeMode === "DEEP" ? (
        <> Intent này sẽ chạy Judge để soạn Decision draft.</>
      ) : null}
    </p>
  );
}
