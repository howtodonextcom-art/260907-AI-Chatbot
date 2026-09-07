# MASTER CODING PROMPT v15
## Layer A — AI Decision Lab
## Independent Audit 85/100 → Verified 100/100

### Repository

`https://github.com/howtodonextcom-art/260907-AI-Chatbot`

### Independently audited HEAD

`0e82b51cd9ff0d408e57e0b8455f2592dd2078a0`

### Canonical specification

`plan/26-09-07-layer-a-ai-decision-lab-coding-spec-v5.markdown`

### Current independent score

`85/100`

### Current classification

`BETA_READY`

Target:

`Verified 100/100`

Do not claim 100 unless every internal hard gate defined below is objectively satisfied.

---

# 0. MISSION

Do not redesign Layer A.

Do not add more AI providers.

Do not add more agent roles.

Do not rewrite working modules.

Close the remaining verified gaps in:

1. Decision integrity
2. Evidence relevance/trust
3. Firestore defense-in-depth
4. Structured-state consistency
5. Constraint lifecycle
6. DecisionRecord provenance
7. Confidence semantics
8. Blueprint coding handoff
9. Experiment trust
10. Budget/stop-condition runtime semantics
11. Evaluation proof
12. E2E regression coverage
13. Production security

Preserve all existing passing behavior.

---

# 1. FIRST ACTION

Run:

```bash
git status
git rev-parse HEAD
git log -10 --oneline
```

If HEAD is newer than:

`0e82b51cd9ff0d408e57e0b8455f2592dd2078a0`

inspect every newer commit before editing.

Then baseline:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:rules
pnpm test:e2e
pnpm build
```

Record actual results.

---

# 2. REQUIRED SUB-AGENTS

Use at least:

```text
Agent 1 — Decision Integrity / Unknown Policy
Agent 2 — Firestore Security / Concurrency
Agent 3 — Structured State / Constraints
Agent 4 — DecisionRecord / Confidence / Experiment Trust
Agent 5 — Blueprint v3
Agent 6 — Orchestration / Budget / Stop Conditions
Agent 7 — Evaluation Engine
Agent 8 — Playwright / Regression QA / Production Security
Agent 9 — Independent Final Auditor
```

Agents 1–8 implement.

Agent 9 must not implement the original work it audits.

Avoid concurrent edits to shared critical files.

---

# 3. PRESERVE VERIFIED PASSING INVARIANTS

Do not regress:

```text
canonical state transition gate
explicit human approval
DecisionRecord immutability
Workspace ownerId immutability
SecondOpinion independent semantics
Judge heuristic agreement
intent-aware execution planning
VERIFY ToolConnector wiring
MT4/MT5 arithmetic classifier
VerificationCoverage
Unknown UI
Unknown readiness summary
DomainPack criteria hydration
DomainPack tool allowlist
role-isolated prompts
cancellation propagation
Experiment lifecycle
Blueprint DRAFT → explicit APPROVED
rules tests in CI
Playwright in CI
generic core without ChallengeReady
```

---

# 4. P0 — CLOSE RESOLVE_WITH_EVIDENCE RELEVANCE BYPASS

Current behavior accepts any VERIFIED EvidenceItem in the same session to resolve any Unknown.

This is forbidden.

`RESOLVE_WITH_EVIDENCE` must require evidence to demonstrably relate to the target Unknown.

At minimum:

```text
Evidence.verificationStatus === VERIFIED
AND
Evidence.sessionId == session.id
AND
Evidence.ownerId == session.ownerId
AND
Evidence.supportsUnknownIds includes target unknownId
```

Do not accept unrelated VERIFIED evidence.

---

# 5. EVIDENCE RELATIONSHIP RULE

Example that must FAIL:

```text
Evidence:
20 * 15 = 300
VERIFIED

Unknown:
Should FTMO import use MT4/MT5 upload or API?

RESOLVE_WITH_EVIDENCE(calculationEvidence)
```

Expected:

```text
VALIDATION_ERROR
Unknown remains blocking
```

---

# 6. EXPLICIT HUMAN LINKING

If a user wants to use existing Evidence that was not originally linked to an Unknown:

do NOT silently treat it as verified resolution.

Provide one of:

A. an explicit evidence-linking action with rationale, which remains human-attributed;

or

B. require HUMAN_DECISION / ACCEPT_RISK instead.

Do not convert human interpretation into tool verification.

---

# 7. FIX EXISTING WRONG UNIT FIXTURE

Current Unknown policy tests accept unrelated VERIFIED calculator evidence.

Replace that fixture with evidence whose:

```text
supportsUnknownIds
```

contains the actual Unknown ID.

Add negative regression proving unrelated evidence is rejected.

---

# 8. P0 — FIRESTORE DIRECT UNKNOWN/STATUS BYPASS

Current Firestore session rule permits owner direct writes to structured decision state except a few server fields.

An authenticated Firebase client must not be able to bypass API/domain policy by writing:

```text
unknowns
status = DECISION_READY
judge-sensitive decision state
```

directly.

---

# 9. FIRESTORE SESSION WRITE POLICY

Review actual client architecture.

If all business writes already go through server APIs/Admin SDK, strongly prefer:

```text
client read allowed
client business-state update denied
```

for session structured state.

Otherwise define an explicit allowlist of safe direct-client fields.

At minimum direct client writes must NOT modify:

```text
status
unknowns
judgeDraft
activeDecisionRecordId
activeBlueprintId
assumptions verification/status fields
evidence links
system-controlled decision metadata
```

Do not depend solely on REST route validation.

---

# 10. FIRESTORE RULE TESTS

Add emulator tests:

```text
owner cannot directly set HIGH Unknown RESOLVED
owner cannot directly replace unknowns array
owner cannot directly set DECISION_READY
owner cannot combine fake Unknown resolution + DECISION_READY
owner cannot modify judgeDraft
owner cannot modify activeDecisionRecordId
non-owner cannot modify anything
legitimate allowed client fields still behave according to architecture
```

CI must run them.

---

# 11. APPROVAL DEFENSE-IN-DEPTH

Do not trust `session.status === DECISION_READY` alone.

Before creating DecisionRecord, `approveDecision()` must re-evaluate canonical deterministic readiness from CURRENT session state.

Require:

```text
option count valid
assumption count valid
blocking HIGH Unknown count = 0
contradicted blocking assumptions policy satisfied
DomainPack validation passes
JudgeDraft matches judgeRunId
explicit approval
```

This protects against corrupted/stale state even if another layer fails.

---

# 12. REMOVE DECORATIVE APPROVAL GATES

Current approval uses hard-coded:

`budgetExceeded: false`

Either connect real source-run budget state or remove budget from the consequential approval gate.

Do not retain a deterministic control that always receives a hard-coded passing value.

---

# 13. P0 — CURRENT NEXT.JS SECURITY PATCH

Current audited version:

`next@15.5.9`

Before implementation, check current official Next.js security guidance.

As of this audit, Maintenance LTS 15.5 requires at least:

`15.5.24`

for the August 2026 security release.

Upgrade `next`, `eslint-config-next` and lockfile to the current safe compatible Maintenance-LTS version.

Do not jump major versions unless required.

Run full suite after upgrade.

---

# 14. P1 — ATOMIC UNKNOWN RESOLUTION

Current route performs:

```text
read full session
modify one Unknown in array
write full session
```

This permits lost updates under concurrent requests.

Create repository-level atomic Unknown mutation or optimistic concurrency control.

Firestore implementation should use a transaction.

Test:

```text
Unknown A resolve concurrently
Unknown B resolve concurrently
```

Expected:

both changes survive.

---

# 15. IDEMPOTENT UNKNOWN ACTIONS

Repeated identical legitimate resolution must not:

```text
duplicate evidence IDs
duplicate audit data
corrupt timestamps
reopen terminal state
```

Define terminal-state transition rules.

A resolved Unknown must not be silently moved back to OPEN/VERIFY_NOW by stale client input.

---

# 16. P1 — OPTIONS STRUCTURED-STATE CONSISTENCY

Current Analyst has independent:

```text
reply
options[]
```

and the visible reply may mention options not persisted in state.

Make structured options authoritative.

Preferred:

```text
Model returns structured options
→ persist structured options
→ user-facing candidate list derives from structured data
```

Do not parse free-form prose afterward if avoidable.

---

# 17. OPTION INVARIANT

For `GENERATE_OPTIONS`:

every material candidate shown as an actual option to the user must have a stable `Option.id` in session state.

Add test fixture with exactly three FTMO options.

Assert:

```text
visible material options = 3
persisted session.options = 3
```

---

# 18. STABLE OPTION IDS

When later runs update an existing option:

preserve its ID.

Prefer structured agent output with:

```text
existingOptionId
```

or deterministic title/fingerprint matching.

Do not generate new IDs for an unchanged option every turn.

---

# 19. P1 — ASSUMPTION DEDUPLICATION

Current dedupe only lowercases and trims exact strings.

Improve deterministic normalization.

At minimum normalize:

```text
case
whitespace
punctuation
common domain-neutral boilerplate
```

Prefer having subsequent agent outputs reference existing assumption IDs.

Do not add vector DB/RAG.

---

# 20. ASSUMPTION UPDATE CONTRACT

Recommended structured form:

```ts
{
  assumptionUpdates: [
    {
      existingAssumptionId,
      status?,
      importance?,
      statement?
    }
  ],
  newAssumptions: [...]
}
```

Preserve IDs whenever referring to the same assumption.

---

# 21. P1 — CONSTRAINT CAPTURE

Canvas currently displays Constraints but Analyst cannot output any because Analyst schema has no constraints field.

Add structured constraint proposals.

Recommended:

```ts
{
  statement: string;
  source: "AI";
  confirmedByUser: false;
}
```

Do not automatically mark AI-proposed constraints as user-confirmed.

---

# 22. CONSTRAINT PROVENANCE

Preserve:

```text
USER
SYSTEM
DOMAIN_PACK
AI
```

and confirmation state.

ChallengeReady safety constraints may originate from DomainPack where appropriate.

Generic core must remain domain-independent.

---

# 23. CONSTRAINT UI

Allow user to:

```text
inspect
confirm
reject/remove
edit where policy permits
```

AI-proposed hard boundaries should not silently become immutable truth.

---

# 24. P1 — JUDGE STRUCTURED OUTPUT OBSERVABILITY

The missing-judgeDraft defect is fixed, but schema failure is still hidden by safe fallback.

Differentiate:

```text
VALID_STRUCTURED
RECOVERED_STRUCTURED
SAFE_FALLBACK
FAILED_STRUCTURED
```

Persist/log the structured-output status.

Do not make a safe `INSUFFICIENT_EVIDENCE` fallback look identical to fully valid Judge structured output.

---

# 25. AGENTRUN CONTRACT QUALITY

If required structured output remains invalid after one repair:

AgentRun must not silently advertise an unqualified success.

Use an existing status if suitable:

```text
PARTIAL
FAILED
```

or add explicit structured-output diagnostic fields.

Keep the prose reply where useful.

---

# 26. P1 — DECISIONRECORD ASSUMPTION SELECTION

Do not put every session assumption into:

`acceptedAssumptionIds`.

Accepted assumptions should be limited to:

```text
SUPPORTED
ACCEPTED_FOR_NOW
```

unless Judge explicitly and audibly selects another assumption with rationale.

Never silently accept:

```text
UNVERIFIED
CONTRADICTED
```

---

# 27. DECISIONRECORD EVIDENCE SELECTION

Do not populate `selectedEvidenceIds` with every EvidenceItem.

Select evidence that is actually relevant to:

```text
selected option
accepted assumptions
resolved Unknowns
decision rationale
```

Preserve verification status.

---

# 28. P1 — CONFIDENCE SEMANTICS

Keep:

`HEURISTIC`

Replace weak factors with:

```text
verifiedRelevantEvidenceCoverage
verifiedSourceReliability
blockingUnknownPenalty
unverifiedAssumptionPenalty
contradictedAssumptionPenalty
agentAgreement
trustedExperimentStrength
```

Do not use raw `evidence.length / 5` as the primary coverage signal.

Do not count unverified HIGH-labeled evidence as verified reliability.

---

# 29. P0/P1 — EXPERIMENT RESULT TRUST

Current API lets user submit experiment results and then converts them into:

```text
HIGH
VERIFIED
createdBy SYSTEM
verifiedBy EXPERIMENT
```

This is forbidden for manually entered results.

Add result provenance:

```ts
type ExperimentResultOrigin =
  | "MANUAL_USER"
  | "SYSTEM_EXECUTED"
  | "TOOL_VERIFIED";
```

---

# 30. EXPERIMENT TRUST MATRIX

Expected:

```text
MANUAL_USER
→ createdBy USER
→ UNVERIFIED or USER_ATTESTED
→ conservative reliability

SYSTEM_EXECUTED
→ may become VERIFIED

TOOL_VERIFIED
→ VERIFIED where tool semantics justify
```

A user typing arbitrary JSON cannot create SYSTEM VERIFIED HIGH evidence.

Add negative API test.

---

# 31. P1 — BLUEPRINT V3 LOSSLESS PERSISTENCE

BlueprintContent currently contains richer objects than persisted Blueprint.

Fix round-trip loss.

Persist rich:

```text
module purpose
business rules
edge cases
tests required

entity purpose
fields
relationships
indexes
ownership
validation
immutability

API auth
authorization
request schema
response schema
errors
idempotency
side effects
```

Do not flatten rich entities to `string[]`.

---

# 32. BLUEPRINT ROUND-TRIP TEST

Required:

```text
BlueprintContent
→ persisted Blueprint
→ repository read
→ BlueprintContent/export
```

Assert deep semantic preservation.

No fields silently disappear.

---

# 33. BLUEPRINT MUST DESCRIBE TARGET PROJECT

Current deterministic Blueprint hard-codes Layer A APIs and infrastructure.

If selected project is an FTMO training app, Blueprint must describe the FTMO app.

It must not automatically produce:

```text
/api/sessions/:id/run
DecisionRecord
Layer A orchestration
Firebase
Vercel
```

unless those were explicitly approved for the target product.

---

# 34. BOUNDED BLUEPRINT SYNTHESIZER

If structured DecisionState does not contain enough target architecture:

use one bounded Blueprint synthesis step through ModelGateway.

Input only:

```text
approved DecisionRecord
selected Option
accepted assumptions
verified relevant Evidence
constraints
residual Unknowns/risks
DomainPack context
```

Output strict Blueprint schema.

Maximum one repair.

Never invent unsupported architecture as a settled decision.

Represent missing decisions as:

`TBD / OPEN RISK`.

---

# 35. BLUEPRINT CANONICAL EXPORT

Canonical coding-agent export must require:

`Blueprint.status === APPROVED`

A DRAFT export must either:

```text
return 409
```

or require explicit draft mode and prominently label:

`DRAFT — NOT APPROVED FOR IMPLEMENTATION`.

Add E2E negative test.

---

# 36. BLUEPRINT FTMO ISOLATION TEST

Create an FTMO training product decision.

Export Blueprint.

Assert it contains target concepts such as appropriate combinations of:

```text
Challenge simulation
risk limits
training session
rule compliance
readiness
journal
```

and does not default to Layer A's own APIs/data model.

Avoid brittle sentence matching.

---

# 37. P1 — COST DISPLAY FIX

Current UI double counts the most recent run:

```text
persisted AgentRun totals
+
run.completed subtotal
```

After persisted runs reload, reset/remove provisional subtotal.

Canonical completed cost:

`sum(AgentRun.costUsd)`.

Only in-flight unpersisted usage may be displayed separately.

Add UI/unit test.

---

# 38. P1 — HARD PROVIDER BUDGET

Count every actual external attempt:

```text
initial attempt
retry
fallback
repair call
```

Failed attempts must still count as attempts where appropriate.

Hard budget preflight must run before starting another provider request.

Do not only check between agent stages.

---

# 39. PROVIDER ATTEMPT OBSERVABILITY

Track:

```text
providerAttempts
successfulCalls
failedAttempts
retries
fallbacks
repairCalls
tokens
cost
```

Avoid pretending wrapper call count equals network request count.

---

# 40. P1 — LOW_DISAGREEMENT RUNTIME SIGNAL

The evaluator exists.

Supply a real runtime value.

Use transparent heuristic derived from:

```text
Judge SecondOpinion agreement
selected option convergence
Critic contradiction state
```

Do not invent statistical precision.

Add orchestrator integration test where `LOW_DISAGREEMENT` is actually emitted.

---

# 41. P1 — NO_NEW_INFORMATION RUNTIME SIGNAL

Compute new-information score deterministically from differences in:

```text
options
assumptions
unknowns
evidence
criticisms
```

A simple normalized set/Jaccard heuristic is acceptable.

Add orchestration-level test demonstrating actual `NO_NEW_INFORMATION`.

---

# 42. P1 — EVALUATION RUNNER

Current runner grades caller-supplied artifacts.

Implement real execution:

```text
EvaluationCase
×
Configuration
→ actual pipeline execution
→ normalized artifact
→ deterministic grader
→ metrics
```

Configurations:

```text
A Single Groq
B Single Gemini
C Analyst + Critic
D Analyst + Critic + Judge
E D + conditional SecondOpinion
```

CI uses deterministic stub providers.

---

# 43. REMOVE SYNTHETIC BENCHMARK VERDICT

Remove hard-coded benchmark values such as:

```text
0.72
0.74
```

as evidence for SecondOpinion value.

If actual benchmark has not run:

return:

`INSUFFICIENT_DATA`

Operational default may remain:

`KEEP_CONDITIONAL`.

---

# 44. P1 — PLAYWRIGHT UNKNOWN CLOSURE TEST

Add actual browser regression:

```text
FTMO Session
→ HIGH Unknown visible
→ readiness NOT READY
→ resolution controls visible
→ invalid empty resolution rejected
→ legitimate HUMAN_DECISION or evidence resolution
→ readiness updates
→ PREPARE
→ DECISION_READY
→ approve
→ DECIDED
→ Blueprint DRAFT
→ approve
→ APPROVED
→ export
```

No direct request shortcuts for the positive closure path.

---

# 45. PLAYWRIGHT VERIFY REGRESSION

Use an FTMO Unknown containing:

`MT4/MT5`

Assert:

```text
no "4/5 = 0.8" evidence
no calculator invocation for identifier
Unknown remains unresolved
```

until legitimately resolved.

---

# 46. PLAYWRIGHT OPTIONS/CONSTRAINTS

Assert:

```text
visible candidate count matches structured options
constraints can appear in Canvas
confirmed constraints preserve provenance
```

Use machine-readable state/API assertions where possible.

---

# 47. PLAYWRIGHT NEGATIVE PATHS

Add:

```text
unrelated VERIFIED evidence cannot resolve Unknown
DRAFT Blueprint canonical export rejected
cross-user Unknown resolve denied
empty Human Decision note denied
duplicate/stale resolution safe
```

---

# 48. FIRESTORE RULES REGRESSION IN CI

Add direct Firebase SDK emulator tests for the new integrity protections.

`pnpm test:rules` remains mandatory in CI.

---

# 49. CURRENT SECURITY BASELINE

Before final completion, check official advisories again.

No production-ready claim with a known Critical vulnerability in current Next.js release.

Record installed safe version in final audit.

---

# 50. FIRESTORE PRODUCTION BLOCKER

Source/rules/CI completion and production deployment are separate.

Report:

```text
SOURCE_RULES
RULES_TESTED
CI_TESTED
DEPLOYED
PRODUCTION_VERIFIED
```

If IAM still returns 403:

`BLOCKED_EXTERNAL`

Do not fake PASS.

---

# 51. FULL TEST GATE

Final commands:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:rules
pnpm test:e2e
pnpm build
git diff --check
```

All applicable internal gates must PASS.

---

# 52. LIVE FTMO ACCEPTANCE TEST

After automated tests pass, rerun with real:

```text
Gemini
Groq
DeepSeek
USE_STUB_MODELS=false
```

Use one FTMO-only session.

Capture machine-readable:

```text
session states
AgentRuns
Evidence
Unknown lifecycle
JudgeDraft
DecisionRecord
confidence
Blueprint
cost
server transition logs
```

Do not rely on screenshots alone.

---

# 53. LIVE ACCEPTANCE MUST PROVE

```text
DISCOVERY
→ VALIDATING
→ HIGH blocker
→ legitimate resolution
→ DECISION_READY
→ explicit approval
→ DECIDED
→ DecisionRecord
→ target-specific Blueprint DRAFT
→ explicit approval
→ APPROVED
→ Markdown export
```

Target:

`0 false VERIFIED evidence`.

---

# 54. INDEPENDENT FINAL AUDITOR

Agent 9 independently inspects final HEAD.

It must verify each hard gate from source, tests, CI and runtime evidence.

Use:

```text
PASS
PARTIAL
FAIL
BLOCKED_EXTERNAL
CORRECTLY_ABSENT
```

Implementation agents may not self-certify 100.

---

# 55. FINAL 100-POINT RUBRIC

```text
Product clarity                  10
Architecture                     15
Domain model                     10
AI orchestration                 10
Data architecture                10
API contracts                    10
Security                         10
Testing / Evaluation             10
Deployment / Operations           5
Coding-agent usability           10
-----------------------------------
TOTAL                            100
```

Starting independent score:

`85/100`

---

# 56. 100/100 HARD GATES

Do not report 100 unless all are true:

```text
No direct Firestore readiness bypass
Unrelated Evidence cannot resolve Unknown
Unknown resolution atomic/race safe
Canonical approval rechecks readiness
Current Next security baseline clean
MT4/MT5 regression remains fixed
Options prose/state consistent
Assumption duplication controlled
Constraints structured and provenance-aware
Judge fallback observability truthful
DecisionRecord assumptions selected correctly
DecisionRecord evidence selected correctly
Confidence uses verified relevant factors
Manual Experiment results cannot self-become VERIFIED HIGH
Blueprint persistence lossless
Blueprint target-project specific
Canonical export requires APPROVED
UI cost reconciled
Provider attempt budget hard-enforced
LOW_DISAGREEMENT works at runtime
NO_NEW_INFORMATION works at runtime
Evaluation executes actual configuration pipelines
Unknown closure Playwright passes
VERIFY regression Playwright passes
Rules security regression passes
CI fully green
Live FTMO acceptance reaches Blueprint APPROVED
0 false VERIFIED evidence in acceptance session
No unresolved internal P0 defect
```

Firestore production may remain:

`BLOCKED_EXTERNAL`

only if IAM is genuinely unavailable and this is explicitly separated from repository implementation score.

---

# 57. REQUIRED FINAL REPORT

Create:

`reports/FINAL-AUDIT-v15.md`

Include:

```text
Starting HEAD
Final HEAD
Files changed
P0 bypass reproduction and fix
Firestore rule matrix
Unknown evidence relevance matrix
Concurrency test
Next.js security status
Options consistency
Assumption dedupe
Constraint lifecycle
Judge output status matrix
DecisionRecord provenance
Confidence factors
Experiment trust matrix
Blueprint round-trip
Blueprint FTMO isolation
Cost reconciliation
Budget attempt accounting
Stop-condition runtime matrix
Evaluation results
Unit tests
Integration tests
Rules tests
Playwright tests
Live FTMO QA
CI run URL/status
Firestore production status
Independent auditor score
Remaining blockers
```

---

# FINAL PRINCIPLE

Do not make gates weaker.

Make the state trustworthy enough to satisfy them.

The remaining product path is:

```text
structured decision state
→ relevant verified evidence
→ auditable uncertainty resolution
→ deterministic readiness
→ explicit human approval
→ immutable DecisionRecord
→ lossless target-specific Blueprint
```

Every PASS must be backed by:

```text
source
+
regression test
+
integration path
+
browser evidence where user-facing
+
CI
```

Otherwise it is not PASS.