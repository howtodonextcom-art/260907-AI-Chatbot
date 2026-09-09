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
    pipeline: "Theo giai đoạn: FRAME→OPTIONS→CRITIQUE→VERIFY→PREPARE",
    debate:
      "Gửi = 1 giai đoạn (StageController). OPTIONS: Analyst+DeepSeek · rồi CRITIQUE: Critic/Groq (không pause vì Unknown HIGH). PREPARE: Judge. DISCUSS/FRAME chỉ Analyst.",
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
