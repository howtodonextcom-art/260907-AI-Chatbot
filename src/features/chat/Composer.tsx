"use client";

/** DEEP is the only mode (v18 — see CLAUDE.md [[deep-only]]) — fixed footer copy. */
const DEEP_FOOTER_HINT =
  "DEEP: Gửi = 1 giai đoạn · Bắt đầu phân tích = cả pipeline. FRAME = Parallel Blind Framing (Gemini∥DeepSeek∥Groq). Pipeline luôn tiến tới PREPARE (Judge) kể cả khi còn HIGH Unknown — Unknown chỉ chặn lúc DUYỆT quyết định, không chặn quy trình. VERIFY trước CRITIQUE. DECIDED chỉ Human Approve.";

export function Composer(props: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  running: boolean;
  onAutoRun?: () => void;
  autoRunning?: boolean;
  autoStepLabel?: string | null;
  autoLabel?: string;
}) {
  const busy = props.running || Boolean(props.autoRunning);
  const cta = props.autoLabel ?? "Bắt đầu phân tích";

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
            style={{ borderColor: "var(--danger)", color: "var(--danger-text)" }}
            data-testid="stop-workflow"
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
                title="Hệ thống tự chọn và chạy các giai đoạn tiếp theo — không cần chọn Intent"
              >
                {cta}
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
          ? `Đang chạy quy trình: ${props.autoStepLabel} — bấm Dừng để huỷ.`
          : `Enter để gửi · Shift+Enter xuống dòng · ${DEEP_FOOTER_HINT}`}
      </p>
    </div>
  );
}
