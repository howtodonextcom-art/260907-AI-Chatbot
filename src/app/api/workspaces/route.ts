import { requireAuth } from "@/infrastructure/api/auth";
import { getServerEnv } from "@/config/env";
import {
  createRequestId,
  handleRouteError,
  jsonOk,
} from "@/infrastructure/api/http";
import { getRepositories } from "@/infrastructure/repositories";
import {
  CreateWorkspaceSchema,
} from "@/domain/workspace/schemas";

export async function GET(request: Request) {
  const requestId = createRequestId();
  try {
    const user = await requireAuth(request);
    const repos = getRepositories();
    const env = getServerEnv();
    // #region agent log
    fetch("http://127.0.0.1:7577/ingest/0ef3d92a-0efa-4ea4-af96-ee377e9604cb", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "166647",
      },
      body: JSON.stringify({
        sessionId: "166647",
        runId: "pre-fix",
        hypothesisId: "B",
        location: "src/app/api/workspaces/route.ts:GET",
        message: "auth ok, listing workspaces",
        data: {
          hasUid: Boolean(user.uid),
          repoKind: repos.workspaces.constructor.name,
          useMemoryStore: env.useMemoryStore,
          connectedMode: env.connectedMode,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    const workspaces = await repos.workspaces.listByOwner(user.uid);
    // #region agent log
    fetch("http://127.0.0.1:7577/ingest/0ef3d92a-0efa-4ea4-af96-ee377e9604cb", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "166647",
      },
      body: JSON.stringify({
        sessionId: "166647",
        runId: "pre-fix",
        hypothesisId: "A",
        location: "src/app/api/workspaces/route.ts:GET:success",
        message: "listByOwner succeeded",
        data: { count: workspaces.length },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return jsonOk({ workspaces, requestId });
  } catch (error) {
    const err = error as { code?: string; message?: string; name?: string };
    // #region agent log
    fetch("http://127.0.0.1:7577/ingest/0ef3d92a-0efa-4ea4-af96-ee377e9604cb", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "166647",
      },
      body: JSON.stringify({
        sessionId: "166647",
        runId: "pre-fix",
        hypothesisId: "A",
        location: "src/app/api/workspaces/route.ts:GET:catch",
        message: "GET /api/workspaces failed",
        data: {
          name: err?.name,
          code: err?.code,
          msg: String(err?.message ?? error).slice(0, 240),
          isIndexHint: String(err?.message ?? "").includes("index"),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return handleRouteError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    const user = await requireAuth(request);
    const body = CreateWorkspaceSchema.parse(await request.json());
    const repos = getRepositories();
    const now = new Date().toISOString();
    const workspace = await repos.workspaces.create({
      ownerId: user.uid,
      name: body.name,
      description: body.description,
      defaultDomainPackId: body.defaultDomainPackId,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });
    return jsonOk({ workspace, requestId }, 201);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
