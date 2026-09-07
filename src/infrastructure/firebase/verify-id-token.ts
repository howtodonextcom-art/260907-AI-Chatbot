import { createPublicKey, verify as verifySignature } from "node:crypto";

const CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const CLOCK_SKEW_SECONDS = 30;
const DEFAULT_CERTS_TTL_MS = 60 * 60 * 1000;

let certsCache: { certs: Record<string, string>; expiresAt: number } | null =
  null;

async function getGoogleCerts(): Promise<Record<string, string>> {
  if (certsCache && certsCache.expiresAt > Date.now()) {
    return certsCache.certs;
  }
  const res = await fetch(CERTS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Google signing certs: ${res.status}`);
  }
  const certs = (await res.json()) as Record<string, string>;
  const maxAge = res.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1];
  const ttlMs = maxAge ? Number(maxAge) * 1000 : DEFAULT_CERTS_TTL_MS;
  certsCache = { certs, expiresAt: Date.now() + ttlMs };
  return certs;
}

function base64UrlToBuffer(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export interface VerifiedFirebaseToken {
  uid: string;
  email?: string;
  emailVerified?: boolean;
}

/**
 * Verifies a Firebase Auth ID token's RS256 signature against Google's public
 * signing certs and checks standard claims — no service account required.
 * Mirrors the algorithm the Firebase Admin SDK uses internally.
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */
export async function verifyFirebaseIdToken(
  token: string,
  projectId: string
): Promise<VerifiedFirebaseToken> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed ID token");
  }
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = JSON.parse(base64UrlToBuffer(headerB64).toString("utf8")) as {
    alg?: string;
    kid?: string;
  };
  if (header.alg !== "RS256") {
    throw new Error(`Unexpected token algorithm: ${header.alg}`);
  }
  if (!header.kid) {
    throw new Error("Token header missing kid");
  }

  const payload = JSON.parse(
    base64UrlToBuffer(payloadB64).toString("utf8")
  ) as {
    iss?: string;
    aud?: string;
    exp?: number;
    iat?: number;
    auth_time?: number;
    sub?: string;
    user_id?: string;
    email?: string;
    email_verified?: boolean;
  };

  const certs = await getGoogleCerts();
  const cert = certs[header.kid];
  if (!cert) {
    throw new Error("No matching signing certificate for token kid");
  }

  const publicKey = createPublicKey(cert);
  const signedData = Buffer.from(`${headerB64}.${payloadB64}`, "utf8");
  const signature = base64UrlToBuffer(signatureB64);
  if (!verifySignature("RSA-SHA256", signedData, publicKey, signature)) {
    throw new Error("Token signature verification failed");
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp + CLOCK_SKEW_SECONDS < now) {
    throw new Error("Token expired");
  }
  if (!payload.iat || payload.iat - CLOCK_SKEW_SECONDS > now) {
    throw new Error("Token issued in the future");
  }
  if (payload.auth_time && payload.auth_time - CLOCK_SKEW_SECONDS > now) {
    throw new Error("Token auth_time in the future");
  }
  if (payload.aud !== projectId) {
    throw new Error("Token audience does not match project");
  }
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error("Token issuer does not match project");
  }
  const uid = payload.sub || payload.user_id;
  if (!uid) {
    throw new Error("Token missing subject");
  }

  return { uid, email: payload.email, emailVerified: payload.email_verified };
}
