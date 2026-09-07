"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, getAuthToken } from "@/features/workspace/api-client";
import type { DecisionSession, RouteMode } from "@/domain/decision/types";
import type { Message, EvidenceItem } from "@/domain/evidence/types";
import type { AgentRun, Blueprint } from "@/domain/blueprint/types";
import type { DecisionRecord } from "@/domain/decision/types";
import { ChatPanel } from "@/features/chat/ChatPanel";
import { DecisionCanvas } from "@/features/decision-canvas/DecisionCanvas";
import { SessionHeader } from "@/features/decision-session/SessionHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { LoadingBlock } from "@/components/ui/LoadingBlock";

type Intent =
  | "DISCUSS"
  | "FRAME_PROBLEM"
  | "GENERATE_OPTIONS"
  | "CRITIQUE"
  | "VERIFY"
  | "PREPARE_DECISION";

export default function SessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const [session, setSession] = useState<DecisionSession | null>(null);
  const [sessions, setSessions] = useState<DecisionSession[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [decision, setDecision] = useState<DecisionRecord | null>(null);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [routeMode, setRouteMode] = useState<RouteMode>("STANDARD");
  const [intent, setIntent] = useState<Intent>("DISCUSS");
  const [streamingText, setStreamingText] = useState("");
  const [streamingRole, setStreamingRole] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const [costUsd, setCostUsd] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);
  const [running, setRunning] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoStepLabel, setAutoStepLabel] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);

  const loadAll = useCallback(async () => {
    const s = await apiFetch<{ session: DecisionSession }>(
      `/api/sessions/${sessionId}`
    );
    setSession(s.session);
    const [msgs, ev, rs, dec, bp, list] = await Promise.all([
      apiFetch<{ messages: Message[] }>(`/api/sessions/${sessionId}/messages`),
      apiFetch<{ evidence: EvidenceItem[] }>(
        `/api/sessions/${sessionId}/evidence`
      ),
      apiFetch<{ runs: AgentRun[] }>(`/api/sessions/${sessionId}/runs`),
      apiFetch<{ decision: DecisionRecord | null }>(
        `/api/sessions/${sessionId}/decision`
      ),
      apiFetch<{ blueprint: Blueprint | null }>(
        `/api/sessions/${sessionId}/blueprint`
      ),
      apiFetch<{ sessions: DecisionSession[] }>(
        `/api/workspaces/${s.session.workspaceId}/sessions`
      ),
    ]);
    setMessages(msgs.messages);
    setEvidence(ev.evidence);
    setRuns(rs.runs);
    setDecision(dec.decision);
    setBlueprint(bp.blueprint);
    setSessions(list.sessions);
    return s.session;
  }, [sessionId]);

  useEffect(() => {
    void loadAll().catch((e) =>
      setError(e instanceof Error ? e.message : "Không tải được session")
    );
  }, [loadAll]);

  const totalCost = useMemo(
    () => runs.reduce((acc, r) => acc + (r.costUsd ?? 0), 0) + costUsd,
    [runs, costUsd]
  );

  async function sendMessage(
    content: string,
    overrides?: { routeMode?: RouteMode; intent?: Intent }
  ): Promise<{ status: DecisionSession["status"]; failed: boolean }> {
    setError(null);
    setPartial(false);
    setStreamingText("");
    setStreamingRole(null);
    setRunning(true);
    let failed = false;
    try {
      const created = await apiFetch<{ message: Message }>(
        `/api/sessions/${sessionId}/messages`,
        { method: "POST", body: JSON.stringify({ content }) }
      );
      setMessages((prev) => [...prev, created.message]);

      const token = getAuthToken();
      abortRef.current = new AbortController();
      const res = await fetch(`/api/sessions/${sessionId}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({
          routeMode: overrides?.routeMode ?? routeMode,
          intent: overrides?.intent ?? intent,
          messageId: created.message.id,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? "Run thất bại");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let localStream = "";
      let currentRole: string | null = null;

      const commitStreamBubble = (
        role: string | null,
        text: string,
        meta?: { runId?: string; provider?: string; model?: string }
      ) => {
        if (!role || !text.trim()) return;
        const provisional: Message = {
          id: `provisional-${meta?.runId ?? role}-${Date.now()}`,
          workspaceId: session?.workspaceId ?? "",
          sessionId,
          ownerId: session?.ownerId ?? "",
          role: "ASSISTANT",
          content: text,
          runId: meta?.runId,
          agentRole: role as Message["agentRole"],
          provider: meta?.provider,
          model: meta?.model,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, provisional]);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const lines = part.split("\n");
          const eventLine = lines.find((l) => l.startsWith("event:"));
          const dataLine = lines.find((l) => l.startsWith("data:"));
          if (!eventLine || !dataLine) continue;
          const event = eventLine.slice(6).trim();
          const data = JSON.parse(dataLine.slice(5)) as Record<string, unknown>;

          if (event === "agent.started") {
            commitStreamBubble(currentRole, localStream);
            const role = String(data.role);
            currentRole = role;
            localStream = "";
            setAgentStatus(role);
            setStreamingRole(role);
            setStreamingText("");
          }
          if (event === "agent.completed") {
            commitStreamBubble(currentRole ?? String(data.role ?? ""), localStream, {
              runId: typeof data.runId === "string" ? data.runId : undefined,
              provider:
                typeof data.provider === "string" ? data.provider : undefined,
              model: typeof data.model === "string" ? data.model : undefined,
            });
            localStream = "";
            setStreamingText("");
          }
          if (event === "token.delta" && typeof data.text === "string") {
            if (typeof data.role === "string" && data.role !== currentRole) {
              commitStreamBubble(currentRole, localStream);
              currentRole = data.role;
              localStream = "";
              setStreamingRole(data.role);
            }
            localStream += data.text;
            setStreamingText(localStream);
          }
          if (event === "decision.state.updated") {
            setSession((prev) =>
              prev
                ? {
                    ...prev,
                    ...(data.patch as Partial<DecisionSession>),
                  }
                : prev
            );
          }
          if (event === "run.partial") {
            setPartial(true);
          }
          if (event === "run.completed" || event === "run.partial") {
            commitStreamBubble(currentRole, localStream);
            localStream = "";
            if (typeof data.costUsd === "number") setCostUsd(data.costUsd);
            setAgentStatus(null);
            setStreamingRole(null);
            setStreamingText("");
          }
          if (event === "run.failed") {
            setError(String(data.message ?? "Run failed"));
            setAgentStatus(null);
            setStreamingRole(null);
            failed = true;
          }
        }
      }

      const refreshed = await loadAll();
      setStreamingText("");
      setStreamingRole(null);
      return { status: refreshed?.status ?? "DISCOVERY", failed };
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(e instanceof Error ? e.message : "Gửi thất bại");
      }
      return { status: session?.status ?? "DISCOVERY", failed: true };
    } finally {
      setRunning(false);
    }
  }

  function stop() {
    stoppedRef.current = true;
    abortRef.current?.abort();
    setRunning(false);
    setAgentStatus(null);
    setStreamingRole(null);
  }

  const AUTO_STEPS: Array<{
    intent: Intent;
    label: string;
    followup?: string;
  }> = [
    { intent: "FRAME_PROBLEM", label: "Định khung" },
    {
      intent: "GENERATE_OPTIONS",
      label: "Sinh phương án",
      followup:
        "Hãy đề xuất các phương án khả thi dựa trên khung vấn đề vừa xác định.",
    },
    {
      intent: "CRITIQUE",
      label: "Phản biện",
      followup:
        "Hãy phản biện các phương án đã đề xuất, chỉ ra rủi ro và giả định chưa được kiểm chứng.",
    },
    {
      intent: "VERIFY",
      label: "Xác minh",
      followup: "Hãy xác minh các giả định hoặc claim quan trọng nếu có thể.",
    },
  ];

  /**
   * Runs FRAME_PROBLEM → GENERATE_OPTIONS → CRITIQUE → VERIFY back-to-back in
   * DEEP mode, stopping as soon as the session reaches DECISION_READY (or
   * DECIDED) so a human still explicitly approves — this never auto-decides.
   * Always DEEP: CRITIQUE/PREPARE_DECISION-adjacent intents only invoke
   * Critic/Judge in DEEP mode (see routing-policy.ts), so QUICK/STANDARD
   * would silently skip the parts of this sequence that matter.
   */
  async function runAutoWorkflow(seedContent: string) {
    if (!seedContent.trim() || running || autoRunning) return;
    stoppedRef.current = false;
    setAutoRunning(true);
    setRouteMode("DEEP");
    try {
      for (let i = 0; i < AUTO_STEPS.length; i += 1) {
        if (stoppedRef.current) break;
        const step = AUTO_STEPS[i];
        setIntent(step.intent);
        setAutoStepLabel(`${step.label} (${i + 1}/${AUTO_STEPS.length})`);
        const content = i === 0 ? seedContent : (step.followup ?? seedContent);
        const result = await sendMessage(content, {
          routeMode: "DEEP",
          intent: step.intent,
        });
        if (stoppedRef.current || result.failed) break;
        if (result.status === "DECISION_READY" || result.status === "DECIDED") {
          break;
        }
      }
    } finally {
      setAutoRunning(false);
      setAutoStepLabel(null);
    }
  }

  async function approveDecision() {
    if (!session?.judgeDraft) return;
    try {
      const data = await apiFetch<{ decision: DecisionRecord }>(
        `/api/sessions/${sessionId}/decision`,
        {
          method: "POST",
          headers: { "Idempotency-Key": `approve-${session.judgeDraft.runId}` },
          body: JSON.stringify({
            judgeRunId: session.judgeDraft.runId,
            approve: true,
          }),
        }
      );
      setDecision(data.decision);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Duyệt quyết định thất bại");
    }
  }

  async function generateBlueprint() {
    if (!decision) return;
    try {
      const data = await apiFetch<{ blueprint: Blueprint }>(
        `/api/sessions/${sessionId}/blueprint`,
        {
          method: "POST",
          headers: { "Idempotency-Key": `bp-${decision.id}` },
          body: JSON.stringify({ sourceDecisionRecordId: decision.id }),
        }
      );
      setBlueprint(data.blueprint);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo blueprint thất bại");
    }
  }

  async function approveBlueprint() {
    try {
      const data = await apiFetch<{ blueprint: Blueprint }>(
        `/api/sessions/${sessionId}/blueprint`,
        {
          method: "PATCH",
          body: JSON.stringify({ approve: true }),
        }
      );
      setBlueprint(data.blueprint);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Duyệt blueprint thất bại");
    }
  }

  if (!session) {
    return <LoadingBlock label="Đang tải Decision Session…" />;
  }

  return (
    <div className="flex h-screen flex-col">
      <SessionHeader
        session={session}
        routeMode={routeMode}
        onRouteModeChange={setRouteMode}
        intent={intent}
        onIntentChange={setIntent}
        costUsd={totalCost}
        agentStatus={agentStatus}
        onToggleCanvas={() => setCanvasOpen((v) => !v)}
      />

      {error ? <ErrorBanner message={error} onRetry={() => setError(null)} /> : null}
      {partial ? (
        <div
          className="px-4 py-2 text-sm"
          style={{ background: "#3a3218", color: "var(--warn)" }}
        >
          Chạy một phần — kết quả Analyst được giữ. Bạn có thể thử lại Critic/Judge.
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
        <aside
          className="hidden overflow-auto border-r p-3 lg:block"
          style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
          aria-label="Danh sách session"
        >
          <div className="type-eyebrow mb-3">Sessions</div>
          <Link
            href={`/workspaces/${session.workspaceId}`}
            className="mb-3 block rounded-md px-2 py-2 text-sm font-medium"
            style={{ color: "var(--accent)", background: "var(--accent-soft)" }}
          >
            + Session mới
          </Link>
          <ul className="grid gap-1">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/sessions/${s.id}`}
                  className="block rounded-md px-2 py-2 text-sm transition"
                  style={{
                    background:
                      s.id === session.id ? "var(--bg-panel)" : "transparent",
                    boxShadow:
                      s.id === session.id
                        ? "inset 2px 0 0 var(--accent)"
                        : undefined,
                  }}
                >
                  <div className="truncate font-medium">{s.title}</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {s.status}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <ChatPanel
          messages={messages}
          streamingText={streamingText}
          streamingRole={streamingRole}
          running={running}
          routeMode={routeMode}
          onSend={sendMessage}
          onStop={stop}
          onAutoRun={runAutoWorkflow}
          autoRunning={autoRunning}
          autoStepLabel={autoStepLabel}
        />

        <div
          className={`overflow-auto border-l ${
            canvasOpen
              ? "lab-panel-slide fixed inset-0 z-20 block bg-[var(--bg)] lg:static lg:z-auto"
              : "hidden lg:block"
          }`}
          style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
          aria-label="Decision Canvas"
        >
          <div
            className="flex items-center justify-between border-b px-3 py-2 lg:hidden"
            style={{ borderColor: "var(--border)" }}
          >
            <strong style={{ fontFamily: "var(--font-display)" }}>
              Decision Canvas
            </strong>
            <button
              type="button"
              className="lab-btn lab-btn-ghost min-h-9 px-3 py-1 text-sm"
              onClick={() => setCanvasOpen(false)}
            >
              Đóng
            </button>
          </div>
          <DecisionCanvas
            session={session}
            evidence={evidence}
            decision={decision}
            blueprint={blueprint}
            onApproveDecision={approveDecision}
            onGenerateBlueprint={generateBlueprint}
            onApproveBlueprint={approveBlueprint}
          />
        </div>
      </div>
    </div>
  );
}
