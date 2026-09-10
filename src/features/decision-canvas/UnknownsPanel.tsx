"use client";

import { useState } from "react";
import type { Unknown } from "@/domain/decision/types";
import type { EvidenceItem } from "@/domain/evidence/types";
import type { ResolveUnknownPayload } from "@/features/decision-canvas/types";

/**
 * Renders the Decision Canvas Unknowns section and the legitimate
 * resolution paths for a HIGH Unknown — MASTER CODING PROMPT v13 §6-13.
 * Every action here maps 1:1 to a bounded ResolveUnknownAction on the
 * server (src/domain/decision/unknown-policy.ts); there is no "just mark
 * resolved" control with no justification.
 */

const RESOLUTION_LABEL: Record<Unknown["resolution"], string> = {
  OPEN: "Mở",
  VERIFY_NOW: "Đang chờ xác minh",
  EXPERIMENT_REQUIRED: "Cần thí nghiệm",
  HUMAN_DECISION_REQUIRED: "Cần quyết định thủ công",
  RESOLVED: "Đã giải quyết (evidence)",
  HUMAN_DECISION: "Đã quyết định thủ công",
  ACCEPTED_RISK: "Đã chấp nhận rủi ro",
};

const TERMINAL: ReadonlySet<Unknown["resolution"]> = new Set([
  "RESOLVED",
  "HUMAN_DECISION",
  "ACCEPTED_RISK",
]);

function UnknownRow(props: {
  unknown: Unknown;
  verifiedEvidence: EvidenceItem[];
  onResolve: (payload: ResolveUnknownPayload) => Promise<void>;
}) {
  const { unknown } = props;
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<
    "EVIDENCE" | "HUMAN_DECISION" | "ACCEPT_RISK" | null
  >(null);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isTerminal = TERMINAL.has(unknown.resolution);
  const isBlocking = unknown.importance === "HIGH" && !isTerminal;

  async function submit(payload: ResolveUnknownPayload) {
    setSubmitting(true);
    setLocalError(null);
    try {
      await props.onResolve(payload);
      setExpanded(false);
      setMode(null);
      setNote("");
      setSelectedEvidenceIds([]);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Không thể cập nhật Unknown");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li
      className="rounded border px-2.5 py-2"
      style={{
        borderColor: isBlocking ? "var(--danger)" : "var(--border)",
      }}
      data-testid="unknown-row"
      data-importance={unknown.importance}
      data-resolution={unknown.resolution}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium">{unknown.question}</div>
          <div className="mt-1 flex gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
            <span
              data-testid="unknown-importance"
              style={{
                color: unknown.importance === "HIGH" ? "var(--danger-text)" : undefined,
              }}
            >
              {unknown.importance}
            </span>
            <span>·</span>
            <span data-testid="unknown-resolution">
              {RESOLUTION_LABEL[unknown.resolution]}
            </span>
          </div>
          {unknown.resolutionNote ? (
            <p className="mt-1 text-xs italic" style={{ color: "var(--text-muted)" }}>
              &ldquo;{unknown.resolutionNote}&rdquo;
            </p>
          ) : null}
          {unknown.evidenceIds.length > 0 ? (
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Evidence liên kết: {unknown.evidenceIds.length}
            </p>
          ) : null}
        </div>
        {isBlocking ? (
          <button
            type="button"
            className="lab-btn lab-btn-ghost shrink-0 px-2 py-1 text-xs"
            onClick={() => setExpanded((v) => !v)}
            data-testid="unknown-resolve-toggle"
          >
            {expanded ? "Đóng" : "Giải quyết"}
          </button>
        ) : null}
      </div>

      {isBlocking && expanded ? (
        <div className="mt-2 grid gap-2 rounded border p-2" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className="lab-btn px-2 py-1 text-xs"
              disabled={submitting}
              onClick={() => submit({ action: "VERIFY_NOW" })}
            >
              Xác minh ngay
            </button>
            <button
              type="button"
              className="lab-btn px-2 py-1 text-xs"
              disabled={submitting}
              onClick={() => submit({ action: "MARK_EXPERIMENT" })}
            >
              Đánh dấu cần thí nghiệm
            </button>
            <button
              type="button"
              className="lab-btn px-2 py-1 text-xs"
              disabled={submitting}
              onClick={() => setMode(mode === "EVIDENCE" ? null : "EVIDENCE")}
              data-testid="unknown-resolve-evidence"
            >
              Giải quyết bằng Evidence
            </button>
            <button
              type="button"
              className="lab-btn px-2 py-1 text-xs"
              disabled={submitting}
              onClick={() =>
                setMode(mode === "HUMAN_DECISION" ? null : "HUMAN_DECISION")
              }
              data-testid="unknown-resolve-human"
            >
              Quyết định thủ công
            </button>
            <button
              type="button"
              className="lab-btn px-2 py-1 text-xs"
              disabled={submitting}
              onClick={() => setMode(mode === "ACCEPT_RISK" ? null : "ACCEPT_RISK")}
              data-testid="unknown-resolve-risk"
            >
              Chấp nhận rủi ro còn lại
            </button>
          </div>

          {mode === "EVIDENCE" ? (
            <div className="grid gap-1.5">
              {props.verifiedEvidence.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Chưa có evidence VERIFIED nào trong session — chạy VERIFY hoặc
                  thêm evidence trước.
                </p>
              ) : (
                <ul className="grid gap-1">
                  {props.verifiedEvidence.map((e) => (
                    <li key={e.id} className="flex items-start gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        id={`ev-${unknown.id}-${e.id}`}
                        checked={selectedEvidenceIds.includes(e.id)}
                        onChange={(ev) =>
                          setSelectedEvidenceIds((prev) =>
                            ev.target.checked
                              ? [...prev, e.id]
                              : prev.filter((id) => id !== e.id)
                          )
                        }
                      />
                      <label htmlFor={`ev-${unknown.id}-${e.id}`}>{e.claim}</label>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="lab-btn lab-btn-primary justify-self-start px-2 py-1 text-xs"
                disabled={submitting || selectedEvidenceIds.length === 0}
                onClick={() =>
                  submit({
                    action: "RESOLVE_WITH_EVIDENCE",
                    evidenceIds: selectedEvidenceIds,
                  })
                }
              >
                Xác nhận giải quyết
              </button>
            </div>
          ) : null}

          {mode === "HUMAN_DECISION" || mode === "ACCEPT_RISK" ? (
            <div className="grid gap-1.5">
              <textarea
                className="lab-input px-2 py-1 text-xs"
                rows={2}
                placeholder={
                  mode === "HUMAN_DECISION"
                    ? "Ghi rõ quyết định thủ công (không phải sự thật đã kiểm chứng)…"
                    : "Ghi rõ rủi ro còn lại được chấp nhận…"
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
                data-testid={
                  mode === "HUMAN_DECISION"
                    ? "unknown-human-note"
                    : "unknown-risk-note"
                }
              />
              <button
                type="button"
                className="lab-btn lab-btn-primary justify-self-start px-2 py-1 text-xs"
                disabled={submitting || !note.trim()}
                onClick={() =>
                  submit(
                    mode === "HUMAN_DECISION"
                      ? { action: "HUMAN_DECISION", resolutionNote: note }
                      : { action: "ACCEPT_RISK", resolutionNote: note }
                  )
                }
              >
                Xác nhận
              </button>
            </div>
          ) : null}

          {localError ? (
            <p className="text-xs" style={{ color: "var(--danger-text)" }}>
              {localError}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function UnknownsPanel(props: {
  unknowns: Unknown[];
  evidence: EvidenceItem[];
  onResolve: (unknownId: string, payload: ResolveUnknownPayload) => Promise<void>;
}) {
  const verifiedEvidence = props.evidence.filter(
    (e) => e.verificationStatus === "VERIFIED"
  );
  const blockingCount = props.unknowns.filter(
    (u) => u.importance === "HIGH" && !TERMINAL.has(u.resolution)
  ).length;

  return (
    <section
      className={blockingCount > 0 ? "-mx-3 rounded-md border-l-2 px-3 py-2" : undefined}
      style={
        blockingCount > 0
          ? {
              borderColor: "var(--danger)",
              background: "color-mix(in oklab, var(--danger) 6%, transparent)",
            }
          : undefined
      }
      data-testid="unknowns-section"
      data-blocking={blockingCount > 0}
    >
      <h2 className="type-section mb-1">
        Unknowns ({props.unknowns.length})
        {blockingCount > 0 ? (
          <span className="ml-2 text-xs font-normal" style={{ color: "var(--danger-text)" }}>
            {blockingCount} đang chặn Decision Ready
          </span>
        ) : null}
      </h2>
      {props.unknowns.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Chưa có bất định nào được ghi nhận.
        </p>
      ) : (
        <ul className="grid gap-2" data-testid="unknowns-list">
          {props.unknowns.map((u) => (
            <UnknownRow
              key={u.id}
              unknown={u}
              verifiedEvidence={verifiedEvidence}
              onResolve={(payload) => props.onResolve(u.id, payload)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
