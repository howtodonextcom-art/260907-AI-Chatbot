import { requireAuth } from "@/infrastructure/api/auth";
import {
  createRequestId,
  handleRouteError,
  jsonError,
} from "@/infrastructure/api/http";
import { getRepositories } from "@/infrastructure/repositories";
import { RunSessionSchema } from "@/domain/decision/schemas";
import {
  encodeSse,
  runDecisionOrchestrator,
} from "@/ai/orchestration/decision-orchestrator";
import { AppError } from "@/infrastructure/api/errors";

type Params = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const user = await requireAuth(request);
    const { sessionId } = await params;
    const body = RunSessionSchema.parse(await request.json());
    const repos = getRepositories();

    const limit = await repos.rateLimit.consume(
      user.uid,
      30,
      60 * 60 * 1000
    );
    if (!limit.allowed) {
      throw new AppError("RATE_LIMITED", "AI run rate limit exceeded", 429);
    }

    const session = await repos.sessions.getBySessionId(sessionId, user.uid);
    if (!session) {
      return jsonError("NOT_FOUND", "Session not found", requestId);
    }

    let userRequest =
      body.intent ?? "Continue the automatic decision workflow.";
    if (body.messageId) {
      const messages = await repos.messages.listBySession(
        session.workspaceId,
        sessionId,
        user.uid
      );
      const msg = messages.find((m) => m.id === body.messageId);
      userRequest =
        msg?.content ?? body.intent ?? "Continue the automatic decision workflow.";
    } else {
      const messages = await repos.messages.listBySession(
        session.workspaceId,
        sessionId,
        user.uid
      );
      const lastUser = [...messages].reverse().find((m) => m.role === "USER");
      userRequest =
        lastUser?.content ??
        body.intent ??
        "Continue the automatic decision workflow.";
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const event of runDecisionOrchestrator({
            repos,
            session,
            ownerId: user.uid,
            routeMode: body.routeMode,
            intent: body.intent,
            userRequest,
            requestId,
            signal: request.signal,
          })) {
            controller.enqueue(encoder.encode(encodeSse(event)));
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Orchestrator failed";
          controller.enqueue(
            encoder.encode(
              encodeSse({
                event: "run.failed",
                data: { code: "INTERNAL_ERROR", message, requestId },
              })
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
