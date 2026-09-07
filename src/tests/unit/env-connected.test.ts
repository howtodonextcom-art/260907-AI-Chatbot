import { afterEach, describe, expect, it } from "vitest";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getServerEnv, resetEnvCache } from "@/config/env";

const probePath = join(process.cwd(), ".tmp-test-sa.json");

afterEach(() => {
  resetEnvCache();
  if (existsSync(probePath)) unlinkSync(probePath);
  delete process.env.FIREBASE_ADMIN_CREDENTIALS_PATH;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.FIREBASE_ADMIN_PROJECT_ID;
  delete process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  delete process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  delete process.env.USE_MEMORY_STORE;
  delete process.env.DEV_AUTH_BYPASS;
  delete process.env.USE_STUB_MODELS;
  delete process.env.NEXT_PHASE;
  delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  delete process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  delete process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
});

describe("env connected mode", () => {
  it("detects Admin via credentials file path without inline private key", () => {
    writeFileSync(
      probePath,
      JSON.stringify({
        type: "service_account",
        project_id: "demo",
        client_email: "demo@demo.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----\n",
      }),
      "utf8"
    );

    process.env.FIREBASE_ADMIN_CREDENTIALS_PATH = probePath;
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "x";
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "demo.firebaseapp.com";
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo";
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:1:web:1";
    process.env.USE_MEMORY_STORE = "false";
    process.env.DEV_AUTH_BYPASS = "true";

    const env = getServerEnv();
    expect(env.hasFirebaseAdmin).toBe(true);
    expect(env.hasFirebaseClient).toBe(true);
    expect(env.connectedMode).toBe(true);
    expect(env.useMemoryStore).toBe(false);
    // Fail-closed: bypass off when connected even if env says true
    expect(env.devAuthBypass).toBe(false);
  });

  it("uses memory store when USE_MEMORY_STORE=true even with Admin path", () => {
    writeFileSync(
      probePath,
      JSON.stringify({
        type: "service_account",
        project_id: "demo",
        client_email: "demo@demo.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----\n",
      }),
      "utf8"
    );
    process.env.FIREBASE_ADMIN_CREDENTIALS_PATH = probePath;
    process.env.USE_MEMORY_STORE = "true";
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "x";
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "demo.firebaseapp.com";
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo";
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:1:web:1";

    const env = getServerEnv();
    expect(env.hasFirebaseAdmin).toBe(true);
    expect(env.useMemoryStore).toBe(true);
    expect(env.connectedMode).toBe(true);
    expect(env.devAuthBypass).toBe(false);
  });
});

function setNodeEnv(value: string | undefined) {
  const env = process.env as { NODE_ENV?: string };
  if (value === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = value;
}

describe("production guards", () => {
  it("forbids USE_MEMORY_STORE=true in production runtime", () => {
    const prev = process.env.NODE_ENV;
    try {
      setNodeEnv("production");
      delete process.env.NEXT_PHASE;
      process.env.USE_MEMORY_STORE = "true";
      resetEnvCache();
      expect(() => getServerEnv()).toThrow(/forbidden in production/i);
    } finally {
      setNodeEnv(prev);
    }
  });

  it("allows USE_MEMORY_STORE during next production build phase", () => {
    const prev = process.env.NODE_ENV;
    try {
      setNodeEnv("production");
      process.env.NEXT_PHASE = "phase-production-build";
      process.env.USE_MEMORY_STORE = "true";
      resetEnvCache();
      expect(getServerEnv().useMemoryStore).toBe(true);
    } finally {
      setNodeEnv(prev);
      delete process.env.NEXT_PHASE;
    }
  });

  it("DEV_AUTH_BYPASS cannot operate in production", () => {
    const prev = process.env.NODE_ENV;
    try {
      setNodeEnv("production");
      process.env.DEV_AUTH_BYPASS = "true";
      delete process.env.USE_MEMORY_STORE;
      resetEnvCache();
      expect(getServerEnv().devAuthBypass).toBe(false);
    } finally {
      setNodeEnv(prev);
    }
  });
});
