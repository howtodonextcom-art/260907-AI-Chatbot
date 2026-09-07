/**
 * Runtime evidence for Firebase Admin + Firestore connected mode.
 * Does not print secrets. Loads .env.local manually for Node scripts.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

function loadEnvLocal() {
  const envPath = join(root, ".env.local");
  if (!existsSync(envPath)) {
    throw new Error(".env.local missing");
  }
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function truthy(v) {
  return ["1", "true", "yes", "on"].includes(String(v || "").toLowerCase());
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  process.chdir(root);
  loadEnvLocal();

  const credRaw =
    process.env.FIREBASE_ADMIN_CREDENTIALS_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    "";
  const credPath = credRaw
    ? resolve(root, credRaw)
    : resolve(root, "service.json");

  const hasFirebaseClient = Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  );
  const hasFirebaseAdmin = existsSync(credPath);
  const connectedMode = hasFirebaseClient && hasFirebaseAdmin;
  const useMemoryStore = truthy(process.env.USE_MEMORY_STORE);
  const bypassRequested = truthy(process.env.DEV_AUTH_BYPASS);
  const devAuthBypass = !connectedMode && bypassRequested;

  console.log("=== Firebase connected-mode verify ===");
  console.log(
    JSON.stringify(
      {
        hasFirebaseClient,
        hasFirebaseAdmin,
        connectedMode,
        useMemoryStore,
        bypassRequested,
        effectiveDevAuthBypass: devAuthBypass,
        credentialsFileExists: existsSync(credPath),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || null,
        hasGemini: Boolean(process.env.GEMINI_API_KEY),
        hasGroq: Boolean(process.env.GROQ_API_KEY),
      },
      null,
      2
    )
  );

  assert(hasFirebaseClient, "Firebase client public config incomplete");
  assert(hasFirebaseAdmin, "service account credentials file missing");
  assert(connectedMode, "connectedMode expected true");
  assert(!useMemoryStore, "USE_MEMORY_STORE must be false for connected mode");
  assert(
    !bypassRequested,
    "DEV_AUTH_BYPASS must be false for connected mode"
  );

  const admin = require("firebase-admin");
  if (admin.apps.length === 0) {
    // Load via file URL to avoid printing path contents; cert from JSON object.
    const sa = JSON.parse(readFileSync(credPath, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: sa.project_id,
        clientEmail: sa.client_email,
        privateKey: sa.private_key,
      }),
      projectId:
        process.env.FIREBASE_ADMIN_PROJECT_ID ||
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
        sa.project_id,
    });
  }

  const auth = admin.auth();
  let invalidRejected = false;
  try {
    await auth.verifyIdToken("not-a-real-token");
  } catch {
    invalidRejected = true;
  }
  assert(invalidRejected, "verifyIdToken should reject invalid tokens");
  console.log("PASS: Auth verifyIdToken rejects invalid token (fail-closed)");

  const db = admin.firestore();
  const probeRef = db.collection("_health").doc("connection-probe");
  await probeRef.set({
    ok: true,
    at: new Date().toISOString(),
    source: "scripts/verify-firebase.mjs",
  });
  const snap = await probeRef.get();
  assert(snap.exists, "Firestore write/read failed");
  assert(snap.data()?.ok === true, "Firestore round-trip data mismatch");
  await probeRef.delete();
  console.log(
    "PASS: Firestore Admin read/write/delete on _health/connection-probe"
  );

  console.log("RESULT: PASS — Firebase Auth Admin + Firestore connected");
}

main().catch((err) => {
  console.error("RESULT: FAIL —", err instanceof Error ? err.message : err);
  process.exit(1);
});
