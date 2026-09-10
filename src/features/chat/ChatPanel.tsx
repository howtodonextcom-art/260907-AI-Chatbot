"use client";

import { useEffect, useRef, useState } from "react";
import type { Message } from "@/domain/evidence/types";
import type {
  RouteMode,
  WorkflowLastRun,
  WorkflowMetadata,
} from "@/domain/decision/types";
import { MessageBubble } from "@/features/chat/MessageBubble";
import { Composer } from "@/features/chat/Composer";
import { DebateTimeline } from "@/features/chat/DebateTimeline";
import { RunStageChips } from "@/features/chat/RunStageChips";
import { EmptyState } from "@/components/ui/EmptyState";

const STREAM_COLOR: Record<string, string> = {
  ANALYST: "var(--analyst)",
  CRITIC: "var(--critic)",
  JUDGE: "var(--judge)",
  SECOND_OPINION: "var(--second-opinion)",
};

export function ChatPanel(props: {
  messages: Message[];
  streamingText: string;
  streamingRole?: string | null;
  running: boolean;
  routeMode: RouteMode;
  onSend: (content: string) => Promise<unknown>;
  onStop: () => void;
  onAutoRun?: (content: string) => Promise<void>;
  autoRunning?: boolean;
  autoStepLabel?: string | null;
  autoLabel?: string;
  workflow?: WorkflowMetadata;
  lastRun?: WorkflowLastRun;
  plannedStages?: string[];
  livePartials?: Array<{ role?: string; message?: string }>;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bottomRef.current?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
    });
  }, [props.messages, props.streamingText, props.streamingRole]);

  async function handleSend() {
    const content = draft.trim();
    if (!content || props.running || props.autoRunning) return;
    setDraft("");
    await props.onSend(content);
  }

  async function handleAutoRun() {
    const content = draft.trim();
    if (!content || props.running || props.autoRunning || !props.onAutoRun) return;
    setDraft("");
    await props.onAutoRun(content);
  }

  const emptyDescription =
    props.routeMode === "DEEP"
      ? "Mode DEEP — Parallel Blind Framing rồi VERIFY→OPTIONS→CRITIQUE. Bạn sở hữu quyết định cuối (DECIDED)."
      : props.routeMode === "QUICK"
        ? "Mode QUICK chỉ 1 lần gọi nhẹ. Chọn STANDARD/DEEP để chạy quy trình quyết định đầy đủ."
        : "Mode STANDARD chạy quy trình đầy đủ với Analyst theo giai đoạn. Chọn DEEP để có Critic/SecondOpinion/Judge.";

  return (
    <section className="flex min-h-0 flex-col" aria-label="Chat quyết định">
      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        {props.messages.length === 0 && !props.streamingText ? (
          <EmptyState
            title="Bắt đầu từ ý tưởng chưa rõ"
            description={emptyDescription}
          />
        ) : null}

        <div className="mx-auto grid max-w-3xl gap-3">
          {props.routeMode === "DEEP" ? (
            <div
              className="rounded-lg border px-3 py-2 text-xs leading-relaxed"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-muted)",
                background: "var(--bg-elevated)",
              }}
              data-testid="deep-stage-hint"
            >
              {props.workflow?.artifacts?.CRITIQUE?.status === "CURRENT"
                ? "DEEP: Critic (Groq) đã chạy. Judge (Gemini) ở PREPARE — HIGH Unknown vẫn chặn duyệt quyết định."
                : props.workflow?.currentStage === "OPTIONS" ||
                    props.workflow?.completedStages?.includes("OPTIONS") ||
                    props.workflow?.artifacts?.OPTIONS?.status === "CURRENT"
                  ? "Bước tiếp theo: CRITIQUE — Critic (Groq). Gửi = một giai đoạn (chạy Groq ngay). Bắt đầu phân tích = tiếp pipeline."
                  : "FRAME/DISCOVERY = Parallel Blind Framing (Gemini∥DeepSeek∥Groq). HIGH Unknowns pause before OPTIONS. VERIFY trước CRITIQUE. DECIDED chỉ Human Approve."}
            </div>
          ) : null}

          {(props.messages.length > 0 || props.running) && (
            <DebateTimeline
              messages={props.messages}
              activeRole={props.streamingRole}
              routeMode={props.routeMode}
            />
          )}

          <RunStageChips
            lastRun={props.lastRun ?? props.workflow?.lastRun}
            plannedStages={props.plannedStages}
            livePartials={props.livePartials}
          />

          {props.messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {props.streamingText ? (
            <div
              className="lab-message-enter rounded-xl border px-3 py-2 whitespace-pre-wrap"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-panel)",
              }}
              aria-live="polite"
            >
              <div
                className="mb-1 text-xs font-semibold"
                style={{
                  color:
                    STREAM_COLOR[props.streamingRole ?? "ANALYST"] ??
                    "var(--analyst)",
                }}
              >
                {props.streamingRole ?? "ANALYST"} đang stream…
              </div>
              <span className="lab-stream-cursor text-sm leading-relaxed">
                {props.streamingText}
              </span>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      <Composer
        value={draft}
        onChange={setDraft}
        onSend={handleSend}
        onStop={props.onStop}
        running={props.running}
        routeMode={props.routeMode}
        onAutoRun={props.onAutoRun ? handleAutoRun : undefined}
        autoRunning={props.autoRunning}
        autoStepLabel={props.autoStepLabel}
        autoLabel={props.autoLabel}
      />
    </section>
  );
}

