import { requireAuth } from "@/infrastructure/api/auth";
import {
  createRequestId,
  handleRouteError,
  jsonError,
  jsonOk,
} from "@/infrastructure/api/http";
import { getRepositories } from "@/infrastructure/repositories";
import { CreateMessageSchema } from "@/domain/decision/schemas";

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
    const messages = await repos.messages.listBySession(
      session.workspaceId,
      sessionId,
      user.uid
    );
    return jsonOk({ messages, requestId });
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const user = await requireAuth(request);
    const { sessionId } = await params;
    const body = CreateMessageSchema.parse(await request.json());
    const repos = getRepositories();
    const session = await repos.sessions.getBySessionId(sessionId, user.uid);
    if (!session) {
      return jsonError("NOT_FOUND", "Session not found", requestId);
    }
    const message = await repos.messages.create({
      workspaceId: session.workspaceId,
      sessionId,
      ownerId: user.uid,
      role: "USER",
      content: body.content,
      createdAt: new Date().toISOString(),
    });
    return jsonOk({ message, requestId }, 201);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
