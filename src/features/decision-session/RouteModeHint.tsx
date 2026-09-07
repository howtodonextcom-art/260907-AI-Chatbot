"use client";

import type { RouteMode } from "@/domain/decision/types";

const MODE_HINT: Record<
  RouteMode,
  { pipeline: string; debate: string }
> = {
  QUICK: {
    pipeline: "1 lần gọi (Groq)",
    debate: "Không tranh luận đa vai",
  },
  STANDARD: {
    pipeline: "Chỉ Analyst (Gemini)",
    debate: "Không Critic/Judge — chọn DEEP để tranh luận",
  },
  DEEP: {
    pipeline: "Analyst → Critic → Judge",
    debate: "Tranh luận đa vai (theo spec)",
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
          Intent <strong>Chuẩn bị quyết định</strong> cần Mode{" "}
          <strong>DEEP</strong> để có bản nháp Judge.
        </>
      ) : null}
      {judgeNeeded && props.routeMode === "DEEP" ? (
        <> Intent này sẽ chạy Judge để soạn Decision draft.</>
      ) : null}
    </p>
  );
}
