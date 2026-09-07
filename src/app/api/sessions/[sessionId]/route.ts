import { requireAuth } from "@/infrastructure/api/auth";
import {
  createRequestId,
  handleRouteError,
  jsonError,
  jsonOk,
} from "@/infrastructure/api/http";
import { getRepositories } from "@/infrastructure/repositories";
import { UpdateSessionSchema } from "@/domain/decision/schemas";
import {
  canEnterDecisionReady,
  canEnterValidating,
  canTransition,
} from "@/domain/decision/state-machine";
import { AppError } from "@/infrastructure/api/errors";
import type { DecisionSession } from "@/domain/decision/types";

type Params = { params: Promise<{ sessionId: string }> };

export async function GET(request: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const user = await requireAuth(request);
    const { sessionId } = await params;
    const repos = getRepositories();
    const session = await repos.sessions.getBySessionId(sessionId, user.uid);
    if (!session) {
      return jsonError("NOT_FOUND", "Session not found", requestId);
    }
    return jsonOk({ session, requestId });
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const user = await requireAuth(request);
    const { sessionId } = await params;
    const body = UpdateSessionSchema.parse(await request.json());
    const repos = getRepositories();
    const session = await repos.sessions.getBySessionId(sessionId, user.uid);
    if (!session) {
      return jsonError("NOT_FOUND", "Session not found", requestId);
    }
    const patch = body as Partial<DecisionSession>;
    if (body.status && body.status !== session.status) {
      if (!canTransition(session.status, body.status)) {
        throw new AppError(
          "SESSION_INVALID_STATE",
          `Cannot transition ${session.status} → ${body.status}`,
          409
        );
      }
      if (body.status === "VALIDATING") {
        const ok = canEnterValidating({
          problem: patch.problem ?? session.problem,
          objective: patch.objective ?? session.objective,
          optionCount: (patch.options ?? session.options).length,
        });
        if (!ok) {
          throw new AppError(
            "SESSION_INVALID_STATE",
            "Session does not meet requirements to enter VALIDATING",
            409
          );
        }
      }
      if (body.status === "DECISION_READY") {
        const unknowns = patch.unknowns ?? session.unknowns;
        const highPriorityOpenUnknowns = unknowns.filter(
          (u) => u.importance === "HIGH" && u.resolution === "OPEN"
        ).length;
        const ok = canEnterDecisionReady({
          optionCount: (patch.options ?? session.options).length,
          assumptionCount: (patch.assumptions ?? session.assumptions).length,
          highPriorityOpenUnknowns,
          domainValidationErrors: [],
        });
        if (!ok) {
          throw new AppError(
            "SESSION_INVALID_STATE",
            "Session does not meet requirements to enter DECISION_READY",
            409
          );
        }
      }
    }
    const updated = await repos.sessions.update(
      session.workspaceId,
      sessionId,
      user.uid,
      patch
    );
    return jsonOk({ session: updated, requestId });
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
