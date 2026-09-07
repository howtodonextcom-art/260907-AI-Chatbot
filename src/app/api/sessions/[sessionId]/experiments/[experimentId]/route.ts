import { requireAuth } from "@/infrastructure/api/auth";
import {
  createRequestId,
  handleRouteError,
  jsonError,
  jsonOk,
} from "@/infrastructure/api/http";
import { getRepositories } from "@/infrastructure/repositories";
import { TransitionExperimentSchema } from "@/domain/decision/schemas";
import { assertExperimentTransition } from "@/domain/experiment/lifecycle";
import { experimentResultDefaults } from "@/domain/evidence/trust";

type Params = {
  params: Promise<{ sessionId: string; experimentId: string }>;
};

export async function GET(request: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const user = await requireAuth(request);
    const { sessionId, experimentId } = await params;
    const repos = getRepositories();
    const session = await repos.sessions.getBySessionId(sessionId, user.uid);
    if (!session) {
      return jsonError("NOT_FOUND", "Session not found", requestId);
    }
    const experiment = await repos.experiments.getById(
      session.workspaceId,
      sessionId,
      experimentId
    );
    if (!experiment || experiment.ownerId !== user.uid) {
      return jsonError("NOT_FOUND", "Experiment not found", requestId);
    }
    return jsonOk({ experiment, requestId });
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const user = await requireAuth(request);
    const { sessionId, experimentId } = await params;
    const body = TransitionExperimentSchema.parse(await request.json());
    const repos = getRepositories();
    const session = await repos.sessions.getBySessionId(sessionId, user.uid);
    if (!session) {
      return jsonError("NOT_FOUND", "Session not found", requestId);
    }
    const existing = await repos.experiments.getById(
      session.workspaceId,
      sessionId,
      experimentId
    );
    if (!existing || existing.ownerId !== user.uid) {
      return jsonError("NOT_FOUND", "Experiment not found", requestId);
    }
    assertExperimentTransition(existing.status, body.status);

    if (body.status === "COMPLETED" && !body.results) {
      return jsonError(
        "VALIDATION_ERROR",
        "COMPLETED experiments require results — a plan is not evidence",
        requestId
      );
    }

    const experiment = await repos.experiments.update(
      session.workspaceId,
      sessionId,
      experimentId,
      {
        status: body.status,
        results: body.results,
        winnerVariantId: body.winnerVariantId,
      }
    );

    if (body.status === "COMPLETED" && body.results) {
      const trust = experimentResultDefaults();
      await repos.evidence.create({
        workspaceId: session.workspaceId,
        sessionId,
        ownerId: user.uid,
        type: "EXPERIMENT",
        claim: `Experiment ${experiment.hypothesis}: ${JSON.stringify(body.results)}`,
        source: `experiment:${experiment.id}`,
        reliability: trust.reliability,
        createdBy: trust.createdBy,
        supportsOptionIds: [],
        contradictsOptionIds: [],
        verificationStatus: trust.verificationStatus,
        verifiedBy: trust.verifiedBy,
        verifiedAt: new Date().toISOString(),
        verificationMethod: "experiment.completed",
        metadata: { experimentId: experiment.id, results: body.results },
        createdAt: new Date().toISOString(),
      });
    }

    return jsonOk({ experiment, requestId });
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
