export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_ERROR"
  | "AI_BUDGET_EXCEEDED"
  | "SCHEMA_INVALID"
  | "SESSION_INVALID_STATE"
  | "IDEMPOTENCY_CONFLICT"
  | "INTERNAL_ERROR";

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  retryable: boolean;
  requestId: string;
}

const RETRYABLE: ApiErrorCode[] = [
  "PROVIDER_TIMEOUT",
  "PROVIDER_ERROR",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
];

export function makeApiError(
  code: ApiErrorCode,
  message: string,
  requestId: string
): ApiError {
  return {
    code,
    message,
    retryable: RETRYABLE.includes(code),
    requestId,
  };
}

export class AppError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** User-facing Vietnamese copy for provider / gateway failures. */
export function humanizeProviderError(raw: unknown): string {
  const message = raw instanceof Error ? raw.message : String(raw ?? "");
  const lower = message.toLowerCase();

  if (
    lower.includes("api key") ||
    lower.includes("missing") ||
    lower.includes("not configured") ||
    lower.includes("no ai providers")
  ) {
    return "Thiếu hoặc sai API key (GEMINI_API_KEY / GROQ_API_KEY). Kiểm tra .env.local rồi khởi động lại server.";
  }
  if (
    lower.includes("model_not_found") ||
    lower.includes("no longer available") ||
    lower.includes("does not exist")
  ) {
    return "Model AI không còn khả dụng. Cập nhật model registry hoặc thử lại sau.";
  }
  if (lower.includes("429") || lower.includes("rate") || lower.includes("quota")) {
    return "Provider đang giới hạn tốc độ / hết quota. Đợi giây lát rồi thử lại.";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "Provider phản hồi quá chậm (timeout). Thử lại hoặc chuyển mode khác.";
  }
  if (message.length > 180) {
    return `Lỗi AI provider: ${message.slice(0, 160)}…`;
  }
  return message
    ? `Lỗi AI provider: ${message}`
    : "Không gọi được AI provider. Thử lại hoặc kiểm tra cấu hình.";
}
