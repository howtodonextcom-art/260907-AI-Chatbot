"use client";

import type { RouteMode } from "@/domain/decision/types";

const FOOTER_BY_MODE: Record<RouteMode, string> = {
  QUICK: "QUICK: một lần gọi · không Critic/Judge",
  STANDARD: "STANDARD: chỉ Analyst · chọn DEEP để tranh luận",
  DEEP: "DEEP: gọi model theo intent — không chạy đủ hội đồng mỗi bước",
};

export function Composer(props: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  running: boolean;
  routeMode?: RouteMode;
  onAutoRun?: () => void;
  autoRunning?: boolean;
  autoStepLabel?: string | null;
}) {
  const modeHint = props.routeMode
    ? FOOTER_BY_MODE[props.routeMode]
    : null;
  const busy = props.running || Boolean(props.autoRunning);

  return (
    <div
      className="border-t p-3"
      style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}
    >
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <label className="sr-only" htmlFor="decision-composer">
          Viết yêu cầu quyết định
        </label>
        <textarea
          id="decision-composer"
          data-testid="composer"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          rows={2}
          placeholder="Viết yêu cầu quyết định…"
          className="lab-input min-h-[56px] flex-1 resize-none px-3 py-2"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void props.onSend();
            }
          }}
        />
        {busy ? (
          <button
            type="button"
            onClick={props.onStop}
            className="lab-btn min-h-[56px] border px-4 text-sm"
            style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
          >
            Dừng
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void props.onSend()}
              className="lab-btn lab-btn-primary min-h-[56px] px-4 text-sm"
              data-testid="send-message"
            >
              Gửi
            </button>
            {props.onAutoRun ? (
              <button
                type="button"
                onClick={props.onAutoRun}
                className="lab-btn min-h-[56px] px-3 text-sm"
                data-testid="auto-workflow"
                title="Tự động: FRAME→Analyst, OPTIONS→Analyst, CRITIQUE→Critic, VERIFY→tools (~4–7 gọi, không 16)"
              >
                ▶ Tự động 4 bước
              </button>
            ) : null}
          </>
        )}
      </div>
      <p
        className="mx-auto mt-1.5 max-w-3xl text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        {props.autoRunning && props.autoStepLabel
          ? `Đang tự động chạy: ${props.autoStepLabel} — bấm Dừng để huỷ.`
          : `Enter để gửi · Shift+Enter xuống dòng${modeHint ? ` · ${modeHint}` : ""}`}
      </p>
    </div>
  );
}
