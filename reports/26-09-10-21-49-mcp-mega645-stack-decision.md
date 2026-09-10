# MCP Live — Mega 6/45 Research Lab stack decision

- **Time:** 2026-09-10 21:49 (UTC+7)
- **Workspace:** Mega 6/45 Research Lab (`Vo4C2ankSlt2AQn9PDi8`)
- **Session:** http://localhost:3001/sessions/DCBcWXlvv4YPj8w8smAm
- **Mode:** DEEP · Parallel Blind Framing
- **Status after FRAME:** VALIDATING · NOT READY (8 HIGH unknowns blocking)

## Prompt executed

Decision Brief đã OK (architecture A/B/C, walk-forward, Holm–Bonferroni, anti-overclaim).

## Runtime evidence (`\.cursor\debug-74ad39.log`)

```json
{"workflowStage":"FRAME","runParallelFraming":true,"planStages":["PARALLEL_FRAME"],"hasGemini":true,"hasDeepseek":true,"hasGroq":true}
{"message":"parallel blind framing completed with quorum","providersCompleted":["gemini","deepseek","groq"],"frameCount":3,"conflictTopics":22,"unknownCount":9,"highUnknowns":8,"assumptionCount":10}
{"workflowStage":"VERIFY","planStages":["VERIFY_TOOLS"],"highUnknownCount":8}
```

## MCP checklist

| ID | Criterion | Result |
|---|---|---|
| S1 | New workspace + session created | PASS |
| S2 | Mode DEEP | PASS |
| S3 | Quorum ≥2 framers (3/3) | PASS |
| S4 | Conflict Map visible (3 framers, 22 topics) | PASS |
| S5 | HIGH unknowns pause before OPTIONS/CRITIQUE | PASS (8 HIGH open → VERIFY then pause; Tiếp tục available) |
| S6 | No auto-DECIDED | PASS (NOT READY; approve absent) |

## Council recommendation (from Canvas + chat)

**Selected direction: Option B — Python compute core (Polars/NumPy/SciPy) + CLI/sync + Streamlit mỏng**

Rationale (compressed from framers/options on Canvas):
- Tách core thuần khỏi UI → pytest được walk-forward / Holm–Bonferroni / seed.
- Streamlit đủ UX lab (filter, chart, nút sync) với chi phí ops thấp.
- Monolith A risk: khó test leakage và tái lập.
- FastAPI+Next C overkill cho lab cá nhân lúc MVP; có thể migrate sau vì core đã tách.

Options surfaced on Canvas: A Monolith Streamlit · B Core+CLI+thin Streamlit · C FastAPI+Next · (variants labeled by deepseek/groq).

## Next human steps in this session

1. Resolve or ACCEPT_RISK the 8 HIGH unknowns (deploy public? MVP budget? latency? UI complexity? …).
2. Press **Tiếp tục quy trình** after blockers clear → OPTIONS/CRITIQUE/PREPARE.
3. Human Approve only when DECISION_READY + server `humanApproveProof`.
