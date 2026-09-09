"use client";

import type { DecisionSession } from "@/domain/decision/types";
import { debateNotesHasContent } from "@/domain/decision/debate-notes";

export function DebateNotesPanel(props: { session: DecisionSession }) {
  const notes = props.session.workflow?.debateNotes;
  const draft = props.session.judgeDraft;
  const hasNotes = debateNotesHasContent(notes);
  const hasAgreement =
    draft?.agentAgreementMethod === "JUDGE_HEURISTIC" ||
    Boolean(draft?.agentAgreementRationale);

  if (!hasNotes && !hasAgreement) return null;

  return (
    <section data-testid="debate-notes">
      <h2 className="type-section mb-1">Điểm bất đồng</h2>
      {notes?.soPreferredOptionTitle || notes?.soRecommendedDirection ? (
        <p className="mb-1 text-xs">
          SecondOpinion:{" "}
          <strong>
            {notes.soPreferredOptionTitle ?? notes.soRecommendedDirection}
          </strong>
        </p>
      ) : null}
      {notes && notes.criticisms.length > 0 ? (
        <div className="mb-2">
          <div className="text-xs font-semibold" style={{ color: "var(--critic)" }}>
            Critic
          </div>
          <ul className="list-disc pl-4 text-xs">
            {notes.criticisms.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {notes && notes.divergentRisks.length > 0 ? (
        <div className="mb-2">
          <div
            className="text-xs font-semibold"
            style={{ color: "var(--second-opinion)" }}
          >
            Rủi ro lệch (SecondOpinion)
          </div>
          <ul className="list-disc pl-4 text-xs">
            {notes.divergentRisks.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {notes && notes.unsupportedAssumptions.length > 0 ? (
        <ul className="mb-2 list-disc pl-4 text-xs" style={{ color: "var(--warn)" }}>
          {notes.unsupportedAssumptions.map((c) => (
            <li key={c}>Giả định yếu: {c}</li>
          ))}
        </ul>
      ) : null}
      {notes && notes.missingEvidence.length > 0 ? (
        <ul className="mb-2 list-disc pl-4 text-xs" style={{ color: "var(--text-muted)" }}>
          {notes.missingEvidence.map((c) => (
            <li key={c}>Thiếu evidence: {c}</li>
          ))}
        </ul>
      ) : null}
      {hasAgreement ? (
        <p className="text-xs" data-testid="debate-agreement">
          Judge đồng thuận SecondOpinion:{" "}
          <strong>
            {draft?.agentAgreementMethod === "UNAVAILABLE"
              ? "không có dữ liệu"
              : draft?.agentAgreement != null
                ? `${Math.round(draft.agentAgreement * 100)}% heuristic`
                : "—"}
          </strong>
          {draft?.agentAgreementRationale
            ? ` — ${draft.agentAgreementRationale}`
            : null}
        </p>
      ) : null}
    </section>
  );
}
