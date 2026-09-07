export function mapFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code: string }).code)
      : "";
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (code.includes("unauthorized-domain") || message.includes("unauthorized-domain")) {
    return "Domain chưa được Firebase cho phép. Thêm domain Vercel vào Authentication → Settings → Authorized domains.";
  }
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "Email hoặc mật khẩu không đúng.";
  }
  if (code.includes("email-already-in-use")) {
    return "Email này đã có tài khoản. Hãy đăng nhập.";
  }
  if (code.includes("weak-password")) {
    return "Mật khẩu tối thiểu 6 ký tự.";
  }
  if (code.includes("invalid-email")) {
    return "Email không hợp lệ.";
  }
  if (code.includes("operation-not-allowed")) {
    return "Đăng nhập email/mật khẩu chưa bật trên Firebase Authentication.";
  }
  if (code.includes("too-many-requests")) {
    return "Thử quá nhiều lần. Đợi rồi thử lại.";
  }
  return message || "Đăng nhập thất bại";
}
