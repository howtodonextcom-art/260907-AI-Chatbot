import { createHmac, timingSafeEqual } from "crypto";
import { AppError } from "@/infrastructure/api/errors";

const TTL_MS = 15 * 60 * 1000;

function approveSecret(): string {
  const fromEnv = process.env.HUMAN_APPROVE_HMAC_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  // Derive a stable server-only secret from Admin key material when present.
  const pk = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (pk && pk.length >= 32) {
    return createHmac("sha256", "human-approve-v1").update(pk).digest("hex");
  }
  if (process.env.NODE_ENV === "production") {
    throw new AppError(
      "INTERNAL_ERROR",
      "HUMAN_APPROVE_HMAC_SECRET (or FIREBASE_ADMIN_PRIVATE_KEY) required to mint approve proofs",
      500
    );
  }
  return "dev-only-human-approve-hmac-secret";
}

export interface HumanApproveProofPayload {
  uid: string;
  sessionId: string;
  judgeRunId: string;
  exp: number;
  sig: string;
}

function sign(payload: Omit<HumanApproveProofPayload, "sig">): string {
  const body = `${payload.uid}|${payload.sessionId}|${payload.judgeRunId}|${payload.exp}`;
  return createHmac("sha256", approveSecret()).update(body).digest("hex");
}

/** Server-minted, time-bounded proof that a human UI may call DECIDED. */
export function mintHumanApproveProof(args: {
  uid: string;
  sessionId: string;
  judgeRunId: string;
  now?: number;
}): string {
  const exp = (args.now ?? Date.now()) + TTL_MS;
  const base = {
    uid: args.uid,
    sessionId: args.sessionId,
    judgeRunId: args.judgeRunId,
    exp,
  };
  const payload: HumanApproveProofPayload = { ...base, sig: sign(base) };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/**
 * Verify proof issued by this server. Client cannot forge origin=HUMAN_APPROVE;
 * only a valid HMAC proof minted after auth binds the approve action.
 */
export function verifyHumanApproveProof(args: {
  proof: string;
  uid: string;
  sessionId: string;
  judgeRunId: string;
  now?: number;
}): void {
  let parsed: HumanApproveProofPayload;
  try {
    parsed = JSON.parse(
      Buffer.from(args.proof, "base64url").toString("utf8")
    ) as HumanApproveProofPayload;
  } catch {
    throw new AppError(
      "FORBIDDEN",
      "Invalid human approve proof",
      403
    );
  }

  if (
    parsed.uid !== args.uid ||
    parsed.sessionId !== args.sessionId ||
    parsed.judgeRunId !== args.judgeRunId
  ) {
    throw new AppError(
      "FORBIDDEN",
      "Human approve proof does not match session/user/draft",
      403
    );
  }

  const now = args.now ?? Date.now();
  if (!Number.isFinite(parsed.exp) || parsed.exp < now) {
    throw new AppError("FORBIDDEN", "Human approve proof expired", 403);
  }

  const expected = sign({
    uid: parsed.uid,
    sessionId: parsed.sessionId,
    judgeRunId: parsed.judgeRunId,
    exp: parsed.exp,
  });
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(parsed.sig ?? ""), "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError("FORBIDDEN", "Human approve proof signature invalid", 403);
  }
}
