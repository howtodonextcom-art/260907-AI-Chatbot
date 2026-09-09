"use client";

import type {
  DecisionSession,
  RouteMode,
  WorkflowStage,
  WorkflowState,
} from "@/domain/decision/types";
import { RouteModeHint } from "@/features/decision-session/RouteModeHint";
import { WorkflowStepper } from "@/features/decision-session/WorkflowStepper";

export type Intent =
  | "DISCUSS"
  | "FRAME_PROBLEM"
  | "GENERATE_OPTIONS"
  | "CRITIQUE"
  | "VERIFY"
  | "PREPARE_DECISION";

export function SessionHeader(props: {
  session: DecisionSession;
  routeMode: RouteMode;
  onRouteModeChange: (m: RouteMode) => void;
  intent: Intent;
  onIntentChange: (i: Intent) => void;
  costUsd: number;
  agentStatus: string | null;
  onToggleCanvas: () => void;
  onRequestCritique?: () => void;
  onRequestVerify?: () => void;
}) {
  const workflow = props.session.workflow;
  const runningStage: WorkflowStage | undefined =
    workflow?.state === "RUNNING" ? workflow.currentStage : undefined;

  return (
    <header
      className="flex flex-col gap-2 border-b px-4 py-3"
      style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="type-eyebrow truncate">
            Decision Session · {props.session.status}
          </div>
          <h1
            className="truncate text-xl"
            style={{ fontFamily: "var(--font-display)", fontWeight: 560 }}
          >
            {props.session.title}
          </h1>
        </div>

        <div
          className="flex max-w-xl flex-col gap-1.5 rounded-lg border px-2 py-1.5"
          style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
          aria-label="Điều khiển chạy"
        >
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm" style={{ color: "var(--text-muted)" }}>
              Mode{" "}
              <select
                value={props.routeMode}
                onChange={(e) =>
                  props.onRouteModeChange(e.target.value as RouteMode)
                }
                className="lab-input ml-1 min-h-9 px-2 py-1 text-sm"
                title="Mode điều khiển độ sâu — hệ thống tự chọn giai đoạn"
                data-testid="route-mode"
              >
                <option value="QUICK">QUICK — 1 gọi</option>
                <option value="STANDARD">STANDARD — quy trình đầy đủ</option>
                <option value="DEEP">DEEP — đa góc nhìn</option>
              </select>
            </label>
          </div>
          <RouteModeHint routeMode={props.routeMode} intent={props.intent} />
        </div>

        <div
          className="text-sm tabular-nums"
          style={{ color: "var(--text-muted)" }}
          title="Chi phí ước tính phiên này"
        >
          ~${props.costUsd.toFixed(4)}
        </div>

        {props.agentStatus ? (
          <span
            className="rounded px-2 py-1 text-xs font-semibold"
            style={{ background: "var(--accent-soft)", color: "var(--analyst)" }}
            role="status"
          >
            {props.agentStatus} đang chạy
          </span>
        ) : null}

        <button
          type="button"
          className="lab-btn lab-btn-ghost min-h-9 px-3 py-1 text-sm lg:hidden"
          onClick={props.onToggleCanvas}
        >
          Canvas
        </button>
      </div>

      <WorkflowStepper
        workflow={workflow}
        runningStage={runningStage}
        sessionStatus={props.session.status}
      />

      <details data-testid="advanced-controls" className="text-sm">
        <summary
          className="cursor-pointer select-none"
          style={{ color: "var(--text-muted)" }}
        >
          Nâng cao / QA — Intent thủ công
        </summary>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label style={{ color: "var(--text-muted)" }}>
            Intent{" "}
            <select
              value={props.intent}
              onChange={(e) => props.onIntentChange(e.target.value as Intent)}
              className="lab-input ml-1 min-h-9 px-2 py-1 text-sm"
              data-testid="intent-select"
            >
              <option value="DISCUSS">Thảo luận</option>
              <option value="FRAME_PROBLEM">Định khung</option>
              <option value="GENERATE_OPTIONS">Sinh phương án</option>
              <option value="CRITIQUE">Phản biện</option>
              <option value="VERIFY">Xác minh</option>
              <option value="PREPARE_DECISION">Chuẩn bị quyết định</option>
            </select>
          </label>
          {props.onRequestCritique ? (
            <button
              type="button"
              className="lab-btn lab-btn-ghost min-h-9 px-2 text-xs"
              onClick={props.onRequestCritique}
              data-testid="request-more-critique"
            >
              Phản biện thêm
            </button>
          ) : null}
          {props.onRequestVerify ? (
            <button
              type="button"
              className="lab-btn lab-btn-ghost min-h-9 px-2 text-xs"
              onClick={props.onRequestVerify}
              data-testid="request-reverify"
            >
              Xác minh lại
            </button>
          ) : null}
        </div>
      </details>
    </header>
  );
}

export type { WorkflowState };
