import Link from "next/link";
import { LabMark } from "@/components/ui/LabMark";

export default function HomePage() {
  return (
    <main className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="lab-hero-visual flex flex-col gap-7">
        <div className="flex items-center gap-3">
          <LabMark size={36} />
          <p className="type-eyebrow">Layer A</p>
        </div>
        <h1
          className="max-w-3xl leading-[1.08]"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--type-hero)",
          }}
        >
          AI Decision Lab
        </h1>
        <p className="type-body-muted max-w-xl text-lg">
          Chat là bề mặt tương tác. Quyết định mới là sản phẩm. Định khung vấn
          đề, kiểm chứng giả định, so sánh phương án, ghi nhận Decision Record
          và bàn giao Blueprint.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/workspaces" className="lab-btn lab-btn-primary lab-cta-pulse">
            Mở Workspace
          </Link>
          <Link href="/login" className="lab-btn lab-btn-ghost">
            Đăng nhập
          </Link>
        </div>
      </div>

      <aside
        className="lab-hero-visual rounded-[14px] border p-5"
        style={{
          borderColor: "var(--border)",
          background: "color-mix(in oklab, var(--bg-panel) 88%, transparent)",
          animationDelay: "80ms",
        }}
        aria-label="Sơ đồ Decision Canvas"
      >
        <p className="type-eyebrow mb-4">Decision flow</p>
        <svg viewBox="0 0 320 260" className="w-full" role="img">
          <title>Luồng quyết định: vấn đề → phương án → thẩm định → quyết định</title>
          <rect x="16" y="20" width="120" height="44" rx="8" fill="var(--bg-elevated)" stroke="var(--border)" />
          <text x="76" y="47" textAnchor="middle" fill="var(--text)" fontSize="13" fontFamily="var(--font-body)">
            Vấn đề
          </text>
          <rect x="184" y="20" width="120" height="44" rx="8" fill="var(--bg-elevated)" stroke="var(--border)" />
          <text x="244" y="47" textAnchor="middle" fill="var(--text)" fontSize="13" fontFamily="var(--font-body)">
            Giả định
          </text>
          <path d="M76 64V92H244V64" fill="none" stroke="var(--border-strong)" strokeWidth="1.5" />
          <rect
            x="100"
            y="100"
            width="120"
            height="44"
            rx="8"
            fill="color-mix(in oklab, var(--accent) 18%, var(--bg-elevated))"
            stroke="var(--accent)"
          />
          <text x="160" y="127" textAnchor="middle" fill="var(--text)" fontSize="13" fontFamily="var(--font-body)">
            Phương án
          </text>
          <path d="M160 144V172" stroke="var(--border-strong)" strokeWidth="1.5" />
          <rect x="40" y="172" width="100" height="40" rx="8" fill="var(--bg-elevated)" stroke="var(--border)" />
          <text x="90" y="197" textAnchor="middle" fill="var(--text-muted)" fontSize="12" fontFamily="var(--font-body)">
            Critic
          </text>
          <rect x="180" y="172" width="100" height="40" rx="8" fill="var(--bg-elevated)" stroke="var(--border)" />
          <text x="230" y="197" textAnchor="middle" fill="var(--text-muted)" fontSize="12" fontFamily="var(--font-body)">
            Judge
          </text>
          <path d="M90 212V228H230V212" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
          <rect
            x="100"
            y="220"
            width="120"
            height="28"
            rx="6"
            fill="var(--accent-strong)"
          />
          <text x="160" y="239" textAnchor="middle" fill="white" fontSize="12" fontFamily="var(--font-body)">
            Decision Record
          </text>
        </svg>
        <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
          Critic/Judge chỉ chạy ở Mode DEEP — STANDARD chỉ Analyst. Lab ghi nhận
          bằng chứng và kết luận, không chỉ hội thoại.
        </p>
      </aside>
    </main>
  );
}
