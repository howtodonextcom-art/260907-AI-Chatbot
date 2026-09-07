# MASTER CODING PROMPT v13
## Layer A — AI Decision Lab
## Decision Closure + Evidence Integrity + Structured-State Consistency + Verified FTMO E2E

---

# 0. REPOSITORY

Repository:

```text
https://github.com/howtodonextcom-art/260907-AI-Chatbot
```

Canonical specification:

```text
plan/26-09-07-layer-a-ai-decision-lab-coding-spec-v5.markdown
```

Repository instructions:

```text
CLAUDE.md
```

Primary runtime QA evidence:

```text
26-09-07-23-49-kiem-thu-e2e-ftmo-decision-session.md
```

This QA report is authoritative evidence for the defects reproduced in a real browser session.

Do NOT reinterpret those failures as theoretical.

---

# 1. PRIMARY MISSION

Close the remaining product gaps exposed by the real FTMO end-to-end test.

The target is NOT to weaken decision gates.

The target is to make the user journey capable of legitimately satisfying them.

Required final loop:

```text
DISCOVERY
→ VALIDATING
→ resolve / verify blocking uncertainty
→ DECISION_READY
→ explicit human approval
→ DECIDED
→ DecisionRecord
→ Blueprint DRAFT
→ explicit Blueprint approval
→ Blueprint APPROVED
→ Markdown coding handoff
```

The system must reach this outcome without:

```text
manual database edits
hidden API calls
temporary source hacks
forcing status
removing readiness gates
faking Evidence
marking Unknown resolved without rationale
```

---

# 2. VERIFIED FAILURES FROM REAL QA

Treat the following as confirmed defects unless CURRENT HEAD already proves they were fixed.

## HIGH-01 — Decision lifecycle deadlock

Observed runtime:

```text
2 HIGH Unknowns remain OPEN
→ gateStatusTransition correctly rejects DECISION_READY
→ Decision Canvas does not expose Unknown resolution UI
→ Approve Decision button does not render
→ /decision returns HTTP 409
→ DecisionRecord = null
→ Blueprint = null
```

The gate is correct.

The product workflow is incomplete.

DO NOT bypass the gate.

Build the missing uncertainty-resolution workflow.

---

## HIGH-02 — Calculator false-positive

Observed:

```text
MT4/MT5
→ arithmetic extraction
→ 4/5
→ calculator = 0.8
→ Evidence CALCULATION
→ VERIFIED
```

This is false verification.

This must be fixed at the verification-selection layer, not merely patched with one literal exception for MT4/MT5.

---

## MEDIUM-01 — Structured options diverge from chat

Observed:

```text
Analyst reply visibly presents 3 MVP options
but
session.options persists only 2
```

The structured state and user-visible reasoning are inconsistent.

Structured state must be authoritative and complete.

---

## MEDIUM-02 — Duplicate assumptions

Observed after PREPARE_DECISION:

```text
semantically equivalent FTMO assumptions
→ new IDs
→ duplicated state
```

Prevent uncontrolled semantic/state duplication.

---

## MEDIUM-03 — Constraints remain empty

During FTMO reasoning the AI identified real hard boundaries, but:

```text
session.constraints = []
```

throughout the run.

Important project boundaries must become explicit structured state when appropriate.

---

## LOW-01 — JudgeDraft visibility

JudgeDraft exists in session JSON while the Canvas message still says to run PREPARE_DECISION because rendering is tied too tightly to:

```text
status === DECISION_READY
```

UI should distinguish:

```text
Judge recommendation exists
but
readiness gate is still blocked
```

---

## LOW-02 — transient cost display discrepancy

Observed UI cost around:

```text
$0.0104
```

while persisted AgentRun / orchestrator total was:

```text
$0.006728
```

After reload the UI matched persisted cost.

Audit client-side aggregation and eliminate double counting or stale optimistic cost where practical.

---

# 3. PRESERVE VERIFIED WORKING BEHAVIOR

Do NOT regress:

```text
Gemini Analyst
Groq Critic
DeepSeek SecondOpinion
Gemini Judge
```

All were observed running through real provider APIs.

Preserve:

```text
SecondOpinion conditional routing
Judge-derived JUDGE_HEURISTIC agreement
canonical transition gate
HIGH Unknown readiness blocking
explicit Decision approval
immutable DecisionRecord
DomainPack isolation
VERIFY tool architecture
Evidence trust normalization
provider abstraction
repository abstraction
full CI pipeline
```

The QA report proved:

```text
transition.rejected
```

was correct behavior.

Never “fix” the test by removing or weakening it.

---

# 4. REQUIRED MULTI-AGENT DEVELOPMENT TEAM

Use at least 9 sub-agents.

Recommended ownership:

```text
Agent 1 — Unknown Resolution Domain Model
Agent 2 — Decision Canvas / UX
Agent 3 — VERIFY Parser & Evidence Integrity
Agent 4 — Structured State Consistency
Agent 5 — Decision / Confidence / Provenance
Agent 6 — Blueprint Handoff
Agent 7 — Test Architecture
Agent 8 — Browser E2E / Runtime QA
Agent 9 — Independent Final Auditor
```

Coordinator must:

```text
prevent overlapping critical edits
merge incrementally
run checkpoints
reject weak fixes
```

Agent 9 must not implement the features it later audits.

---

# 5. FIRST ACTION — REPRODUCE BEFORE FIXING

Before changing source:

```bash
git status
git rev-parse HEAD
git log -10 --oneline
```

Run baseline:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:rules
pnpm test:e2e
pnpm build
```

Then reproduce, using controlled tests or browser where possible:

```text
HIGH Unknown blocks DECISION_READY
Canvas cannot resolve it
MT4/MT5 becomes 4/5
options reply/state divergence
assumption duplication
constraints remain absent
```

Save failing regression tests BEFORE implementing fixes.

Do not merely copy the QA report's assertions.

Confirm current HEAD behavior.

---

# 6. P0 — BUILD A REAL UNKNOWN RESOLUTION WORKFLOW

Unknown must become a first-class user-facing object.

Decision Canvas must render an:

```text
Unknowns
```

section.

For every Unknown show at minimum:

```text
question
priority
resolution/status
linked Evidence
source
createdAt where useful
```

---

# 7. UNKNOWN ACTIONS

Provide clear bounded actions appropriate to current architecture.

At minimum support:

```text
VERIFY NOW
MARK FOR EXPERIMENT
REQUEST HUMAN DECISION
RESOLVE WITH EVIDENCE
ACCEPT AS OPEN RISK
```

Use existing domain vocabulary where possible.

Do not invent duplicate state concepts unnecessarily.

---

# 8. DO NOT ALLOW EMPTY "RESOLVED"

A user must not bypass readiness by simply pressing:

```text
Resolved
```

with no justification.

To resolve a HIGH Unknown, require at least one of:

```text
verified Evidence
completed Experiment result
explicit Human Decision with resolution note
explicit acceptance as known residual risk
```

Persist:

```text
resolution
resolvedAt
resolvedBy
resolutionNote
linkedEvidenceIds
```

or equivalent existing fields.

---

# 9. HUMAN DECISION IS NOT VERIFIED FACT

If user manually resolves an Unknown:

do NOT turn it into:

```text
VERIFIED FACT
```

Record it as something equivalent to:

```text
HUMAN_DECISION
USER_ACCEPTED_RISK
ACCEPTED_FOR_NOW
```

depending on existing domain model.

Maintain provenance.

---

# 10. HIGH UNKNOWN READINESS POLICY

Centralize the logic.

A HIGH Unknown should block DECISION_READY when:

```text
status = OPEN
and
resolution requires further evidence
```

It may cease blocking when properly resolved via:

```text
verified evidence
experiment result
explicit human acceptance/decision
```

The reason must be auditable.

---

# 11. CANONICAL UNKNOWN API

Create or extend server APIs for Unknown lifecycle.

Example shape only:

```text
PATCH /api/sessions/:sessionId/unknowns/:unknownId
```

Request must use strict Zod validation.

Client must not modify:

```text
ownerId
sessionId
createdBy system fields
verified fields
```

arbitrarily.

Authorization:

```text
requireAuth
session owner scope
```

---

# 12. UNKNOWN UI MUST ENABLE THE ACTUAL JOURNEY

The browser must support:

```text
open Decision Canvas
→ inspect HIGH Unknown
→ choose resolution path
→ complete resolution
→ session updates
→ PREPARE_DECISION again
→ gate reevaluates
→ DECISION_READY
```

No DevTools/manual API call should be needed for normal user flow.

---

# 13. JUDGED-BUT-BLOCKED UI STATE

If JudgeDraft exists but readiness gate rejects transition:

show:

```text
Judge Recommendation Available
Decision not ready
```

plus blockers.

Example:

```text
2 HIGH uncertainties still require resolution
```

Do not hide JudgeDraft merely because status remains VALIDATING.

This improves transparency without weakening the gate.

---

# 14. P0 — VERIFY CANDIDATE CLASSIFICATION

The calculator must not run on arbitrary text that happens to contain:

```text
digit / digit
```

Before arithmetic extraction:

classify whether the candidate is genuinely a mathematical proposition.

Implement deterministic parsing first.

Avoid an LLM call merely to decide whether `MT4/MT5` is arithmetic unless absolutely necessary.

---

# 15. TOKEN / IDENTIFIER SAFETY

Arithmetic recognition must reject identifier-like patterns such as:

```text
MT4/MT5
H264/H265
4K/8K
v1/v2
ISO27001/27002
A/B
IPv4/IPv6
USB2/USB3
Gen4/Gen5
```

Do NOT implement this as only a literal blacklist.

Use lexical/context rules.

Example considerations:

```text
letters immediately adjacent to number
known identifier token
slash-separated alphanumeric labels
version notation
codec notation
platform/product notation
```

---

# 16. STRICT ARITHMETIC GRAMMAR

A candidate calculation should consist primarily of:

```text
numeric literals
operators
parentheses
whitespace
approved decimal/percentage notation
```

after safe normalization.

Do not feed arbitrary natural-language fragments directly to CalculatorConnector.

---

# 17. VERIFICATION SCOPE

Add explicit semantics equivalent to:

```ts
type VerificationCoverage =
  | "NONE"
  | "PARTIAL"
  | "FULL";
```

Evidence should retain:

```text
originalClaim
verifiedFragment
coverage
```

Example:

```text
Original:
20 users × $15 = $300 MRR and they will all subscribe

Verified:
20 × 15 = 300

Coverage:
PARTIAL
```

Do NOT set the whole Assumption to SUPPORTED.

---

# 18. FULL SUPPORT POLICY

Only transition an Assumption to:

```text
SUPPORTED
```

when verification covers the proposition that the Assumption actually asserts.

Partial calculation evidence should attach to the Assumption but leave the unresolved portion explicit.

---

# 19. UNKNOWN RESOLUTION FROM VERIFY

Do not automatically mark Unknown resolved because one piece of evidence was created.

Require:

```text
evidence addresses the actual Unknown
+
verification coverage is sufficient
```

For example:

```text
"Should FTMO data import use MT4/MT5 upload or API?"
```

cannot be resolved by a calculation.

---

# 20. TOOL CONNECTOR CONTRACT

Extend ToolConnector verification results if useful to return:

```ts
{
  verifiedFragment: string;
  coverage: VerificationCoverage;
  normalizedInput: string;
  result: unknown;
}
```

Keep connectors deterministic and allowlisted.

---

# 21. P0 REGRESSION TESTS FOR VERIFY

Required tests:

```text
MT4/MT5 → calculator NOT invoked
H264/H265 → calculator NOT invoked
4/5 → calculator invoked
20*15 → calculator invoked
20 users * $15 → safely normalized if supported
compound numeric claim → PARTIAL
pure arithmetic claim → FULL
non-arithmetic FTMO rule claim → no calculator
```

Also test:

```text
no false EvidenceItem VERIFIED created
no Unknown falsely resolved
no Assumption falsely SUPPORTED
```

---

# 22. P1 — STRUCTURED OPTIONS MUST MATCH USER-VISIBLE OPTIONS

The model must not maintain two divergent truths:

```text
reply prose
vs
structured options[]
```

Prefer:

```text
structured output is authoritative
→ render reply from structured result
```

or ensure both fields derive from the same structured generation.

---

# 23. GENERATE_OPTIONS INVARIANT

If the user-visible Analyst answer presents N candidate options:

```text
all N material candidates
```

must exist in:

```text
session.options
```

with stable IDs.

Do not allow a third option to exist only in prose.

---

# 24. OPTION UPDATE CONTRACT

For existing options, prefer:

```text
updateExistingOption
```

using existing IDs.

For genuinely new options:

```text
createNewOption
```

Do not recreate the entire option set every run unless intended.

---

# 25. ASSUMPTION DEDUPLICATION

Stop repeated PREPARE/FRAME runs from generating semantic clones with new IDs.

First layer:

```text
normalize text
case fold
punctuation normalization
whitespace normalization
domain-specific trivial wording normalization
```

Second layer, if needed:

use explicit references to existing IDs in structured agent output.

Preferred agent output pattern:

```ts
{
  assumptionUpdates: [
    {
      existingAssumptionId,
      ...
    }
  ],
  newAssumptions: [...]
}
```

Do NOT add a vector database solely for deduplication.

---

# 26. SEMANTIC DUPLICATE TEST

Test FTMO phrases such as:

```text
"Trader thường thất bại do kỷ luật quản trị rủi ro."

"Phần lớn trader trượt Challenge vì thiếu kỷ luật risk management."
```

Do not demand perfect NLP equivalence.

But repeated model turns should not create uncontrolled duplicates when they clearly refer to the same existing assumption.

---

# 27. CONSTRAINTS AS FIRST-CLASS STRUCTURED STATE

Audit why FTMO constraints stayed empty.

Introduce structured capture for real hard boundaries such as:

```text
training / simulation only
no live broker execution
no trading signal service
no guaranteed FTMO pass claim
MVP scope boundary
```

Do not automatically elevate every Analyst sentence to a hard Constraint.

---

# 28. CONSTRAINT PROVENANCE

Constraint should preserve origin:

```text
USER
DOMAIN_PACK
AI_PROPOSED
SYSTEM
```

AI-proposed constraints may require user confirmation before becoming hard project constraints when appropriate.

---

# 29. DOMAINPACK CONSTRAINTS

ChallengeReady deterministic policy may provide predefined non-negotiable safety boundaries.

If so, encode them as:

```text
DOMAIN_PACK
```

rather than repeatedly regenerating them via AI.

Generic core must remain independent.

---

# 30. P1 — DECISION CANVAS IMPROVEMENT

Canvas should expose:

```text
Problem
Constraints
Options
Assumptions
Unknowns
Evidence
Judge Recommendation
Decision Readiness
Blueprint
```

No important structured object required by a state gate should be invisible.

---

# 31. READINESS EXPLANATION

Add deterministic readiness summary:

```text
Ready / Not Ready
```

with machine-derived blockers.

Example:

```text
NOT READY

Blocking:
- 2 HIGH Unknowns OPEN
- 1 required assumption contradicted

Non-blocking:
- 2 MEDIUM Unknowns OPEN
```

Do not ask an LLM to generate the gate explanation.

---

# 32. PREPARE_DECISION AFTER RESOLUTION

When blocking Unknowns are resolved:

user can run:

```text
PREPARE_DECISION
```

again.

Expected:

```text
JudgeDraft
→ gateStatusTransition()
→ DECISION_READY
```

No hidden auto-approval.

---

# 33. DECISION APPROVAL

After DECISION_READY:

UI must expose explicit:

```text
Approve Decision
```

On approval:

```text
HardPolicyGate
→ immutable DecisionRecord
→ status DECIDED
```

Maintain existing idempotency.

---

# 34. DECISION RECORD QUALITY

While working on this flow, verify:

```text
acceptedAssumptionIds
selectedEvidenceIds
unresolvedUnknownIds
```

reflect the final actual state.

Do not automatically accept:

```text
UNVERIFIED
CONTRADICTED
```

assumptions.

Evidence selection must preserve verification status.

---

# 35. P1 — BLUEPRINT MUST NOW BE TESTED THROUGH REAL USER FLOW

The previous QA could not reach Blueprint.

After fixing closure UX:

test:

```text
DECIDED
→ Generate Blueprint
→ DRAFT
→ inspect
→ explicit Approve
→ APPROVED
→ Markdown export
```

No API shortcuts.

---

# 36. BLUEPRINT TARGET-PROJECT QUALITY

Use the same FTMO domain session.

Blueprint must describe the TARGET APP:

```text
FTMO training / rehearsal product
risk discipline
Challenge simulation
rule tracking
session / journal / readiness domain
```

It must not default to describing Layer A's internal:

```text
DecisionSession
DecisionRecord
/api/sessions/:id/run
```

unless explicitly part of the chosen target architecture.

---

# 37. BLUEPRINT LOSSLESS PERSISTENCE

Confirm rich Blueprint survives:

```text
generation
→ persistence
→ reload
→ Markdown export
```

without losing:

```text
entity fields
module business rules
API schemas
ownership
relationships
testing requirements
```

Add round-trip tests.

---

# 38. P1 — COST DISPLAY CONSISTENCY

Use persisted AgentRun cost as the canonical completed-run cost.

Audit optimistic SSE accumulation.

Avoid:

```text
adding run subtotal
+
adding AgentRun subtotal
```

twice.

Tests should verify:

```text
UI displayed completed cost
≈
sum(AgentRun.costUsd)
≈
orchestrator.completed.costUsd
```

subject only to documented rounding.

---

# 39. TEST ARCHITECTURE

Use four levels:

```text
UNIT
INTEGRATION
PLAYWRIGHT E2E
LIVE PROVIDER QA
```

No single layer replaces another.

---

# 40. REQUIRED UNIT TESTS — UNKNOWN RESOLUTION

Test:

```text
HIGH OPEN blocks DECISION_READY
HIGH VERIFIED/RESOLVED no longer blocks
HIGH HUMAN_ACCEPTED resolution obeys policy
empty resolution note rejected when human resolution requires note
wrong owner rejected
unknown ID outside session rejected
```

---

# 41. REQUIRED UNIT TESTS — VERIFY

Test at minimum:

```text
MT4/MT5 rejected as arithmetic
4/5 accepted as arithmetic
A/B rejected
v1/v2 rejected
H264/H265 rejected
20*15 accepted
partial claim = PARTIAL
full arithmetic claim = FULL
```

---

# 42. REQUIRED UNIT TESTS — STRUCTURED STATE

Test:

```text
3 generated Options → 3 persisted Options
existing option update preserves ID
repeated assumption does not create duplicate
constraints preserve provenance
```

---

# 43. REQUIRED UNIT TESTS — READINESS

Test deterministic summary:

```text
blockingHighUnknowns
blockingContradictions
ready false/true
human-readable reason codes
```

Do not test only English strings.

Prefer machine-readable blocker codes.

---

# 44. REQUIRED INTEGRATION TEST — COMPLETE DECISION CLOSURE

Build one deterministic integration flow:

```text
create Workspace
create FTMO DecisionSession
FRAME
GENERATE_OPTIONS
CRITIQUE
VERIFY
HIGH Unknown remains
PREPARE → rejected
resolve HIGH Unknowns legitimately
PREPARE again
DECISION_READY
approve
DecisionRecord created
DECIDED
generate Blueprint DRAFT
approve Blueprint
APPROVED
export Markdown
```

This is now a mandatory release test.

---

# 45. REQUIRED INTEGRATION TEST — FALSE VERIFY

Scenario:

```text
Unknown:
"Use MT4/MT5 upload or API?"
```

Expected:

```text
Calculator not called
no CALCULATION evidence
Unknown remains unresolved
```

---

# 46. REQUIRED INTEGRATION TEST — PARTIAL VERIFY

Scenario:

```text
Assumption:
"20 users x $15 = $300 MRR and all will subscribe."
```

Expected:

```text
calculator verifies numeric fragment
Evidence coverage PARTIAL
Assumption not automatically SUPPORTED
```

---

# 47. REQUIRED INTEGRATION TEST — OPTIONS

Agent fixture returns exactly three FTMO options.

Expected:

```text
session.options.length === 3
```

and IDs remain stable through PREPARE.

---

# 48. REQUIRED PLAYWRIGHT FULL FTMO TEST

Automate the same business domain as real QA:

Workspace:

```text
FTMO Trader Training Platform
```

Session:

```text
Build a web training app to help traders prepare for the FTMO Challenge,
focused on risk discipline and Challenge rule rehearsal.
```

Do not introduce unrelated domains.

---

# 49. PLAYWRIGHT FLOW

Mandatory:

```text
Login
→ create Workspace
→ create Session
→ FRAME
→ OPTIONS
→ CRITIQUE
→ VERIFY
→ inspect Decision Canvas
→ observe HIGH Unknown blocker
→ resolve via legitimate UI
→ PREPARE_DECISION again
→ DECISION_READY
→ approve
→ DecisionRecord
→ Blueprint DRAFT
→ approve Blueprint
→ APPROVED
→ export Markdown
```

---

# 50. PLAYWRIGHT ASSERTIONS

Assert machine-readable state/API data, not visual impressions.

After each major step verify:

```text
HTTP status
session.status
structured options
structured assumptions
structured unknowns
Evidence
AgentRuns
judgeDraft
DecisionRecord
Blueprint
```

Use network interception/request inspection.

---

# 51. PLAYWRIGHT MUST CHECK UI UNKNOWN SECTION

Assert:

```text
Unknowns section visible
HIGH indicator visible
action control visible
resolution note input visible when required
linked evidence visible when resolved
readiness blocker count updates
```

---

# 52. PLAYWRIGHT VERIFY REGRESSION

Use a FTMO unknown containing:

```text
MT4/MT5
```

Assert:

```text
no evidence claim "4/5 = 0.8"
```

and no calculator call for that identifier.

---

# 53. PLAYWRIGHT OPTIONS CONSISTENCY

If reply shows 3 candidate options:

Canvas/API must show those same 3 material options.

Use IDs/titles from API rather than prose substring guesses where possible.

---

# 54. PLAYWRIGHT DUPLICATE ASSUMPTION CHECK

After PREPARE:

assert no obvious normalized duplicate assumptions.

At minimum detect exact normalized duplicates deterministically.

---

# 55. PLAYWRIGHT CONSTRAINT CHECK

Confirm expected FTMO boundaries are represented when generated/confirmed.

Do not require every possible constraint.

At least verify the system can display and persist them.

---

# 56. PLAYWRIGHT DECISION RECORD CHECK

After approval verify:

```text
status = DECIDED
DecisionRecord != null
confidence.type = HEURISTIC
selectedOptionId valid
accepted assumptions valid
unresolved unknown list reflects residual risks
```

---

# 57. PLAYWRIGHT BLUEPRINT CHECK

Verify:

```text
initial status DRAFT
no automatic APPROVED
explicit click required
status APPROVED after click
Markdown export succeeds
```

---

# 58. PLAYWRIGHT BLUEPRINT CONTENT CHECK

For FTMO Blueprint ensure it contains domain-specific concepts such as appropriate combinations of:

```text
Challenge
risk limits
simulation
trading session
rule compliance
readiness
journal
```

and does NOT drift into:

```text
generic LMS
Coursera clone
e-commerce
healthcare
```

Use semantic assertions conservatively.

Do not make tests brittle by requiring one exact AI sentence.

---

# 59. NEGATIVE E2E

Add:

```text
cannot approve while HIGH Unknown OPEN
cannot resolve HIGH Unknown with invalid empty payload
cannot canonical-export DRAFT Blueprint
cross-user unknown update denied
false arithmetic identifier not verified
```

---

# 60. LIVE-PROVIDER QA TEST

Automated CI should normally use deterministic stubs.

Separately add/maintain a LIVE QA procedure using:

```text
Gemini
Groq
DeepSeek
```

with:

```text
USE_STUB_MODELS=false
ENABLE_SECOND_OPINION=true
```

Use the FTMO-only scenario.

Do not execute automatically on every CI run due cost/quota variability.

---

# 61. LIVE QA ACCEPTANCE

Real provider session must prove:

```text
FRAME → Gemini Analyst
CRITIQUE → Groq Critic + DeepSeek SecondOpinion
PREPARE → Judge Gemini
```

All expected AgentRuns:

```text
COMPLETED
```

unless external provider failure is honestly reported.

---

# 62. LIVE QA CONTENT QUALITY

Check:

```text
FTMO topic adherence
no unrelated product drift
specific FTMO risks
specific FTMO training options
meaningful Critic challenge
meaningful SecondOpinion difference
meaningful Judge rationale
```

Do not require facts about current FTMO rules to be treated as verified unless evidence exists.

---

# 63. LIVE QA EVIDENCE QUALITY

This is mandatory after the MT4/MT5 defect.

Inspect every EvidenceItem created.

For each:

```text
claim
type
source
verificationStatus
coverage
supportsAssumptionIds
supportsUnknownIds
```

Manually flag false verification.

Target:

```text
0 false VERIFIED evidence
```

in the acceptance session.

---

# 64. SERVER LOG EVIDENCE

Capture:

```text
transition.rejected
tool.started
tool.completed
orchestrator.completed
decision approval
Blueprint generation/approval
```

Check:

```text
costUsd
provider calls
stop reason
```

where applicable.

---

# 65. CI GATE

Final CI must run:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:rules
pnpm test:e2e
pnpm build
```

All must pass.

---

# 66. TEST EVIDENCE MATRIX

Create:

```text
reports/FTMO-DECISION-CLOSURE-TEST-MATRIX.md
```

Matrix:

| Capability | Unit | Integration | Playwright | Live QA |
|---|---|---|---|---|

Include:

```text
Unknown blocking
Unknown resolve
VERIFY classifier
partial verification
Options consistency
Assumption dedupe
Constraints
JudgeDraft blocked UI
Decision approval
DecisionRecord
Blueprint
Blueprint export
Cost consistency
Cross-user security
```

---

# 67. REAL BROWSER QA REPORT

After implementation, rerun the original FTMO E2E scenario with real providers if credentials/quota permit.

Create:

```text
reports/FTMO-LIVE-E2E-POST-FIX.md
```

Required sections:

```text
Environment
Store mode
Providers
Step-by-step table
Network payload evidence
AgentRun evidence
EvidenceItems
Unknown lifecycle
DecisionRecord
Blueprint
Topic adherence
Actual API cost
Bugs found
External blockers
Final PASS / PARTIAL / FAIL
```

---

# 68. DO NOT CLAIM FIRESTORE PRODUCTION PASS FROM MEMORY STORE

If live QA uses:

```text
USE_MEMORY_STORE=true
```

state explicitly:

```text
Persistence production NOT VERIFIED
```

Memory-mode success proves application behavior, not Firestore production.

---

# 69. FIRESTORE PRODUCTION FOLLOW-UP

If IAM access becomes available:

run equivalent smoke/full loop against Firestore-connected mode.

Before that:

verify required composite indexes exist.

Do not bypass Firestore errors by silently switching to memory store in production verification.

---

# 70. RELEASE HARD GATE

The product cannot be called full Decision Loop PASS until a browser user can perform:

```text
DISCOVERY
→ VALIDATING
→ inspect blocker
→ legitimately resolve blocker
→ DECISION_READY
→ approve Decision
→ DECIDED
→ Blueprint DRAFT
→ approve Blueprint
→ APPROVED
```

without DevTools/API/manual datastore edits.

---

# 71. 100/100 HARD GATES

Do not report 100/100 unless all are true:

```text
HIGH Unknown UI exists
HIGH Unknown can be legitimately resolved
empty resolve bypass impossible
readiness blockers are visible
MT4/MT5 false arithmetic fixed
identifier-like slash patterns safe
verification coverage implemented
partial evidence cannot fully support compound claim
no false Unknown resolution
visible Options match structured Options
assumption duplication controlled
constraints can persist/display
JudgeDraft visible while blocked
Decision flow reaches DECIDED through UI
DecisionRecord quality correct
Blueprint reaches APPROVED through UI
Blueprint export works
FTMO Blueprint is target-specific
Unit tests pass
Integration closure test passes
Playwright full FTMO loop passes
negative E2E passes
CI fully green
live provider rerun reaches Decision + Blueprint
0 false VERIFIED evidence in acceptance run
```

Firestore production may remain separately:

```text
BLOCKED_EXTERNAL
```

if IAM prevents connected-mode proof.

Do not falsify it.

---

# 72. INDEPENDENT FINAL AUDIT

Agent 9 must independently inspect final HEAD.

It must verify:

```text
source
tests
CI
browser evidence
live provider evidence
```

Do not accept implementation-agent summaries as proof.

For every hard gate:

```text
PASS
PARTIAL
FAIL
BLOCKED_EXTERNAL
```

---

# 73. FINAL SCORE

Use:

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

Do not artificially increase score because test count increased.

Score runtime behavior.

---

# 74. REQUIRED FINAL REPORT

Create:

```text
reports/FINAL-AUDIT-v13.md
```

Include:

```text
Starting HEAD
Final HEAD
Files changed
Original FTMO defects
Root causes
Fixes
Unit results
Integration results
Rules tests
Playwright results
Live provider results
Evidence false-positive audit
Unknown-resolution audit
Options consistency audit
Assumption dedupe audit
Constraint audit
DecisionRecord audit
Blueprint audit
Cost reconciliation
Firestore production status
Final rubric
Remaining blockers
```

---

# 75. FINAL RESPONSE FORMAT

Return:

```text
1. Starting HEAD
2. Final HEAD
3. HIGH defects resolved
4. MEDIUM defects resolved
5. Unknown-resolution design
6. VERIFY safety design
7. Structured-state consistency changes
8. Constraint handling changes
9. DecisionRecord changes
10. Blueprint changes
11. Unit test result
12. Integration test result
13. Playwright result
14. Live-provider FTMO result
15. Actual API cost
16. CI result
17. Firestore production status
18. Independent auditor verdict
19. Final score
20. Paths to QA reports
```

---

# FINAL PRINCIPLE

Do NOT solve the deadlock by weakening the gate.

Give the user the missing path to satisfy the gate.

Do NOT solve false verification by adding a longer blacklist.

Make verification understand what it is actually verifying.

Do NOT allow chat prose and DecisionState to become two different products.

The final system must prove:

```text
AI reasoning
→ structured uncertainty
→ user-visible blockers
→ trustworthy verification
→ legitimate resolution
→ deterministic readiness
→ human decision
→ immutable DecisionRecord
→ target-specific Blueprint
```

That is the acceptance definition.