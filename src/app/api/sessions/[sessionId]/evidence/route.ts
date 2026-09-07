import { requireAuth } from "@/infrastructure/api/auth";
import {
  createRequestId,
  handleRouteError,
  jsonError,
  jsonOk,
} from "@/infrastructure/api/http";
import { getRepositories } from "@/infrastructure/repositories";
import { CreateEvidenceSchema } from "@/domain/decision/schemas";
import { DEFAULT_EVIDENCE_RELIABILITY } from "@/domain/evidence/types";
import { AppError } from "@/infrastructure/api/errors";

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
    const evidence = await repos.evidence.listBySession(
      session.workspaceId,
      sessionId,
      user.uid
    );
    return jsonOk({ evidence, requestId });
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const user = await requireAuth(request);
    const { sessionId } = await params;
    const body = CreateEvidenceSchema.parse(await request.json());
    if (body.type === "AI_INFERENCE") {
      throw new AppError(
        "VALIDATION_ERROR",
        "Clients cannot create AI_INFERENCE as USER_FACT; use USER_CLAIM or USER_FACT",
        400
      );
    }
    const repos = getRepositories();
    const session = await repos.sessions.getBySessionId(sessionId, user.uid);
    if (!session) {
      return jsonError("NOT_FOUND", "Session not found", requestId);
    }
    const item = await repos.evidence.create({
      workspaceId: session.workspaceId,
      sessionId,
      ownerId: user.uid,
      type: body.type,
      claim: body.claim,
      source: body.source,
      reliability:
        body.reliability ?? DEFAULT_EVIDENCE_RELIABILITY[body.type],
      createdBy: "USER",
      supportsOptionIds: body.supportsOptionIds,
      contradictsOptionIds: body.contradictsOptionIds,
      metadata: body.metadata,
      createdAt: new Date().toISOString(),
    });
    return jsonOk({ evidence: item, requestId }, 201);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
