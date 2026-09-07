import { requireAuth } from "@/infrastructure/api/auth";
import {
  createRequestId,
  handleRouteError,
  jsonError,
  jsonOk,
} from "@/infrastructure/api/http";
import { getRepositories } from "@/infrastructure/repositories";
import { UpdateSessionSchema } from "@/domain/decision/schemas";
import { canTransition } from "@/domain/decision/state-machine";
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
    if (body.status && body.status !== session.status) {
      if (!canTransition(session.status, body.status)) {
        throw new AppError(
          "SESSION_INVALID_STATE",
          `Cannot transition ${session.status} → ${body.status}`,
          409
        );
      }
    }
    const patch = body as Partial<DecisionSession>;
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
