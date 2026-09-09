# Automatic Decision Workflow v17

Alias (prompt filename): `AUTOMATIC-DECISION-WORKFLOW-v17.md`

- **Thời điểm:** 2026-09-10 02:37 (UTC+7)
- **Starting HEAD:** `680bd719b01747aea709cbd1ce0e9a65a3225f03`
- **Final HEAD:** *(uncommitted working tree at report time; commit after review)*
- **Scope:** MASTER CODING PROMPT v17 — StageController, Mode×Stage routing, UX stepper, SSE workflow events, prompt/token rebalance

## Executive summary

Normal Decision Session UX no longer requires users to operate Intent. The server owns progression through `FRAME → OPTIONS → CRITIQUE → VERIFY → PREPARE` via `decideWorkflowStage()`. Human still owns explicit Decision approval (`POST /decision`). Gates (`gateStatusTransition`, unknown-policy, HardPolicyGate) were not weakened. VERIFY remains tool-first.

## Baseline (starting HEAD)

| Command | Result |
|---|---|
| `pnpm lint` | pass |
| `pnpm typecheck` | pass |
| `pnpm test` | 142 pass |
| `pnpm test:rules` | 14 pass |
| `pnpm test:e2e` | 3 skipped (Firebase connected, no bypass in that env) |
| `pnpm build` | pass |

## Old vs new routing matrix

### Old (pre-v17)

| Mode | Intent | Agents |
|---|---|---|
| QUICK/STANDARD | VERIFY | tools |
| QUICK/STANDARD | other | Analyst |
| DEEP | FRAME/OPTIONS/DISCUSS | Analyst |
| DEEP | CRITIQUE | Critic + conditional SO |
| DEEP | PREPARE | Analyst + SO + Critic + Judge |
| DEEP | VERIFY | tools |

### New (v17 Mode × Stage)

| Stage | QUICK | STANDARD | DEEP |
|---|---|---|---|
| DISCUSS | Analyst | Analyst | Analyst |
| FRAME | Analyst | Analyst | Analyst (+ Critic if high-impact framing) |
| OPTIONS | Analyst | Analyst | Analyst + SecondOpinion parallel |
| CRITIQUE | Analyst | Analyst | Critic (+ SO only if not already contributed) |
| VERIFY | tools | tools | tools (+ optional post-verify explanation flag; trust unchanged) |
| PREPARE | Analyst | Analyst | **Judge only** (prior artifacts) |

## Old vs new token caps (ceilings)

| Role | Old DEEP | New QUICK | New STANDARD | New DEEP |
|---|---|---|---|---|
| Analyst | ~10000 | 2000 | 3500 | 4000 |
| SecondOpinion | min(2000) | — | — | 2500 |
| Critic | min(1500) | — | — | 2500 |
| Judge | ~10000 | — | — | 4000 |

Prompt: SecondOpinion **no longer** contains “3-4 sentences maximum”; DEEP SO/Critic/Judge prompts list required responsibilities without CoT exposure.

## Call-count architecture

| Path | Old typical DEEP full council | New justified DEEP lifecycle |
|---|---|---|
| Provider calls | Often ~8 (esp. PREPARE re-running Analyst+SO+Critic+Judge) | ~5–6: FRAME 1 + OPTIONS 2 + CRITIQUE 1 + VERIFY 0 LLM + PREPARE 1 |
| Cost | Higher when PREPARE re-ran council | Lower PREPARE cost; usage accumulated on `session.workflow.usage` |

Live Gemini/Groq/DeepSeek FTMO A/B was **not** re-run in this pass (time/cost); architecture + deterministic integration prove call topology. Recommend a follow-up live benchmark on one FTMO seed comparing unique options/risks/calls/tokens/cost/latency/redundant-call rate — **not** prose length.

## StageController behavior

File: `src/domain/decision/workflow-stage.ts`

- Content-driven (not `currentStep++`)
- Persists `session.workflow` (stage, state, completedStages, artifacts CURRENT/STALE, blockers, usage)
- Pause on HIGH Unknown / EXPERIMENT / HUMAN_DECISION_REQUIRED / CONTRADICTED
- Material constraint change → `invalidatedFromStage=OPTIONS` (history retained, downstream STALE)
- No-op acknowledgements do not backtrack
- `RunSessionSchema.intent` optional → controller maps stage → OrchestratorIntent

## SSE events added

`workflow.started` | `workflow.stage.started` | `workflow.stage.completed` | `workflow.paused` | `workflow.resumed` | `workflow.completed`

UI stepper (`data-testid="workflow-stepper"`) follows persisted workflow + events. Intent selector only inside Advanced/QA `<details>` (`data-testid="advanced-controls"`). CTA: **Bắt đầu phân tích** / **Tiếp tục quy trình**. Mode label: **DEEP — đa góc nhìn**.

## Tests

| Suite | Evidence |
|---|---|
| Unit StageController | `workflow-stage.test.ts` (14) — FRAME→…→PREPARE, pause, resume, DECISION_READY/DECIDED stop, backtrack, no-op |
| Routing matrix | `execution-plan.test.ts` — every Mode×Stage; DEEP OPTIONS has SO; DEEP PREPARE Judge-only |
| Prompts | `prompt-depth.test.ts` — no 3–4 sentence ceiling; Critic/Judge responsibilities |
| Integration | `automatic-workflow.test.ts` — omitted intent progresses stages; HIGH Unknown pause + resume |
| Playwright | `decision-loop.spec.ts` updated — Mode only; Intent hidden; auto CTA; no auto-approve |
| Final gate | lint (warn unused cleaned), typecheck, **167** tests, rules 14, build pass, `git diff --check` clean |

## Remaining blockers

1. **Live FTMO provider A/B** still needed for empirical cost/quality claims.
2. Playwright e2e may skip when `DEV_AUTH_BYPASS` / stub models unavailable (Firebase connected).
3. Firestore rules production deploy IAM debt unchanged (out of v17 scope).
4. Audit F-01/F-02/F-03 (Next CVE, evidence relevance, VERIFY hyphen range) intentionally out of scope.
5. STANDARD PREPARE still Analyst-drafts (no Judge) — DEEP required for Judge draft; documented in RouteModeHint.

## Principle check

| Owner | Status |
|---|---|
| Human: problem, facts, prefs, risk acceptance, final decision | Preserved — no auto-approve |
| System: framing, options, challenge, verify, stage progression, prepare | Implemented via StageController + auto CTA |
| Deterministic gates: state/evidence/readiness integrity | Unchanged authority |
