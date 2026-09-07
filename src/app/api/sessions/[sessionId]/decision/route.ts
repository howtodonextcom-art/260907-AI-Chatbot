import { requireAuth } from "@/infrastructure/api/auth";
import {
  createRequestId,
  handleRouteError,
  jsonError,
  jsonOk,
} from "@/infrastructure/api/http";
import { getRepositories } from "@/infrastructure/repositories";
import { ApproveDecisionSchema } from "@/domain/decision/schemas";
import { approveDecision } from "@/ai/orchestration/decision-orchestrator";

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
    const decision = await repos.decisionRecords.getBySession(
      sessionId,
      user.uid
    );
    return jsonOk({ decision, requestId });
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const user = await requireAuth(request);
    const { sessionId } = await params;
    const body = ApproveDecisionSchema.parse(await request.json());
    const repos = getRepositories();
    const session = await repos.sessions.getBySessionId(sessionId, user.uid);
    if (!session) {
      return jsonError("NOT_FOUND", "Session not found", requestId);
    }
    const idempotencyKey = request.headers.get("Idempotency-Key") ?? undefined;
    const decision = await approveDecision({
      repos,
      session,
      ownerId: user.uid,
      judgeRunId: body.judgeRunId,
      idempotencyKey,
    });
    return jsonOk({ decision, requestId }, 201);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
