import type { EvidenceItem } from "@/domain/evidence/types";
import type { Unknown, UnknownResolution } from "@/domain/decision/types";
import { evidenceTopicallySupportsUnknown } from "@/domain/decision/entity-cluster";

/**
 * THE single place that decides whether a HIGH Unknown still blocks
 * DECISION_READY, and the single place that authorizes a resolution action.
 * Mirrors state-machine.ts::gateStatusTransition — every call site that
 * previously computed `highPriorityOpenUnknowns` inline via
 * `resolution === "OPEN"` must go through countBlockingHighUnknowns()
 * instead, because non-OPEN-but-non-terminal states (VERIFY_NOW,
 * EXPERIMENT_REQUIRED, HUMAN_DECISION_REQUIRED — all "flagged for future
 * action", none of them actually resolved) must still block. See
 * CLAUDE.md [[unknown-resolution-workflow]] and MASTER CODING PROMPT v13
 * §10.
 */
const TERMINAL_RESOLUTIONS = new Set<UnknownResolution>([
  "RESOLVED",
  "HUMAN_DECISION",
  "ACCEPTED_RISK",
]);

export function isUnknownResolutionTerminal(
  resolution: UnknownResolution
): boolean {
  return TERMINAL_RESOLUTIONS.has(resolution);
}

export function isUnknownBlocking(u: Unknown): boolean {
  return u.importance === "HIGH" && !isUnknownResolutionTerminal(u.resolution);
}

export function countBlockingHighUnknowns(unknowns: Unknown[]): number {
  return unknowns.filter(isUnknownBlocking).length;
}

export type UnknownResolveAction =
  | { kind: "VERIFY_NOW" }
  | { kind: "MARK_EXPERIMENT" }
  | { kind: "REQUEST_HUMAN_DECISION" }
  | { kind: "RESOLVE_WITH_EVIDENCE"; evidenceIds: string[] }
  | { kind: "HUMAN_DECISION"; resolutionNote: string }
  | { kind: "ACCEPT_RISK"; resolutionNote: string };

export interface UnknownResolveContext {
  ownerId: string;
  now: string;
  /** Evidence already persisted for this session — used to validate
   * RESOLVE_WITH_EVIDENCE references real, verified evidence rather than
   * accepting arbitrary client-supplied IDs (closes the "empty resolve"
   * bypass in v13 §8). */
  sessionEvidence: EvidenceItem[];
}

export interface UnknownResolveResult {
  applied: boolean;
  unknown: Unknown;
  reason?: string;
}

/**
 * Applies a bounded resolution action to one Unknown. Never allows a bare
 * "mark resolved" with no justification (v13 §8): RESOLVE_WITH_EVIDENCE
 * requires at least one existing VERIFIED EvidenceItem belonging to this
 * session; HUMAN_DECISION and ACCEPT_RISK require a non-empty
 * resolutionNote. VERIFY_NOW/MARK_EXPERIMENT/REQUEST_HUMAN_DECISION are
 * non-terminal flags — they never unblock a HIGH Unknown on their own.
 */
export function resolveUnknown(
  unknown: Unknown,
  action: UnknownResolveAction,
  ctx: UnknownResolveContext
): UnknownResolveResult {
  switch (action.kind) {
    case "VERIFY_NOW":
      return {
        applied: true,
        unknown: { ...unknown, resolution: "VERIFY_NOW" },
      };
    case "MARK_EXPERIMENT":
      return {
        applied: true,
        unknown: { ...unknown, resolution: "EXPERIMENT_REQUIRED" },
      };
    case "REQUEST_HUMAN_DECISION":
      return {
        applied: true,
        unknown: { ...unknown, resolution: "HUMAN_DECISION_REQUIRED" },
      };
    case "RESOLVE_WITH_EVIDENCE": {
      if (action.evidenceIds.length === 0) {
        return {
          applied: false,
          unknown,
          reason: "RESOLVE_WITH_EVIDENCE requires at least one evidenceId",
        };
      }
      const evidenceById = new Map(ctx.sessionEvidence.map((e) => [e.id, e]));
      for (const id of action.evidenceIds) {
        const evidence = evidenceById.get(id);
        if (!evidence) {
          return {
            applied: false,
            unknown,
            reason: `Evidence ${id} does not exist in this session`,
          };
        }
        if (evidence.verificationStatus !== "VERIFIED") {
          return {
            applied: false,
            unknown,
            reason: `Evidence ${id} is not VERIFIED (status=${evidence.verificationStatus})`,
          };
        }
        if (!evidenceTopicallySupportsUnknown(evidence, unknown)) {
          return {
            applied: false,
            unknown,
            reason: `Evidence ${id} does not topically support this unknown`,
          };
        }
      }
      return {
        applied: true,
        unknown: {
          ...unknown,
          resolution: "RESOLVED",
          evidenceIds: Array.from(
            new Set([...unknown.evidenceIds, ...action.evidenceIds])
          ),
          resolvedAt: ctx.now,
          resolvedBy: ctx.ownerId,
        },
      };
    }
    case "HUMAN_DECISION": {
      if (!action.resolutionNote.trim()) {
        return {
          applied: false,
          unknown,
          reason: "HUMAN_DECISION requires a non-empty resolutionNote",
        };
      }
      return {
        applied: true,
        unknown: {
          ...unknown,
          resolution: "HUMAN_DECISION",
          resolutionNote: action.resolutionNote.trim(),
          resolvedAt: ctx.now,
          resolvedBy: ctx.ownerId,
        },
      };
    }
    case "ACCEPT_RISK": {
      if (!action.resolutionNote.trim()) {
        return {
          applied: false,
          unknown,
          reason: "ACCEPT_RISK requires a non-empty resolutionNote",
        };
      }
      return {
        applied: true,
        unknown: {
          ...unknown,
          resolution: "ACCEPTED_RISK",
          resolutionNote: action.resolutionNote.trim(),
          resolvedAt: ctx.now,
          resolvedBy: ctx.ownerId,
        },
      };
    }
  }
}

export interface ReadinessBlocker {
  code: string;
  message: string;
}

export interface ReadinessSummary {
  ready: boolean;
  blocking: ReadinessBlocker[];
  nonBlocking: ReadinessBlocker[];
}

/**
 * Deterministic (non-LLM) readiness explanation — v13 §31 explicitly
 * forbids asking an LLM to generate this. Machine-readable `code` fields
 * are primary; `message` is a human-readable Vietnamese label for the UI.
 */
export function computeReadiness(args: {
  optionCount: number;
  assumptionCount: number;
  unknowns: Unknown[];
  contradictedAssumptionCount: number;
}): ReadinessSummary {
  const blocking: ReadinessBlocker[] = [];
  const nonBlocking: ReadinessBlocker[] = [];

  if (args.optionCount < 1) {
    blocking.push({ code: "NO_OPTIONS", message: "Chưa có phương án nào." });
  }
  if (args.assumptionCount < 1) {
    blocking.push({
      code: "NO_ASSUMPTIONS",
      message: "Chưa có giả định nào được ghi nhận.",
    });
  }
  const blockingHighUnknowns = args.unknowns.filter(isUnknownBlocking);
  if (blockingHighUnknowns.length > 0) {
    blocking.push({
      code: "HIGH_UNKNOWNS_OPEN",
      message: `${blockingHighUnknowns.length} bất định mức HIGH chưa được giải quyết.`,
    });
  }
  if (args.contradictedAssumptionCount > 0) {
    blocking.push({
      code: "CONTRADICTED_ASSUMPTIONS",
      message: `${args.contradictedAssumptionCount} giả định bị mâu thuẫn (CONTRADICTED).`,
    });
  }

  const mediumOrLowOpenUnknowns = args.unknowns.filter(
    (u) => u.importance !== "HIGH" && !isUnknownResolutionTerminal(u.resolution)
  );
  if (mediumOrLowOpenUnknowns.length > 0) {
    nonBlocking.push({
      code: "NON_HIGH_UNKNOWNS_OPEN",
      message: `${mediumOrLowOpenUnknowns.length} bất định mức MEDIUM/LOW còn mở (không chặn).`,
    });
  }

  return { ready: blocking.length === 0, blocking, nonBlocking };
}
