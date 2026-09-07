import { requireAuth } from "@/infrastructure/api/auth";
import {
  createRequestId,
  handleRouteError,
  jsonError,
  jsonOk,
} from "@/infrastructure/api/http";
import { getRepositories } from "@/infrastructure/repositories";
import { CreateExperimentSchema } from "@/domain/decision/schemas";
import { experimentDraftInput } from "@/domain/experiment/lifecycle";

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
    const experiments = await repos.experiments.listBySession(
      session.workspaceId,
      sessionId
    );
    return jsonOk({ experiments, requestId });
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const user = await requireAuth(request);
    const { sessionId } = await params;
    const body = CreateExperimentSchema.parse(await request.json());
    const repos = getRepositories();
    const session = await repos.sessions.getBySessionId(sessionId, user.uid);
    if (!session) {
      return jsonError("NOT_FOUND", "Session not found", requestId);
    }
    const experiment = await repos.experiments.create(
      experimentDraftInput({
        workspaceId: session.workspaceId,
        sessionId,
        ownerId: user.uid,
        hypothesis: body.hypothesis,
        source: "user",
      })
    );
    return jsonOk({ experiment, requestId }, 201);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
