import { requireAuth } from "@/infrastructure/api/auth";
import {
  createRequestId,
  handleRouteError,
  jsonError,
  jsonOk,
} from "@/infrastructure/api/http";
import { getRepositories } from "@/infrastructure/repositories";
import { CreateSessionSchema } from "@/domain/decision/schemas";
import { getDomainPack } from "@/domain-packs/registry";

type Params = { params: Promise<{ workspaceId: string }> };

export async function GET(request: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const user = await requireAuth(request);
    const { workspaceId } = await params;
    const repos = getRepositories();
    const workspace = await repos.workspaces.getById(workspaceId, user.uid);
    if (!workspace) {
      return jsonError("NOT_FOUND", "Workspace not found", requestId);
    }
    const sessions = await repos.sessions.listByWorkspace(workspaceId, user.uid);
    return jsonOk({ sessions, requestId });
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const user = await requireAuth(request);
    const { workspaceId } = await params;
    const body = CreateSessionSchema.parse(await request.json());
    const repos = getRepositories();
    const workspace = await repos.workspaces.getById(workspaceId, user.uid);
    if (!workspace) {
      return jsonError("NOT_FOUND", "Workspace not found", requestId);
    }
    const now = new Date().toISOString();
    const pack = getDomainPack(
      body.domainPackId ?? workspace.defaultDomainPackId
    );
    const criteria = (pack.getDecisionCriteria?.() ?? []).map((c) => ({
      ...c,
    }));
    const session = await repos.sessions.create({
      workspaceId,
      ownerId: user.uid,
      title: body.title,
      problem: body.problem,
      objective: body.objective,
      domainPackId: body.domainPackId ?? workspace.defaultDomainPackId,
      constraints: [],
      assumptions: [],
      unknowns: [],
      options: [],
      criteria,
      status: "DISCOVERY",
      createdAt: now,
      updatedAt: now,
    });
    return jsonOk({ session, requestId }, 201);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
