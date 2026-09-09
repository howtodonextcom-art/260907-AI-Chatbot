# Nâng cấp thuật toán DEEP v18

- **Thời điểm:** 2026-09-10 03:10 (UTC+7)
- **Starting HEAD:** `72604f6`
- **Gates:** không weaken `gateStatusTransition` / unknown-policy / HardPolicyGate; VERIFY tool-first; SO `allowFallback: false`

## RCA

| ID | Sev | Root cause | Evidence | Fix |
|---|---|---|---|---|
| D1 | P0 | `applyWorkflowProgress` luôn nhận `agentRunIds: []`; `secondOpinionAlreadyContributed` đòi `OPTIONS.agentRunIds.length > 0` → luôn false | Live P2: CRITIQUE `plannedStages=["SECOND_OPINION","CRITIC"]`, DeepSeek COMPLETED lần 2. Code: `decision-orchestrator.ts` persist | Persist run ids; flag `contributions.secondOpinion`; `hasSecondOpinionContribution()` |
| D2 | P0 | “Tiếp tục quy trình…” dài >12 ký tự, không nằm no-op list → có thể bị coi material (và SO skip dựa D1 anyway) | `detectMaterialInvalidation` | Treat `/tiếp tục quy trình/` + English continue as no-op |
| D3 | P0 | Critic Groq JSON fail → silent Gemini fallback; lastRun hiện `provider: gemini` như thể Groq thành công | Live P2 lần 1: `provider.fallback groq→gemini` | lastRun.message `fallback from groq` + SSE `run.partial` |
| D4 | P1 | Artifact overwrite xóa `contributions` khi append run ids | `applyWorkflowProgress` replace object | Spread previous artifact |
| D5 | P1 | Explicit Intent CRITIQUE (“Phản biện thêm”) không set `userRequestedChallenge` | orchestrator never passed the flag | `userRequestedChallenge: args.intent === "CRITIQUE"` |
| D6 | P2 | Critic structured empty → debateNotes criticisms rỗng | merge only `structured.criticisms` | Fallback slice of `reply` |

D-stage: FRAME+OPTIONS CURRENT → CRITIQUE đã đúng trong `workflow-stage.ts` (unit sẵn). Không đổi logic next-stage.

## Call topology (old vs new)

| Stage | v17 live (bug) | v18 |
|---|---|---|
| FRAME | Analyst Gemini ×1 | unchanged |
| OPTIONS | Analyst∥SO (`calls=2`) | unchanged + persist SO flag/ids |
| CRITIQUE | SO DeepSeek **lại** + Critic (`calls=2+`) | Critic only (`calls=1`) unless facts changed or explicit CRITIQUE intent |
| PREPARE | Judge only | unchanged |

Integration: OPTIONS `calls=2` → CRITIQUE `calls=1`, đúng 1 AgentRun `SECOND_OPINION`.

## Verify

- `pnpm typecheck` pass
- `pnpm test` **176** pass
- Live FTMO API không chạy lại (đã chứng minh skip bằng integration; lần live trước đã xác nhận gemini+deepseek+groq)

## UI — cách thấy

1. Mode **DEEP** → **Bắt đầu phân tích**. Chip **Lượt này**: OPTIONS `Analyst · gemini → 2nd Opinion · deepseek`.
2. Bước CRITIQUE: chỉ Critic (Groq). Không thêm bubble DeepSeek. Nếu Groq lỗi JSON: chip Critic `gemini` + chữ `fallback from groq`.
3. Canvas: **Điểm bất đồng** + badge `2nd Opinion` trên option.
4. **Phản biện thêm** (nâng cao) mới được phép gọi lại SO.

## Files

- `src/ai/orchestration/decision-orchestrator.ts`
- `src/domain/decision/debate-notes.ts` (`hasSecondOpinionContribution`)
- `src/domain/decision/workflow-stage.ts`
- tests: execution-plan, workflow-stage, debate-notes, automatic-workflow
