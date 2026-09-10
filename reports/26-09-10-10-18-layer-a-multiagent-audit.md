# Layer A — Multi-Agent Algorithm Audit & Targeted Fixes

- **Trigger:** MASTER WORK PROMPT v21 (Layer A AI Decision Lab — Algorithm Audit → External Research → Redesign → Implementation → Verification)
- **Time:** 2026-09-10 10:18 (UTC+7)
- **Audited HEAD (given):** `904334ef192c093c1b772ce1c5226d44b3c8cc64`
- **Audited HEAD (actual, verified via `git rev-parse HEAD`):** `904334ef192c093c1b772ce1c5226d44b3c8cc64` — matches; no newer commits existed on the branch at audit start.
- **Branch:** `claude/layer-a-audit-3vw76h`
- **Scope decision:** the full v21 prompt calls for live multi-provider benchmarking (sections 19–22) and a ground-up "adaptive council" redesign (blind judge, rotating judge, information-gain routing — sections 16–18). After completing the audit and external research (below), the user was asked to choose the scope and picked **"fix confirmed defects only"** — no live API spend, no architecture rewrite. This report covers the audit, the research that informed the recommendation, and the concrete fixes implemented under that scope.

## 1. Baseline gate (before any change)

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | OK |
| `pnpm lint` | OK (2 pre-existing warnings in `src/tests/live/deep-ftmo-providers.test.ts`, unrelated) |
| `pnpm typecheck` | OK |
| `pnpm test` | **178/178** passed (22 files) |
| `pnpm test:rules` (real Firestore Emulator, `firebase emulators:exec`) | **14/14** passed |
| `pnpm test:e2e` (Playwright, stub models + memory store) | **2/3** passed — 1 deterministic failure, see H11 below |
| `pnpm build` | OK |
| GitHub Actions CI | Same commands as above (`.github/workflows/ci.yml`); the E2E failure (H11) would fail CI too — it is not environment-specific. |

The sandboxed audit environment lacked `firebase-tools` and a matching Playwright browser build by default; both were resolved locally (`npm i -g firebase-tools`, a temporary `executablePath` override for the pre-installed Chromium) to actually run the rules/E2E suites rather than skip them. Neither workaround was committed.

## 2. Source forensics — how the algorithm actually works

Traced UI → `/api/sessions/[id]/run` → `decision-orchestrator.ts` → `ModelGateway` → providers → prompts → structured schemas → state merge → gates, reading `decision-orchestrator.ts` (1872 lines), all agent/prompt/gateway files, `state-machine.ts`, `unknown-policy.ts`, `hard-policy-gate.ts`, Firestore rules, and the relevant API routes in full.

### 2.1 Mode × Stage × Role × Provider matrix (as implemented, `execution-plan.ts`)

| Mode | DISCUSS | FRAME | OPTIONS | CRITIQUE | VERIFY | PREPARE |
|---|---|---|---|---|---|---|
| QUICK | Analyst (groq) | — | — | — | tools only | — |
| STANDARD (before fix) | Analyst (gemini) | Analyst | Analyst | Analyst | tools only | **Analyst (dead end — see H1)** |
| STANDARD (after fix) | Analyst | Analyst | Analyst | Analyst | tools only | **Judge (gemini)** |
| DEEP | Analyst | Analyst (+Critic if high-impact framing) | Analyst ∥ SecondOpinion (deepseek, parallel, blind to each other) | Critic (groq) (+SecondOpinion if re-triggered) | tools (+optional Analyst explanation) | Judge (gemini) only, reusing prior artifacts |

- Provider binding (`model-gateway.ts::resolveProviderForRole`): Analyst → groq (QUICK) / gemini (else); Critic → **groq always**; Judge → gemini (preferred, but falls back gemini→groq→deepseek on failure like Analyst/Critic); SecondOpinion → **hard-locked to `"deepseek"` with `allowFallback:false`** (by design, see `[[deepseek-second-opinion]]` in CLAUDE.md).
- No rotation, no blind-identity judging, no adaptive budgets exist today — `resolveProviderForRole` is a pure `(role, mode) → provider` function.
- SecondOpinion never sees Analyst's output (separate, un-awaited promise; schema has no `agreement` field at all — enforced structurally, not just by prompt). Critic sees Analyst (+SecondOpinion if present) but only as "(different provider)", never a literal vendor name. Judge sees all three the same way. `agentAgreement` is derived solely from `JudgeOutputSchema.secondOpinionAgreement` via `deriveAgentAgreement()` — no drift from the CLAUDE.md P0-02 design was found.
- `gateStatusTransition` (state-machine.ts) is confirmed as the *only* path to any non-`DECIDED` status change (3 call sites: Analyst-suggested, Judge-triggered, client PATCH). `DECIDED` is written in exactly one place (`approveDecision`, after `gateDecisionApproval`/`HardPolicyGate`). No drift from the CLAUDE.md P0-01 design was found.

### 2.2 Restriction audit (section 10 of the prompt)

No occurrence of an arbitrarily asymmetric restriction ("10,000 tokens for one model, 3 sentences for another") was found. Actual role ceilings (`roleTokenCeiling`, `ai-budget.ts`):

| Role | QUICK | STANDARD | DEEP |
|---|---|---|---|
| Analyst | 2000 | 3500 | 4000 |
| Judge | — (never runs) | 3500 *(added by this fix)* | 4000 |
| SecondOpinion | — | — | 2500 |
| Critic | — | — | 2500 |

All capped again by the mode's total `maxOutputTokens` (QUICK 2000 / STANDARD 5000 / DEEP 10000) and `maxCalls` (1/2/8) — modest, and scaled sensibly by role (Judge/Analyst need to synthesize more than Critic/SecondOpinion need to react). This does **not** support the user's hypothesis that models are arbitrarily over-restricted or unfairly unequal.

## 3. Hypothesis verification (H1–H12 from the prompt)

| ID | Verdict | Evidence |
|---|---|---|
| H1 | **CONFIRMED (fixed)** | STANDARD was Analyst-only at every stage including PREPARE (`execution-plan.ts`), yet Analyst's own `suggestedStatus` can legally reach `DECISION_READY` via `gateStatusTransition` (`applyAnalystState`) — with no `judgeDraft` ever set (`judgeDraft` is written in exactly one place, the Judge branch). `approveDecision` requires `judgeDraft` to exist. Net effect: a STANDARD session could reach `DECISION_READY` and then never be approvable — a real dead end, not just a mislabeled UI hint. |
| H2 | **CONFIRMED (fixed)** | `page.tsx::sendMessage` sent `runBody.intent = intent` (component state, default `"DISCUSS"`) for every plain "Gửi" send in QUICK/STANDARD, regardless of whether the user ever opened the advanced "Nâng cao / QA" panel. Only DEEP mode omitted it. A normal STANDARD/QUICK user who never touches the advanced panel would silently send stage-inappropriate `intent: "DISCUSS"` forever instead of letting StageController infer the stage. |
| H3 | **PARTIAL (not re-scoped)** | `RESOLVE_WITH_EVIDENCE` (`unknown-policy.ts`) already requires the evidence IDs to exist in-session and be `VERIFIED` (real fix from a prior session, `[[unknown-resolution-workflow]]`). It does **not** check topical relevance to the specific Unknown being resolved (any VERIFIED evidence in the session can close any Unknown). Left as documented debt — a relevance check would need a design decision (semantic match? explicit `supportsUnknownIds` requirement?) out of scope for this pass. |
| H4 | **PARTIAL (not re-scoped)** | Firestore rules (already fixed for `ownerId` immutability, P0-03) block `DECIDED`/`judgeDraft`/`activeDecisionRecordId`/`activeBlueprintId` writes, but do **not** validate the transition graph or content of `unknowns`/`options`/`assumptions` for any other write — a client bypassing the API (direct authenticated Firestore write) could still legally set `status: "DECISION_READY"` or forge unknown/option content, ignoring `gateStatusTransition`. Compounding: production rules deploy to `chatai-62ca2` is still blocked on IAM (pre-existing debt, documented in CLAUDE.md). Rewriting rules to encode the state machine is a real, security-relevant change that deserves its own careful pass with dedicated tests, not a rushed addition here. |
| H5 | **Not verified this pass** (time-boxed out) | `experiment/lifecycle.ts` was skimmed but not traced end-to-end into evidence creation. |
| H6 | **CONFIRMED (fixed)** | `deriveBlueprintContent` (`blueprint/service.ts`) hardcoded Layer A's own internals into `apiContracts` (`/api/sessions/{id}/run`, `/api/sessions/{id}/decision`), `aiWorkflow` ("Analyst frames problem", "Judge draft → human approve"), `securityRequirements` ("DECIDED only via approveDecision after HardPolicyGate"), `observabilityRequirements` ("Persist AgentRun provider/model/tokens"), `testRequirements` (Layer A's own test suite), and `deploymentRequirements` ("Vercel", "Firebase") / `implementationOrder` ("Deploy with production MemoryStore forbidden"). The Blueprint — the artifact meant to brief whoever builds the *target* product (e.g. an FTMO training app) — was describing the decision tool itself, not the product. |
| H7 | **Not verified this pass** (time-boxed out) | Persistence path (`blueprint/repository.ts` / Firestore mapping) not traced field-by-field. |
| H8 | **CONFIRMED (fixed)** | `judgeDraft.selectedEvidenceIds` was `evidence.map((e) => e.id)` — literally every evidence item in the session regardless of `verificationStatus` (including `CONTRADICTED`/`UNVERIFIED`/`NOT_VERIFIABLE`). `judgeDraft.acceptedAssumptionIds` was every assumption in the session regardless of `status`, including ones marked `CONTRADICTED`. Both flow unfiltered into the immutable `DecisionRecord`. |
| H9 | **Not verified this pass** (time-boxed out) | Cost UI aggregation (`totalCost` in `page.tsx`) looked plausible on inspection but wasn't stress-tested against a partial/retried run. |
| H10 | **CONFIRMED, left unfixed (documented)** | `computeDisagreementScore` / `computeNewInformationScore` (`stop-conditions.ts`) are real, non-trivial heuristics — but grep confirms zero call sites outside their own definitions; every `evaluateStop()` call passes them as `undefined` explicitly, so `LOW_DISAGREEMENT`/`NO_NEW_INFORMATION` can never fire. Wiring them up is a genuine behavior change (would need a decision about *what* consumes the signal — auto-stop a round? surface for observability only?) and was intentionally left out of the "fix confirmed defects only" scope rather than rushed. |
| H11 | **CONFIRMED (fixed)** | `decision-loop.spec.ts` clicked `data-testid="auto-workflow"`, then asserted text on that same testid — but `Composer.tsx` swaps that element for `data-testid="stop-workflow"` the instant the run starts (`busy` state), and DEEP's multi-stage auto-run stays busy far longer than the assertion's ~10s window. Deterministic failure, not flaky — reproduced twice locally, and would fail the same way on GitHub Actions CI. |
| H12 | **NO LONGER APPLICABLE** | `package.json` confirms `next@15.5.9`, the patched 15.5.x line — matches the CLAUDE.md record. |

### Additional finding surfaced while writing an H8 regression test (not in original H1–H12, **not fixed**, flagged for follow-up)

`canEnterDecisionReady` (`state-machine.ts`) checks `highPriorityOpenUnknowns`, option/assumption counts, and domain errors — but never assumption `status`. Combined with `resolveIntentForRun`: an **explicit** intent (e.g. `PREPARE_DECISION` via the "Nâng cao / QA" panel) bypasses `decideWorkflowStage`'s advisory `EVIDENCE_CONTRADICTION` pause entirely (that pause only applies when intent is *inferred*). Net effect: a session with a `CONTRADICTED` assumption can still legally reach `DECISION_READY`/`DECIDED` via the explicit-intent path — the pause is advisory UI behavior, not a gate. The H8 fix (excluding `CONTRADICTED` assumptions from `judgeDraft.acceptedAssumptionIds`) is real defense-in-depth for exactly this path, verified by test. Closing the gate itself (teaching `canEnterDecisionReady` about contradicted assumptions) is a follow-up, not done here.

## 4. Model fairness audit (sections 8–9 of the prompt) — summary verdict

Going dimension by dimension (F1–F12) against Gemini/Groq/DeepSeek: **no evidence supports "models are being constrained too aggressively" or "provider influence is structurally unequal beyond what the roles require."**

- Context access (F1): all roles get the same `buildCoreContext` base; only role-specific deltas are prior-role outputs, which is by design (Critic must see what it's critiquing).
- Opportunity to contribute / independent proposal (F2/F3): Analyst and SecondOpinion run genuinely in parallel with zero cross-visibility, verified at the code level (separate promises, no shared content, schema has no agreement field).
- Token budget (F4): modest, role-scaled, not "10k vs 3 sentences" — see §2.2.
- Influence on structured state / final decision (F6/F7): Analyst/SecondOpinion can propose options/assumptions/unknowns; Critic can only add debate notes (no structural write access at all); Judge alone writes `judgeDraft` and can gate `DECISION_READY`. This is a legitimate, intentional hierarchy (Critic is meant to challenge, not author), not a fairness bug.
- Provider-brand bias risk (F12): the one real, literature-supported risk is Gemini serving as both Analyst and Judge (self-preference bias — see §5). The existing DeepSeek-SecondOpinion + Judge-only `secondOpinionAgreement` design is a genuine, already-implemented mitigation for this, not a gap.

Verdict: the user's hypotheses 1–7 (§2 of the prompt) are **not substantiated** by the code. The real defects found (§3 above) are integration/product bugs, not model-fairness or debate-richness problems.

## 5. External research summary (section 12–19 of the prompt)

Full research (AutoGen, CrewAI, LangGraph, CAMEL-AI, MetaGPT, ChatDev, AgentVerse, OpenAI Swarm/Agents SDK, Mixture-of-Agents, multi-agent debate literature, LLM self-preference bias literature, Karpathy's "LLM Council") was conducted via live web search with citations. Headline conclusions:

1. **Layer A's deterministic-gate discipline is ahead of most frameworks surveyed** — only LangGraph matches it structurally, and LangGraph's generality is a cost not worth paying for a fixed 4-role pipeline.
2. **Analyst ∥ SecondOpinion → Critic → Judge is a legitimate, literature-supported 2-layer Mixture-of-Agents.** Recent "selection bottleneck" research (arXiv:2603.20324) finds diverse-model teams with judge-based *selection* beat naive synthesis — Layer A's Judge already selects/rejects options rather than blending them, which is the empirically better shape.
3. **Gemini-as-Judge-over-Gemini-as-Analyst self-preference bias is real and measured** (arXiv:2404.13076, 2410.21819), not hypothetical — this validates the existing DeepSeek-SecondOpinion mitigation rather than calling for a bigger redesign. Blind/anonymized judging (à la Karpathy's LLM Council) is a legitimate *lightweight experiment* to consider later, with the explicit caveat from the literature that anonymization only *partially* mitigates the bias (judges still recognize stylistic fingerprints).
4. **A rigorous, recent finding (arXiv:2604.02460) shows single-agent LLMs match or beat 5 multi-agent architectures under equal token budgets** on multi-hop reasoning — direct evidence against "add more agents/rounds" as a default move. AutoGen and ChatDev both underwent full architecture rewrites within about a year of their popular releases — a concrete, current illustration of the framework-churn cost of chasing this pattern.

Combined with the hypothesis verification above, this is why the recommendation below is **EVOLVE CURRENT**, not a redesign — the full research memo (with per-framework citations) was produced during the audit and can be written up as a standalone `reports/` artifact on request, but was not required once the scope was narrowed to "fix confirmed defects only."

## 6. Fixes implemented (this branch, this commit)

All fixes are test-first / test-covered and scoped to the confirmed defect only — no speculative refactors.

1. **H1 — STANDARD dead end.** `execution-plan.ts::decideRouting`: STANDARD's PREPARE stage now runs Judge-only (mirrors DEEP PREPARE), fitting inside STANDARD's existing `maxCalls: 2` budget. Added `roleTokenCeiling("JUDGE", "STANDARD") = 3500`. Updated the STANDARD footer hint in `Composer.tsx`. Test: `execution-plan.test.ts` (split the old "STANDARD stays Analyst-only" test; added a dedicated PREPARE→Judge assertion).
2. **H2 — stale Intent leak.** `page.tsx`: added `intentTouched` state; the advanced "Nâng cao / QA" Intent dropdown is only honored on plain Send once the user has actually interacted with it; otherwise QUICK/STANDARD now omit `intent` the same way DEEP already does, letting StageController infer. `onRequestCritique`/`onRequestVerify` are unaffected (they already pass an explicit `overrides.intent`).
3. **H6 — Blueprint describing Layer A instead of the target product.** `blueprint/service.ts::deriveBlueprintContent`: `apiContracts`/`aiWorkflow`/`securityRequirements`/`observabilityRequirements`/`testRequirements`/`deploymentRequirements`/`implementationOrder` are now derived from the session's selected option / constraints / target entity, with honest placeholders where Layer A genuinely cannot know the target's stack, instead of hardcoding Layer A's own routes and pipeline. Test: `blueprint-derive.test.ts` (new test asserting no Layer A internals leak into Blueprint content).
4. **H8 — DecisionRecord including unfiltered evidence/assumptions.** `decision-orchestrator.ts`: `judgeDraft.selectedEvidenceIds` now filters to `verificationStatus === "VERIFIED"`; `judgeDraft.acceptedAssumptionIds` now excludes `status === "CONTRADICTED"`. Test: new integration test in `automatic-workflow.test.ts` driving the real orchestrator through a scripted Judge run with a mixed-status fixture, verifying the filtered fields — deliberately using the explicit-intent path (see §3 follow-up finding) since that's the realistic route that reaches Judge despite a contradicted assumption.
5. **H11 — deterministic E2E failure.** `decision-loop.spec.ts`: replaced the racy same-testid text assertion with an assertion on the state the click actually produces (`stop-workflow` becoming visible).

## 7. Test results (after fixes)

| Check | Result |
|---|---|
| `pnpm lint` | OK |
| `pnpm typecheck` | OK |
| `pnpm test` | **181/181** passed (22 files; +3 new tests) |
| `pnpm test:rules` | **14/14** passed (unaffected, re-verified) |
| `pnpm test:e2e` | **3/3** passed (was 2/3) |
| `pnpm build` | OK |

## 8. Recommendation (section 39.30 of the prompt)

**EVOLVE CURRENT.**

Not "KEEP CURRENT" — real, confirmed defects existed and are now fixed. Not "MAJOR REDESIGN" — the audit found no evidence for the user's core suspicions (models over-restricted, unfairly weighted, or that the current fixed-role/single-pass design is under-deliberative), and the external literature review argues *against* the specific redesign directions sketched in the prompt (more agents, debate rounds, full adaptive-council rewrite) as a default move, absent a measured quality gap the current design demonstrably has. The defects that did exist were mundane integration bugs (a mode reaching a dead-end status, a stale UI variable, an artifact template that forgot to parameterize itself, an unfiltered array, a racy test) — none of which are fixed by adding more models or more debate.

## 9. Deferred / not in this pass

- H3 (evidence relevance to the specific Unknown), H4 (Firestore rules don't encode the full state machine — plus the pre-existing production-deploy IAM blocker), H5/H7/H9 (not verified this pass), H10 (wiring disagreement/new-information signals — needs a design decision on what consumes them), and the `canEnterDecisionReady`-doesn't-check-contradicted-assumptions finding from §3. None were part of the user-approved scope for this pass; all are concrete enough to pick up individually with test-first fixes later.
- Live multi-provider benchmarking (prompt §19–22) and the full adaptive-council redesign (prompt §16–18) were explicitly declined by the user for this pass, given the findings above.
