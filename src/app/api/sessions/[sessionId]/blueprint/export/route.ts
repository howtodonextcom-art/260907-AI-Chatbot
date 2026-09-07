import { requireAuth } from "@/infrastructure/api/auth";
import {
  createRequestId,
  handleRouteError,
  jsonError,
} from "@/infrastructure/api/http";
import { getRepositories } from "@/infrastructure/repositories";
import { blueprintToMarkdown } from "@/domain/blueprint/markdown";

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
    if (!blueprint) {
      return jsonError("NOT_FOUND", "Blueprint not found", requestId);
    }
    const markdown = blueprintToMarkdown(blueprint);
    const filename = `${blueprint.title.replace(/[^\w.-]+/g, "-").slice(0, 60)}.md`;
    return new Response(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
