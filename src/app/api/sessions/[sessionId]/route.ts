import { requireAuth } from "@/infrastructure/api/auth";
import {
  createRequestId,
  handleRouteError,
  jsonError,
  jsonOk,
} from "@/infrastructure/api/http";
import { getRepositories } from "@/infrastructure/repositories";
import { UpdateSessionSchema } from "@/domain/decision/schemas";
import { gateStatusTransition } from "@/domain/decision/state-machine";
import { countBlockingHighUnknowns } from "@/domain/decision/unknown-policy";
import { AppError } from "@/infrastructure/api/errors";
import type { DecisionSession } from "@/domain/decision/types";
import { mintHumanApproveProof } from "@/infrastructure/api/human-approve-proof";

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
    let humanApproveProof: string | undefined;
    if (session.status === "DECISION_READY" && session.judgeDraft?.runId) {
      humanApproveProof = mintHumanApproveProof({
        uid: user.uid,
        sessionId,
        judgeRunId: session.judgeDraft.runId,
      });
    }
    return jsonOk({ session, humanApproveProof, requestId });
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
      const unknowns = patch.unknowns ?? session.unknowns;
      const assumptions = patch.assumptions ?? session.assumptions;
      const gated = gateStatusTransition(session.status, body.status, {
        problem: patch.problem ?? session.problem,
        objective: patch.objective ?? session.objective,
        optionCount: (patch.options ?? session.options).length,
        assumptionCount: assumptions.length,
        highPriorityOpenUnknowns: countBlockingHighUnknowns(unknowns),
        domainValidationErrors: [],
        contradictedAssumptionCount: assumptions.filter(
          (a) => a.status === "CONTRADICTED"
        ).length,
      });
      if (!gated.applied) {
        throw new AppError(
          "SESSION_INVALID_STATE",
          gated.reason ?? `Cannot transition ${session.status} → ${body.status}`,
          409
        );
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
