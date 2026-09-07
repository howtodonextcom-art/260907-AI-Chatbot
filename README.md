# Layer A — AI Decision Lab

Chat is the interaction surface. **Decision is the product.**

Canonical lifecycle: IDEA → PROBLEM → ASSUMPTIONS → OPTIONS → EVIDENCE → CRITIQUE → EXPERIMENT → DECISION → BLUEPRINT → IMPLEMENTATION.

Baseline stack: Next.js App Router + TypeScript strict + Firebase Auth/Firestore + Gemini + Groq + optional DeepSeek + Vercel.

Source of truth: `plan/26-09-07-layer-a-ai-decision-lab-coding-spec-v5.markdown`
Operating rules: `CLAUDE.md`

## Runtime (what the code actually does)

- **Login:** email/password Firebase Auth. Google Sign-In is not used. Dev Auth Bypass appears only when client Firebase is not configured and `DEV_AUTH_BYPASS=true` (never in production).
- **Core agent roles:** Analyst, Critic, Judge.
- **Optional independent reviewer:** SecondOpinion on DeepSeek (`ENABLE_SECOND_OPINION`, default on when DeepSeek is configured). It does **not** self-report agreement. Judge derives `agentAgreement` or marks it `UNAVAILABLE`.
- **Routing:** QUICK/STANDARD = Analyst. DEEP is **intent-aware** — FRAME/OPTIONS = Analyst only; CRITIQUE = Critic (+ optional SecondOpinion); VERIFY = allowlisted tools; PREPARE_DECISION = Analyst + Critic + Judge. Auto-run is four steps, not 16 council calls.
- **VERIFY:** deterministic tools (calculator) via DomainPack allowlist. User evidence cannot self-upgrade to VERIFIED/HIGH.
- **DecisionRecord:** immutable, created only by explicit human approval after HardPolicyGate. `DECIDED` is not a client PATCH.
- **Blueprint:** derived from the approved decision (no filler). Markdown export: `GET /api/sessions/:sessionId/blueprint/export`.
- **Model Gateway:** Gemini + Groq + DeepSeek fallback. `USE_STUB_MODELS=true` for CI/E2E (no paid APIs).

## Local setup

- Node.js 22+
- pnpm 10.15.0 (`npx pnpm@10.15.0` if needed)

```bash
npx pnpm@10.15.0 install --frozen-lockfile
npx pnpm@10.15.0 prepare:env
npx pnpm@10.15.0 dev
```

Open [http://localhost:3000](http://localhost:3000). Never commit `.env.local` or `service.json`.

### Environment

| Variable | Notes |
|---|---|
| `GEMINI_API_KEY` / `GROQ_API_KEY` / `DEEPSEEK_API_KEY` | Server only |
| `NEXT_PUBLIC_FIREBASE_*` | Client Firebase config |
| `FIREBASE_ADMIN_CREDENTIALS_PATH` | Preferred Admin path to gitignored `service.json` |
| `USE_MEMORY_STORE=true` | In-memory repos (tests / offline). **Forbidden in production runtime** |
| `DEV_AUTH_BYPASS=true` | Local bypass only when Firebase is not fully configured; off in production |
| `ENABLE_SECOND_OPINION` | Optional DeepSeek reviewer (default on) |
| `USE_STUB_MODELS` | CI/Playwright deterministic providers |

### Connected mode

1. Place service account JSON at `./service.json` (gitignored).
2. Fill `NEXT_PUBLIC_FIREBASE_*`.
3. `USE_MEMORY_STORE=false`, `DEV_AUTH_BYPASS=false`.
4. Firebase Console → Authentication → **Email/Password**.
5. Authorize `localhost` and the Vercel domain.

Firestore rules/indexes live in `src/infrastructure/firebase/rules/`. Production deploy may be **IAM-blocked** (`BLOCKED_EXTERNAL`) even when emulator tests pass.

## Scripts

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:rules    # Firestore emulator
pnpm test:e2e      # Playwright (stub models in CI)
pnpm build
```

## Architecture notes

- Domain/UI never import provider SDKs
- All consequential status changes go through `gateStatusTransition()`
- DomainPack hooks: criteria hydrate sessions; tools restrict VERIFY; output schema names map to real Zod schemas; evaluation suite ids select cases
- Production cannot accidentally use MemoryStore (`USE_MEMORY_STORE=true` throws unless Next.js build phase)

## Disclaimer

Decision support / training tooling. Not financial, legal, or investment advice.
