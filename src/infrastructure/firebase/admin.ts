import { readFileSync } from "node:fs";
import { getServerEnv } from "@/config/env";

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
    throw new Error("Firebase Admin is not configured");
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

let firestoreSettingsApplied = false;

export function getAdminDb(): Firestore {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const admin = require("firebase-admin") as typeof import("firebase-admin");
  getAdminApp();
  const db = admin.firestore();
  if (!firestoreSettingsApplied) {
    // Optional fields (e.g. Workspace.description, DecisionSession.objective)
    // are `undefined` when absent — Firestore rejects that by default.
    db.settings({ ignoreUndefinedProperties: true });
    firestoreSettingsApplied = true;
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
  firestoreSettingsApplied = false;
}
