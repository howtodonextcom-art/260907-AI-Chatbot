# MASTER CODING PROMPT v10
# Layer A — AI Decision Lab
## 83/100 → Verified 100/100 Remediation Program

Repository:

```text
https://github.com/howtodonextcom-art/260907-AI-Chatbot
```

Last independently audited HEAD:

```text
032a0241089d3b6fcae5b6cf344d0d160c06a771
```

Canonical specification:

```text
plan/26-09-07-layer-a-ai-decision-lab-coding-spec-v5.markdown
```

Repository operating rules:

```text
CLAUDE.md
```

Previous independently audited score:

```text
83/100
```

Current classification:

```text
FUNCTIONAL_MVP
```

Target:

```text
VERIFIED 100/100
```

However:

> Never claim 100/100 unless every hard gate in this prompt is objectively satisfied.

---

# 0. PRIMARY MISSION

Bring the current repository from the independently audited state of approximately 83/100 to the highest objectively verifiable implementation quality possible.

The goal is NOT:

```text
more files
more interfaces
more agents
more abstractions
more documentation claims
```

The goal is:

```text
every important architectural promise becomes real runtime behavior
+
automated verification
+
full end-to-end proof
```

The product principle remains:

> Chat is the interaction surface. Decision is the product.

Canonical lifecycle:

```text
IDEA
→ PROBLEM
→ ASSUMPTIONS
→ OPTIONS
→ EVIDENCE
→ CRITIQUE
→ EXPERIMENT
→ DECISION
→ BLUEPRINT
→ IMPLEMENTATION
```

---

# 1. DO NOT TRUST THIS PROMPT BLINDLY

Before changing anything:

```bash
git status
git rev-parse HEAD
git log -15 --oneline
```

If HEAD is newer than:

```text
032a0241089d3b6fcae5b6cf344d0d160c06a771
```

inspect every new commit.

Re-audit relevant code before patching.

Do not overwrite legitimate work already completed after the audit.

---

# 2. BASELINE VERIFICATION

Run:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:rules
pnpm test:e2e
pnpm build
```

Record:

```text
PASS
FAIL
SKIPPED
BLOCKED
```

for every command.

Do not infer success from commit messages.

---

# 3. PRESERVE THE THREE FIXED P0 INVARIANTS

The following are already valuable and MUST NOT regress.

## P0-A — Canonical state transition gate

All consequential state transitions must remain behind:

```text
gateStatusTransition()
```

AI may propose.

AI may never authorize.

`DECIDED` may only be reached through explicit human approval and HardPolicyGate.

---

## P0-B — SecondOpinion agreement semantics

SecondOpinion must remain independent.

It must NOT self-report agreement with Analyst when it did not see Analyst output.

Agreement must remain:

```text
Judge-derived heuristic
or
UNAVAILABLE
```

with method and rationale.

---

## P0-C — Workspace ownership immutability

Firestore rules must continue enforcing:

```text
request.resource.data.ownerId == resource.data.ownerId
```

for Workspace updates.

Keep the rules emulator regression tests.

---

# 4. REQUIRED MULTI-AGENT EXECUTION

Use at least **8 specialized sub-agents**.

Recommended assignment:

```text
Agent 1 — Evidence & VERIFY
Agent 2 — Blueprint & Coding Handoff
Agent 3 — Orchestration / Routing / Stop Conditions
Agent 4 — DomainPack & Experiment
Agent 5 — Cancellation / Budget / Observability
Agent 6 — Security / Firebase / Dependencies
Agent 7 — Testing / E2E / CI / Evaluation
Agent 8 — Independent Final Auditor
```

Coordinator responsibilities:

```text
assign ownership
prevent overlapping edits
merge carefully
run checkpoints
resolve architectural conflicts
enforce scope
```

Agent 8 must not participate in the original implementation work it audits.

---

# 5. PRIORITY ORDER

Implement in this order unless current HEAD proves an item already solved:

```text
P0. Dependency/security production blockers
P1. Evidence trust + real VERIFY
P2. Blueprint v2
P3. Intent-aware orchestration + stop conditions
P4. Provider-call budget + cancellation
P5. DomainPack wiring + Experiment lifecycle
P6. Full E2E + CI
P7. Evaluation + SecondOpinion value proof
P8. Documentation + final production verification
```

---

# 6. SECURITY DEPENDENCY BASELINE

Current audit identified an outdated Next.js patch version.

First inspect the official current security guidance.

Do NOT blindly upgrade to an arbitrary version.

Upgrade Next.js to the newest compatible patched version in the chosen supported release line.

Then run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Do not combine unrelated framework migration work.

If a newer major release creates unnecessary migration risk:

stay within a safe supported compatible release line.

Record:

```text
previous version
new version
reason
security advisory addressed
regressions found
```

---

# 7. EVIDENCE TRUST MODEL — REQUIRED REDESIGN

Current concepts:

```text
EvidenceType
EvidenceReliability
createdBy
```

are insufficient.

Introduce explicit verification semantics.

Recommended:

```ts
type VerificationStatus =
  | "UNVERIFIED"
  | "VERIFIED"
  | "CONTRADICTED"
  | "NOT_VERIFIABLE";

type VerificationActor =
  | "TOOL"
  | "SYSTEM"
  | "USER"
  | "EXPERIMENT";

interface VerificationMetadata {
  status: VerificationStatus;
  verifiedBy?: VerificationActor;
  verifiedAt?: string;
  verifierId?: string;
  method?: string;
}
```

Evidence must distinguish:

```text
PROVENANCE
RELIABILITY
VERIFICATION
```

These are not interchangeable.

---

# 8. USER EVIDENCE MUST NOT SELF-UPGRADE TRUST

A client must NOT be able to submit:

```json
{
  "type": "OFFICIAL_DOCUMENTATION",
  "reliability": "HIGH"
}
```

and thereby create verified trusted evidence.

User-submitted evidence defaults to:

```text
verificationStatus = UNVERIFIED
createdBy = USER
```

Reliability should be server-derived or conservatively normalized.

Example defaults:

```text
USER_CLAIM → LOW
AI_INFERENCE → LOW
USER_FACT → MEDIUM / UNVERIFIED
SOURCE_CODE uploaded by user → UNVERIFIED
OFFICIAL_DOCUMENTATION submitted by user → UNVERIFIED
CALCULATION generated by Calculator tool → VERIFIED
EXPERIMENT with actual result → VERIFIED
```

Do not confuse source label with verification.

---

# 9. REAL VERIFY PIPELINE

`VERIFY` must stop being another LLM discussion.

Target runtime:

```text
VERIFY
↓
inspect assumptions / unknowns / claims
↓
identify verifiable claim
↓
DomainPack.getToolConnectorIds()
↓
allowlist
↓
ToolConnector.execute()
↓
normalize result
↓
EvidenceItem
↓
link evidence
↓
update assumption / unknown when justified
```

Emit:

```text
tool.started
tool.completed
```

SSE events.

---

# 10. CALCULATOR CONNECTOR

Current calculator connector can remain if safe.

Wire it into VERIFY.

Example:

```text
Assumption:
"20 users × $15/month = $300 MRR"

VERIFY
→ calculator.evaluate("20*15")
→ 300
→ EvidenceType = CALCULATION
→ createdBy = TOOL
→ verificationStatus = VERIFIED
→ verifiedBy = TOOL
→ verifiedAt = timestamp
```

Do not fabricate verification if no connector exists.

---

# 11. UNSUPPORTED VERIFICATION

If a claim cannot be verified with available MVP tools:

Do NOT ask an LLM to declare it verified.

Return one of:

```text
UNVERIFIED
NOT_VERIFIABLE
HUMAN_DECISION_REQUIRED
EXPERIMENT_REQUIRED
```

depending on context.

This distinction is core product behavior.

---

# 12. EVIDENCE LINKS

When verification succeeds:

link Evidence IDs to relevant:

```text
Assumption.evidenceIds
Unknown.evidenceIds
Option.evidenceIds
```

When evidence contradicts a claim:

mark appropriately.

Do not automatically mark every assumption SUPPORTED just because one evidence item exists.

---

# 13. BLUEPRINT V2 — PRIMARY PRODUCT GATE

Current Blueprint lifecycle exists but content is not sufficiently coding-ready.

Create a real Blueprint domain layer.

Recommended structure:

```text
src/domain/blueprint/
  types.ts
  schema.ts
  validator.ts
  service.ts
  markdown.ts
```

---

# 14. STRICT BLUEPRINT SCHEMA

Create:

```ts
BlueprintSchema
BlueprintGenerationInputSchema
BlueprintValidationResultSchema
```

Use Zod.

Blueprint must contain structured data for at least:

```text
Project Goal
Problem
Target Users
Scope
Non-goals
Modules
Architecture
Data Model
API Contracts
AI Workflow
Security
Observability
Testing
Deployment
Acceptance Criteria
Open Risks
Out-of-scope
Decision References
Implementation Order
```

---

# 15. REMOVE BLUEPRINT FILLER

Delete generic placeholder generation such as:

```text
Primary decision maker
Implementation team
Core Module
Working MVP increment
Implement selected decision
```

unless those values were genuinely derived from state/evidence.

Never map:

```ts
session.criteria.map(c => c.name)
```

into:

```text
dataModel
```

Criteria are not data entities.

---

# 16. BLUEPRINT INPUT

Generate Blueprint from:

```text
approved DecisionRecord
+
selected Option
+
DecisionSession structured state
+
verified / relevant Evidence
+
DomainPack context
+
constraints
+
approved assumptions
+
open risks
```

Coding agent should not need full chat history.

---

# 17. BLUEPRINT GENERATION

Use structured generation.

Recommended:

```text
BlueprintService.generate()
↓
ModelGateway structured output
↓
BlueprintSchema.safeParse()
↓
semantic validation
↓
optional ONE repair retry
↓
persist DRAFT only after passing required validation
```

Maximum repair retry:

```text
1
```

No infinite repair loop.

---

# 18. BLUEPRINT SEMANTIC VALIDATION

Validate deterministically:

```text
DecisionRecord exists
DecisionRecord belongs to same session/user
DecisionRecord is approved
selected option is valid
required sections nonempty
modules exist
acceptance criteria exist
security section exists
testing section exists
open risks represented
DecisionRecord reference included
scope does not contradict explicit non-goals
```

Zod schema success alone is not enough.

---

# 19. BLUEPRINT HUMAN LIFECYCLE

Keep:

```text
DRAFT
→ REVIEW
→ APPROVED
→ SUPERSEDED
```

Approval remains explicit human action.

No automatic approval.

---

# 20. BLUEPRINT MARKDOWN EXPORT

Implement actual Markdown export.

Required route or equivalent:

```text
GET /api/sessions/:sessionId/blueprint/export
```

or:

```text
GET /api/blueprints/:id/export
```

Return:

```text
text/markdown
```

The exported file must be directly usable as coding-agent input.

Isolation test:

> Give ONLY this Markdown to another coding agent.

It must understand:

```text
what to build
why
scope
non-goals
modules
dependencies
data entities
API
AI behavior
security
tests
deployment
acceptance criteria
risks
implementation order
```

If not:

Blueprint is not complete.

---

# 21. EXECUTION PLAN

Replace implicit orchestration with explicit execution planning.

Create:

```ts
interface ExecutionPlan {
  intent: Intent;
  stages: ExecutionStage[];
  reasons: string[];
  estimatedCalls: number;
  estimatedMaxCostUsd: number;
}
```

Example:

```text
DISCUSS
→ Analyst

FRAME_PROBLEM
→ Analyst

GENERATE_OPTIONS
→ Analyst

CRITIQUE
→ Critic
→ optional SecondOpinion

VERIFY
→ tools
→ optional Analyst interpretation

PREPARE_DECISION
→ Judge
```

Do not run every role merely because routeMode = DEEP.

---

# 22. AUTO WORKFLOW COST FIX

Current:

```text
FRAME
OPTIONS
CRITIQUE
VERIFY
```

must not trigger a full four-agent council four times.

Expected behavior resembles:

```text
FRAME
→ Analyst

OPTIONS
→ Analyst

CRITIQUE
→ Critic
→ optional SecondOpinion

VERIFY
→ Tool pipeline

PREPARE_DECISION
→ Judge
```

This can reduce roughly:

```text
16 role calls
```

toward:

```text
4–7 justified calls
```

depending on uncertainty.

Show estimated calls/cost before or during auto-run.

---

# 23. SECONDOPINION FEATURE FLAG

Add:

```text
ENABLE_SECOND_OPINION
```

and corresponding typed env support.

SecondOpinion should be conditional.

Trigger examples:

```text
high consequence
high uncertainty
low evidence
explicit user request for independent opinion
benchmark-proven benefit
```

Do not run it automatically for every DEEP intent.

---

# 24. SECONDOPINION PRINCIPLE

Preserve:

```text
DeepSeek independent provider
allowFallback = false
```

when operating as independent reviewer.

If DeepSeek fails:

```text
partial run
no fake replacement by Gemini
```

---

# 25. REAL STOP CONDITION ENGINE

Implement one evaluator covering:

```text
ENOUGH_EVIDENCE
LOW_DISAGREEMENT
NO_NEW_INFORMATION
BUDGET_EXHAUSTED
EXPERIMENT_REQUIRED
HUMAN_DECISION_REQUIRED
MAX_ROUNDS_REACHED
```

Recommended:

```ts
interface StopContext {
  evidenceCoverage: number;
  blockingUnknownCount: number;
  disagreementScore?: number;
  newInformationScore?: number;
  experimentRequired: boolean;
  humanDecisionRequired: boolean;
  budget: BudgetTracker;
}

interface StopDecision {
  stop: boolean;
  reason: StopReason | null;
  rationale: string;
}
```

---

# 26. STOP CONDITION BEHAVIOR

Each stop condition needs:

```text
definition
runtime caller
test
log/event
```

Examples:

### ENOUGH_EVIDENCE

No unnecessary additional AI critique if required evidence coverage is reached and no blocking unknown remains.

### LOW_DISAGREEMENT

Do not trigger another critique cycle when agents converge sufficiently.

### NO_NEW_INFORMATION

Stop if a new run materially repeats existing conclusions.

### EXPERIMENT_REQUIRED

Stop AI debate and create experiment next action.

### HUMAN_DECISION_REQUIRED

Stop automation and ask for human resolution.

---

# 27. PROVIDER-LEVEL BUDGET ACCOUNTING

Current orchestration may undercount internal repair calls.

Fix this.

Every actual provider call must count toward:

```text
calls
input tokens
output tokens
cost
latency
```

Do not count only wrapper-level agent calls.

Possible architecture:

```text
ModelGateway
→ emits usage/call event
→ BudgetTracker
```

or equivalent centralized accounting.

Budget must represent real external model calls.

---

# 28. AGENTRUN OBSERVABILITY

Persist per AgentRun:

```text
provider
model
role
routeMode
promptVersion
schemaVersion
inputTokens
outputTokens
latencyMs
costUsd
status
errorCode
errorMessage
```

Additionally persist run-level:

```text
executionPlan
plannedCalls
actualProviderCalls
plannedCost
actualCost
stopReason
fallbacks
```

---

# 29. CANCELLATION END-TO-END

Add:

```ts
signal?: AbortSignal
```

to normalized model requests.

Propagate:

```text
request.signal
→ Route Handler
→ Orchestrator
→ ModelGateway
→ ModelProvider
```

Before:

```text
new agent stage
state mutation
artifact persistence
```

check abort state.

---

# 30. CANCELLED AGENTRUN

Use existing:

```text
RunStatus = CANCELLED
```

meaningfully.

If abort occurs:

```text
do not write abandoned AI decision changes
do not continue Critic/Judge
do not create DecisionRecord
do not create Blueprint
```

If provider SDK cannot terminate an in-flight HTTP request:

document limitation, but prevent downstream effects.

---

# 31. CONTEXT BUILDER ROLE ISOLATION

Current shared context must NOT include:

```text
getRoleInstructions("ANALYST")
```

for all roles.

Refactor:

```text
buildCoreContext()
```

to return only:

```text
security policy
core orchestration policy
domain context
decision state
evidence
conversation
```

Then each agent adds only its own role instructions.

Example:

```text
runAnalyst → ANALYST
runCritic → CRITIC
runJudge → JUDGE
runSecondOpinion → independent reviewer
```

Add tests proving no role contamination.

---

# 32. DOMAINPACK CRITERIA WIRING

When creating DecisionSession:

```ts
criteria =
  clone(domainPack.getDecisionCriteria?.() ?? [])
```

Do not default blindly to:

```text
[]
```

when a DomainPack supplies criteria.

Clone arrays safely.

Never share mutable criterion objects across sessions.

---

# 33. DOMAINPACK TOOL WIRING

For VERIFY:

```text
available tools =
DomainPack.getToolConnectorIds()
```

Only these connectors may be used.

Generic pack may have:

```text
[]
```

or deliberately selected tools.

ChallengeReady may expose calculator.

---

# 34. DOMAINPACK OUTPUT SCHEMA

Current `getOutputSchemaName()` must stop being decorative.

Choose ONE architecture:

## Option A

Map schema names to a registry of real Zod schemas.

or

## Option B

Remove the hook and use role-owned schemas if Domain Packs do not need schema customization.

Do not retain a dead abstraction.

---

# 35. DOMAINPACK EVALUATION SUITE

Wire:

```text
getEvaluationSuiteId()
```

to evaluation selection.

If unused after review:

remove it.

Every DomainPack hook must be:

```text
used
or removed
```

---

# 36. EXPERIMENT MINIMUM VIABLE LIFECYCLE

Do not build a giant Experiment platform.

Implement:

```text
DRAFT
→ READY
→ RUNNING
→ COMPLETED
or
→ CANCELLED
```

Repository needs at least:

```text
create
get
list
update
transition status
record result
```

---

# 37. EXPERIMENT_REQUIRED

When Judge returns:

```text
EXPERIMENT_FIRST
```

or Unknown resolution is:

```text
EXPERIMENT_REQUIRED
```

the system should produce an ExperimentDefinition or explicit structured next action.

Do not continue AI debate indefinitely.

---

# 38. EXPERIMENT EVIDENCE

Only actual completed experiment results may create:

```text
EvidenceType = EXPERIMENT
verificationStatus = VERIFIED
verifiedBy = EXPERIMENT
```

A plan is not evidence.

---

# 39. CONFIDENCE MODEL CLEANUP

Confidence must remain explicitly:

```text
HEURISTIC
```

Audit every factor:

```text
evidenceCoverage
sourceReliability
unresolvedUnknownPenalty
assumptionPenalty
agentAgreement
experimentStrength
```

Remove fake constants where possible.

Example current debt:

```text
experimentStrength = 0.2
```

must become data-derived or unavailable.

If unavailable:

use conservative handling and record that it is unavailable.

---

# 40. EVALUATION ENGINE

Replace evaluation scaffold with a usable benchmark runner.

Configurations:

```text
A. Single Groq
B. Single Gemini
C. Gemini Analyst + Groq Critic
D. Analyst + Critic + Judge
E. Analyst + optional SecondOpinion + Critic + Judge
```

Metrics:

```text
correctness
schema validity
evidence discipline
unsupported claims
decision quality
decision stability
latency
tokens
cost
decision-change rate
```

---

# 41. EVALUATION CASES

Create at least:

```text
20 representative evaluation cases
```

Cover:

```text
generic product decision
software architecture
Firebase vs PostgreSQL
weak evidence
conflicting evidence
high uncertainty
high-consequence decision
experiment required
human decision required
simple low-impact query
provider failure
DeepSeek unavailable
malformed structured output
prompt injection attempt
ChallengeReady boundary
calculation verification
evidence contradiction
budget exhausted
cancellation
Blueprint generation
```

---

# 42. DO NOT USE SUBSTRING GRADING AS PRIMARY QUALITY SIGNAL

Substring matching can remain as a trivial structural signal.

It cannot be the primary quality evaluation.

Use deterministic graders where possible:

```text
schema
evidence provenance
policy compliance
required fields
decision stability
unsupported claim counts
```

Optional LLM-as-judge may be used only with clear labeling.

---

# 43. PROVE SECONDOPINION VALUE

Run benchmark with:

```text
SecondOpinion OFF
SecondOpinion ON
```

Compare:

```text
quality
unsupported claims
decision changes
latency
cost
schema failure
```

Final default:

```text
KEEP_DEFAULT
KEEP_CONDITIONAL
EXPERIMENTAL_ONLY
REMOVE
```

If evidence does not prove value:

default should be:

```text
KEEP_CONDITIONAL
```

or:

```text
EXPERIMENTAL_ONLY
```

Do not delete provider support unnecessarily.

---

# 44. FULL DECISION LOOP PLAYWRIGHT

Create deterministic E2E:

```text
login/dev auth
→ create Workspace
→ create DecisionSession
→ send initial idea
→ FRAME
→ OPTIONS
→ CRITIQUE
→ VERIFY
→ evidence appears
→ PREPARE_DECISION
→ DECISION_READY
→ explicit approval
→ immutable DecisionRecord
→ Blueprint generation
→ Blueprint REVIEW
→ Blueprint APPROVED
→ Markdown export
```

Provider behavior in CI should use deterministic test doubles where necessary.

Do not require paid real AI APIs on every CI run.

---

# 45. E2E NEGATIVE PATHS

Add:

```text
invalid transition
Analyst attempts DECISION_READY bypass
cross-user access
provider failure
SecondOpinion unavailable
stop auto workflow
cancel in-flight run
VERIFY with no suitable tool
Blueprint validation failure
duplicate decision approval
duplicate Blueprint creation
```

---

# 46. FIRESTORE RULES TESTS IN CI

Current:

```text
pnpm test:rules
```

must run in CI.

Do not leave security tests as manual-only.

---

# 47. E2E IN CI

CI must run:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:rules
pnpm test:e2e
pnpm build
```

All are required for full score.

---

# 48. TEST COUNTS ARE NOT THE GOAL

Do not inflate test count artificially.

Every test must protect behavior.

Create a matrix:

| Capability | Unit | Integration | E2E | CI |
|---|---|---|---|---|

At minimum include:

```text
Auth
Workspace
DecisionSession
State Gate
Analyst
SecondOpinion
Critic
Judge
Routing
Stop Conditions
VERIFY
ToolConnector
Evidence Trust
DomainPack
Experiment
DecisionRecord
Blueprint
Cancellation
Budget
Cross-user security
Firestore Rules
```

---

# 49. PRODUCTION MEMORYSTORE GUARD

Production must not accidentally run MemoryStore.

Target behavior:

```text
NODE_ENV=production
+
USE_MEMORY_STORE=true
```

should:

```text
throw
or
fail closed
```

unless there is an extremely explicit test-only mechanism impossible in deployed production.

Do not silently accept ephemeral storage in production.

Add tests.

---

# 50. DEV AUTH BYPASS

Continue ensuring:

```text
DEV_AUTH_BYPASS
```

cannot operate in production or Firebase connected production mode.

Add regression tests if needed.

---

# 51. FIRESTORE PRODUCTION DEPLOY

After rules/tests are correct:

attempt deployment if credentials permit.

Run:

```bash
firebase deploy --project chatai-62ca2 --only firestore:rules,firestore:indexes
```

If IAM blocks deployment:

record exact error.

Do not claim deployed.

Create explicit report:

```text
SOURCE_RULES_CORRECT
EMULATOR_TESTED
CI_TESTED
DEPLOYED
PRODUCTION_VERIFIED
```

with status for each.

---

# 52. DOCUMENTATION SYNCHRONIZATION

Update:

```text
README.md
CLAUDE.md
.env.example
```

to actual runtime.

Fix current drift around:

```text
email/password vs Google Sign-In
Gemini/Groq/DeepSeek
3 core roles vs optional SecondOpinion
auto workflow
VERIFY behavior
Firestore deployment
test commands
Blueprint export
```

README must describe source truth, not intended architecture.

---

# 53. CORE AGENT ROLES

README should distinguish:

```text
CORE
Analyst
Critic
Judge
```

from:

```text
OPTIONAL INDEPENDENT REVIEWER
SecondOpinion / DeepSeek
```

Do not market SecondOpinion as a mandatory fourth core role unless benchmark proves that design.

---

# 54. ARCHITECTURE CLEANUP

Search entire repo for:

```text
TODO
FIXME
HACK
z.array(z.unknown())
dead schema
unused DomainPack hook
unused ToolConnector
unused StopReason
duplicate type
hard-coded Blueprint filler
hard-coded confidence factors
stale provider config
stale documentation
```

For each:

```text
WIRE
REMOVE
SIMPLIFY
DOCUMENT
```

Do not retain architectural ornaments.

---

# 55. DO NOT OVERBUILD

Remain out of scope:

```text
LangGraph
Temporal
Redis
PostgreSQL migration
Vector DB
Full RAG
Team collaboration
Billing
Marketplace
Autonomous coding
Autonomous browser
Knowledge graph
OpenAI provider
Anthropic provider
```

unless a current critical defect requires one, which is unlikely.

---

# 56. TEST CHECKPOINT 1

After Evidence + VERIFY:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Also manually trace:

```text
VERIFY
→ tool.started
→ connector
→ tool.completed
→ Evidence
```

---

# 57. TEST CHECKPOINT 2

After Blueprint:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

Perform Blueprint isolation test.

---

# 58. TEST CHECKPOINT 3

After orchestration/cancellation:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Verify real provider-call counting.

---

# 59. FINAL TEST CHECKPOINT

Mandatory:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:rules
pnpm test:e2e
pnpm build
```

No final completion claim before all applicable commands pass.

---

# 60. FINAL INDEPENDENT AUDIT

Agent 8 must independently audit final HEAD.

It must not trust implementation-agent summaries.

For each requirement:

```text
PASS
PARTIAL
FAIL
BLOCKED_EXTERNAL
CORRECTLY_ABSENT
```

Provide:

```text
source path
test path
runtime path
CI result
```

---

# 61. SCORE USING EXACT RUBRIC

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

Do not modify weights.

---

# 62. CURRENT BASELINE

Use:

```text
Previous independently audited score: 83/100
```

Do not award points merely because code volume increased.

Every added point must correspond to a previously missing capability becoming:

```text
implemented
wired
tested
verified
```

---

# 63. 100/100 HARD GATES

100/100 is forbidden unless ALL are true:

```text
No consequential state bypass
No fake agreement signal
Evidence verification semantics enforced
VERIFY executes deterministic tools where available
Unverifiable claims remain explicitly unverified
DomainPack tools actually restrict VERIFY
DomainPack criteria hydrate sessions
Dead DomainPack hooks removed or wired
Stop conditions execute
Provider-level call budget accurate
Auto workflow does not repeatedly run full councils unnecessarily
SecondOpinion is conditional unless benchmark proves default value
Cancellation propagates safely
DecisionRecord remains immutable
Human decision approval remains mandatory
Blueprint uses strict structured schema
Blueprint semantic validation exists
Blueprint contains decision-derived content
Blueprint Markdown export works
Coding agent can implement from Blueprint alone
Experiment metadata lifecycle works
EXPERIMENT_REQUIRED creates a useful next action
Confidence does not hide fake constants as real signals
Full Decision Loop E2E passes
Negative E2E paths exist
test:rules runs in CI
test:e2e runs in CI
CI is green
Production cannot use MemoryStore accidentally
DEV_AUTH_BYPASS unavailable in production
README matches source
Security-patched Next.js version installed
No committed secrets
No unresolved P0 code defect
```

---

# 64. FIRESTORE EXTERNAL BLOCKER RULE

If production rules cannot be deployed because of IAM:

do not falsify status.

A codebase may otherwise reach implementation completeness while production verification remains externally blocked.

Final score/report must explicitly state:

```text
Firestore production deployment:
BLOCKED_EXTERNAL
Reason:
IAM permission
```

Do not hide it.

---

# 65. FINAL ACCEPTANCE SCENARIO

Start with:

```text
"I want to build a web application to help FTMO challenge traders train before taking the real challenge."
```

The user must be able to reach:

```text
Workspace
↓
DecisionSession
↓
Problem framing
↓
Assumptions
↓
Options
↓
Critique
↓
VERIFY
↓
Verified evidence / unresolved claims clearly separated
↓
Experiment next action if needed
↓
Judge recommendation
↓
DECISION_READY
↓
explicit human approval
↓
immutable DecisionRecord
↓
coding-ready Blueprint
↓
Blueprint review
↓
Blueprint approval
↓
Markdown export
↓
coding agent handoff
```

without:

```text
fake evidence
fake agent agreement
AI state bypass
unbounded debate
unnecessary model calls
silent provider substitution
automatic consequential approval
hard-coded Blueprint filler
production MemoryStore
```

---

# 66. CREATE FINAL AUDIT REPORT

Create:

```text
reports/FINAL-VERIFIED-100-AUDIT-v10.md
```

Include:

```text
Previous audited HEAD
Starting HEAD
Final HEAD
Changed files
Resolved findings
Remaining findings
Security dependency update
Evidence trust matrix
VERIFY trace
Blueprint isolation test
DomainPack hook matrix
Experiment lifecycle
Execution plan examples
Provider-call/cost comparison
Stop-condition matrix
SecondOpinion benchmark
Unit tests
Integration tests
Rules tests
E2E tests
CI result
Vercel result
Firestore production deployment state
Final 100-point rubric
External blockers
```

---

# 67. BEFORE FINAL COMMIT

Run:

```bash
git diff
git status
git diff --check
```

Inspect for:

```text
secrets
debug logs
temporary files
test credentials
generated junk
unrelated modifications
```

Do not commit:

```text
.env.local
service.json
API keys
private keys
```

---

# 68. GIT DISCIPLINE

Obey current `CLAUDE.md`.

Do not:

```text
git reset --hard
force push
rewrite unrelated history
delete unrelated user work
```

Commit logically coherent remediation groups.

---

# 69. FINAL RESPONSE FORMAT

Return:

```text
1. Starting HEAD
2. Final HEAD
3. Previous independent score: 83/100
4. Final independent audit score
5. Security fixes
6. Evidence/VERIFY changes
7. Blueprint changes
8. Orchestration/cost changes
9. DomainPack changes
10. Experiment changes
11. Cancellation changes
12. Evaluation results
13. SecondOpinion cost/quality verdict
14. Unit test results
15. Integration results
16. Firestore rules test result
17. Full E2E result
18. CI result
19. Vercel deployment result
20. Firestore production deployment result
21. External blockers
22. Remaining known debt
23. Path to FINAL-VERIFIED-100-AUDIT-v10.md
```

---

# 70. FINAL PRINCIPLE

Do not turn the system into a larger AI council.

Make it a better decision system.

The desired progression is:

```text
Problem
→ structured uncertainty
→ evidence
→ bounded challenge
→ deterministic verification
→ explicit human decision
→ implementation-ready blueprint
```

Not:

```text
Problem
→ more agents
→ more tokens
→ more confidence-looking numbers
```

A true 100/100 implementation is one where every important promise can be traced:

```text
requirement
→ runtime code
→ test
→ CI
→ observable behavior
```

If that trace cannot be shown, the item is not complete.