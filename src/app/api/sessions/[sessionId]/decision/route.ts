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
import {
  mintHumanApproveProof,
  verifyHumanApproveProof,
} from "@/infrastructure/api/human-approve-proof";
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
    const decision = await repos.decisionRecords.getBySession(
      sessionId,
      user.uid
    );
    let humanApproveProof: string | undefined;
    if (
      session.status === "DECISION_READY" &&
      session.judgeDraft?.runId &&
      !decision
    ) {
      humanApproveProof = mintHumanApproveProof({
        uid: user.uid,
        sessionId,
        judgeRunId: session.judgeDraft.runId,
      });
    }
    return jsonOk({ decision, humanApproveProof, requestId });
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const user = await requireAuth(request);
    const { sessionId } = await params;
    const raw = (await request.json()) as Record<string, unknown>;
    // Client-asserted origin / actionOrigin must never drive DECIDED.
    if ("origin" in raw || "actionOrigin" in raw) {
      throw new AppError(
        "FORBIDDEN",
        "Client-asserted origin is not accepted; use server-minted humanApproveProof",
        403
      );
    }
    const body = ApproveDecisionSchema.parse(raw);
    const repos = getRepositories();
    const session = await repos.sessions.getBySessionId(sessionId, user.uid);
    if (!session) {
      return jsonError("NOT_FOUND", "Session not found", requestId);
    }

    verifyHumanApproveProof({
      proof: body.humanApproveProof,
      uid: user.uid,
      sessionId,
      judgeRunId: body.judgeRunId,
    });

    // #region agent log
    fetch("http://127.0.0.1:7741/ingest/bc7d4cca-eded-4559-8e61-3c173f46bff4", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "74ad39",
      },
      body: JSON.stringify({
        sessionId: "74ad39",
        runId: "post-fix",
        hypothesisId: "V4-origin",
        location: "decision/route.ts:POST",
        message: "human approve proof verified; server sets HUMAN_APPROVE",
        data: { sessionId, judgeRunId: body.judgeRunId },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    const idempotencyKey = request.headers.get("Idempotency-Key") ?? undefined;
    // Origin is NEVER taken from the client — approveDecision hardcodes HUMAN_APPROVE.
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
