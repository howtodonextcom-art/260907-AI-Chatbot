import Link from "next/link";
import { LabMark } from "@/components/ui/LabMark";

export default function HomePage() {
  return (
    <main className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="flex flex-col gap-7">
        <div className="lab-hero-visual flex items-center gap-3">
          <LabMark size={36} />
          <p className="type-eyebrow">Layer A</p>
        </div>
        <h1
          className="lab-hero-visual max-w-3xl leading-[1.08]"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--type-hero)",
            animationDelay: "70ms",
          }}
        >
          AI Decision Lab
        </h1>
        <p
          className="lab-hero-visual type-body-muted max-w-xl text-lg"
          style={{ animationDelay: "140ms" }}
        >
          Chat là bề mặt tương tác. Quyết định mới là sản phẩm. 3 mô hình AI
          định khung độc lập, đối chiếu bất đồng, rồi một Judge tổng hợp —
          bạn luôn là người duyệt cuối cùng.
        </p>
        <div
          className="lab-hero-visual flex flex-wrap gap-3"
          style={{ animationDelay: "210ms" }}
        >
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
        aria-label="Sơ đồ tranh luận đa mô hình"
      >
        <p className="type-eyebrow mb-4">Parallel Blind Framing</p>
        <svg viewBox="0 0 320 260" className="w-full" role="img">
          <title>
            3 mô hình định khung độc lập → phát hiện bất đồng → Judge tổng hợp
            → Decision Record
          </title>
          <rect x="8" y="16" width="92" height="36" rx="8" fill="color-mix(in oklab, var(--analyst) 16%, var(--bg-elevated))" stroke="var(--analyst)" />
          <text x="54" y="39" textAnchor="middle" fill="var(--text)" fontSize="12" fontFamily="var(--font-body)">Gemini</text>
          <rect x="114" y="16" width="92" height="36" rx="8" fill="color-mix(in oklab, var(--second-opinion) 16%, var(--bg-elevated))" stroke="var(--second-opinion)" />
          <text x="160" y="39" textAnchor="middle" fill="var(--text)" fontSize="12" fontFamily="var(--font-body)">DeepSeek</text>
          <rect x="220" y="16" width="92" height="36" rx="8" fill="color-mix(in oklab, var(--critic) 16%, var(--bg-elevated))" stroke="var(--critic)" />
          <text x="266" y="39" textAnchor="middle" fill="var(--text)" fontSize="12" fontFamily="var(--font-body)">Groq</text>

          <path d="M54 52V78M160 52V78M266 52V78" fill="none" stroke="var(--border-strong)" strokeWidth="1.5" />
          <path d="M54 78H266" fill="none" stroke="var(--border-strong)" strokeWidth="1.5" />
          <path d="M160 78V92" fill="none" stroke="var(--border-strong)" strokeWidth="1.5" />

          <rect x="90" y="94" width="140" height="40" rx="8" fill="color-mix(in oklab, var(--danger) 14%, var(--bg-elevated))" stroke="var(--danger)" />
          <text x="160" y="118" textAnchor="middle" fill="var(--text)" fontSize="12" fontFamily="var(--font-body)">Conflict Map</text>

          <path d="M160 134V156" fill="none" stroke="var(--border-strong)" strokeWidth="1.5" />

          <rect x="90" y="158" width="140" height="40" rx="8" fill="color-mix(in oklab, var(--judge) 18%, var(--bg-elevated))" stroke="var(--judge)" />
          <text x="160" y="182" textAnchor="middle" fill="var(--text)" fontSize="12" fontFamily="var(--font-body)">Judge</text>

          <path d="M160 198V212" fill="none" stroke="var(--accent)" strokeWidth="1.5" />

          <rect x="70" y="214" width="180" height="30" rx="6" fill="var(--accent-strong)" />
          <text x="160" y="234" textAnchor="middle" fill="white" fontSize="12" fontFamily="var(--font-body)">Decision Record</text>
        </svg>
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
          <li><span style={{ color: "var(--danger)" }}>■</span> Bất đồng cần con người xử lý</li>
          <li><span style={{ color: "var(--judge)" }}>■</span> Judge chỉ chạy ở Mode DEEP</li>
        </ul>
      </aside>
    </main>
  );
}
