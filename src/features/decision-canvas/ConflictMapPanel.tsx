"use client";

import type { FrameConflictReport } from "@/domain/decision/types";

export function ConflictMapPanel(props: {
  report?: FrameConflictReport;
}) {
  const report = props.report;
  if (!report || report.providerCount < 1) return null;

  const topics = report.conflictMap?.coreDisagreements ?? [];
  if (topics.length === 0 && report.perspectives.length === 0) return null;

  return (
    <section
      className="space-y-2"
      data-testid="conflict-map"
      aria-label="Frame conflict map"
    >
      <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
        Conflict Map ({report.providerCount} framers)
      </h2>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Parallel Blind Framing — disagreements before OPTIONS/CRITIQUE.
      </p>
      <ul className="space-y-2">
        {report.perspectives.map((p) => (
          <li
            key={p.provider}
            className="rounded-md border px-2.5 py-2 text-xs"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="font-medium">
              {p.provider}
              {p.perspectiveName ? ` · ${p.perspectiveName}` : ""}
            </div>
            <div style={{ color: "var(--text-muted)" }}>
              {(p.framing ?? "").slice(0, 220) || "—"}
            </div>
            <div style={{ color: "var(--text-muted)" }}>
              assumptions {p.assumptionCount} · unknowns {p.unknownCount}
            </div>
          </li>
        ))}
      </ul>
      {topics.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold">Core disagreements</h3>
          {topics.map((topic) => (
            <div
              key={topic.topic}
              className="rounded-md border px-2.5 py-2 text-xs"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="font-medium">{topic.topic}</div>
              <ul className="mt-1 space-y-1">
                {topic.viewpoints.map((v) => (
                  <li key={`${topic.topic}-${v.provider}`}>
                    <span className="font-medium">{v.provider}:</span>{" "}
                    {v.stance.slice(0, 180)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
