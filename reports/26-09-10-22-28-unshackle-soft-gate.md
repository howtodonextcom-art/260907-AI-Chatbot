# Unshackle + Soft Gate — forensic execution

- **Time:** 2026-09-10 22:28 (UTC+7)
- **Prompt:** Forensic Remediation Brief (user OK)

## Soft Gate
Already present in `workflow-stage.ts` (`collectPipelineBlockers` = CONTRADICTED only). Integration proves PREPARE with HIGH open. No further stage-controller change required this pass.

## Unshackle (confirmed interventions fixed)

| Change | File |
|---|---|
| Removed Critic `"Phản bác Analyst:"` / SO `"Phương án khác:"` forced prefixes; Analyst/Judge no greetings | `src/ai/prompts/registry.ts` |
| Per-provider analytical lens (no greeting) | `src/ai/agents/independent-framer.ts` |
| Judge parse fail → no invented `INSUFFICIENT_EVIDENCE` enum | `src/ai/agents/judge.ts` |
| UI: neutral kickers; **stop prepending** scripted text into bubble body | `src/features/chat/MessageBubble.tsx` |
| Summarize framing = structural tags only | `src/domain/decision/conflict-engine.ts` |
| Stub/integration replies without canned prefixes | stub-provider, automatic-workflow, prompt-depth, agent-structured-recovery |

## Explicitly NOT done (forensic reject)
- No fake `framer-prompts.ts` / `infrastructure/gateways`
- Conflict Engine remains deterministic AST (no LLM synthesizer)
- StubProvider kept for CI
- HardPolicyGate / DECIDED / empty-resolve / quorum / humanApproveProof unchanged

## Verify
- `pnpm typecheck` — pass
- `pnpm test` — **213/213** pass
