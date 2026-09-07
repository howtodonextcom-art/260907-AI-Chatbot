import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { z } from "zod";

const boolFromEnv = z
  .string()
  .optional()
  .transform((v) => {
    if (v === undefined || v === "") return undefined;
    return ["1", "true", "yes", "on"].includes(v.toLowerCase());
  });

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().optional(),

  FIREBASE_ADMIN_PROJECT_ID: z.string().optional(),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_ADMIN_PRIVATE_KEY: z.string().optional(),
  /** Absolute or cwd-relative path to a service account JSON file (preferred). */
  FIREBASE_ADMIN_CREDENTIALS_PATH: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),

  USE_MEMORY_STORE: boolFromEnv,
  DEV_AUTH_BYPASS: boolFromEnv,
  DEV_AUTH_UID: z.string().optional(),

  ENABLE_CRITIC: boolFromEnv,
  ENABLE_JUDGE: boolFromEnv,
  ENABLE_CHALLENGEREADY_PACK: boolFromEnv,
});

export type ServerEnv = z.infer<typeof serverEnvSchema> & {
  useMemoryStore: boolean;
  devAuthBypass: boolean;
  enableCritic: boolean;
  enableJudge: boolean;
  enableChallengeReadyPack: boolean;
  hasFirebaseAdmin: boolean;
  hasFirebaseClient: boolean;
  hasGemini: boolean;
  hasGroq: boolean;
  hasDeepseek: boolean;
  firebaseAdminCredentialsPath: string | null;
  connectedMode: boolean;
};

let cached: ServerEnv | null = null;

export function resolveCredentialsPath(
  raw: string | undefined
): string | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  const absolute = isAbsolute(trimmed)
    ? trimmed
    : resolve(process.cwd(), trimmed);
  return existsSync(absolute) ? absolute : null;
}

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }

  const data = parsed.data;
  const firebaseAdminCredentialsPath = resolveCredentialsPath(
    data.FIREBASE_ADMIN_CREDENTIALS_PATH || data.GOOGLE_APPLICATION_CREDENTIALS
  );
  const hasInlineAdminCert = Boolean(
    data.FIREBASE_ADMIN_PROJECT_ID &&
      data.FIREBASE_ADMIN_CLIENT_EMAIL &&
      data.FIREBASE_ADMIN_PRIVATE_KEY
  );
  const hasFirebaseAdmin = Boolean(
    firebaseAdminCredentialsPath || hasInlineAdminCert
  );
  const hasFirebaseClient = Boolean(
    data.NEXT_PUBLIC_FIREBASE_API_KEY &&
      data.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      data.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      data.NEXT_PUBLIC_FIREBASE_APP_ID
  );

  const connectedMode = hasFirebaseAdmin && hasFirebaseClient;

  // Fail-closed: memory store only when explicitly requested, or when Admin is missing (non-prod).
  const useMemoryStore =
    data.USE_MEMORY_STORE === true ||
    (!hasFirebaseAdmin && data.NODE_ENV !== "production");

  // Fail-closed: never allow auth bypass when Firebase connected mode is available.
  const devAuthBypass =
    !connectedMode &&
    data.DEV_AUTH_BYPASS === true &&
    data.NODE_ENV !== "production";

  const env: ServerEnv = {
    ...data,
    useMemoryStore,
    devAuthBypass,
    enableCritic: data.ENABLE_CRITIC !== false,
    enableJudge: data.ENABLE_JUDGE !== false,
    enableChallengeReadyPack: data.ENABLE_CHALLENGEREADY_PACK !== false,
    hasFirebaseAdmin,
    hasFirebaseClient,
    hasGemini: Boolean(data.GEMINI_API_KEY),
    hasGroq: Boolean(data.GROQ_API_KEY),
    hasDeepseek: Boolean(data.DEEPSEEK_API_KEY),
    firebaseAdminCredentialsPath,
    connectedMode,
  };

  cached = env;
  return env;
}

export function resetEnvCache(): void {
  cached = null;
}
