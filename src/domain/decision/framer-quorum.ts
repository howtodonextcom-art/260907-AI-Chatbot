import type { IndependentFrame } from "@/domain/decision/types";
import { AppError } from "@/infrastructure/api/errors";

/** Minimum independent successful framers required for Conflict Engine. */
export const MIN_FRAMER_QUORUM = 2;

export interface FramerFailureMeta {
  provider: string;
  error: string;
  runId?: string;
}

/**
 * Thrown when Parallel Blind Framing cannot meet quorum (≥2 successful frames).
 * Callers must NOT invoke the Conflict Engine or advance the session framing.
 */
export class InsufficientFramersError extends AppError {
  readonly failures: FramerFailureMeta[];
  readonly successfulCount: number;
  readonly attemptedProviders: string[];

  constructor(args: {
    successfulCount: number;
    failures: FramerFailureMeta[];
    attemptedProviders: string[];
  }) {
    const failSummary = args.failures
      .map((f) => `${f.provider}: ${f.error}`)
      .join("; ");
    super(
      "PROVIDER_ERROR",
      `Insufficient framer quorum: need ≥${MIN_FRAMER_QUORUM} independent frames, got ${args.successfulCount}. Failures: ${failSummary || "none"}`,
      502
    );
    this.name = "InsufficientFramersError";
    this.failures = args.failures;
    this.successfulCount = args.successfulCount;
    this.attemptedProviders = args.attemptedProviders;
  }
}

/**
 * Assert quorum before Conflict Engine. Silent single-provider degradation
 * is forbidden for Parallel Blind Framing.
 */
export function assertFramerQuorum(args: {
  frames: IndependentFrame[];
  failures: FramerFailureMeta[];
  attemptedProviders: string[];
}): IndependentFrame[] {
  if (args.frames.length < MIN_FRAMER_QUORUM) {
    throw new InsufficientFramersError({
      successfulCount: args.frames.length,
      failures: args.failures,
      attemptedProviders: args.attemptedProviders,
    });
  }
  return args.frames;
}
