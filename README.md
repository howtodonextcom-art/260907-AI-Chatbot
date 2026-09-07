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

**Decision Canvas** shows Overview, Options, Assumptions, Evidence, Experiments, Judge draft (when `status === DECISION_READY`), and Blueprint. Session JSON may contain `unknowns`, but the Canvas **does not** render an Unknowns panel today — HIGH open unknowns still block `DECISION_READY`.

## Agents and routing (runtime)

| Mode | Intent | Who runs |
|---|---|---|
| QUICK / STANDARD | most intents | Analyst (Gemini) only |
| any | `VERIFY` | Allowlisted tools only (today: calculator via DomainPack) — not an LLM council |
| DEEP | `FRAME_PROBLEM` / `GENERATE_OPTIONS` / `DISCUSS` | Analyst only |
| DEEP | `CRITIQUE` | Critic (Groq) + **conditional** SecondOpinion (DeepSeek) |
| DEEP | `PREPARE_DECISION` | Analyst + optional SecondOpinion + Critic + Judge (Gemini) |

**SecondOpinion** (optional 4th DEEP role): runs only when `ENABLE_SECOND_OPINION` is on, DeepSeek is configured, and the intent is `CRITIQUE` or `PREPARE_DECISION` (or related challenge/low-evidence triggers). It calls DeepSeek with **no Gemini fallback**. It does **not** self-score agreement; Judge derives `agentAgreementMethod`: `JUDGE_HEURISTIC` | `UNAVAILABLE`.

**Auto “▶ Tự động 4 bước”:** `FRAME_PROBLEM` → `GENERATE_OPTIONS` → `CRITIQUE` → `VERIFY` in DEEP. It never auto-approves a Decision Record.

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
| `FIREBASE_ADMIN_CREDENTIALS_PATH` / `GOOGLE_APPLICATION_CREDENTIALS` | Path to gitignored `service.json` |
| `USE_MEMORY_STORE=true` | In-memory repos (local/tests). **Forbidden in production runtime** (allowed only during Next production build phase) |
| `DEV_AUTH_BYPASS=true` | Local bypass only when Firebase client is not configured; off in production |
| `ENABLE_SECOND_OPINION` | Optional DeepSeek reviewer (default on when unset) |
| `USE_STUB_MODELS` | Deterministic stub providers for CI/Playwright |

### Connected mode (Firestore)

1. Place a service-account JSON at `./service.json` (gitignored).
2. Fill `NEXT_PUBLIC_FIREBASE_*`.
3. Set `USE_MEMORY_STORE=false`, `DEV_AUTH_BYPASS=false`.
4. Firebase Console → Authentication → **Email/Password**; authorize `localhost` and your Vercel domain.
5. Rules/indexes source: `src/infrastructure/firebase/rules/`. Production deploy may be **IAM-blocked** even when `pnpm test:rules` (emulator) passes — see `CLAUDE.md`.

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

- **VERIFY** is an allowlisted tool pipeline (calculator expressions found in assumption/unknown text), not web-scale fact checking. User-supplied evidence cannot self-upgrade to `VERIFIED` / `HIGH`.
- **DECISION_READY** stays blocked while any HIGH-importance unknown remains `OPEN` — even if JudgeDraft already exists in session JSON.
- **In-memory mode** is for local/offline loops; it does not prove Firestore production persistence.
- This is **decision support / training tooling**, not financial, legal, or investment advice.

## Further reading

- [`CLAUDE.md`](CLAUDE.md) — agent rules, naming for `reports/`, known IAM/debt notes
- Spec under `plan/` — design history; prefer `src/` when they disagree
