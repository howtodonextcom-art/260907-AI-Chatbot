# Layer A — AI Decision Lab

Domain-agnostic **AI Decision Lab**: chat is the interaction surface; decision is the product.

Baseline stack: Next.js App Router + TypeScript strict + Firebase Auth/Firestore + Gemini + Groq + Vercel.

Source of truth: `plan/26-09-07-layer-a-ai-decision-lab-coding-spec-v5.markdown`

## Features (MVP)

- Workspace + DecisionSession CRUD (owner-scoped)
- Streaming chat (SSE) with QUICK / STANDARD / DEEP routes
- Bounded Analyst → Critic → Judge orchestration
- Decision Canvas (assumptions, options, evidence, decision, blueprint)
- Immutable DecisionRecord + Blueprint handoff
- Model Gateway (Gemini + Groq), server-side keys only
- ChallengeReady Domain Pack as optional reference adapter
- Dual repositories: Firestore (connected) + memory store (local/tests)

## Local setup

### Requirements

- Node.js 22+ (project also runs on current LTS)
- pnpm 10.15.0 (`npx pnpm@10.15.0` if global install is unavailable)

### Install

```bash
npx pnpm@10.15.0 install
npx pnpm@10.15.0 prepare:env
npx pnpm@10.15.0 dev
```

Open [http://localhost:3000](http://localhost:3000).

`prepare:env` creates `.env.local` from a template and maps keys from legacy `env.local` (`Gemini_API` / `Groq_API`) when present.

### Environment

Copy `.env.example` → `.env.local`. Never commit secrets (`.env.local`, `service.json`).

| Variable | Notes |
|---|---|
| `GEMINI_API_KEY` / `GROQ_API_KEY` | Server only |
| `NEXT_PUBLIC_FIREBASE_*` | Client Firebase config |
| `FIREBASE_ADMIN_CREDENTIALS_PATH` / `GOOGLE_APPLICATION_CREDENTIALS` | Preferred Admin path to gitignored `service.json` |
| `FIREBASE_ADMIN_PROJECT_ID` / `CLIENT_EMAIL` / `PRIVATE_KEY` | Fallback Admin cert (avoid committing) |
| `USE_MEMORY_STORE=true` | Force in-memory repos (tests / offline) |
| `DEV_AUTH_BYPASS=true` | Local auth bypass only when Firebase is **not** fully configured |

### Connected mode (Firebase Auth + Firestore)

1. Place a Firebase service account JSON at `./service.json` (gitignored).
2. Fill `NEXT_PUBLIC_FIREBASE_*` in `.env.local` from the Firebase console web app config.
3. Set:
   - `FIREBASE_ADMIN_CREDENTIALS_PATH=./service.json`
   - `GOOGLE_APPLICATION_CREDENTIALS=./service.json`
   - `USE_MEMORY_STORE=false`
   - `DEV_AUTH_BYPASS=false`
4. In Firebase Console → Authentication → Sign-in method: enable **Google**.
5. Add authorized domains (`localhost` for local).
6. Deploy rules/indexes (optional but recommended):

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

(`firebase.json` points at `src/infrastructure/firebase/rules/`.)

7. Restart `pnpm dev`, open `/login`, sign in with Google.

When Admin + client Firebase env are valid, the app runs **fail-closed**: memory store and auth bypass stay off unless you explicitly force `USE_MEMORY_STORE=true` (bypass is disabled while connected).

### Memory / offline mode

Set `USE_MEMORY_STORE=true` and (optionally) `DEV_AUTH_BYPASS=true` when Firebase is unavailable. Login page falls back to Dev Auth Bypass only if client Firebase is not configured.

### Scripts

```bash
npx pnpm@10.15.0 lint
npx pnpm@10.15.0 typecheck
npx pnpm@10.15.0 test
npx pnpm@10.15.0 verify:firebase
npx pnpm@10.15.0 test:e2e
npx pnpm@10.15.0 build
```

## Deployment (Vercel)

1. Push to GitHub (`feature/*` → PR → `main`)
2. Import repo in Vercel
3. Set production env vars (separate from preview). Prefer Admin cert env vars on Vercel; do **not** upload `service.json` to the repo.
4. Deploy Preview on PR; Production from `main`
5. Configure Firebase project (prefer separate prod project)
6. Deploy Firestore rules from `src/infrastructure/firebase/rules/firestore.rules`

Rollback: use Vercel previous deployment. Keep Firestore schema backward-compatible.

## Architecture notes

- Domain code never imports Gemini/Groq SDKs
- UI never imports provider SDKs
- Repositories abstract Firestore (memory implementations for tests/local)
- ChallengeReady is a Domain Pack — core runs without it
- Firebase Admin SDK is server-only; client receives public config only

## Disclaimer

Decision support / training tooling. Not financial, legal, or investment advice.
