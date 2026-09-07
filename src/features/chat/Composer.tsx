"use client";

import type { RouteMode } from "@/domain/decision/types";

const FOOTER_BY_MODE: Record<RouteMode, string> = {
  QUICK: "QUICK: một lần gọi · không Critic/Judge",
  STANDARD: "STANDARD: chỉ Analyst · chọn DEEP để tranh luận",
  DEEP: "DEEP: Analyst → Critic → Judge sẽ trả lời lần lượt",
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
            >
              Gửi
            </button>
            {props.onAutoRun ? (
              <button
                type="button"
                onClick={props.onAutoRun}
                className="lab-btn min-h-[56px] px-3 text-sm"
                title="Tự động chạy Định khung → Sinh phương án → Phản biện → Xác minh (DEEP), dừng khi tới Decision Ready"
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
