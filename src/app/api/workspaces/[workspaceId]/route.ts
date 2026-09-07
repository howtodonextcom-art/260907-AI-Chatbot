import { requireAuth } from "@/infrastructure/api/auth";
import {
  createRequestId,
  handleRouteError,
  jsonError,
  jsonOk,
} from "@/infrastructure/api/http";
import { getRepositories } from "@/infrastructure/repositories";
import { UpdateWorkspaceSchema } from "@/domain/workspace/schemas";

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
    return jsonOk({ workspace, requestId });
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const user = await requireAuth(request);
    const { workspaceId } = await params;
    const body = UpdateWorkspaceSchema.parse(await request.json());
    const repos = getRepositories();
    const workspace = await repos.workspaces.update(workspaceId, user.uid, body);
    return jsonOk({ workspace, requestId });
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
