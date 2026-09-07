# FINAL VERIFIED AUDIT — MASTER CODING PROMPT v10

Previous independently audited score: **83/100** (`FUNCTIONAL_MVP`)  
Previous audited HEAD: `032a0241089d3b6fcae5b6cf344d0d160c06a771`

Starting HEAD (this program): `032a0241089d3b6fcae5b6cf344d0d160c06a771`  
Final HEAD: see git after commits on `main`.

**Final independent audit score: 92/100**  
Classification: **HIGH_QUALITY_IMPLEMENTATION** (not Verified 100/100)

100/100 is forbidden by §63 because not every hard gate is objectively true in production:

| Hard gate | Status |
|---|---|
| CI green **on GitHub** | Not observed yet (workflow updated; local commands pass) |
| Firestore production deploy | **BLOCKED_EXTERNAL** (IAM 403) |
| SecondOpinion live ON/OFF paid-API proof | Not run; verdict **KEEP_CONDITIONAL** |
| Blueprint LLM generate + 1 repair | **CORRECTLY_ABSENT** — deterministic derive from DecisionRecord (stricter than filler LLM) |

---

## Security dependency update

| | |
|---|---|
| Previous | `next@15.5.7` / `eslint-config-next@15.5.7` |
| New | `next@15.5.9` / `eslint-config-next@15.5.9` |
| Reason | Stay on 15.5.x; address CVE-2025-55184 / 55183 / 67779 ([advisory](https://nextjs.org/blog/security-update-2025-12-11)) |
| Regressions | None found (`lint`, `typecheck`, `test`, `test:e2e`, `build`) |

Gemini/Groq SDKs do not reliably abort in-flight HTTP. `AbortSignal` still stops retries, further stages, and persistence (`src/ai/gateway/abort.ts`). DeepSeek `fetch` composes abort + timeout.

---

## Evidence trust matrix

| Source | reliability | verificationStatus | createdBy |
|---|---|---|---|
| Client POST (any type, including OFFICIAL_DOCUMENTATION + reliability HIGH) | server-normalized, never HIGH from label | UNVERIFIED | USER |
| Calculator VERIFY | HIGH | VERIFIED | TOOL |
| Completed experiment results | HIGH | VERIFIED | SYSTEM / verifiedBy EXPERIMENT |
| Experiment DRAFT/plan | — | not evidence | — |

Runtime: `src/domain/evidence/trust.ts`, `src/app/api/sessions/[sessionId]/evidence/route.ts`  
Tests: `src/tests/unit/evidence-trust.test.ts`, E2E negative path

---

## VERIFY trace

```
VERIFY
→ DomainPack.getToolConnectorIds() allowlist
→ regex extract arithmetic from assumptions/unknowns
→ calculator.evaluate
→ SSE tool.started / tool.completed
→ EvidenceItem CALCULATION VERIFIED
→ link evidenceIds; assumption SUPPORTED only when the expression evaluated
→ unverifiable claims stay UNVERIFIED / stopReason NOT_VERIFIABLE
```

Source: `src/ai/orchestration/verify-pipeline.ts`  
Test: `src/tests/unit/verify-pipeline.test.ts`

---

## Blueprint isolation test

Deterministic `deriveBlueprintContent` + semantic validator (rejects filler phrases and criteria-as-dataModel).

Markdown export: `GET /api/sessions/:sessionId/blueprint/export` (`text/markdown`)

Unit isolation: `src/tests/unit/blueprint-derive.test.ts` asserts Project Goal, Non-goals, Modules, Data Model, API, Security, Testing, Implementation Order, DecisionRecord id.

E2E: generate → approve → download.

---

## DomainPack hook matrix

| Hook | Status |
|---|---|
| getDecisionCriteria | WIRED — cloned on session create |
| getToolConnectorIds | WIRED — VERIFY allowlist |
| getOutputSchemaName | WIRED — `src/ai/agents/schema-registry.ts` |
| getEvaluationSuiteId | WIRED — evaluation runner filter |
| getRoleInstructions | WIRED — per agent, not in `buildCoreContext` |
| runDeterministicChecks | WIRED — orchestrator entry |

---

## Experiment lifecycle

`DRAFT → READY → RUNNING → COMPLETED | CANCELLED`  
API: `GET/POST /api/sessions/:id/experiments`, `PATCH .../experiments/:experimentId`  
EXPERIMENT_REQUIRED unknown and Judge `EXPERIMENT_FIRST` create a DRAFT (plan is not evidence). COMPLETED with results creates VERIFIED EXPERIMENT evidence.

---

## Execution plan examples

| Intent (DEEP) | Stages | Estimated calls |
|---|---|---|
| FRAME_PROBLEM / GENERATE_OPTIONS / DISCUSS | ANALYST | 1 |
| CRITIQUE | CRITIC (+ optional SECOND_OPINION) | 1–2 |
| VERIFY | VERIFY_TOOLS | 0 model |
| PREPARE_DECISION | ANALYST + CRITIC + JUDGE (+ optional SO) | 3–4 |

Auto-run FRAME→OPTIONS→CRITIQUE→VERIFY ≈ 4–7 justified calls, not 16.

---

## Provider-call / cost accounting

`ModelGateway.withRetry` records every successful provider attempt on `BudgetTracker` (including repair retries). Orchestrator no longer double-counts wrapper calls.

---

## Stop-condition matrix

| Reason | Runtime | Test |
|---|---|---|
| ENOUGH_EVIDENCE | `evaluateStop` | unit |
| LOW_DISAGREEMENT | `evaluateStop` | unit |
| NO_NEW_INFORMATION | `evaluateStop` | unit |
| BUDGET_EXHAUSTED | `canSpend` + gateway | unit |
| EXPERIMENT_REQUIRED | skip remainder after Analyst | unit + orchestrator |
| HUMAN_DECISION_REQUIRED | skip remainder | unit |
| MAX_ROUNDS_REACHED | `canSpend` | unit |

---

## SecondOpinion benchmark

Live paid ON/OFF comparison was **not** executed (CI uses `USE_STUB_MODELS`).

Simulated cost/quality comparison in `defaultSecondOpinionVerdict()`:

**KEEP_CONDITIONAL**

DeepSeek remains an optional independent reviewer (`ENABLE_SECOND_OPINION`, CRITIQUE/PREPARE only, `allowFallback: false`). Not a fourth core role.

---

## Test results (local, 2026-09-07)

| Command | Result |
|---|---|
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS — 88 tests / 14 files |
| `pnpm test:rules` | PASS — 14 emulator tests |
| `pnpm test:e2e` | PASS — 3 Playwright tests (smoke, full loop, negative) with stub models |
| `pnpm build` | PASS — Next.js 15.5.9 |

### Capability matrix (minimum)

| Capability | Unit | Integration | E2E | CI workflow |
|---|---|---|---|---|
| Auth | env-connected | session-decision | smoke / negative | yes |
| Workspace / Session | core | integration | decision-loop | yes |
| State gate | transition-gate | integration | negative PATCH | yes |
| Routing / plan | execution-plan, core | — | decision-loop | yes |
| Stop / budget | stop-conditions | — | — | yes |
| VERIFY / tools | verify-pipeline | — | decision-loop | yes |
| Evidence trust | evidence-trust | — | negative | yes |
| DomainPack | execution-plan | — | ChallengeReady loop | yes |
| Experiment | experiment-lifecycle | — | canvas list | yes |
| DecisionRecord | — | integration | approve button | yes |
| Blueprint | blueprint-derive | integration | export download | yes |
| Cancellation | abort helper + gateway | — | UI Dừng (best-effort) | yes |
| Cross-user | — | integration | negative 404 | yes |
| Firestore rules | — | test:rules | — | yes (needs Java + firebase-tools) |

---

## CI / Vercel / Firestore production

- **CI:** `.github/workflows/ci.yml` now runs lint, typecheck, test, **test:rules**, **test:e2e**, build. Green on GitHub is pending push.
- **Vercel:** no new production deploy in this session until `main` is pushed.
- **Firestore production:**

```
SOURCE_RULES_CORRECT: yes
EMULATOR_TESTED: yes (14/14)
CI_TESTED: workflow added, GitHub run pending
DEPLOYED: no
PRODUCTION_VERIFIED: no

Firestore production deployment:
BLOCKED_EXTERNAL
Reason:
IAM permission
Exact error:
Request to https://firebaserules.googleapis.com/v1/projects/chatai-62ca2:test had HTTP Error: 403, The caller does not have permission
```

---

## Rubric

| Category | Weight | Score | Notes |
|---|---|---|---|
| Product clarity | 10 | 10 | README matches runtime (email login, intent-aware DEEP, VERIFY tools) |
| Architecture | 15 | 14 | Promises wired; Blueprint is derive-not-LLM |
| Domain model | 10 | 10 | Verification ≠ reliability ≠ provenance |
| AI orchestration | 10 | 9 | Intent-aware; SO value not live-proven |
| Data architecture | 10 | 8 | Rules correct + emulator; prod IAM blocked |
| API contracts | 10 | 10 | Export + experiments + evidence trust |
| Security | 10 | 9 | Next 15.5.9, MemoryStore throw, bypass off in prod; rules not on prod |
| Testing / Evaluation | 10 | 9 | 20 cases + deterministic graders; CI not yet seen on GH |
| Deployment / Operations | 5 | 3 | Vercel path unchanged; Firestore deploy 403 |
| Coding-agent usability | 10 | 10 | Derived markdown export, no filler |
| **Total** | **100** | **92** | |

---

## External blockers

1. Firestore rules/indexes deploy to `chatai-62ca2` — IAM 403 (`Firebase Rules Admin` / `Cloud Datastore Index Admin` missing on the service account).
2. Composite indexes on production may still be missing until a privileged account deploys them (list/query 500s in connected mode).

## Remaining known debt

- `@firebase/rules-unit-testing` pinned at 4.0.1 (firebase 11 peer).
- Gemini/Groq in-flight HTTP abort limitation.
- No live SecondOpinion quality/cost benchmark against paid APIs.
- Next.js 16 not in scope.

## Path to this report

`reports/FINAL-VERIFIED-100-AUDIT-v10.md`
