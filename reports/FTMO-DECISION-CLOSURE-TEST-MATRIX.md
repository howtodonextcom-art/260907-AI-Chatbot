# FTMO Decision Closure — Test Evidence Matrix

MASTER CODING PROMPT v13, §66. Starting HEAD `41f261e`. All rows below reflect
work done in this pass; anything not listed was not touched.

| Capability | Unit | Integration | Playwright | Live QA |
|---|---|---|---|---|
| HIGH Unknown blocking (centralized policy) | ✅ `unknown-policy.test.ts` (22) | ✅ `unknown-resolution-closure.test.ts` | ❌ not added | ✅ live browser, real FTMO session (2 HIGH unknowns blocked → readiness NOT READY) |
| Unknown resolve — RESOLVE_WITH_EVIDENCE / HUMAN_DECISION / ACCEPT_RISK | ✅ `unknown-policy.test.ts` | ✅ `unknown-resolution-closure.test.ts` (real evidence, cross-user, empty-payload reject) | ❌ not added | ✅ live: both resolve paths clicked through real UI, notes persisted with `resolvedBy`/`resolvedAt` |
| Empty-resolve bypass closed (bulk-array PATCH) | ✅ | ✅ (`UpdateSessionSchema` no longer accepts `unknowns`) | ❌ | — |
| Deterministic readiness summary (no LLM) | ✅ `computeReadiness` (3 tests) | — (exercised indirectly) | ❌ | ✅ live: "NOT READY" → "READY" transitions matched real Unknown state in real time |
| VERIFY arithmetic classifier (MT4/MT5 false positive) | ✅ `arithmetic-classifier.test.ts` (19, full §41 list) | — | ❌ not added | ✅ live: real Analyst-generated assumption containing "MT4/MT5/cTrader" produced **zero** evidence (no false positive) |
| Verification coverage NONE/PARTIAL/FULL | ✅ `verify-pipeline.test.ts` (3 new cases) | — | ❌ | — (not exercised live; no VERIFY run hit an arithmetic claim in the FTMO sessions tested) |
| JudgeDraft visible while blocked (LOW-01) | — (UI logic, no unit harness) | — | ❌ | ✅ live: judgeDraft rendered with blocker list before DECISION_READY was reached |
| Agent structured-parse recovery (new finding) | ✅ `agent-structured-recovery.test.ts` (6, Judge/Critic/Analyst) | — | ❌ | ✅ live: reproduced the silent-loss bug pre-fix, then confirmed judgeDraft persists correctly post-fix in a second live run |
| Decision approval → DecisionRecord | ✅ (existing `session-decision-integrity.test.ts`) | ✅ `unknown-resolution-closure.test.ts` | ✅ existing v10 suite (stub models, not re-verified this pass) | ✅ live: real approval, real computed confidence (LOW/14) |
| Blueprint DRAFT → APPROVED | — | ✅ `unknown-resolution-closure.test.ts` | ✅ existing v10 suite (not re-verified this pass) | ✅ live: real generation + approval, `approvedAt` set |
| Blueprint export (Markdown) | — | — | ✅ existing v10 suite (not re-verified this pass) | ❌ not clicked in this pass |
| Cross-user security (Unknown route) | ✅ | ✅ (404 for other user, 404 for unknown ID outside session) | — | — |
| **Options consistency (MEDIUM-01)** | ❌ **not addressed** | ❌ | ❌ | — |
| **Assumption dedup (MEDIUM-02)** | ❌ **not addressed** | ❌ | ❌ | — |
| **Constraints generation (MEDIUM-03)** | ⚠️ UI section added and renders correctly; **underlying capture/provenance logic (v13 §27-29) not implemented** — Constraints will still show `(0)` on every real run until something populates them | ❌ | ❌ | ✅ live: section renders `Constraints (0)` with no crash on every session tested |
| **Cost display consistency (LOW-02)** | ❌ **not addressed** | ❌ | ❌ | — |
| CI green on GitHub | — | — | — | ❌ not verified this pass (no push yet at time of writing; local suite is green) |
| Firestore production | — | — | — | `BLOCKED_EXTERNAL` (pre-existing IAM 403, unchanged this pass) |

## Legend
- ✅ = implemented and verified with real evidence (not self-reported)
- ⚠️ = partially done, gap disclosed
- ❌ = not touched this pass
- `—` = not applicable / not attempted at that layer

## What "Live QA" means here

Every ✅ under Live QA was a real browser session (Chrome via MCP), a real
Firebase-authenticated user, real Gemini/Groq/DeepSeek API calls
(`USE_STUB_MODELS=false`), running against the in-memory store
(`USE_MEMORY_STORE=true` — see [[firestore-production-status]] below for why).
Two separate FTMO sessions were run end-to-end this pass; the second one
specifically to confirm the judge-parse fix after finding the bug live in
the first one.

## Firestore production status

Unchanged from prior debt: `BLOCKED_EXTERNAL` (IAM 403 on the service
account). This pass's live verification used `USE_MEMORY_STORE=true`, so
**production Firestore persistence for these new code paths (Unknown
resolution API, readiness computation) is NOT verified** — only the
in-memory repository implementation and the application logic layered on
top of it. See CLAUDE.md's Nợ kỹ thuật section.
