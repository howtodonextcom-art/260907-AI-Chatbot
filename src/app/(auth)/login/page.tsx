"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getClientAuth,
  isFirebaseClientConfigured,
} from "@/infrastructure/firebase/client";
import { setAuthToken } from "@/features/workspace/api-client";
import { mapFirebaseAuthError } from "@/features/workspace/auth-errors";
import { LabMark } from "@/components/ui/LabMark";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"signin" | "signup" | "dev" | null>(null);
  const firebaseReady = isFirebaseClientConfigured();

  async function afterAuth(user: { getIdToken: () => Promise<string> }) {
    const token = await user.getIdToken();
    setAuthToken(token);
    router.push("/workspaces");
  }

  async function withAuth(
    mode: "signin" | "signup",
    action: (
      auth: NonNullable<Awaited<ReturnType<typeof getClientAuth>>>
    ) => Promise<void>
  ) {
    setBusy(mode);
    setError(null);
    try {
      const auth = await getClientAuth();
      if (!auth) {
        throw new Error("Firebase client chưa cấu hình");
      }
      await action(auth);
    } catch (e) {
      const mapped = mapFirebaseAuthError(e);
      setError(mapped);
    } finally {
      setBusy(null);
    }
  }

  async function signInEmail(e: React.FormEvent) {
    e.preventDefault();
    await withAuth("signin", async (auth) => {
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      const result = await signInWithEmailAndPassword(auth, email, password);
      await afterAuth(result.user);
    });
  }

  async function signUpEmail() {
    await withAuth("signup", async (auth) => {
      const { createUserWithEmailAndPassword } = await import("firebase/auth");
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await afterAuth(result.user);
    });
  }

  async function continueDev() {
    setBusy("dev");
    setAuthToken("dev:dev-user-1");
    router.push("/workspaces");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div className="lab-hero-visual flex flex-col gap-5">
        <Link href="/" className="flex items-center gap-3 self-start">
          <LabMark size={32} />
          <span className="type-eyebrow">AI Decision Lab</span>
        </Link>
        <h1 className="type-title">Vào phòng Lab</h1>
        <p className="type-body-muted">
          Đăng nhập bằng email và mật khẩu để mở workspace và Decision Session.
        </p>
        {firebaseReady ? (
          <form onSubmit={signInEmail} className="grid gap-3">
            <label className="grid gap-1 text-sm">
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                className="lab-input px-3 py-2"
                placeholder="ban@example.com"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Mật khẩu
              <input
                type="password"
                required
                minLength={6}
                autoComplete="current-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                className="lab-input px-3 py-2"
                placeholder="Tối thiểu 6 ký tự"
              />
            </label>
            <button
              type="submit"
              disabled={busy !== null}
              className="lab-btn lab-btn-primary lab-cta-pulse"
            >
              {busy === "signin" ? "Đang đăng nhập…" : "Đăng nhập"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void signUpEmail()}
              className="lab-btn"
            >
              {busy === "signup" ? "Đang tạo…" : "Tạo tài khoản"}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => void continueDev()}
            className="lab-btn lab-btn-primary lab-cta-pulse"
          >
            Tiếp tục (Dev Auth Bypass)
          </button>
        )}
        {error ? (
          <p className="text-sm" role="alert" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
