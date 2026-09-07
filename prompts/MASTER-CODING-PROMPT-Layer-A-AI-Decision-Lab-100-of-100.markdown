# MASTER CODING PROMPT
## Layer A — AI Decision Lab: Upgrade From Current ~78/100 to Verified 100/100

You are acting as a **Principal Software Architect, Staff Full-Stack Engineer, AI Systems Engineer, Security Reviewer, QA Lead, and Release Gatekeeper**.

Your task is NOT to redesign the product from scratch.

Your task is to inspect the existing repository, compare the actual implementation against the approved specification, repair all gaps, remove harmful implementation drift, strengthen the critical paths, complete missing functionality, and leave the repository in a state that can legitimately be re-audited as **100/100** against the same scoring framework.

---

# 0. SOURCE OF TRUTH

Repository:

`https://github.com/howtodonextcom-art/260907-AI-Chatbot`

Primary specification:

`plan/26-09-07-layer-a-ai-decision-lab-coding-spec-v5.markdown`

Secondary historical specification:

`plan/26-09-07-08-52-layer-a-multi-ai-chat-engine.markdown`

The v5 specification is authoritative when there is conflict.

Current architecture should remain:

```text
User
↓
Workspace
↓
DecisionSession
├── Conversation
├── Decision State
├── Evidence
├── Agent Runs
├── DecisionRecord
└── Blueprint
```

Core thesis:

> Chat is the interaction surface. Decision is the product.

Target lifecycle:

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

ChallengeReady must remain only a reference Domain Pack.

The Layer A core must remain domain-agnostic.

---

# 1. CURRENT AUDIT BASELINE

Treat the following as the starting audit baseline.

Approximate current score:

```text
Implementation Completion: 76/100
Engineering Quality:       82/100
Overall:                   78/100
Spec Alignment:            83/100
Production Readiness:      67/100
```

Current status:

`FUNCTIONAL MVP`

Target status:

`PRODUCTION-READY DECISION LAB / VERIFIED 100/100`

Do NOT merely raise cosmetic quality.

The target score requires eliminating architectural, correctness, integrity, testing, evaluation, and blueprint-generation deficiencies.

---

# 2. NON-NEGOTIABLE RULE

You are forbidden from saying:

- "100/100 complete"
- "production ready"
- "all tasks completed"
- "fully compliant"

unless every required acceptance gate in this prompt is demonstrably satisfied.

A folder, interface, enum, schema, component, route, test stub, TODO, scaffold, placeholder, mocked implementation, or unused abstraction does NOT count as implemented.

A feature counts as implemented only when:

```text
UI/API entry point
→ validation
→ business logic
→ persistence/state
→ expected output
→ automated tests
```

can be traced through working code.

---

# 3. FIRST ACTION: AUDIT BEFORE MODIFYING CODE

Before making changes:

1. Read the entire v5 specification.
2. Read repository structure recursively.
3. Inspect:
   - package.json
   - environment config
   - Firebase config/rules/indexes
   - AI gateway
   - providers
   - agent wrappers
   - prompt registry
   - orchestrator
   - routing
   - stop conditions
   - state machine
   - DecisionSession
   - DecisionRecord
   - Blueprint
   - Evidence
   - Experiments
   - Domain Packs
   - Tool Connectors
   - API routes
   - UI
   - repositories
   - tests
   - CI
4. Run the existing test/build pipeline before modifying code.
5. Record failures or mismatches.

Do not assume the previous audit is perfectly current.

Verify everything against the actual current HEAD.

---

# 4. PRESERVE THESE DESIGN DECISIONS

Do NOT introduce unnecessary architectural churn.

Keep unless technically impossible:

- Next.js App Router
- TypeScript strict
- Firebase Auth
- Firestore
- Gemini
- Groq
- Zod
- ModelGateway abstraction
- Repository abstraction
- MemoryStore for tests/local development
- Workspace
- DecisionSession
- Evidence
- DecisionRecord
- Blueprint
- DomainPack architecture
- bounded Analyst → Critic → Judge design
- server-side provider secrets
- explicit human approval
- cost tracking
- prompt version tracking
- immutable DecisionRecord concept
- ChallengeReady only as reference vertical

---

# 5. DO NOT ADD THESE JUST TO APPEAR MORE ADVANCED

Unless required to solve a demonstrated issue, do NOT add:

- PostgreSQL
- Redis
- Temporal
- LangGraph
- vector database
- full RAG
- OpenAI provider
- Anthropic provider
- eight-agent council
- autonomous coding agents
- autonomous browser system
- billing
- marketplace
- team collaboration
- knowledge graph
- Kubernetes
- microservices

Overengineering reduces the score.

---

# 6. CRITICAL PRIORITY P0
# DECISION LIFECYCLE INTEGRITY

This is the highest-priority correctness issue.

The system MUST enforce this invariant:

```text
DISCOVERY
→ VALIDATING
→ DECISION_READY
→ HUMAN APPROVAL
→ DecisionRecord
→ DECIDED
→ Blueprint
```

There must be NO alternate path to `DECIDED`.

## Required corrections

### 6.1 Prevent direct DECIDED mutation

Client/API must not be able to PATCH:

```text
status = DECIDED
```

directly.

`DECIDED` must only be assigned server-side after successfully creating the corresponding immutable DecisionRecord.

### 6.2 Protect server-owned fields

Clients must never directly modify:

```text
ownerId
workspaceId
judgeDraft
activeDecisionRecordId
activeBlueprintId
approvedAt
DecisionRecord references
system-generated AgentRun data
```

Define clearly which DecisionSession fields are:

```text
USER_EDITABLE
AI_PROPOSED
SERVER_CONTROLLED
IMMUTABLE
```

Implement enforcement at both:

- API/schema layer
- Firestore rules layer

### 6.3 Replace unsafe unknown arrays

Remove unsafe structures such as:

```ts
z.array(z.unknown())
```

for:

- constraints
- assumptions
- unknowns
- options
- criteria

Use proper schemas.

Use existing:

- `CriterionSchema`
- `OptionSchema`
- `AssumptionSchema`
- `UnknownSchema`

or improve them if required.

### 6.4 Enforce canEnterValidating()

All transitions into `VALIDATING` must satisfy the actual entry rules.

### 6.5 Enforce canEnterDecisionReady()

No Judge output may move a session into `DECISION_READY` unless:

```text
optionCount >= 1
assumptionCount >= 1
highPriorityOpenUnknowns == 0
domainValidationErrors == 0
```

and any additional required v5 conditions are satisfied.

Use the state-machine helper in the actual runtime path.

Do not leave correctness helpers unused.

### 6.6 Decision approval must remain explicit

Human approval is mandatory.

AI must never approve its own DecisionRecord.

Required chain:

```text
Judge creates JudgeDraft
↓
User explicitly approves
↓
HardPolicyGate
↓
DecisionRecord created
↓
session.status = DECIDED
```

### 6.7 Atomicity / race safety

Where logically required, use Firestore transactions or equivalent safeguards so that concurrent approval requests cannot:

- create duplicate DecisionRecords;
- create inconsistent activeDecisionRecordId;
- violate supersession order.

Idempotency must remain enforced.

---

# 7. P1
# BLUEPRINT V2: CODING-READY IMPLEMENTATION HANDOFF

This is the largest product-value gap.

The current Blueprint generator must be upgraded from a mostly generic/hard-coded template into a legitimate implementation artifact.

The fundamental test is:

> Could an independent coding agent receive only the approved Blueprint and build the intended project without reading the original chat transcript?

If the answer is no, Blueprint is not complete.

## 7.1 Blueprint lifecycle

Implement:

```text
DRAFT
→ REVIEW
→ APPROVED
```

Do NOT auto-create a Blueprint as APPROVED.

Creation should produce:

`DRAFT`

Human approval must transition:

`DRAFT → REVIEW → APPROVED`

or, if v5 explicitly permits a simpler flow:

`DRAFT → APPROVED`

but explicit human approval is still required.

## 7.2 Blueprint source context

Blueprint generation must be derived from:

```text
Approved DecisionRecord
+
selected Option
+
DecisionSession
+
constraints
+
accepted assumptions
+
resolved and unresolved unknowns
+
selected Evidence
+
decision criteria
+
DomainPack context
+
review triggers
```

Never generate Blueprint primarily from hard-coded text.

## 7.3 Blueprint must contain

### Identity
- blueprintId
- version
- sourceDecisionRecordId
- workspaceId
- sessionId
- domainPackId
- createdAt
- approvedAt
- status

### Product
- title
- executiveSummary
- projectGoal
- problemStatement
- targetUsers
- userJobs
- successMetrics

### Scope
- scope
- nonGoals
- assumptions
- constraints
- unresolvedRisks

### Architecture
- architectureSummary
- architecturalPrinciples
- componentDiagram or structured component description
- dependencies
- technology choices
- technology rationale

### Modules

Each module must define:

```text
name
purpose
jobToBeDone
inputs
outputs
dependencies
businessRules
edgeCases
acceptanceCriteria
testsRequired
```

### Data Model

Do NOT derive dataModel from decision criteria names.

Create actual domain entities.

For each entity:

```text
name
purpose
fields
field types
required/optional
relationships
indexes
ownership
immutability
validation rules
```

### API Contracts

For each route:

```text
method
path
purpose
authentication
authorization
requestSchema
responseSchema
errorCases
idempotency
sideEffects
```

### AI Workflow

If AI is involved:

```text
role
provider routing
input
output schema
fallback behavior
budget
failure behavior
human gate
```

### Security
- authentication requirements
- authorization rules
- protected fields
- secret handling
- Firestore protections
- abuse prevention
- input validation
- prompt injection boundaries where applicable

### Observability
- logs
- traces
- AgentRun telemetry
- tokens
- latency
- estimated cost
- prompt version
- provider
- failure codes

### Tests
- unit tests
- integration tests
- E2E tests
- security/invariant tests
- acceptance scenarios

### Deployment
- environment variables
- Firebase
- Vercel
- migration requirements
- CI checks
- rollout strategy

### Implementation order

Coding agent should be given a dependency-aware execution order.

Example:

```text
Phase 1: domain types
Phase 2: repositories
Phase 3: server APIs
Phase 4: orchestration
Phase 5: UI
Phase 6: tests
Phase 7: deployment validation
```

### Definition of Done

Every Blueprint must contain objective acceptance gates.

## 7.4 Strict Blueprint schema

Create a real Zod schema.

Invalid Blueprint generation must:

1. fail validation;
2. attempt one structured repair;
3. fail safely if repair remains invalid.

Never silently store invalid Blueprints.

---

# 8. P2
# EVIDENCE + VERIFY PIPELINE

The current Evidence module must become an operational verification layer.

Implement:

```text
User/AI claim
↓
VERIFY intent
↓
Determine verification method
↓
ToolConnector / deterministic calculation / user clarification
↓
EvidenceItem
↓
provenance
↓
supports / contradicts Option
```

## 8.1 Evidence provenance rules

Preserve clear types such as:

```text
SOURCE_CODE
OFFICIAL_DOCUMENTATION
WEB_SOURCE
USER_FACT
USER_CLAIM
CALCULATION
EXPERIMENT
AI_INFERENCE
```

AI inference must NEVER silently become fact.

## 8.2 Tool execution

Wire ToolConnector runtime into Orchestrator.

At minimum, Calculator must actually be callable when relevant.

The flow must emit Tool events:

```text
tool.started
tool.completed
```

with:

- connectorId
- action
- success/failure
- sanitized result metadata

## 8.3 Tool security

All actions must remain allowlisted.

No arbitrary command execution.

No write connector in MVP unless explicitly approved by spec.

## 8.4 Evidence linkage

Support evidence relation to:

- assumption
- option
- unknown
- decision rationale

The UI should make important relationships inspectable.

---

# 9. P3
# STOP CONDITIONS + INFORMATION-GAIN ROUTING

The StopReason enum must represent real behavior, not decorative vocabulary.

Implement actual logic for:

```text
ENOUGH_EVIDENCE
LOW_DISAGREEMENT
NO_NEW_INFORMATION
BUDGET_EXHAUSTED
EXPERIMENT_REQUIRED
HUMAN_DECISION_REQUIRED
MAX_ROUNDS_REACHED
```

## 9.1 Budget

Continue enforcing:

- maxCalls
- maxInputTokens
- maxOutputTokens
- maxCostUsd
- maxRounds

Ensure `rounds` is incremented and checked correctly.

## 9.2 Critic escalation

Critic should be invoked when justified by factors such as:

- uncertainty
- low evidence coverage
- high importance
- explicit critique request
- conflicting evidence
- irreversible/high-cost choice

## 9.3 Judge escalation

Judge should be used for:

- PREPARE_DECISION
- high-impact decision
- substantive disagreement
- explicit user request

Do not call Judge for routine chat.

## 9.4 Early exit

Skip unnecessary Critic/Judge when:

- evidence is sufficient;
- decision is low impact;
- no disagreement remains;
- new call is unlikely to add useful information.

The system must record WHY it skipped an agent.

---

# 10. P4
# MULTI-AGENT QUALITY

Do NOT transform the system into uncontrolled AI debate.

Keep bounded orchestration.

Current sequential pattern is acceptable:

```text
Analyst
→ Critic
→ Judge
```

But improve clarity and correctness.

## 10.1 Analyst

Must:

- frame problem;
- expose assumptions;
- identify unknowns;
- propose alternatives;
- distinguish facts from inference;
- avoid prematurely forcing DECISION_READY.

## 10.2 Critic

Must:

- challenge Analyst;
- identify unsupported assumptions;
- detect missing evidence;
- identify contradictions;
- expose hidden costs;
- identify irreversible decisions;
- avoid rewriting the full proposal.

## 10.3 Judge

Must:

- synthesize;
- compare options;
- record rejected alternatives;
- explain tradeoffs;
- produce review triggers;
- return heuristic confidence;
- return INSUFFICIENT_EVIDENCE when necessary.

Judge must NOT override deterministic gates.

## 10.4 No fake statistical confidence

Confidence remains:

`HEURISTIC`

Never describe it as statistical pass probability.

Replace unnecessarily hard-coded factors when measurable values exist.

For example:

- evidenceCoverage: derive from actual state
- sourceReliability: derive from EvidenceItems
- unknownPenalty: derive from unknowns
- assumptionPenalty: derive from assumptions
- agentAgreement: derive from Analyst/Critic/Judge outputs where possible
- experimentStrength: derive from experiment evidence where possible

If a value cannot be reliably measured, expose it transparently as a heuristic default rather than pretending precision.

---

# 11. P5
# EXPERIMENT ENGINE

The v5 lifecycle includes:

`EXPERIMENT`

The MVP does not need a full experimentation platform.

But Experiment must be more than a type alias or repository placeholder.

Implement a minimal useful Experiment Definition.

Required fields:

```text
id
workspaceId
sessionId
hypothesis
decisionQuestion
variants
successMetric
failureMetric
sampleOrObservationPlan
status
results
conclusion
createdAt
completedAt
```

Support:

```text
PROPOSED
→ RUNNING
→ COMPLETED
→ CANCELLED
```

At minimum the system must allow:

- AI to recommend `EXPERIMENT_REQUIRED`;
- user to create/approve an Experiment Definition;
- result to become Evidence;
- Experiment result to affect DecisionState.

No need for autonomous external experiment execution.

---

# 12. P6
# EVALUATION SYSTEM

This is required to prove whether the multi-agent architecture earns its cost.

Current substring heuristic benchmark is insufficient.

Create a real evaluation framework.

## 12.1 Configurations to compare

At minimum:

```text
A. Cheap single model
B. Strong single Analyst
C. Analyst + Critic
D. Analyst + Critic + Judge
```

Optionally compare providers where practical.

## 12.2 Evaluation cases

Create meaningful test cases for:

- problem framing
- unsupported assumption detection
- option diversity
- contradiction detection
- evidence discipline
- decision quality
- correct INSUFFICIENT_EVIDENCE behavior
- Blueprint quality
- ChallengeReady safety boundaries

## 12.3 Metrics

Record:

```text
correctness
hallucination
evidence discipline
risk detection
decision stability
educational usefulness
latency
token usage
cost
schema failure rate
repair rate
```

## 12.4 Evaluation output

Produce comparable EvaluationRun records.

At minimum:

```text
configuration
case
score
failureReasons
latency
cost
tokens
provider
model
promptVersion
```

## 12.5 Do not fake quality scoring

Avoid trivial substring tests as the main grader.

Use deterministic checks where possible.

Use rubric-based structured evaluation where subjective judgement is required.

Clearly distinguish deterministic from model-based graders.

---

# 13. P7
# DOMAIN PACK COMPLETION

Domain Pack must become operational, not just an interface.

Wire:

```text
getDecisionCriteria()
getToolConnectorIds()
getEvaluationSuiteId()
```

into runtime.

## 13.1 Session creation

If DomainPack supplies default decision criteria:

initialize them on new DecisionSession.

Do not always use:

```text
criteria: []
```

## 13.2 Tool availability

Only Tool Connectors allowed by the active DomainPack should be available to that session.

## 13.3 Evaluation suite

DomainPack may select an evaluation suite.

Wire this into benchmark/evaluation code.

## 13.4 ChallengeReady

Keep ChallengeReady thin.

Do NOT build full ChallengeReady product inside Layer A.

ChallengeReady should demonstrate:

```text
same core engine
+
different instructions
+
different deterministic checks
+
different criteria
+
different tools
+
different evaluation suite
```

---

# 14. P8
# REMOVE DEAD / DUPLICATE / DEBUG CODE

Audit the repository for:

- unused files;
- stale schema files;
- duplicated prompt sources;
- unused exports;
- unused interfaces;
- unused experiment wrappers;
- dead abstraction layers;
- stale comments;
- debugging instrumentation.

## 14.1 Remove debug residue

Remove all debug fetch calls such as:

```text
http://127.0.0.1:7577/...
```

from production paths.

Use the existing structured logger instead.

## 14.2 ChallengeReady schema duplication

Determine whether:

`src/domain-packs/challengeready/schemas.ts`

is actually used.

Either:

- wire it properly into structured output validation;

or

- remove it.

There must be one clear source of truth.

## 14.3 Prompt registry

Avoid tiny redundant files if prompt definitions are already centralized.

Do not refactor purely for aesthetics.

Only remove duplication when it improves maintainability.

---

# 15. P9
# TRUE STREAMING

Current orchestrator may simulate streaming by slicing complete output into chunks.

Upgrade where practical so that provider token streaming is actually used.

However:

structured-output correctness is more important than visual token animation.

A valid architecture is:

### Chat/Discussion mode

Use real provider streaming.

### Structured decision runs

If structured-output providers require complete JSON before validation:

allow buffered structured response.

Do NOT compromise schema validation just to animate tokens.

Document which mode is:

```text
TRUE_PROVIDER_STREAMING
```

and which is:

```text
STRUCTURED_BUFFERED_RESPONSE
```

Do not call simulated chunking "provider streaming".

---

# 16. P10
# PRODUCTION SAFETY

Strengthen environment protections.

## 16.1 MemoryStore

Production must fail startup or throw a clear configuration error if:

```text
NODE_ENV=production
AND
USE_MEMORY_STORE=true
```

unless an explicit documented test environment exception exists.

Production must never accidentally run ephemeral MemoryStore.

## 16.2 Auth bypass

Continue enforcing:

```text
DEV_AUTH_BYPASS=false
```

in production and connected Firebase mode.

Add tests.

## 16.3 Secrets

Provider API keys must remain server-only.

Never expose them to browser bundles or logs.

## 16.4 Errors

Do not send raw provider exception bodies containing sensitive metadata to users.

Use sanitized user-facing errors and structured server logs.

---

# 17. P11
# TESTING REQUIREMENTS

The repository is NOT complete until tests prove the critical paths.

## 17.1 Unit tests

Required coverage includes:

- state transitions
- canEnterValidating
- canEnterDecisionReady
- HardPolicyGate
- routing
- budget
- stop conditions
- confidence
- schema validation
- DomainPack criteria initialization
- tool permissions
- DecisionRecord immutability
- Blueprint validation
- experiment transitions
- production env safety

## 17.2 Security/invariant tests

Explicit tests must prove:

### Test A

Client cannot directly set:

`DECIDED`

### Test B

Client cannot write:

`judgeDraft`

### Test C

Client cannot replace:

`activeDecisionRecordId`

### Test D

Decision approval without JudgeDraft fails.

### Test E

Decision approval with open HIGH unknown fails.

### Test F

Blueprint cannot be created from an unapproved DecisionRecord.

### Test G

Blueprint cannot become APPROVED without explicit approval.

### Test H

User A cannot access User B workspace/session/evidence/decision/blueprint.

### Test I

Production cannot enable DEV_AUTH_BYPASS.

### Test J

Production cannot use MemoryStore.

---

# 18. INTEGRATION TESTS

Add integration tests for the real application lifecycle.

Minimum:

```text
create Workspace
↓
create DecisionSession
↓
send user message
↓
Analyst generates structured state
↓
Evidence stored
↓
Critic runs in DEEP
↓
Judge generates draft
↓
Decision enters DECISION_READY only when valid
↓
human approves
↓
DecisionRecord created
↓
session enters DECIDED
↓
Blueprint generated as DRAFT
↓
Blueprint validated
↓
human approves Blueprint
↓
Blueprint becomes APPROVED
```

Prefer Firebase Emulator for Firestore/Auth integration where practical.

---

# 19. END-TO-END PLAYWRIGHT TESTS

Existing smoke test is insufficient.

Add at least these E2E flows.

## E2E-1: Happy Path

```text
Login
→ Workspace
→ New Session
→ Frame Problem
→ Generate Options
→ Add Evidence
→ DEEP / PREPARE_DECISION
→ Judge Draft
→ Approve Decision
→ Generate Blueprint
→ Approve Blueprint
```

Verify UI state after every milestone.

## E2E-2: Integrity Failure

Attempt invalid Decision approval.

Expected:

```text
HTTP 409
SESSION_INVALID_STATE
```

## E2E-3: Partial Provider Failure

Simulate Critic failure.

Expected:

```text
Analyst preserved
run.partial emitted
no invalid DecisionRecord
```

## E2E-4: Ownership

Attempt cross-user resource access.

Expected:

```text
404 or 403
no data leakage
```

---

# 20. CI QUALITY GATE

CI must run:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

If E2E needs emulator setup, CI must configure it.

Do not mark the task complete while any CI stage fails.

---

# 21. ACCEPTANCE CRITERIA FOR 100/100

## Architecture

- [ ] Core remains domain-agnostic.
- [ ] ChallengeReady is optional.
- [ ] Providers are accessed only through ModelGateway.
- [ ] Business logic does not import provider SDKs directly.
- [ ] Repository abstraction remains intact.

## Decision integrity

- [ ] No direct DECIDED mutation.
- [ ] Human approval required.
- [ ] HardPolicyGate cannot be bypassed.
- [ ] canEnterDecisionReady is enforced.
- [ ] DecisionRecord required before DECIDED.
- [ ] DecisionRecord immutable.
- [ ] supersession works correctly.
- [ ] idempotency works.

## Evidence

- [ ] AI inference cannot silently become fact.
- [ ] VERIFY creates/updates Evidence through valid provenance.
- [ ] ToolConnector runtime works.
- [ ] evidence-option relationships are persisted.

## Multi-Agent

- [ ] QUICK works.
- [ ] STANDARD works.
- [ ] DEEP works.
- [ ] Critic is conditional.
- [ ] Judge is conditional.
- [ ] partial failure works.
- [ ] budget enforcement works.
- [ ] meaningful stop conditions work.

## Blueprint

- [ ] Blueprint is not generic hard-coded filler.
- [ ] strict schema exists.
- [ ] actual modules exist.
- [ ] actual data model exists.
- [ ] actual API contracts exist.
- [ ] security requirements exist.
- [ ] tests requirements exist.
- [ ] deployment requirements exist.
- [ ] Blueprint starts as DRAFT.
- [ ] human approval required.
- [ ] APPROVED Blueprint is genuinely coding-ready.

## Experiments

- [ ] Experiment is usable.
- [ ] EXPERIMENT_REQUIRED has behavior.
- [ ] experiment result can become Evidence.

## Evaluation

- [ ] meaningful evaluation cases exist.
- [ ] single vs multi-agent can be benchmarked.
- [ ] latency/cost are recorded.
- [ ] structured results are persisted or output.
- [ ] substring matching is not the primary evaluator.

## Security

- [ ] owner-scoping enforced.
- [ ] system fields protected.
- [ ] Firestore rules updated.
- [ ] API schemas updated.
- [ ] no debug instrumentation remains.
- [ ] no API key exposure.
- [ ] production MemoryStore prevented.
- [ ] auth bypass disabled in production.

## Testing

- [ ] unit tests pass.
- [ ] integration tests pass.
- [ ] E2E tests pass.
- [ ] security invariant tests pass.
- [ ] build succeeds.
- [ ] CI succeeds.

---

# 22. SCORING RUBRIC

After implementation, independently rescore the repository.

Use:

```text
Implementation Completion = 65%
Engineering Quality       = 35%
```

## Implementation Completion

Evaluate:

```text
Workspace
DecisionSession
Conversation
Decision Canvas
ModelGateway
Providers
Agents
Routing
Budget
Stop Conditions
Evidence
Experiments
DecisionRecord
Blueprint
DomainPack
Tool Connectors
Evaluation
Testing
Production flow
```

## Engineering Quality

Evaluate:

```text
architecture
type safety
schema safety
security
state integrity
failure handling
idempotency
observability
testability
maintainability
dead-code hygiene
CI
production configuration
```

100/100 means there is no material missing capability from the approved MVP specification.

Do NOT award 100 for polish alone.

---

# 23. IMPLEMENTATION ORDER

Follow dependency order.

```text
PHASE 0
Re-audit current HEAD

PHASE 1
Decision integrity + schemas + Firestore rules

PHASE 2
State machine integration + HardPolicyGate

PHASE 3
Blueprint v2 schema + lifecycle + generator

PHASE 4
Evidence VERIFY + ToolConnector runtime

PHASE 5
Stop conditions + routing

PHASE 6
Experiment minimal implementation

PHASE 7
DomainPack runtime wiring

PHASE 8
Evaluation benchmark

PHASE 9
True streaming cleanup

PHASE 10
Debug/dead code cleanup

PHASE 11
Unit + integration + security tests

PHASE 12
Playwright core-loop E2E

PHASE 13
CI hardening

PHASE 14
Final audit
```

Do not jump to later phases while P0 integrity issues remain.

---

# 24. WORKING METHOD

For every phase:

1. inspect the existing implementation;
2. identify the smallest correct change;
3. modify code;
4. add/update tests;
5. run targeted tests;
6. run typecheck;
7. continue only if successful.

Do not perform a large speculative rewrite.

Prefer surgical improvements.

---

# 25. DO NOT DELETE WORKING FUNCTIONALITY

Before deleting/refactoring:

- search all references;
- understand why it exists;
- confirm tests;
- preserve API compatibility when reasonable.

Do not break:

- workspace CRUD;
- chat;
- existing provider calls;
- SSE interface;
- auth;
- repository abstraction;
- ChallengeReady compatibility.

---

# 26. CODE QUALITY RULES

Use:

- TypeScript strict;
- explicit domain types;
- Zod at trust boundaries;
- server-side authorization;
- small pure functions where possible;
- deterministic logic before LLM logic;
- structured errors;
- idempotent consequential writes.

Avoid:

- `any`;
- `unknown` arrays at validated API boundaries;
- silent catches;
- giant untestable functions where avoidable;
- duplication;
- hidden magic numbers;
- hard-coded production assumptions.

---

# 27. AI-CODING-SPECIFIC GUARDRAIL

Do not treat this prompt as permission to "complete" items by:

- creating TODO files;
- adding empty folders;
- adding unused schemas;
- adding fake mocks;
- adding placeholder tests;
- marking interfaces as complete;
- writing documentation that claims functionality;
- weakening tests so they pass;
- skipping E2E because unit tests pass;
- replacing a real implementation with hard-coded fixtures.

The repository, not the explanation, is the deliverable.

---

# 28. REQUIRED FINAL VALIDATION

Before final response, run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Also inspect:

```bash
git diff --check
```

Search repository for:

```text
TODO
FIXME
HACK
127.0.0.1:7577
z.array(z.unknown())
status: "APPROVED"
```

Review every match and confirm whether it is valid.

Search for unused dead code if tooling permits.

---

# 29. FINAL REPORT FORMAT

At completion, respond with exactly these major sections.

## 1. Executive Result

```text
Before: XX/100
After: XX/100
Status:
```

## 2. Critical Fixes Completed

Explain actual changes.

## 3. Module Scorecard

Table:

```text
Module
Before
After
Evidence
```

## 4. Spec Compliance

```text
PASS
PARTIAL
FAIL
UNVERIFIED
```

for every acceptance criterion.

## 5. Security & Integrity Verification

Explicitly confirm:

- no direct DECIDED;
- DecisionRecord gate;
- Blueprint approval;
- Firestore field protections;
- owner isolation.

## 6. Test Evidence

Report:

```text
lint
typecheck
unit
integration
e2e
build
CI
```

with actual results.

## 7. Remaining Limitations

If anything remains, disclose it.

Do not hide it to obtain a perfect score.

## 8. Final Score

Only output:

`100/100`

if every required acceptance gate is genuinely PASS.

Otherwise provide the real score and list exactly what blocks 100.

---

# 30. FINAL DEFINITION OF DONE

The project is complete only when this scenario works:

```text
A user creates a generic project Workspace.

The user creates a DecisionSession.

The user discusses an unclear idea with AI.

The Analyst structures:
problem
assumptions
unknowns
options.

The system verifies important claims and preserves Evidence provenance.

The Critic challenges weak reasoning when appropriate.

The system recommends an Experiment when evidence is insufficient.

Experiment results can become Evidence.

The Judge synthesizes a candidate decision.

The system refuses DECISION_READY if mandatory evidence/state conditions fail.

The user explicitly approves the decision.

An immutable DecisionRecord is created.

The Session becomes DECIDED only because the approved DecisionRecord exists.

The system creates a structured Blueprint DRAFT from the approved decision and evidence.

The Blueprint contains enough product, architecture, module, data, API, security, testing and deployment detail for another coding AI to implement the project without needing raw conversation history.

The user reviews and explicitly approves the Blueprint.

The system stores an APPROVED coding-ready Blueprint.

All actions remain auditable.

All important AI runs record provider/model/prompt/tokens/latency/cost.

Failures degrade safely.

No AI can bypass deterministic gates.

No client can bypass server-owned state.

All unit, integration, security, E2E and CI tests pass.
```

Only when the entire scenario above is verified may the repository be described as:

# Layer A AI Decision Lab — 100/100
# Production-Ready MVP
# Coding-Ready Decision Infrastructure

Begin by auditing the current HEAD against the v5 specification.

Do not ask for confirmation between phases.

Proceed through the critical path until either:

1. every acceptance gate passes;

or

2. you encounter a genuine external blocker that cannot be solved from the repository.

If a blocker exists, document it precisely rather than pretending completion.
