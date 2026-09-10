# Layer A — AI Decision Lab

**Chat is the interaction surface. Decision is the product.**

Layer A is a multi-agent **decision-support lab**: you open a workspace, create a Decision Session, debate through structured intents, and — only after explicit human approval — produce an immutable Decision Record and an optional Blueprint. It is **not** a generic ChatGPT clone, and it is **not** an FTMO (or any other domain) product; domain scenarios are inputs to a session, not the app itself.

Runtime truth lives in `src/`. Agent operating rules: [`CLAUDE.md`](CLAUDE.md). Spec markdown under `plan/` is historical context, not a guarantee of current behavior.

## What you see in the product

| Route | Purpose |
|---|---|
| `/login` | Email/password Firebase Auth (no Google Sign-In) |
| `/workspaces` | List / create workspaces (optional DomainPack, e.g. ChallengeReady) |
| `/workspaces/:id` | Create Decision Sessions (title, problem, objective) |
| `/sessions/:id` | Chat + Mode/Intent controls + Decision Canvas |

**Session status machine (user-visible):**

`DISCOVERY` → `VALIDATING` → `DECISION_READY` → `DECIDED` (then archive)

- Status changes go through `gateStatusTransition()` — AI may *propose*; the gate *authorizes*.
- `DECIDED` is **never** a client PATCH. It is assigned only by `approveDecision()` after `HardPolicyGate`.
- Entering `DECISION_READY` requires ≥1 option, ≥1 assumption, **zero HIGH-priority open unknowns**, and no DomainPack validation errors.
- Approve Decision → immutable `DecisionRecord` → Generate Blueprint (`DRAFT`) → Approve Blueprint (`APPROVED`). Markdown export: `GET /api/sessions/:sessionId/blueprint/export`.

**Decision Canvas** shows Overview, Options, Assumptions, Constraints, Unknowns (every unknown with its resolution/evidence, plus resolution actions for blocking HIGH ones), Decision Readiness, Evidence, Experiments, Judge draft (whenever one exists — with the current blockers listed if the session isn't `DECISION_READY` yet), and Blueprint. HIGH open unknowns still block `DECISION_READY`.

## Agents and routing (runtime)

| Mode | Stage | Who runs |
|---|---|---|
| QUICK | (single call) | Analyst (Groq) only |
| STANDARD | FRAME / OPTIONS / CRITIQUE | Analyst (Gemini) only |
| STANDARD | PREPARE | Judge (Gemini) only, using the session's prior artifacts |
| any | VERIFY | Allowlisted tools only (today: `calculator` for arithmetic expressions, `stats` for descriptive statistics on a `DATA=[...]` tagged dataset — both via DomainPack) — not an LLM council |
| DEEP | DISCUSS / FRAME | Analyst (+ Critic if the framing is high-impact/ambiguous) |
| DEEP | OPTIONS | Analyst ∥ SecondOpinion (DeepSeek), genuinely parallel and blind to each other |
| DEEP | CRITIQUE | Critic (Groq) + conditional SecondOpinion re-engagement |
| DEEP | PREPARE | Judge (Gemini) only, using the session's prior Analyst/Critic/SecondOpinion artifacts — it does **not** re-run them |

Provider-to-role binding is fixed (`model-gateway.ts::resolveProviderForRole`): Analyst → Groq (QUICK) / Gemini (else); Critic → Groq always; Judge → Gemini (falls back to Groq/DeepSeek on failure); SecondOpinion → DeepSeek only, no fallback. No rotation or blind-identity judging exists today.

**SecondOpinion** (optional DEEP role): runs only when `ENABLE_SECOND_OPINION` is on, DeepSeek is configured, and the stage is `OPTIONS` or `CRITIQUE` (or related challenge/low-evidence triggers). It calls DeepSeek with **no Gemini fallback**, and never sees Analyst's output. It does **not** self-score agreement; Judge derives `agentAgreementMethod`: `JUDGE_HEURISTIC` | `UNAVAILABLE`.

**Auto "Bắt đầu phân tích" / "Tiếp tục quy trình":** a single button, available in every Mode, that omits Intent so the server-owned StageController picks the next stage each step (content-driven, not a fixed step list — capped at 8 steps per click as a safety limit). It advances through whatever stages the current Mode actually runs (see table above) and stops on `DECISION_READY`/`DECIDED`/`PAUSED`/`BLOCKED`/no-advance. It never auto-approves a Decision Record — that's always an explicit human action.

## Stack

- Next.js **15.5.9** App Router, React 19, TypeScript strict, Tailwind 4
- Firebase Auth (email/password) + Firestore **or** in-memory store
- Model gateway: Gemini + Groq + optional DeepSeek; `USE_STUB_MODELS=true` for CI/E2E
- Deploy target: Vercel
- Node.js 22+, pnpm 10.15.0

## Local setup

```bash
npx pnpm@10.15.0 install --frozen-lockfile
npx pnpm@10.15.0 prepare:env
npx pnpm@10.15.0 dev
```

Open [http://localhost:3000](http://localhost:3000).

**Never commit** `.env.local`, `service.json`, or private keys.

### Environment

| Variable | Notes |
|---|---|
| `GEMINI_API_KEY` / `GROQ_API_KEY` / `DEEPSEEK_API_KEY` | Server only |
| `NEXT_PUBLIC_FIREBASE_*` | Client Firebase config |
| `FIREBASE_ADMIN_CREDENTIALS_PATH` / `GOOGLE_APPLICATION_CREDENTIALS` | Path to gitignored `service.json` — **local/server dev only**, see note below |
| `FIREBASE_ADMIN_PROJECT_ID` / `FIREBASE_ADMIN_CLIENT_EMAIL` / `FIREBASE_ADMIN_PRIVATE_KEY` | Inline Admin credentials — **required on Vercel** (see below) |
| `USE_MEMORY_STORE=true` | In-memory repos (local/tests). **Forbidden in production runtime** (allowed only during Next production build phase) |
| `DEV_AUTH_BYPASS=true` | Local bypass only when Firebase client is not configured; off in production |
| `ENABLE_SECOND_OPINION` | Optional DeepSeek reviewer (default on when unset) |
| `USE_STUB_MODELS` | Deterministic stub providers for CI/Playwright |

### Connected mode (Firestore)

**Local / any environment with a writable filesystem:**
1. Place a service-account JSON at `./service.json` (gitignored).
2. Fill `NEXT_PUBLIC_FIREBASE_*`.
3. Set `USE_MEMORY_STORE=false`, `DEV_AUTH_BYPASS=false`.
4. Firebase Console → Authentication → **Email/Password**; authorize `localhost` and your Vercel domain.
5. Rules/indexes source: `src/infrastructure/firebase/rules/`. Production deploy may be **IAM-blocked** even when `pnpm test:rules` (emulator) passes — see `CLAUDE.md`.

**Vercel (or any serverless target without a persistent filesystem):** `./service.json` does not work — there is nowhere to put the file at deploy time, and it must never be committed. Set the three inline Admin variables instead, in Vercel → Project → Settings → Environment Variables (Production):
- `FIREBASE_ADMIN_PROJECT_ID` — the Firebase project ID (same value as `NEXT_PUBLIC_FIREBASE_PROJECT_ID`).
- `FIREBASE_ADMIN_CLIENT_EMAIL` — the service account's `client_email` field.
- `FIREBASE_ADMIN_PRIVATE_KEY` — the service account's `private_key` field, pasted as-is (the code un-escapes literal `\n` sequences automatically, so pasting the key on one line with `\n` for newlines is fine).

If any of the three is missing, **every** Firestore-backed API route (e.g. `POST /api/workspaces`) fails — `getAdminDb()` now throws a specific `AppError` naming exactly which variable is missing, visible directly in the API response body / browser Network tab, rather than only in server logs.

Without required composite indexes, some list endpoints (messages / runs / decision / blueprint) can return **500** against real Firestore.

## Scripts

```bash
pnpm lint
pnpm typecheck
pnpm test           # unit + integration (no emulator)
pnpm test:rules     # Firestore emulator + rules tests
pnpm test:e2e       # Playwright (stub models in CI)
pnpm build
```

## Architecture constraints

- Domain and UI layers never import provider SDKs directly.
- All consequential session status changes go through `gateStatusTransition()`.
- `HardPolicyGate` must pass before a Decision Record is persisted; session must already be `DECISION_READY`.
- DomainPacks hydrate default criteria, restrict VERIFY tool connectors, and validate decisions before approval.

## Honest limitations

- **VERIFY** is an allowlisted tool pipeline — `calculator` for arithmetic found in assumption/unknown text, and `stats` for descriptive statistics (count/mean/min/max/population & sample stdev) on a numeric dataset — but only when explicitly tagged `DATA=[n1, n2, ...]` in the claim text. That explicit tag is deliberate: it is not free-text data extraction, specifically to avoid the false-positive-verification failure mode already hit once with loose arithmetic parsing (see CLAUDE.md `[[ftmo-verify-classifier]]`). Neither tool is web-scale fact checking or real data fetching, and user-supplied evidence cannot self-upgrade to `VERIFIED` / `HIGH`.
- **DECISION_READY** stays blocked while any HIGH-importance unknown remains `OPEN` — even if JudgeDraft already exists in session JSON.
- **In-memory mode** is for local/offline loops; it does not prove Firestore production persistence.
- This is **decision support / training tooling**, not financial, legal, or investment advice.

## Further reading

- [`CLAUDE.md`](CLAUDE.md) — agent rules, naming for `reports/`, known IAM/debt notes
- Spec under `plan/` — design history; prefer `src/` when they disagree
