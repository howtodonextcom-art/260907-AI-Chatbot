import { requireAuth } from "@/infrastructure/api/auth";
import {
  createRequestId,
  handleRouteError,
  jsonError,
  jsonOk,
} from "@/infrastructure/api/http";
import { getRepositories } from "@/infrastructure/repositories";
import {
  ApproveBlueprintSchema,
  CreateBlueprintSchema,
} from "@/domain/decision/schemas";
import {
  approveBlueprint,
  createBlueprintFromDecision,
} from "@/ai/orchestration/decision-orchestrator";

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
    const blueprint = await repos.blueprints.getBySession(sessionId, user.uid);
    return jsonOk({ blueprint, requestId });
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const user = await requireAuth(request);
    const { sessionId } = await params;
    const body = CreateBlueprintSchema.parse(await request.json());
    const repos = getRepositories();
    const session = await repos.sessions.getBySessionId(sessionId, user.uid);
    if (!session) {
      return jsonError("NOT_FOUND", "Session not found", requestId);
    }
    const idempotencyKey = request.headers.get("Idempotency-Key") ?? undefined;
    const blueprint = await createBlueprintFromDecision({
      repos,
      session,
      ownerId: user.uid,
      sourceDecisionRecordId: body.sourceDecisionRecordId,
      idempotencyKey,
    });
    return jsonOk({ blueprint, requestId }, 201);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const user = await requireAuth(request);
    const { sessionId } = await params;
    ApproveBlueprintSchema.parse(await request.json());
    const repos = getRepositories();
    const session = await repos.sessions.getBySessionId(sessionId, user.uid);
    if (!session) {
      return jsonError("NOT_FOUND", "Session not found", requestId);
    }
    const blueprint = await repos.blueprints.getBySession(sessionId, user.uid);
    if (!blueprint) {
      return jsonError("NOT_FOUND", "Blueprint not found", requestId);
    }
    const updated = await approveBlueprint({
      repos,
      blueprintId: blueprint.id,
      ownerId: user.uid,
    });
    return jsonOk({ blueprint: updated, requestId });
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
