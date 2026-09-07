import { getServerEnv } from "@/config/env";
import { AppError } from "@/infrastructure/api/errors";

export interface AuthUser {
  uid: string;
  email?: string;
}

export async function requireAuth(
  request: Request
): Promise<AuthUser> {
  const env = getServerEnv();
  const authHeader = request.headers.get("authorization");

  if (env.devAuthBypass) {
    const bypassUid =
      request.headers.get("x-dev-uid") ||
      env.DEV_AUTH_UID ||
      "dev-user-1";
    if (!authHeader && env.useMemoryStore) {
      return { uid: bypassUid, email: "dev@localhost" };
    }
    if (authHeader?.startsWith("Bearer dev:")) {
      return {
        uid: authHeader.slice("Bearer dev:".length) || bypassUid,
        email: "dev@localhost",
      };
    }
    if (!authHeader && env.devAuthBypass) {
      return { uid: bypassUid, email: "dev@localhost" };
    }
  }

  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError("UNAUTHORIZED", "Missing bearer token", 401);
  }

  const token = authHeader.slice("Bearer ".length);
  if (token.startsWith("dev:") && env.devAuthBypass) {
    return { uid: token.slice(4) || env.DEV_AUTH_UID || "dev-user-1" };
  }

  const { verifyIdToken } = await import("@/infrastructure/firebase/admin");
  try {
    const decoded = await verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    throw new AppError("UNAUTHORIZED", "Invalid authentication token", 401);
  }
}
