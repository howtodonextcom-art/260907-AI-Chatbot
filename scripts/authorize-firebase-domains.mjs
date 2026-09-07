/**
 * Enable email/password and add Auth authorized domains (Vercel + localhost).
 * Does not print secrets.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

function loadEnvLocal() {
  const envPath = join(root, ".env.local");
  if (!existsSync(envPath)) return;
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

function extraDomains() {
  const fromEnv = (process.env.FIREBASE_AUTH_AUTHORIZED_DOMAINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [
    "localhost",
    "aichatbot-inky-phi.vercel.app",
    ...fromEnv,
  ];
}

async function main() {
  process.chdir(root);
  loadEnvLocal();

  const credRaw =
    process.env.FIREBASE_ADMIN_CREDENTIALS_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    "./service.json";
  const credPath = resolve(root, credRaw);
  if (!existsSync(credPath)) {
    throw new Error("service account file missing");
  }

  const admin = require("firebase-admin");
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(credPath),
    });
  }

  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_ADMIN_PROJECT_ID;
  if (!projectId) throw new Error("missing project id");

  const { access_token: accessToken } = await admin
    .app()
    .options.credential.getAccessToken();

  const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;
  const getRes = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const current = await getRes.json();
  if (!getRes.ok) {
    throw new Error(`GET config failed: ${getRes.status} ${JSON.stringify({ error: current.error?.message })}`);
  }

  const existing = Array.isArray(current.authorizedDomains)
    ? current.authorizedDomains
    : [];
  const merged = [...new Set([...existing, ...extraDomains()])];

  const patchRes = await fetch(`${url}?updateMask=authorizedDomains,signIn.email`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      authorizedDomains: merged,
      signIn: { email: { enabled: true, passwordRequired: true } },
    }),
  });
  const patched = await patchRes.json();
  if (!patchRes.ok) {
    throw new Error(
      `PATCH config failed: ${patchRes.status} ${JSON.stringify({ error: patched.error?.message })}`
    );
  }

  console.log(
    JSON.stringify(
      {
        projectId,
        emailPasswordEnabled: Boolean(patched.signIn?.email?.enabled),
        authorizedDomains: patched.authorizedDomains,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
