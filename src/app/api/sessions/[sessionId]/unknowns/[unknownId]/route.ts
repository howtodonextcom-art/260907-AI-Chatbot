import { requireAuth } from "@/infrastructure/api/auth";
import {
  createRequestId,
  handleRouteError,
  jsonError,
  jsonOk,
} from "@/infrastructure/api/http";
import { getRepositories } from "@/infrastructure/repositories";
import { ResolveUnknownSchema } from "@/domain/decision/schemas";
import { resolveUnknown } from "@/domain/decision/unknown-policy";
import { logStructured } from "@/infrastructure/logging/logger";

type Params = { params: Promise<{ sessionId: string; unknownId: string }> };

/**
 * Canonical Unknown lifecycle endpoint — v13 §11. The ONLY path a client
 * may use to change an Unknown's resolution; the generic session PATCH
 * deliberately excludes `unknowns` from UpdateSessionSchema so this cannot
 * be bypassed with a bulk-array write. See
 * src/domain/decision/unknown-policy.ts and CLAUDE.md
 * [[unknown-resolution-workflow]].
 */
export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const user = await requireAuth(request);
    const { sessionId, unknownId } = await params;
    const body = ResolveUnknownSchema.parse(await request.json());
    const repos = getRepositories();
    const session = await repos.sessions.getBySessionId(sessionId, user.uid);
    if (!session) {
      return jsonError("NOT_FOUND", "Session not found", requestId);
    }
    const target = session.unknowns.find((u) => u.id === unknownId);
    if (!target) {
      return jsonError("NOT_FOUND", "Unknown not found in this session", requestId);
    }

    const sessionEvidence = await repos.evidence.listBySession(
      session.workspaceId,
      sessionId,
      user.uid
    );

    const action =
      body.action === "RESOLVE_WITH_EVIDENCE"
        ? { kind: "RESOLVE_WITH_EVIDENCE" as const, evidenceIds: body.evidenceIds }
        : body.action === "HUMAN_DECISION"
          ? { kind: "HUMAN_DECISION" as const, resolutionNote: body.resolutionNote }
          : body.action === "ACCEPT_RISK"
            ? { kind: "ACCEPT_RISK" as const, resolutionNote: body.resolutionNote }
            : body.action === "VERIFY_NOW"
              ? { kind: "VERIFY_NOW" as const }
              : body.action === "MARK_EXPERIMENT"
                ? { kind: "MARK_EXPERIMENT" as const }
                : { kind: "REQUEST_HUMAN_DECISION" as const };

    const result = resolveUnknown(target, action, {
      ownerId: user.uid,
      now: new Date().toISOString(),
      sessionEvidence,
    });

    if (!result.applied) {
      return jsonError(
        "VALIDATION_ERROR",
        result.reason ?? "Unknown resolution rejected",
        requestId
      );
    }

    const nextUnknowns = session.unknowns.map((u) =>
      u.id === unknownId ? result.unknown : u
    );
    const updated = await repos.sessions.update(
      session.workspaceId,
      sessionId,
      user.uid,
      { unknowns: nextUnknowns }
    );

    logStructured("info", "unknown.resolved", {
      sessionId,
      unknownId,
      action: body.action,
      resolution: result.unknown.resolution,
    });

    return jsonOk({ session: updated, requestId });
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
