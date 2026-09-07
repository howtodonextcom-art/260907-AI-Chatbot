"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/features/workspace/api-client";
import type { Workspace } from "@/domain/workspace/types";
import type { DecisionSession } from "@/domain/decision/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingBlock } from "@/components/ui/LoadingBlock";

export default function WorkspaceDetailPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const workspaceId = params.workspaceId;
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [sessions, setSessions] = useState<DecisionSession[]>([]);
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("");
  const [objective, setObjective] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const ws = await apiFetch<{ workspace: Workspace }>(
        `/api/workspaces/${workspaceId}`
      );
      setWorkspace(ws.workspace);
      const ss = await apiFetch<{ sessions: DecisionSession[] }>(
        `/api/workspaces/${workspaceId}/sessions`
      );
      setSessions(ss.sessions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải workspace");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const data = await apiFetch<{ session: DecisionSession }>(
        `/api/workspaces/${workspaceId}/sessions`,
        {
          method: "POST",
          body: JSON.stringify({
            title,
            problem,
            objective: objective || undefined,
          }),
        }
      );
      router.push(`/sessions/${data.session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo session thất bại");
    } finally {
      setCreating(false);
    }
  }

  async function archiveWorkspace() {
    if (!workspace) return;
    await apiFetch(`/api/workspaces/${workspaceId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
    router.push("/workspaces");
  }

  if (loading && !workspace) {
    return <LoadingBlock label="Đang tải workspace…" />;
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/workspaces" className="text-sm" style={{ color: "var(--text-muted)" }}>
        ← Workspaces
      </Link>
      <h1 className="type-title mt-3">{workspace?.name ?? "Workspace"}</h1>
      <p className="mt-2 type-body-muted">{workspace?.description}</p>
      <button
        type="button"
        onClick={archiveWorkspace}
        className="mt-3 text-sm"
        style={{ color: "var(--danger)" }}
      >
        Lưu trữ workspace
      </button>

      <section className="mt-8" aria-labelledby="sessions-heading">
        <h2 id="sessions-heading" className="type-section mb-3">
          Decision Sessions
        </h2>
        {sessions.length === 0 ? (
          <div className="lab-elevated mb-6 px-4">
            <EmptyState
              compact
              title="Chưa có session"
              description="Tạo Decision Session để bắt đầu khung vấn đề và thu thập bằng chứng."
            />
          </div>
        ) : (
          <ul className="mb-8 grid gap-3">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/sessions/${s.id}`}
                  className="lab-elevated block px-4 py-3 transition hover:border-[var(--accent)]"
                >
                  <div className="font-semibold">{s.title}</div>
                  <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {s.status} · cập nhật{" "}
                    {new Date(s.updatedAt).toLocaleString("vi-VN")}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={createSession} className="lab-panel my-4 grid gap-3 p-4">
        <h2 className="type-section">Tạo Decision Session</h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Một session = một quyết định cần khung, phương án và Decision Record.
        </p>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tiêu đề quyết định"
          data-testid="session-title"
          className="lab-input px-3 py-2"
        />
        <textarea
          required
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          placeholder="Vấn đề cần quyết định"
          data-testid="session-problem"
          rows={4}
          className="lab-input px-3 py-2"
        />
        <textarea
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder="Mục tiêu / câu hỏi quyết định (khuyến nghị)"
          data-testid="session-objective"
          rows={2}
          className="lab-input px-3 py-2"
        />
        <button
          type="submit"
          disabled={creating}
          className="lab-btn lab-btn-primary justify-self-start"
          data-testid="create-session"
        >
          {creating ? "Đang tạo…" : "Tạo Session"}
        </button>
      </form>

      {error ? (
        <p className="text-sm" role="alert" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      ) : null}
    </main>
  );
}
