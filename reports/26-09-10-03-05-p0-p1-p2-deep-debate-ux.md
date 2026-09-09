# P0/P1/P2 — DEEP multi-provider & chất lượng tranh luận

- **Thời điểm:** 2026-09-10 ~03:05 (UTC+7)
- **Gates:** không weaken `gateStatusTransition` / unknown-policy / HardPolicyGate; VERIFY vẫn tool-first; SO vẫn `allowFallback: false`

## P0 — kỳ vọng đúng

1. Banner `data-testid="deep-stage-hint"` khi Mode=DEEP: DISCUSS/FRAME chỉ Analyst (Gemini); Critic/DeepSeek ở OPTIONS/CRITIQUE; **Bắt đầu phân tích** chạy pipeline.
2. Copy khớp ma trận v17: `DebateTimeline`, `RouteModeHint`, footer Composer.
3. Chip `data-testid="run-stage-chips"` từ `workflow.lastRun` (planned stages + COMPLETED/FAILED/SKIPPED + `run.partial` message).
4. DEEP **Gửi** bỏ Intent DISCUSS — StageController chọn giai đoạn (P1#4 gộp vào P0 UX). **Bắt đầu phân tích** vẫn loop.

## P1 — tranh luận nhìn thấy được

1. Panel Canvas **Điểm bất đồng** (`debate-notes`): Critic criticisms, SO divergentRisks, Judge agreement heuristic.
2. Prompt Critic/SO: prefix trong JSON `reply` (`Phản bác Analyst:` / `Phương án khác:`) + **valid JSON only** (Groq `json_object` fail nếu dump markdown).
3. Badge `proposedBy` trên Options (ANALYST / 2nd Opinion).
4. MessageBubble kicker cho CRITIC / SECOND_OPINION.

Persist: `session.workflow.debateNotes` + `session.workflow.lastRun` (orchestrator).

## P2 — live FTMO (API thật, memory store)

Lệnh: `pnpm exec vitest run --config vitest.live.config.ts`

Seed: FTMO training app, no live execution. FRAME → OPTIONS → CRITIQUE.

| role | provider | model | status | in | out | costUsd | bubble |
|---|---|---|---|---|---|---|---|
| ANALYST | gemini | gemini-3.6-flash | COMPLETED | 544 | 871 | 0.000403 | yes |
| ANALYST | gemini | gemini-3.6-flash | COMPLETED | 2245 | 1437 | 0.000799 | yes |
| SECOND_OPINION | deepseek | deepseek-chat | COMPLETED | 2246 | 2242 | 0.000942 | yes |
| SECOND_OPINION | deepseek | deepseek-chat | COMPLETED | 6657 | 2250 | 0.001562 | yes |
| CRITIC | groq | openai/gpt-oss-120b | COMPLETED | 6230 | 862 | 0.001452 | yes |

Xác nhận:

- OPTIONS `calls=2` — Gemini Analyst + DeepSeek SO (không fallback).
- CRITIQUE Critic **groq** COMPLETED + bubble.

Lần live trước (cùng seed): Groq `json_validate_failed` vì Critic dump markdown → fallback Gemini. Đã siết prompt JSON-only; lần sau Groq xanh.

UI localhost session `uPcRDrZYsrGeNwfzbhoO`: Mode DEEP hint + badge ANALYST trên options đã hiện sau HMR.

## Tests

- `pnpm typecheck` pass
- `pnpm test` **172** pass (không gồm live)
- live P2 **1** pass (~60s, trả phí API)

## Files chính

- [`src/domain/decision/debate-notes.ts`](../src/domain/decision/debate-notes.ts)
- [`src/ai/orchestration/decision-orchestrator.ts`](../src/ai/orchestration/decision-orchestrator.ts)
- [`src/ai/prompts/registry.ts`](../src/ai/prompts/registry.ts)
- [`src/features/chat/RunStageChips.tsx`](../src/features/chat/RunStageChips.tsx)
- [`src/features/decision-canvas/DebateNotesPanel.tsx`](../src/features/decision-canvas/DebateNotesPanel.tsx)
- [`src/app/(app)/sessions/[sessionId]/page.tsx`](../src/app/(app)/sessions/[sessionId]/page.tsx)
- [`src/tests/live/deep-ftmo-providers.test.ts`](../src/tests/live/deep-ftmo-providers.test.ts)
