"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getClientAuth,
  isFirebaseClientConfigured,
} from "@/infrastructure/firebase/client";
import { setAuthToken } from "@/features/workspace/api-client";
import { LabMark } from "@/components/ui/LabMark";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firebaseReady = isFirebaseClientConfigured();

  useEffect(() => {
    if (!firebaseReady) {
      setAuthToken("dev:dev-user-1");
    }
  }, [firebaseReady]);

  async function continueDev() {
    setAuthToken("dev:dev-user-1");
    router.push("/workspaces");
  }

  async function signInGoogle() {
    setBusy(true);
    setError(null);
    try {
      const auth = await getClientAuth();
      if (!auth) {
        throw new Error("Firebase client chưa cấu hình");
      }
      const { GoogleAuthProvider, signInWithPopup } = await import(
        "firebase/auth"
      );
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const token = await result.user.getIdToken();
      setAuthToken(token);
      router.push("/workspaces");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đăng nhập thất bại");
    } finally {
      setBusy(false);
    }
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
          Xác thực để mở workspace và Decision Session. Môi trường local có thể
          dùng Dev Auth Bypass khi chưa gắn Firebase.
        </p>
        {firebaseReady ? (
          <button
            type="button"
            disabled={busy}
            onClick={signInGoogle}
            className="lab-btn lab-btn-primary lab-cta-pulse"
          >
            {busy ? "Đang đăng nhập…" : "Tiếp tục với Google"}
          </button>
        ) : (
          <button
            type="button"
            onClick={continueDev}
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
