"use client";

import type { DecisionSession, DecisionRecord } from "@/domain/decision/types";
import type { EvidenceItem } from "@/domain/evidence/types";
import type { Blueprint } from "@/domain/blueprint/types";
import { LabMark } from "@/components/ui/LabMark";

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
}) {
  const { session } = props;

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

      <section>
        <h2 className="type-section mb-1">
          Options ({session.options.length})
        </h2>
        {session.options.length === 0 ? (
          <CanvasEmpty label="Chưa có phương án — dùng Intent «Sinh phương án»." />
        ) : (
          <ul className="grid gap-2">
            {session.options.map((o) => (
              <li
                key={o.id}
                className="rounded border px-2 py-2"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="font-medium">{o.title}</div>
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
        {session.judgeDraft &&
        session.status === "DECISION_READY" &&
        !props.decision ? (
          <div className="grid gap-2">
            <p>
              Đề xuất Judge: <strong>{session.judgeDraft.decision}</strong>
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              HEURISTIC CONFIDENCE: {session.judgeDraft.confidenceLabel} (
              {session.judgeDraft.confidenceScore})
            </p>
            <button
              type="button"
              onClick={props.onApproveDecision}
              className="lab-btn lab-btn-primary"
              data-testid="approve-decision"
            >
              Duyệt Decision Record
            </button>
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
