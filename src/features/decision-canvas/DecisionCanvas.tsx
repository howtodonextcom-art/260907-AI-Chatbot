"use client";

import type { DecisionSession, DecisionRecord } from "@/domain/decision/types";
import type { EvidenceItem } from "@/domain/evidence/types";
import type { Blueprint } from "@/domain/blueprint/types";
import { LabMark } from "@/components/ui/LabMark";
import { UnknownsPanel } from "@/features/decision-canvas/UnknownsPanel";
import { DebateNotesPanel } from "@/features/decision-canvas/DebateNotesPanel";
import type { ResolveUnknownPayload } from "@/features/decision-canvas/types";
import { computeReadiness } from "@/domain/decision/unknown-policy";

const PIPELINE = [
  "DISCOVERY",
  "VALIDATING",
  "DECISION_READY",
  "DECIDED",
] as const;

function statusActive(current: string, step: string) {
  const ci = PIPELINE.indexOf(current as (typeof PIPELINE)[number]);
  const si = PIPELINE.indexOf(step as (typeof PIPELINE)[number]);
  if (ci < 0 || si < 0) return current === step;
  return si <= ci;
}

function CanvasEmpty(props: { label: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg border border-dashed px-2.5 py-2"
      style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
    >
      <LabMark size={22} />
      <span className="text-xs leading-relaxed">{props.label}</span>
    </div>
  );
}

export function DecisionCanvas(props: {
  session: DecisionSession;
  evidence: EvidenceItem[];
  decision: DecisionRecord | null;
  blueprint: Blueprint | null;
  experiments?: Array<{
    id: string;
    hypothesis: string;
    status: string;
  }>;
  executionPlan?: { stages: string[]; estimatedCalls: number } | null;
  onApproveDecision: () => void;
  onGenerateBlueprint: () => void;
  onApproveBlueprint: () => void;
  onExportBlueprint?: () => void;
  onResolveUnknown: (
    unknownId: string,
    payload: ResolveUnknownPayload
  ) => Promise<void>;
}) {
  const { session } = props;
  const contradictedAssumptionCount = session.assumptions.filter(
    (a) => a.status === "CONTRADICTED"
  ).length;
  const readiness = computeReadiness({
    optionCount: session.options.length,
    assumptionCount: session.assumptions.length,
    unknowns: session.unknowns,
    contradictedAssumptionCount,
  });

  return (
    <div className="grid gap-4 p-3 text-sm">
      <section className="lab-panel-slide">
        <div className="mb-2 flex items-center gap-2">
          <LabMark size={24} />
          <h2 className="type-section">Decision Canvas</h2>
        </div>
        <div className="lab-pipeline" aria-label="Tiến trình quyết định">
          {PIPELINE.map((step) => (
            <span
              key={step}
              className="lab-pipeline-step"
              data-active={String(statusActive(session.status, step))}
            >
              {step.replaceAll("_", " ")}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="type-section mb-1">Overview</h2>
        <p style={{ color: "var(--text-muted)" }}>{session.problem}</p>
        {session.objective ? (
          <p className="mt-2">
            <strong>Mục tiêu:</strong> {session.objective}
          </p>
        ) : null}
        <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          Trạng thái: {session.status}
        </p>
        {props.executionPlan ? (
          <p className="mt-1 text-xs" data-testid="execution-plan">
            Kế hoạch: {props.executionPlan.stages.join(" → ") || "tools"} · ~
            {props.executionPlan.estimatedCalls} gọi model
          </p>
        ) : null}
      </section>

      <section data-testid="readiness-summary">
        <h2 className="type-section mb-1">Decision Readiness</h2>
        <p
          className="font-medium"
          style={{ color: readiness.ready ? "var(--success)" : "var(--danger)" }}
          data-testid="readiness-status"
        >
          {readiness.ready ? "READY" : "NOT READY"}
        </p>
        {readiness.blocking.length > 0 ? (
          <ul className="mt-1 list-disc pl-4 text-xs" style={{ color: "var(--danger)" }}>
            {readiness.blocking.map((b) => (
              <li key={b.code} data-testid={`readiness-blocker-${b.code}`}>
                {b.message}
              </li>
            ))}
          </ul>
        ) : null}
        {readiness.nonBlocking.length > 0 ? (
          <ul className="mt-1 list-disc pl-4 text-xs" style={{ color: "var(--text-muted)" }}>
            {readiness.nonBlocking.map((b) => (
              <li key={b.code}>{b.message}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <h2 className="type-section mb-1">
          Constraints ({session.constraints.length})
        </h2>
        {session.constraints.length === 0 ? (
          <CanvasEmpty label="Chưa có ràng buộc cứng nào được ghi nhận." />
        ) : (
          <ul className="list-disc pl-4">
            {session.constraints.map((c) => (
              <li key={c.id}>
                {c.statement}{" "}
                <span style={{ color: "var(--text-muted)" }}>
                  ({c.source}
                  {c.confirmedByUser ? ", confirmed" : ""})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <UnknownsPanel
        unknowns={session.unknowns}
        evidence={props.evidence}
        onResolve={props.onResolveUnknown}
      />

      <DebateNotesPanel session={session} />

      <section>
        <h2 className="type-section mb-1">
          Options ({session.options.length})
        </h2>
        {session.options.length === 0 ? (
          <CanvasEmpty label="Chưa có phương án — dùng Bắt đầu phân tích (giai đoạn OPTIONS)." />
        ) : (
          <ul className="grid gap-2">
            {session.options.map((o) => (
              <li
                key={o.id}
                className="rounded border px-2 py-2"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium">{o.title}</div>
                  {o.proposedBy ? (
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                      data-testid={`option-proposed-by-${o.proposedBy}`}
                      style={{
                        color:
                          o.proposedBy === "SECOND_OPINION"
                            ? "var(--second-opinion)"
                            : "var(--analyst)",
                        background:
                          "color-mix(in oklab, currentColor 14%, transparent)",
                      }}
                    >
                      {o.proposedBy === "SECOND_OPINION" ? "2nd Opinion" : o.proposedBy}
                    </span>
                  ) : null}
                </div>
                <div style={{ color: "var(--text-muted)" }}>{o.description}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="type-section mb-1">
          Assumptions ({session.assumptions.length})
        </h2>
        {session.assumptions.length === 0 ? (
          <CanvasEmpty label="Chưa có giả định được ghi nhận." />
        ) : (
          <ul className="list-disc pl-4">
            {session.assumptions.map((a) => (
              <li key={a.id}>
                {a.statement}{" "}
                <span style={{ color: "var(--text-muted)" }}>({a.status})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="type-section mb-1">
          Evidence ({props.evidence.length})
        </h2>
        {props.evidence.length === 0 ? (
          <CanvasEmpty label="Chưa có evidence — VERIFY để bổ sung." />
        ) : (
          <ul className="grid gap-2">
            {props.evidence.map((e) => (
              <li
                key={e.id}
                className="rounded border px-2 py-1"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {e.type} · {e.reliability} · {e.verificationStatus}
                </div>
                {e.claim}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="type-section mb-1">
          Experiments ({props.experiments?.length ?? 0})
        </h2>
        {!props.experiments?.length ? (
          <CanvasEmpty label="Chưa có thí nghiệm — EXPERIMENT_REQUIRED sẽ tạo bản nháp." />
        ) : (
          <ul className="grid gap-1" data-testid="experiment-list">
            {props.experiments.map((ex) => (
              <li key={ex.id} className="text-sm">
                {ex.hypothesis}{" "}
                <span style={{ color: "var(--text-muted)" }}>({ex.status})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="type-section mb-1">Decision</h2>
        {!props.decision && session.judgeDraft ? (
          <div className="grid gap-2" data-testid="judge-draft-panel">
            <p>
              Đề xuất Judge: <strong>{session.judgeDraft.decision}</strong>
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              HEURISTIC CONFIDENCE: {session.judgeDraft.confidenceLabel} (
              {session.judgeDraft.confidenceScore})
            </p>
            {session.status === "DECISION_READY" ? (
              <button
                type="button"
                onClick={props.onApproveDecision}
                className="lab-btn lab-btn-primary"
                data-testid="approve-decision"
              >
                Duyệt Decision Record
              </button>
            ) : (
              <div data-testid="judge-blocked">
                <p
                  className="text-xs font-medium"
                  style={{ color: "var(--danger)" }}
                >
                  Judge đã có đề xuất, nhưng session CHƯA sẵn sàng quyết định:
                </p>
                <ul
                  className="list-disc pl-4 text-xs"
                  style={{ color: "var(--danger)" }}
                >
                  {readiness.blocking.map((b) => (
                    <li key={b.code}>{b.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : props.decision ? (
          <div>
            <p>
              Đã duyệt: <strong>{props.decision.decision}</strong>
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              HEURISTIC CONFIDENCE: {props.decision.confidence.label} (
              {props.decision.confidence.score})
            </p>
            {!props.blueprint ? (
              <button
                type="button"
                onClick={props.onGenerateBlueprint}
                className="lab-btn lab-btn-ghost mt-2"
                data-testid="generate-blueprint"
              >
                Tạo Blueprint
              </button>
            ) : null}
          </div>
        ) : (
          <CanvasEmpty label="Chạy DEEP + PREPARE_DECISION để có bản nháp Judge." />
        )}
      </section>

      <section>
        <h2 className="type-section mb-1">Blueprint</h2>
        {props.blueprint ? (
          <div>
            <p className="font-medium">{props.blueprint.title}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {props.blueprint.status}
            </p>
            <ul className="mt-2 list-disc pl-4">
              {props.blueprint.acceptanceCriteria.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            {props.blueprint.status === "DRAFT" ||
            props.blueprint.status === "REVIEW" ? (
              <button
                type="button"
                onClick={props.onApproveBlueprint}
                className="lab-btn lab-btn-primary mt-2"
                data-testid="approve-blueprint"
              >
                Duyệt Blueprint
              </button>
            ) : null}
            {props.onExportBlueprint ? (
              <button
                type="button"
                onClick={props.onExportBlueprint}
                className="lab-btn lab-btn-ghost mt-2 ml-2"
                data-testid="export-blueprint"
              >
                Export Markdown
              </button>
            ) : null}
          </div>
        ) : (
          <CanvasEmpty label="Chưa có blueprint — duyệt Decision Record trước." />
        )}
      </section>
    </div>
  );
}
