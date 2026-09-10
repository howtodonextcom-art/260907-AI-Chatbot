"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  apiFetch,
  clearAuthToken,
  getAuthToken,
} from "@/features/workspace/api-client";
import { getClientAuth } from "@/infrastructure/firebase/client";
import type { Workspace } from "@/domain/workspace/types";
import { LabMark } from "@/components/ui/LabMark";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingBlock } from "@/components/ui/LoadingBlock";

export default function WorkspacesPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [domainPackId, setDomainPackId] = useState("generic-decision");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    if (!getAuthToken()) {
      router.push("/login");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ workspaces: Workspace[] }>("/api/workspaces");
      setWorkspaces(data.workspaces);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được workspace");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    try {
      const auth = await getClientAuth();
      if (auth) {
        const { signOut } = await import("firebase/auth");
        await signOut(auth);
      }
    } finally {
      clearAuthToken();
      router.push("/login");
    }
  }

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const data = await apiFetch<{ workspace: Workspace }>("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || undefined,
          defaultDomainPackId: domainPackId,
        }),
      });
      setName("");
      setDescription("");
      router.push(`/workspaces/${data.workspace.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo workspace thất bại");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <LabMark size={34} />
          <div>
            <p className="type-eyebrow">Layer A · Decision Lab</p>
            <h1 className="type-title">Workspaces</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              Mỗi workspace là một phòng lab cho chuỗi quyết định.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          Đăng xuất
        </button>
      </header>

      <section className="mb-10" aria-labelledby="ws-list-heading">
        <h2 id="ws-list-heading" className="type-section mb-3">
          Lab đang mở
        </h2>
        {loading ? <LoadingBlock label="Đang tải workspace…" /> : null}
        {error ? (
          <p className="mb-3 text-sm" role="alert" style={{ color: "var(--danger-text)" }}>
            {error}
          </p>
        ) : null}
        {!loading && workspaces.length === 0 ? (
          <div className="lab-elevated px-4">
            <EmptyState
              compact
              title="Chưa có workspace"
              description="Tạo lab đầu tiên bên dưới để bắt đầu Decision Session."
            />
          </div>
        ) : null}
        <ul className="grid gap-3">
          {workspaces.map((ws) => (
            <li key={ws.id} className="lab-message-enter">
              <Link
                href={`/workspaces/${ws.id}`}
                className="lab-elevated block px-4 py-3 transition hover:border-[var(--accent)]"
              >
                <div className="font-semibold">{ws.name}</div>
                <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {ws.description || "Không có mô tả"} · pack:{" "}
                  {ws.defaultDomainPackId ?? "generic-decision"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={createWorkspace} className="lab-panel grid gap-3 p-4">
        <h2 className="type-section">Tạo Workspace mới</h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Đặt tên dự án và chọn domain pack — không phải chat thread thuần.
        </p>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên dự án"
          data-testid="workspace-name"
          className="lab-input px-3 py-2"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Mô tả ngắn (tuỳ chọn)"
          rows={3}
          className="lab-input px-3 py-2"
        />
          <select
          value={domainPackId}
          onChange={(e) => setDomainPackId(e.target.value)}
          className="lab-input px-3 py-2"
          data-testid="domain-pack"
        >
          <option value="generic-decision">Generic Decision Workflow</option>
          <option value="challengeready">ChallengeReady (reference pack)</option>
        </select>
        <button
          type="submit"
          disabled={creating}
          className="lab-btn lab-btn-primary justify-self-start"
          data-testid="create-workspace"
        >
          {creating ? "Đang tạo…" : "Tạo Workspace"}
        </button>
      </form>
    </main>
  );
}
