import { readFileSync } from "node:fs";
import { getServerEnv } from "@/config/env";
import { AppError } from "@/infrastructure/api/errors";

type AdminApp = import("firebase-admin/app").App;
type Auth = import("firebase-admin/auth").Auth;
type Firestore = import("firebase-admin/firestore").Firestore;
type ServiceAccount = import("firebase-admin").ServiceAccount;

let app: AdminApp | null = null;

function loadServiceAccountFromFile(path: string): ServiceAccount {
  const raw = readFileSync(path, "utf8");
  const json = JSON.parse(raw) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  if (!json.project_id || !json.client_email || !json.private_key) {
    throw new Error(
      "Firebase Admin credentials file is missing project_id, client_email, or private_key"
    );
  }
  return {
    projectId: json.project_id,
    clientEmail: json.client_email,
    privateKey: json.private_key,
  };
}

function getAdminApp(): AdminApp {
  if (app) return app;
  const env = getServerEnv();
  if (!env.hasFirebaseAdmin) {
    // Was a plain Error before — handleRouteError() flattens any non-AppError
    // into the generic "Unexpected server error", so this exact, common
    // misconfiguration (e.g. deployed to Vercel, which has no persistent
    // filesystem for a service.json file — only the inline vars below work
    // there) was invisible in the API response, only in server logs.
    throw new AppError(
      "INTERNAL_ERROR",
      "Firebase Admin is not configured for this environment: set " +
        "FIREBASE_ADMIN_PROJECT_ID + FIREBASE_ADMIN_CLIENT_EMAIL + " +
        "FIREBASE_ADMIN_PRIVATE_KEY (required on Vercel — there is no " +
        "persistent filesystem for a service.json file there), or " +
        "FIREBASE_ADMIN_CREDENTIALS_PATH for a local/server file path.",
      500
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const admin = require("firebase-admin") as typeof import("firebase-admin");
  if (admin.apps.length > 0) {
    app = admin.apps[0] as AdminApp;
    return app;
  }

  let credential;
  if (env.firebaseAdminCredentialsPath) {
    credential = admin.credential.cert(
      loadServiceAccountFromFile(env.firebaseAdminCredentialsPath)
    );
  } else {
    const privateKey = env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
    credential = admin.credential.cert({
      projectId: env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    });
  }

  app = admin.initializeApp({
    credential,
    projectId:
      env.FIREBASE_ADMIN_PROJECT_ID ||
      env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      undefined,
  });
  return app;
}

export function getAdminAuth(): Auth {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const admin = require("firebase-admin") as typeof import("firebase-admin");
  getAdminApp();
  return admin.auth();
}

const firestoreSettingsFlag = globalThis as typeof globalThis & {
  __layeraFirestoreSettingsApplied?: boolean;
};

export function getAdminDb(): Firestore {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const admin = require("firebase-admin") as typeof import("firebase-admin");
  getAdminApp();
  const db = admin.firestore();
  if (!firestoreSettingsFlag.__layeraFirestoreSettingsApplied) {
    // Optional fields (e.g. Workspace.description, DecisionSession.objective)
    // are `undefined` when absent — Firestore rejects that by default.
    // Persist the flag on globalThis so Turbopack HMR does not call settings() twice.
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (!msg.includes("already been initialized")) throw err;
    }
    firestoreSettingsFlag.__layeraFirestoreSettingsApplied = true;
  }
  return db;
}

/**
 * Verifies a Firebase Auth ID token. Uses Google's public signing certs
 * directly, so it works without a service account (service.json) — the
 * Admin SDK above is only needed for Firestore access.
 */
export async function verifyIdToken(token: string) {
  const env = getServerEnv();
  const projectId =
    env.FIREBASE_ADMIN_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("Firebase project id is not configured");
  }
  const { verifyFirebaseIdToken } = await import(
    "@/infrastructure/firebase/verify-id-token"
  );
  return verifyFirebaseIdToken(token, projectId);
}

/** Test helper — clears cached Admin app (does not delete firebase-admin apps). */
export function resetAdminAppCache(): void {
  app = null;
  firestoreSettingsFlag.__layeraFirestoreSettingsApplied = false;
}
