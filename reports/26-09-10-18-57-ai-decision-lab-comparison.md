# Bao cao so sanh AI Decision Lab

Ngay tao: 2026-09-10 18:57

## Tom tat

Du an nay khong phai chatbot thong thuong. No la mot **AI Decision Lab**: chat chi la giao dien nhap lieu, con san pham loi la quy trinh ra quyet dinh co trang thai, bang chung, unknowns, agent roles, Judge draft, Decision Record va Blueprint.

Stack chinh: Next.js 15, React 19, TypeScript strict, Firebase/Firestore, Vitest, Playwright, Gemini/Groq/DeepSeek.

## Ban do codebase

- Domain loi nam o `src/domain/decision/types.ts`: `ANALYST`, `CRITIC`, `JUDGE`, `SECOND_OPINION`; workflow gom `DISCUSS -> FRAME -> OPTIONS -> CRITIQUE -> VERIFY -> PREPARE`.
- Orchestrator chinh nam o `src/ai/orchestration/decision-orchestrator.ts`: stream SSE, goi agent, merge state, tao decision/blueprint.
- Stage controller nam o `src/domain/decision/workflow-stage.ts`: quyet dinh buoc tiep theo dua tren noi dung, khong chi tang step co hoc.
- Routing theo mode nam o `src/ai/orchestration/execution-plan.ts`: `QUICK`, `STANDARD`, `DEEP`, trong do `VERIFY` la tool-first va `DEEP OPTIONS` chay SecondOpinion.
- Storage co memory/Firestore switch tai `src/infrastructure/repositories/index.ts`.
- UI quyet dinh nam o `src/features/decision-canvas/DecisionCanvas.tsx`: readiness, unknowns, evidence, decision approval, blueprint.

## Van de cot loi

Du an dang giai quyet bai toan: **Lam sao bien mot cuoc tro chuyen voi AI thanh mot quy trinh ra quyet dinh co kiem chung, phan bien, dau vet va phe duyet con nguoi.**

Diem khac biet tot nhat: no khong co lam agent platform tong quat nhu LangGraph/Dify/n8n, ma co gang dong goi decision governance thanh san pham.

## So sanh repo

| Repo | Gan o diem nao | Manh hon du an nay | Yeu hon du an nay |
|---|---|---|---|
| [LangGraph](https://github.com/langchain-ai/langgraph) | Stateful agent workflow, human-in-loop, memory | Durable execution, checkpoint/resume, ecosystem lon | Khong phai san pham decision-specific |
| [Microsoft AutoGen](https://github.com/microsoft/autogen) | Multi-agent conversation, group chat, Studio | Framework lau doi, agent patterns phong phu | AutoGen dang maintenance mode; Studio khong production-ready |
| [CrewAI](https://github.com/crewAIInc/crewAI) | Role-based agents, tasks, crews, flows | API agent orchestration ro, production workflow tot | Khong co Decision Record/evidence gate mac dinh |
| [Deb8flow](https://github.com/iason-solomos/Deb8flow) | Pro/Con debate, moderator, judge, fact-check | Gan nhat ve debate/judge flow, don gian de hoc | It product surface, it persistence/governance |
| [Dify](https://github.com/langgenius/dify) | LLM app platform, agents, tools, RAG, observability | Onboarding, model management, RAG, production platform rat manh | It tap trung vao quyet dinh co phe duyet va audit semantics |
| [n8n](https://github.com/n8n-io/n8n) | Visual AI workflows, tools, human approvals | Tich hop cuc rong, workflow ops truong thanh | Khong chuyen ve multi-agent reasoning/decision quality |
| [Open WebUI](https://github.com/open-webui/open-webui) | Self-hosted multi-model chat UI | Chat UX, deployment, local/open model support | Thieu workflow quyet dinh, evidence/readiness/approval |

## Diem manh

- Co state machine va hard gate tot: AI khong duoc tu dua session sang `DECIDED`; approval phai qua Judge draft va gate.
- Co separation kha sach giua domain, orchestration, provider gateway, repositories, UI.
- Co tu duy evidence-first: assumptions, unknowns, verification status, readiness.
- Co multi-provider strategy: Gemini/Groq/DeepSeek theo vai tro, kem budget.
- Test suite nghiem tuc: transition gate, unknown resolution, workflow, provider fallback, Firestore rules, e2e smoke.

## Diem yeu va rui ro

- Orchestration dang homegrown; so voi LangGraph thieu checkpointing/runtime graph/trace chuan.
- Verify pipeline hien moi manh o calculator/stats; cac loai evidence nhu web/source code/docs da co type nhung chua tu dong hoa tuong xung.
- Observability con mong: co structured log/cost, nhung chua co trace UI kieu LangSmith/Dify/n8n.
- Firestore session update dang merge whole object co the phat sinh race neu nhieu thao tac cap nhat session cung luc.
- UI co Decision Canvas tot nhung van la MVP: review evidence, diff giua agent opinions va audit timeline co the sau hon.
- San pham can dinh vi hep hon; neu goi la "AI chatbot" se thua Open WebUI/Dify, nhung neu goi la "evidence-gated decision OS" thi khac biet ro.

## Khuyen nghi uu tien

1. Dinh vi lai: **AI Decision Lab for auditable product/architecture/business decisions**, khong ban nhu chatbot.
2. Mo rong `VERIFY`: web source, source-code evidence, docs ingestion, citation/provenance chuan.
3. Them trace/audit view: moi run hien thi stage, agent, prompt version, model, evidence, state patch.
4. Chuyen workflow sang event-sourced hoac checkpointed runtime, hoac hoc truc tiep pattern tu LangGraph.
5. Lam Decision Record thanh artifact trung tam: export, compare versions, review triggers, superseding history.
6. Dong goi DomainPack nhu plugin/template de du an co loi the doc nganh.

## Ket luan

Du an manh nhat o phan **governance cua quyet dinh**, khong phai o phan chat hay agent framework. Huong di tot nhat la giu loi hep: bien AI debate thanh decision artifact co bang chung, trang thai, phe duyet, trace va blueprint.

Neu co gang canh tranh voi Dify/Open WebUI ve platform/chat tong quat thi bat loi; neu canh tranh o **decision integrity** thi co cua rat rieng.

## Nguon tham khao web

- LangGraph: https://github.com/langchain-ai/langgraph
- Microsoft AutoGen: https://github.com/microsoft/autogen
- CrewAI: https://github.com/crewAIInc/crewAI
- Deb8flow: https://github.com/iason-solomos/Deb8flow
- Dify: https://github.com/langgenius/dify
- n8n: https://github.com/n8n-io/n8n
- Open WebUI: https://github.com/open-webui/open-webui
