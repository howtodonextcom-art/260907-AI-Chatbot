import { AppError } from "@/infrastructure/api/errors";

export function cancelledError(): AppError {
  return new AppError("PROVIDER_ERROR", "Run cancelled", 499);
}

export function isCancelledError(error: unknown): boolean {
  if (error instanceof AppError && error.status === 499) return true;
  if (
    error instanceof Error &&
    (error.name === "AbortError" || error.message === "Run cancelled")
  ) {
    return true;
  }
  return false;
}

/**
 * Gemini / Groq SDKs do not reliably cancel in-flight HTTP. This still
 * rejects as soon as the caller aborts so the orchestrator will not
 * persist downstream artifacts.
 */
export async function withAbortSignal<T>(
  signal: AbortSignal | undefined,
  fn: () => Promise<T>
): Promise<T> {
  if (signal?.aborted) throw cancelledError();
  if (!signal) return fn();

  let onAbort: () => void = () => undefined;
  const abortPromise = new Promise<never>((_, reject) => {
    onAbort = () => reject(cancelledError());
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([fn(), abortPromise]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
