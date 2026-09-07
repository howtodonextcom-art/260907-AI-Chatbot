import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { v4 as uuidv4 } from "uuid";
import {
  AppError,
  makeApiError,
  type ApiErrorCode,
} from "@/infrastructure/api/errors";

export function createRequestId(): string {
  return uuidv4();
}

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function jsonError(
  code: ApiErrorCode,
  message: string,
  requestId: string,
  status?: number
): NextResponse {
  const statusMap: Partial<Record<ApiErrorCode, number>> = {
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    VALIDATION_ERROR: 400,
    RATE_LIMITED: 429,
    PROVIDER_TIMEOUT: 504,
    PROVIDER_ERROR: 502,
    AI_BUDGET_EXCEEDED: 402,
    SCHEMA_INVALID: 422,
    SESSION_INVALID_STATE: 409,
    IDEMPOTENCY_CONFLICT: 409,
    INTERNAL_ERROR: 500,
  };
  return NextResponse.json(makeApiError(code, message, requestId), {
    status: status ?? statusMap[code] ?? 500,
  });
}

export function handleRouteError(error: unknown, requestId: string): NextResponse {
  if (error instanceof AppError) {
    return jsonError(error.code, error.message, requestId, error.status);
  }
  if (error instanceof ZodError) {
    return jsonError(
      "VALIDATION_ERROR",
      error.errors.map((e) => e.message).join("; "),
      requestId
    );
  }
  console.error(`[${requestId}]`, error instanceof Error ? error.message : "unknown");
  return jsonError("INTERNAL_ERROR", "Unexpected server error", requestId);
}
