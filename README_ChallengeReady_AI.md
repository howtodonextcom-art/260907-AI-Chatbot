# ChallengeReady AI

> **Multi-AI Orchestration Platform for Prop-Trading Readiness, Risk Discipline, and Adaptive Training**

ChallengeReady AI is not intended to be another generic chatbot, trading signal bot, or a screen where GPT, Claude, Gemini, and Groq simply “talk to each other.”

The project is designed as a **bounded multi-agent decision and training system**.

Its first commercial vertical is **prop-trading / FTMO-style challenge preparation**, where the system helps traders answer three practical questions:

1. **Am I actually ready to buy and take a prop challenge?**
2. **Is the trade I am about to take safe relative to my current account state and my own trading plan?**
3. **Why do I keep failing, and what specific behavior should I train next?**

The long-term vision is broader: the underlying Multi-AI Chat Engine can later support other domains such as coding review, real-estate analysis, legal-document review, financial analysis, construction handover, SEO review, or any workflow where multiple specialized AI roles can independently analyze, critique, and judge a decision.

---

## Table of Contents

- [1. Product Vision](#1-product-vision)
- [2. Core Thesis](#2-core-thesis)
- [3. What This Product Is Not](#3-what-this-product-is-not)
- [4. Target Users](#4-target-users)
- [5. Commercial Positioning](#5-commercial-positioning)
- [6. Product Architecture](#6-product-architecture)
- [7. Product Modules](#7-product-modules)
- [8. AI Capabilities by Module](#8-ai-capabilities-by-module)
- [9. Multi-AI Orchestration](#9-multi-ai-orchestration)
- [10. Deterministic Engines](#10-deterministic-engines)
- [11. Model Gateway](#11-model-gateway)
- [12. Structured Output](#12-structured-output)
- [13. AI Memory](#13-ai-memory)
- [14. Commercial Model](#14-commercial-model)
- [15. Product Roadmap](#15-product-roadmap)
- [16. MVP Scope](#16-mvp-scope)
- [17. What Is Deliberately Not in the MVP](#17-what-is-deliberately-not-in-the-mvp)
- [18. Evaluation Framework](#18-evaluation-framework)
- [19. Cost Control](#19-cost-control)
- [20. Security Principles](#20-security-principles)
- [21. Observability](#21-observability)
- [22. Suggested Technical Stack](#22-suggested-technical-stack)
- [23. Suggested Repository Structure](#23-suggested-repository-structure)
- [24. Development Principles](#24-development-principles)
- [25. Success Metrics](#25-success-metrics)
- [26. If the Product Is Not Commercialized](#26-if-the-product-is-not-commercialized)
- [27. Future Expansion](#27-future-expansion)
- [28. Risks](#28-risks)
- [29. Project Status](#29-project-status)
- [30. Disclaimer](#30-disclaimer)

---

# 1. Product Vision

ChallengeReady AI combines:

- deterministic prop-challenge rule checking;
- risk simulation;
- adaptive scenario training;
- contextual AI coaching;
- independent AI critique;
- model-to-model evaluation;
- trader behavior analysis;
- structured learning progression.

The product should be understood as:

```text
ChallengeReady
=
Rule Engine
+
Risk Engine
+
Adaptive Training
+
Contextual AI Coach
+
Bounded Multi-Agent Review
+
Evaluation System
```

Not:

```text
ChallengeReady
=
GPT
+
Claude
+
Gemini
+
Groq
```

The AI providers are infrastructure.

The **product value** is the decision system, training methodology, domain rules, user progress data, and evaluation dataset built on top of them.

---

# 2. Core Thesis

The original hypothesis behind the project is:

> Human-written prompts may not be sufficient to consistently extract the best reasoning from a single AI model.

ChallengeReady does **not** assume that adding more models automatically creates better intelligence.

Instead, the system tests a stronger hypothesis:

> A bounded system in which specialized AI roles independently analyze, challenge, revise, and judge a decision may outperform a single unrestricted chatbot when the workflow is measurable and domain-constrained.

Therefore:

- agents should have narrow responsibilities;
- agents should not debate indefinitely;
- independent analysis should happen before cross-examination;
- mathematical and rule-based facts should be computed by code;
- AI outputs should be structured;
- every additional agent must prove measurable value.

---

# 3. What This Product Is Not

ChallengeReady is **not** intended to be:

- a BUY/SELL signal service;
- a guaranteed FTMO pass system;
- an autonomous trading bot;
- a broker execution system;
- a replacement for financial advice;
- a generic multi-model chat playground;
- a copy of a trading journal product;
- an eight-agent “AI council” built for novelty.

The goal is:

```text
SURVIVAL
→ RISK CONTROL
→ DISCIPLINE
→ CONSISTENCY
→ PERFORMANCE
```

Profit comes after survival and discipline.

---

# 4. Target Users

## Primary Persona

The strongest commercial user is:

> A trader who has failed one or more prop challenges, or is preparing to purchase a challenge, and suspects that risk management, discipline, drawdown control, or emotional behavior is a bigger problem than chart analysis alone.

## User Segments

| Segment | Main Problem | Commercial Priority |
|---|---|---:|
| First-time prop challenge candidate | Does not know if they are ready | High |
| Trader who failed 1-3 challenges | Does not understand the real failure pattern | **Very High** |
| Trader currently taking a challenge | Needs to avoid rule breaches | **Very High** |
| Funded trader | Wants long-term discipline and consistency | Medium |
| Trading mentor / academy | Wants to monitor and train students | Future B2B |
| User looking only for trade signals | Wants BUY/SELL calls | Not a target |

---

# 5. Commercial Positioning

ChallengeReady should be positioned as:

## **Prop Challenge Readiness & Risk Discipline Platform**

A practical positioning statement:

> Know whether you are ready before you buy a challenge.  
> Know whether a trade puts your challenge at risk.  
> Know exactly why you failed and what to train next.

The strongest early commercial hooks are:

### 1. Readiness Score

Answers:

> “Should I buy a challenge yet?”

### 2. ChallengeGuard

Answers:

> “Is this planned trade safe relative to my current account state?”

### 3. Why Did I Fail?

Answers:

> “What sequence of decisions actually caused my challenge failure?”

---

# 6. Product Architecture

```text
Trader
  │
  ▼
ChallengeReady Web App
  │
  ▼
Application / Session Layer
  │
  ├──────────────► User Profile & Trading Plan
  │
  ▼
Input Normalizer
  │
  ├──────────────► FTMO / Prop Rule Engine
  │
  ├──────────────► Deterministic Risk Engine
  │
  ▼
Risk-Aware AI Router
  │
  ├── Low Risk ─────────► Economy Model
  │
  ├── Medium Risk ──────► Coach
  │
  └── High Risk ────────► Coach + Critic + Judge
                           │
                           ▼
                  Structured Blackboard
                           │
                           ▼
                     Hard Policy Gate
                           │
                           ▼
                     Teaching Layer
                           │
                           ▼
                         User
```

The architecture has two major layers:

## Layer A — Multi-AI Chat Engine

Reusable infrastructure:

- provider adapters;
- routing;
- structured outputs;
- agents;
- memory;
- cost tracking;
- evaluation;
- observability;
- tool calling;
- orchestration.

## Layer B — ChallengeReady Domain

Prop-trading specific logic:

- rule sets;
- challenge states;
- readiness assessment;
- risk simulation;
- training scenarios;
- trading plans;
- failure analysis;
- journal intelligence.

This separation is important because the AI engine should remain reusable outside trading.

---

# 7. Product Modules

Every module must answer a specific user question.

No “feature soup.”

---

## Module 1 — Readiness Lab

### User Question

> “Am I ready to buy and take a prop challenge?”

### Purpose

Assess whether the trader is sufficiently prepared before spending money on a real challenge.

### Features

- challenge-type selection;
- rule knowledge assessment;
- scenario-based risk test;
- drawdown decision test;
- discipline assessment;
- readiness score;
- weakness breakdown;
- personalized preparation plan;
- retest and score history.

### Example Output

```text
FTMO Readiness Score: 68/100

Rule Knowledge:       92
Risk Management:      61
Trading Discipline:   58
Decision Quality:     71
Drawdown Management:  49

Status:
NOT READY YET

Primary Weakness:
Risk escalation after losses
```

### AI Integration

- Adaptive Examiner
- AI Coach
- Judge
- Scenario Generator

---

## Module 2 — My Challenge

### User Question

> “What is the exact state of my challenge right now?”

### Purpose

Provide a trusted account-state dashboard.

### Features

- initial balance;
- current balance;
- equity;
- daily P/L;
- remaining daily-loss headroom;
- remaining maximum-loss headroom;
- profit target remaining;
- minimum trading days;
- rule status;
- current challenge stage;
- challenge history.

### AI Integration

Minimal.

This module should rely primarily on **deterministic calculations**, not LLM reasoning.

AI may explain the numbers in plain language.

---

## Module 3 — ChallengeGuard

### User Question

> “Will this planned trade put my challenge at unnecessary risk?”

### Purpose

Prevent avoidable rule breaches and personal-plan violations before the user enters a trade.

### Features

- planned entry;
- stop loss;
- take profit;
- lot size;
- expected monetary risk;
- risk percentage;
- current account headroom;
- worst-case simulation;
- percentage of remaining loss buffer consumed;
- personal trading-plan compliance;
- caution / avoid / block recommendation;
- “what would make this trade acceptable?” analysis.

### Example

```text
Current Daily Loss Headroom: $3,750
Planned Risk:                $1,300

This trade consumes:
34.7% of remaining daily-loss capacity.

Status:
CAUTION
```

### AI Integration

- Risk Coach
- Critic for high-risk cases
- Judge for conflicting assessments

Hard-rule calculations remain deterministic.

---

## Module 4 — Trading Plan

### User Question

> “What rules have I committed to following?”

### Purpose

Convert an informal trading plan into enforceable structured rules.

### Features

- maximum risk per trade;
- maximum trades per day;
- maximum consecutive losses;
- allowed sessions;
- allowed instruments;
- allowed setups;
- news-event restrictions;
- stop-trading rules;
- daily shutdown rules;
- plan version history.

### AI Integration

AI Plan Builder converts natural language into structured rules.

Example:

```text
"I risk no more than 0.5%, trade London and New York,
and stop after two consecutive losses."
```

becomes:

```json
{
  "risk_per_trade_max": 0.5,
  "max_consecutive_losses": 2,
  "sessions": ["LONDON", "NEW_YORK"]
}
```

The user must confirm the structured plan before it becomes active.

---

## Module 5 — Training Arena

### User Question

> “Can I make the correct decision under pressure?”

### Purpose

Train decision quality instead of passive knowledge consumption.

### Features

- scenario-based exercises;
- multiple-choice decisions;
- progressive difficulty;
- rule-breach scenarios;
- drawdown scenarios;
- revenge-trading scenarios;
- position-sizing scenarios;
- instant explanations;
- skill-specific training;
- adaptive curriculum;
- score history.

### AI Integration

- Scenario Generator
- Judge
- Teaching Agent

Deterministic logic validates rule-based answers.

---

## Module 6 — Journal Intelligence

### User Question

> “What behavior keeps hurting my performance?”

### Purpose

Analyze trade history for recurring patterns.

### Initial Features

- manual trade entry;
- CSV import;
- trade tagging;
- risk changes;
- consecutive-loss behavior;
- overtrading;
- time-of-day performance;
- setup performance;
- poor R:R patterns;
- plan violations.

### Later Features

- broker integrations;
- automatic trade sync;
- screenshot analysis;
- session reconstruction.

### AI Integration

- AI Reviewer
- Psychology Pattern Agent
- Critic
- Teaching Agent

This module is **not required for the earliest MVP**.

---

## Module 7 — Why Did I Fail?

### User Question

> “What actually caused my failed challenge?”

### Purpose

Transform a failed challenge into a structured learning event.

### Features

- challenge history import;
- failure timeline;
- direct cause;
- root cause;
- behavioral escalation;
- risk escalation;
- counterfactual simulation;
- training recommendations.

### Example

```text
Direct Cause:
Maximum Daily Loss breach

Root Cause:
Risk escalation after two consecutive losses

Sequence:
Trade #31 Loss
→ Risk increased from 0.6% to 1.1%
→ Second loss
→ Trade frequency increased
→ Final rule breach

Primary Pattern:
Risk Escalation

Secondary Pattern:
Revenge Trading
```

### AI Integration

- Failure Analyst
- Critic
- Judge
- Teaching Agent

---

## Module 8 — Progress

### User Question

> “Am I actually improving?”

### Purpose

Measure learning and behavioral improvement over time.

### Features

- readiness history;
- risk-management score;
- discipline score;
- drawdown-management score;
- rule-knowledge score;
- repeated mistake frequency;
- training streaks;
- weakness trend;
- skill progression.

### AI Integration

AI produces contextual summaries, not raw scoring.

Scores should be derived from measurable behavior wherever possible.

---

## Module 9 — AI Coach

### User Question

> “Can I ask questions using the context of my own account, plan, history, and mistakes?”

### Purpose

Provide contextual coaching across the entire product.

### Important Design Rule

AI Coach should **not** be an isolated generic chat page.

It should appear inside:

- Readiness Lab;
- ChallengeGuard;
- Training Arena;
- Journal;
- Progress;
- Failure Analysis.

Examples:

> “Why is this planned trade considered dangerous?”

> “Why did my readiness score fall this week?”

> “What mistake am I repeating?”

> “Explain why option B is wrong.”

### AI Integration

- Coach
- Critic
- Judge
- Model Router

---

## Module 10 — Mentor Workspace

### User Question

> “Which of my students needs attention and why?”

### Purpose

Create a future B2B product for trading mentors, communities, and academies.

### Features

- student roster;
- readiness dashboard;
- challenge status;
- weakness summaries;
- assignments;
- mentor comments;
- intervention alerts;
- class-level analytics.

### AI Integration

- Student Summary Agent
- Risk Alert Agent
- Curriculum Assistant

### Release

Not MVP.

Target V2/V3.

---

# 8. AI Capabilities by Module

| AI Capability | Purpose | Used In |
|---|---|---|
| Contextual Coach | Explain decisions | Readiness, Guard, Training, Journal |
| Independent Critic | Find weak reasoning | High-risk analysis |
| Judge | Reconcile disagreement | High-risk analysis |
| Scenario Generator | Generate new training cases | Training Arena |
| Adaptive Examiner | Adjust difficulty | Readiness Lab |
| Failure Analyst | Find failure chain | Why Did I Fail |
| Psychology Pattern Agent | Detect behavior patterns | Journal |
| Teaching Agent | Convert technical output into lessons | Entire app |
| Plan Builder | Convert natural language to rules | Trading Plan |
| Model Router | Choose model/cost level | Entire AI layer |

---

# 9. Multi-AI Orchestration

The system should **not** allow unrestricted model-to-model conversation.

Recommended protocol:

## Round 0 — Deterministic Context

Code computes:

- account state;
- applicable challenge rules;
- loss headroom;
- risk;
- plan compliance.

No LLM.

## Round 1 — Independent Analysis

Relevant AI agents analyze independently.

They do not see one another's answers.

This reduces groupthink.

## Round 2 — Disagreement Detection

The orchestrator compares structured outputs.

If there is no meaningful disagreement and risk is low, stop early.

## Round 3 — Adversarial Critique

Only when required.

Critic looks for:

- unsupported assumptions;
- missing evidence;
- numerical inconsistency;
- excessive confidence;
- dangerous recommendations.

## Round 4 — Revision

Original agent may revise once.

Recommended:

```text
MAX_REVISION_ROUNDS = 1
```

## Round 5 — Judge

Judge sees:

- verified facts;
- deterministic calculations;
- agent outputs;
- critic output;
- revisions.

Judge does not override hard rules.

## Round 6 — Hard Policy Gate

Code checks:

- schema validity;
- rule violations;
- numerical consistency;
- missing mandatory data;
- unsafe or unsupported conclusions.

## Round 7 — Teaching Layer

The final result is rewritten for the trader:

- what happened;
- why it matters;
- what to do;
- what would change the decision;
- what lesson should be trained next.

---

# 10. Deterministic Engines

A key architectural rule:

> If something can be calculated reliably, do not ask an LLM to guess it.

---

## Rule Engine

Responsible for:

- challenge type;
- rule version;
- profit target;
- daily loss;
- maximum loss;
- minimum trading days;
- best-day rules where applicable;
- challenge status.

Rules must be:

- versioned;
- source-linked;
- date-effective;
- test-covered;
- human-approved before production use.

Do **not** hard-code a single FTMO rule set forever.

Example schema:

```text
rule_sets

id
provider
program
program_version
account_type

effective_from
effective_to

profit_target_pct
daily_loss_type
daily_loss_pct
max_loss_type
max_loss_pct

minimum_trading_days

best_day_enabled
best_day_pct

timezone

official_source
verified_at
status
```

---

## Risk Engine

Responsible for:

- position risk;
- risk percentage;
- R multiple;
- remaining daily-loss buffer;
- remaining total-loss buffer;
- worst-case trade outcome;
- plan-risk violations;
- drawdown state.

Example functions:

```python
calculate_position_risk()
calculate_daily_loss_headroom()
calculate_max_loss_headroom()
calculate_r_multiple()
check_personal_risk_limit()
simulate_worst_case()
```

---

# 11. Model Gateway

The application should not couple business logic directly to one AI provider.

```text
ModelGateway
├── OpenAIAdapter
├── AnthropicAdapter
├── GeminiAdapter
├── GroqAdapter
└── FutureProviderAdapter
```

Suggested interface:

```typescript
interface ModelProvider {
  generate(
    request: NormalizedModelRequest
  ): Promise<ModelResult>

  capabilities(): ModelCapabilities

  estimateCost(
    request: NormalizedModelRequest
  ): CostEstimate

  health(): ProviderHealth
}
```

The gateway should normalize:

- messages;
- system instructions;
- structured outputs;
- tool calls;
- usage;
- latency;
- cost;
- errors;
- retries.

Do not pretend every provider has identical capabilities.

Use a **Capability Registry**.

Example:

```typescript
type ModelCapabilities = {
  structuredOutput: boolean
  strictSchema: boolean
  tools: boolean
  streaming: boolean
  vision: boolean
  promptCaching: boolean
  maxContextTokens: number
}
```

---

# 12. Structured Output

Agents should communicate through structured state instead of long free-text messages.

Example:

```json
{
  "schema_version": "1.0",

  "agent": {
    "id": "risk_critic",
    "role": "CRITIC",
    "provider": "anthropic",
    "model": "..."
  },

  "assessment": {
    "decision": "ALLOW | CAUTION | AVOID | BLOCK",
    "confidence": 0.82,
    "risk_score": 78
  },

  "evidence": [],

  "assumptions": [],

  "unknowns": [],

  "criticisms": [],

  "recommended_actions": [],

  "education": {
    "lesson": "",
    "mistake_types": []
  },

  "requires_human_review": false
}
```

All outputs should be validated through Zod, Pydantic, JSON Schema, or equivalent.

---

# 13. AI Memory

Trader memory must preserve provenance.

Each memory item should be classified as:

```text
FACT
USER_CLAIM
AI_INFERENCE
TEMPORARY_STATE
```

Example:

```json
{
  "value": "Trader often increases risk after losses",
  "provenance": "AI_INFERENCE",
  "confidence": 0.72,
  "evidence_ids": [
    "trade_232",
    "trade_240",
    "trade_243"
  ],
  "created_at": "...",
  "expires_at": null
}
```

Important rule:

```text
AI_INFERENCE ≠ FACT
```

An AI inference should never silently become a fact.

---

# 14. Commercial Model

A possible commercial structure:

---

## Free

Purpose:

- acquisition;
- education;
- demonstrate value before payment.

Possible features:

- basic Readiness Test;
- basic rule calculator;
- limited training scenarios;
- limited AI Coach;
- one sample ChallengeGuard analysis.

---

## Challenge Pass

Recommended early paid offer.

Example:

### 30-Day ChallengeReady Pass

Possible features:

- full Readiness Lab;
- ChallengeGuard;
- Training Arena;
- AI Coach;
- challenge tracking;
- weekly readiness review;
- basic journal analysis.

This matches the time-bound intent of someone preparing for or actively taking a challenge.

---

## Pro

For active traders.

Possible features:

- multiple accounts;
- Journal Intelligence;
- advanced failure analysis;
- deeper AI reviews;
- long-term progress analytics;
- more training scenarios;
- advanced AI Council mode.

---

## Mentor / Academy

Future B2B plan.

Possible features:

- student management;
- class dashboards;
- assessments;
- assigned training;
- AI student summaries;
- risk alerts;
- cohort analytics.

---

# 15. Product Roadmap

The full product should **not** be written at once.

---

## Phase 0 — Prove the Thesis

Goal:

Determine whether multi-agent orchestration actually improves quality.

Build:

- evaluation harness;
- 100-300 domain scenarios;
- deterministic Rule Engine;
- deterministic Risk Engine;
- single-model baseline;
- Coach + Critic baseline;
- Coach + Critic + Judge baseline.

Compare:

```text
Single Model
vs
Single Strong Model
vs
Model + Critic
vs
3-Agent Council
```

Metrics:

- accuracy;
- rule compliance;
- risk detection;
- hallucination;
- educational value;
- latency;
- cost.

If multi-agent architecture does not create measurable lift, do not expand it.

---

## Phase 1 — Commercial MVP

Build:

- authentication;
- user profile;
- challenge profile;
- Readiness Lab;
- My Challenge;
- Rule Engine;
- Risk Engine;
- ChallengeGuard;
- Training Arena;
- contextual AI Coach;
- Coach → Critic → Judge workflow;
- basic analytics;
- token/cost logging.

This is the first version worth putting in front of real users.

---

## Phase 2 — Learning Intelligence

Add:

- Trading Plan;
- progress scoring;
- adaptive curriculum;
- basic trade journal;
- CSV import;
- mistake library;
- “Why Did I Fail?” analysis;
- personalized training recommendations.

---

## Phase 3 — Advanced Intelligence

Add:

- broker integrations;
- Journal Intelligence;
- Psychology Agent;
- Quant Agent;
- deeper AI Council;
- provider A/B testing;
- richer observability;
- experiment management.

---

## Phase 4 — B2B / Mentor

Add:

- Mentor Workspace;
- student cohorts;
- academy dashboards;
- assignments;
- student risk alerts;
- instructor analytics.

---

## Phase 5 — Multi-Prop Expansion

Support versioned rule sets for multiple prop firms.

Potential examples:

```text
FTMO
FundedNext
The5ers
FundingPips
Others
```

Each prop firm should have:

- independent rule configuration;
- version history;
- verification workflow;
- test suite.

---

# 16. MVP Scope

The earliest product should remain intentionally small.

## Required Domain Components

### 1. Rule Engine

Not an AI agent.

### 2. Risk Engine

Not an AI agent.

### 3. Coach

Explains the setup, decision, and training lesson.

### 4. Critic

Tries to prove the Coach may be wrong.

### 5. Judge / Teacher

Combines deterministic facts, Coach output, and Critic output into the final training verdict.

---

## Required User Modules

| Module | MVP |
|---|---:|
| Readiness Lab | ✅ |
| My Challenge | ✅ |
| ChallengeGuard | ✅ |
| Training Arena | ✅ |
| Contextual AI Coach | ✅ |
| Trading Plan | Optional late MVP / Phase 2 |
| Journal Intelligence | ❌ |
| Broker Sync | ❌ |
| Backtesting | ❌ |
| Full Psychology Agent | ❌ |
| Mentor Workspace | ❌ |
| Eight-Agent Council | ❌ |

---

# 17. What Is Deliberately Not in the MVP

Do not build these immediately:

- eight specialized agents;
- automatic broker sync;
- full trading journal competitor;
- real-time signal engine;
- automated execution;
- advanced Monte Carlo pass probability;
- complex LangGraph workflows;
- Temporal infrastructure;
- mentor dashboard;
- multi-prop support;
- mobile app;
- social/community features.

A smaller product is easier to:

- test;
- debug;
- price;
- explain;
- benchmark;
- improve.

---

# 18. Evaluation Framework

Multi-Agent must earn its complexity.

The project should include an evaluation dataset from the beginning.

---

## Dataset A — Rule Compliance

Known inputs with deterministic expected answers.

Measure:

```text
rule_accuracy
```

Target:

Near 100%.

---

## Dataset B — Risk Mathematics

Test:

- position size;
- risk percentage;
- drawdown;
- remaining headroom;
- R multiple;
- worst case.

Expected answers are deterministic.

---

## Dataset C — Trading Decisions

Expert-labelled scenarios.

Possible labels:

```text
GOOD
ACCEPTABLE
HIGH_RISK
REJECT
```

---

## Dataset D — Behavioral Patterns

Human-labelled sequences:

```text
REVENGE
FOMO
OVERTRADING
RISK_ESCALATION
NORMAL
```

---

## Dataset E — Teaching Quality

Evaluate:

- correctness;
- clarity;
- actionability;
- overconfidence;
- usefulness.

---

## Core Experiment Matrix

```text
A = Single economy model
B = Single strong model
C = Strong model + Critic
D = Two-provider Council
E = Full Council
```

If:

```text
Council Quality ≈ Single Model Quality
```

but:

```text
Cost = 4x
Latency = 3x
```

remove the unnecessary agents.

---

# 19. Cost Control

Each AI session must have an explicit budget.

Example:

```typescript
interface AiBudget {
  maxCalls: number
  maxInputTokens: number
  maxOutputTokens: number
  maxCostUsd: number
  maxDebateRounds: number
}
```

Suggested product modes:

---

## Economy

Use for:

- definitions;
- basic explanation;
- low-risk training.

Possible limits:

```text
1 main model
low token budget
no debate
```

---

## Standard

Use for:

- account review;
- planned trade analysis;
- moderate risk.

Possible flow:

```text
Risk Engine
+
Coach
+
light Judge
```

---

## Deep Review

Use for:

- high-risk challenge state;
- failure analysis;
- major disagreement;
- user-requested deep analysis.

Possible flow:

```text
Coach
+
Critic
+
Judge
```

The product should stop calling models when the cost budget is exhausted.

No infinite AI debates.

---

# 20. Security Principles

## API Keys

Never expose provider API keys in the frontend.

```text
Browser
  ✗ OpenAI Key
  ✗ Anthropic Key
  ✗ Gemini Key
  ✗ Groq Key

Backend
  ✓ Secrets
```

---

## Recommended Controls

- backend-only provider calls;
- secrets manager;
- rate limiting;
- per-user quotas;
- abuse protection;
- prompt-injection defenses;
- schema validation;
- server-side tool permissions;
- PII minimization;
- audit logs;
- safe error handling;
- retry limits.

---

## Trading Safety Boundary

The application should not be allowed to:

- place trades;
- execute broker orders;
- withdraw funds;
- change broker account settings;
- claim guaranteed returns.

The initial product is **training and decision support only**.

---

# 21. Observability

Every agent call should be traceable.

Suggested log fields:

```text
provider
model
agent_role
prompt_version
input_tokens
output_tokens
cached_tokens
latency_ms
cost_usd
decision
confidence
judge_score
user_feedback
experiment_id
```

The system should eventually answer questions such as:

> Does the Critic improve results?

> Is Provider A worth the additional cost?

> Can an economy model safely handle this class of request?

> Which prompt version produces fewer hallucinations?

---

# 22. Suggested Technical Stack

This is an architectural recommendation, not a hard requirement.

---

## Frontend

```text
Next.js
TypeScript strict
Tailwind CSS
Zod
```

---

## Backend

Recommended:

```text
Python
FastAPI
Pydantic
```

Python is useful because the product may require:

- numerical simulation;
- risk calculations;
- pandas / numpy;
- statistics;
- future Monte Carlo analysis;
- AI orchestration.

---

## Database

Recommended primary database:

```text
PostgreSQL
```

Reason:

The domain is highly relational.

Examples:

```text
user
→ trading_account
→ challenge
→ trades
→ rule_version
→ agent_runs
→ evaluations
```

Possible managed providers:

- Supabase;
- Neon;
- Cloud SQL;
- equivalent managed PostgreSQL.

---

## Cache

Redis is optional at first.

Use later for:

- rate limiting;
- short-lived cache;
- distributed locks;
- queue coordination.

---

## Orchestration

### MVP

Use a custom explicit state machine.

Example:

```text
route
→ deterministic context
→ coach
→ optional critic
→ judge
→ validation
```

### Later

Consider LangGraph when the workflow becomes:

- highly branching;
- persistent;
- resumable;
- multi-step;
- human-in-the-loop.

Avoid adding heavyweight orchestration before the workflow actually needs it.

---

# 23. Suggested Repository Structure

```text
challengeready/
│
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   └── lib/
│   │
│   └── api/
│       ├── main.py
│       ├── routes/
│       └── dependencies/
│
├── domain/
│   ├── rules/
│   │   ├── engine.py
│   │   ├── models.py
│   │   └── rule_sets/
│   │
│   ├── risk/
│   │   ├── engine.py
│   │   ├── position_size.py
│   │   └── drawdown.py
│   │
│   ├── readiness/
│   ├── training/
│   ├── journal/
│   └── progress/
│
├── ai/
│   ├── gateway/
│   │   ├── base.py
│   │   ├── openai.py
│   │   ├── anthropic.py
│   │   ├── gemini.py
│   │   └── groq.py
│   │
│   ├── router/
│   │   ├── model_router.py
│   │   └── risk_router.py
│   │
│   ├── agents/
│   │   ├── coach.py
│   │   ├── critic.py
│   │   ├── judge.py
│   │   └── teacher.py
│   │
│   ├── orchestration/
│   │   ├── workflow.py
│   │   └── state.py
│   │
│   ├── schemas/
│   │   └── agent_output.py
│   │
│   ├── prompts/
│   │   ├── registry.py
│   │   └── versions/
│   │
│   ├── memory/
│   └── safety/
│
├── evaluation/
│   ├── datasets/
│   ├── benchmarks/
│   ├── graders/
│   └── reports/
│
├── observability/
│   ├── tracing.py
│   ├── usage.py
│   └── cost.py
│
├── tests/
│   ├── rules/
│   ├── risk/
│   ├── agents/
│   ├── orchestration/
│   └── evaluation/
│
├── docs/
│   ├── architecture/
│   ├── product/
│   └── rules/
│
├── .env.example
├── docker-compose.yml
├── README.md
└── LICENSE
```

---

# 24. Development Principles

## Principle 1 — Domain Logic Before AI

If a rule can be implemented deterministically, implement it in code.

---

## Principle 2 — Every Module Must Have a Job

Before implementing a feature, answer:

```text
Who uses it?
What question does it answer?
What pain does it reduce?
What metric proves it works?
```

If those answers are unclear, do not build it yet.

---

## Principle 3 — AI Is Embedded, Not Bolted On

Do not create one isolated “AI Chat” page and call the product AI-powered.

AI should appear contextually inside:

- Readiness;
- ChallengeGuard;
- Training;
- Journal;
- Progress;
- Failure Analysis.

---

## Principle 4 — Multi-Agent Is Conditional

Do not run every model on every request.

Use routing.

---

## Principle 5 — Cost Is a Product Constraint

Every analysis should have a known:

- token budget;
- call budget;
- cost budget;
- latency target.

---

## Principle 6 — Measure Before Expanding

Do not add Agent #4 until Agent #3 has proven value.

---

## Principle 7 — Training, Not Prediction

The product should improve the user's decision process.

It should not sell certainty.

---

# 25. Success Metrics

Potential core metrics:

---

## Acquisition

- Readiness Test starts;
- Readiness Test completion rate;
- Free → Challenge Pass conversion;
- visitor → account conversion.

---

## Activation

- first challenge created;
- first ChallengeGuard analysis;
- first Training Arena session;
- first personalized weakness identified.

---

## Engagement

- training sessions per week;
- ChallengeGuard checks per challenge;
- AI Coach questions;
- repeat readiness assessments.

---

## Learning

- readiness-score improvement;
- risk-management score improvement;
- rule-knowledge improvement;
- repeated mistake reduction;
- plan-violation reduction.

---

## Commercial

- Challenge Pass conversion;
- subscription retention;
- CAC;
- LTV;
- paid conversion;
- mentor-plan adoption.

---

## AI System

- agent accuracy;
- critic lift;
- hallucination rate;
- cost per analysis;
- latency;
- schema failure rate;
- provider failure rate.

---

# 26. If the Product Is Not Commercialized

Even if ChallengeReady never becomes a paid SaaS, the project can still produce valuable assets.

---

## 1. Personal AI Training System

Use it privately for:

- decision review;
- risk discipline;
- trading simulation;
- learning;
- journaling;
- structured reflection.

---

## 2. Multi-Agent AI Laboratory

The platform can benchmark:

```text
GPT vs Claude
Single Agent vs Multi-Agent
Critic vs No Critic
Provider cost vs quality
Prompt version A vs B
```

This produces a proprietary evaluation dataset.

---

## 3. Reusable AI Application Engine

The orchestration layer can be reused in other domains.

Example:

```text
User
↓
Domain Data
↓
Specialist
↓
Critic
↓
Judge
↓
Decision
```

Potential future domains:

- code review;
- financial statement review;
- credit-card analysis;
- real-estate analysis;
- SEO audit;
- legal-document review;
- construction handover;
- internal company workflows.

---

## 4. Technical Portfolio / Intellectual Property

Even without revenue, the project can demonstrate:

- multi-provider AI architecture;
- bounded agent orchestration;
- rule engines;
- prompt registry;
- model routing;
- cost governance;
- AI evaluation;
- memory provenance;
- observability;
- domain-specific AI design.

---

# 27. Future Expansion

ChallengeReady can evolve from:

```text
FTMO Trainer
```

to:

```text
Prop Trading Training OS
```

The core AI engine should remain provider-independent.

New verticals should primarily require:

- new rule sets;
- new domain tools;
- new scenarios;
- new evaluation data;
- new prompts.

Not a complete rewrite.

---

# 28. Risks

Top product and technical risks:

| Risk | Probability | Impact | Mitigation |
|---|---:|---:|---|
| Multi-Agent does not outperform a single model | High | High | Benchmark first |
| API cost grows too quickly | High | Medium | Risk-aware routing |
| Latency becomes frustrating | High | Medium | Early exit and economy path |
| Multiple models hallucinate the same rule | Medium | High | Deterministic Rule Engine |
| Prop-firm rules change | High | High | Versioned rule sets |
| AI consensus creates false confidence | Medium | High | Independent analysis + Critic |
| Product becomes too complex | High | High | Strict MVP |
| Users treat AI as a trading signal | High | High | Training-first UX |
| Psychology inference is wrong | Medium | Medium | Provenance + confidence |
| Provider outage / rate limit | Medium | Medium | Multi-provider fallback |

---

# 29. Project Status

## Current Stage

```text
Concept
+
Product Architecture
+
Commercial Positioning
+
Multi-Agent System Design
```

The project should **not** yet claim that all modules described in this README are implemented.

Recommended next milestone:

### Phase 0 Prototype

Build and benchmark:

1. deterministic Rule Engine;
2. deterministic Risk Engine;
3. 100-300 evaluation scenarios;
4. Single Coach baseline;
5. Coach + Critic;
6. Coach + Critic + Judge;
7. cost / latency / quality comparison.

Only after the thesis is validated should the full commercial MVP be expanded.

---

# 30. Disclaimer

ChallengeReady AI is intended for:

- education;
- simulation;
- decision support;
- risk awareness;
- training.

It is not financial advice.

It does not guarantee:

- successful trading;
- passing an FTMO or other prop challenge;
- funding;
- profitability.

Prop-firm rules, account conditions, product names, APIs, model capabilities, and pricing may change over time.

Any production implementation must:

- verify current rules against official sources;
- version rule sets;
- test calculations;
- clearly display applicable rule versions;
- avoid presenting AI-generated opinions as guaranteed outcomes.

---

# Final Product Definition

```text
ChallengeReady AI
=
Prop Challenge Readiness
+
Risk Survival
+
Adaptive Training
+
Contextual Coaching
+
Bounded Multi-Agent Review
+
Measurable Evaluation
```

The long-term objective is not to create the loudest AI chat room.

It is to create a system where each AI has a clear job, hard facts remain hard facts, every additional agent must justify its cost, and users become better at making disciplined decisions.
