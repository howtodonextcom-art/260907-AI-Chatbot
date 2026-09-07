import { requireAuth } from "@/infrastructure/api/auth";
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
    const workspaces = await repos.workspaces.listByOwner(user.uid);
    return jsonOk({ workspaces, requestId });
  } catch (error) {
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
