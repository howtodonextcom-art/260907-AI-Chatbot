# Refactoring Report — Parallel Blind Framing & HITL Hard Gates

- **Time:** 2026-09-10 21:02 (UTC+7)
- **Repo:** `260907-AI-Chatbot` (workspace; prompt named `260909-AI-Research-Lab`)
- **Status:** **PASS**

---

## 1. Eradicated Blind Spots Summary

| Blind Spot | Defect | Fix |
|---|---|---|
| **1. Framing monopoly** | DEEP `FRAME`/`DISCUSS` = Analyst/Gemini only | `decideRouting` → `runParallelFraming: true`; `Promise.all` gemini∥deepseek∥groq via `runIndependentFramer` (`allowFallback: false`) |
| **2. Missing Conflict Engine** | Downstream agents debated on Gemini-only neo | `detectFrameConflicts` + `ConflictMap` persisted on `workflow.framing`; Canvas `ConflictMapPanel` |
| **3. Debate before verify** | CRITIQUE before VERIFY; HIGH unknowns allowed Critic | Stage order: FRAME → (pause HIGH) → OPTIONS → **VERIFY before CRITIQUE**; HIGH OPEN pauses before OPTIONS/CRITIQUE |
| **4. Bypassable DECIDED** | Direct `status: "DECIDED"` update | `approveDecision` must pass `gateDecisionApproval({ actionOrigin: "HUMAN_APPROVE" })` **and** `gateStatusTransition(..., { origin: "HUMAN_APPROVE", approve: true })` |

---

## 2. Code Diff Evidence

### Before (sequential Gemini FRAME)
```ts
// execution-plan.ts (old)
if (stage === "FRAME") {
  return wrap({
    runAnalyst: true,
    runSecondOpinion: false,
    runCritic: frameNeedsChallenge ? … : false,
  });
}
```

### After (Parallel Blind Framing)
```ts
// execution-plan.ts (new)
if (stage === "FRAME" || stage === "DISCUSS") {
  return wrap({
    runAnalyst: false,
    runParallelFraming: true, // PARALLEL_FRAME stage
    runSecondOpinion: false,
    runCritic: false,
  });
}

// decision-orchestrator.ts
const framerRuns = await Promise.all(
  providers.map((provider) =>
    runIndependentFramer({ gateway, provider, request: { … raw userContent … } })
  )
);
const merged = applyParallelFrameState({ session, frames });
```

### Conflict Engine
```ts
// conflict-engine.ts
export function detectFrameConflicts({ frames }): FrameConflictReport {
  // deterministic perspective + assumption/unknown coverage gaps
  return { conflictMap: { coreDisagreements: ConflictTopic[] }, … };
}
```

---

## 3. HITL Protection Proof

```ts
// hard-policy-gate.ts
{ code: "HUMAN_APPROVE_ORIGIN", passed: args.actionOrigin === "HUMAN_APPROVE", … }

// decision-orchestrator.ts — approveDecision
gateDecisionApproval({ …, actionOrigin: "HUMAN_APPROVE" });
gateStatusTransition(status, "DECIDED", ctx, {
  origin: "HUMAN_APPROVE",
  approve: true,
});
// PATCH / sessions cannot set DECIDED without that origin (gateStatusTransition rejects AI_AGENT/SYSTEM/USER_PATCH).
```

Orchestrator also early-returns on StageController `PAUSED` (HIGH unknowns) so agents cannot “push through” the human gate.

---

## 4. Build & Test Verification Log

```text
> pnpm typecheck
> tsc --noEmit
(exit 0)

> pnpm test
> vitest run
 Test Files  25 passed (25)
      Tests  204 passed (204)
```

New/updated coverage includes `conflict-engine.test.ts`, Parallel Framing routing tests, VERIFY-before-CRITIQUE stage tests, HUMAN_APPROVE gate tests.

---

## 5. Final Status

**[PASS]**

Key files touched:
- `src/ai/orchestration/execution-plan.ts`
- `src/ai/orchestration/decision-orchestrator.ts`
- `src/ai/orchestration/parallel-frame-merge.ts`
- `src/ai/agents/independent-framer.ts`
- `src/domain/decision/workflow-stage.ts`
- `src/domain/decision/conflict-engine.ts`
- `src/domain/decision/types.ts`
- `src/ai/safety/hard-policy-gate.ts`
- `src/features/decision-canvas/ConflictMapPanel.tsx`
- UI hints + unit/integration tests

**Note:** Live MCP browser re-verify on Mega 6/45 with three real API keys is recommended after deploy; unit/integration prove the architecture with scripted providers.
