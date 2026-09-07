"use client";

import { useEffect, useRef, useState } from "react";
import type { Message } from "@/domain/evidence/types";
import type { RouteMode } from "@/domain/decision/types";
import { MessageBubble } from "@/features/chat/MessageBubble";
import { Composer } from "@/features/chat/Composer";
import { DebateTimeline } from "@/features/chat/DebateTimeline";
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
  onSend: (content: string) => Promise<void>;
  onStop: () => void;
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
    if (!content || props.running) return;
    setDraft("");
    await props.onSend(content);
  }

  const emptyDescription =
    props.routeMode === "DEEP"
      ? "Mode DEEP sẽ chạy Analyst → Critic → Judge. Intent «Chuẩn bị quyết định» tạo bản nháp Judge trên Canvas."
      : props.routeMode === "QUICK"
        ? "Mode QUICK chỉ 1 lần gọi nhanh — không tranh luận. Chọn DEEP nếu muốn Critic/Judge."
        : "Mode STANDARD chỉ chạy Analyst. «Thảo luận» không phải tranh luận đa vai — chọn Mode DEEP để thấy Critic/Judge.";

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
          {(props.messages.length > 0 || props.running) && (
            <DebateTimeline
              messages={props.messages}
              activeRole={props.streamingRole}
              routeMode={props.routeMode}
            />
          )}

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
      />
    </section>
  );
}
