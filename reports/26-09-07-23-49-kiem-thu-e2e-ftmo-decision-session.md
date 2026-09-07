# Báo cáo QA E2E — FTMO Decision Session

- **Thời điểm:** 2026-09-07 23:49 (UTC+7)
- **Vai trò:** Senior QA Engineer / Test Evidence Auditor
- **Kết luận:** **PARTIAL**

Hội đồng đa tác tử (Gemini / Groq / DeepSeek) chạy thật end-to-end tới JudgeDraft, nội dung bám FTMO. Vòng đời **không** tới DECIDED/Blueprint vì session bị kẹt VALIDATING: 2 unknown HIGH còn OPEN, canvas không cho đóng unknown, nút duyệt không hiện, API duyệt trả 409.

Đây **không** phải Firestore production. Store: **in-memory** (`USE_MEMORY_STORE=true` khi start `next dev`). Messages/runs/decision/blueprint trả 200 — đúng kỳ vọng khi tránh blocker index IAM trên `chatai-62ca2`.

Hai câu hỏi:

- **(A) Chức năng:** luồng quyết định đa tác tử có chạy đúng end-to-end không?
- **(B) Chất lượng nội dung:** AI có bám đúng bối cảnh FTMO không, hay trôi dạt sang lĩnh vực/app khác?

---

## 1. Môi trường đã dùng

| Hạng mục | Giá trị |
|---|---|
| App | Layer A AI Decision Lab, `http://localhost:3000` (Next 15.5.9, Ready ~1165ms) |
| Store | **In-memory** — không phải Firestore production |
| Auth | Firebase email/password từ `USER_EMAIL` / `USER_PASSWORD` (không in mật khẩu) |
| SecondOpinion | Có — `ENABLE_SECOND_OPINION=true`, DeepSeek đã cấu hình, chạy ở CRITIQUE và PREPARE_DECISION |
| Stub models | Tắt (`USE_STUB_MODELS=false`) |
| Workspace | `FTMO Trader Training Platform` · pack `challengeready` · id `47a672b2-b178-40e4-9484-5573d43a4aa8` |
| Session | `93cd97e1-9cf0-4886-be8a-812b744556bd` |
| Log server | `%TEMP%\layer-a-qa-ftmo\next-dev.log` (ngoài repo, tránh Fast Refresh) |
| Driver | Playwright MCP (network JSON) + Chrome DevTools MCP (lock/screenshot cùng session in-memory) |
| Textarea | Native setter + `input` event — không dùng fill React (quirk controlled textarea) |

Không sửa mã nguồn để test dễ pass. Không in secrets.

---

## 2. Bảng kết quả 11 bước

| # | Bước | Kết quả | Bằng chứng máy đọc |
|---|---|---|---|
| 0 | Khởi động server | **PASS** | `next-dev.log`: Ready ~1165ms; app phục vụ `/login` |
| 1 | Đăng nhập | **PASS** | Redirect `/workspaces`; workspace list rỗng (store mới) |
| 2 | Tạo Workspace | **PASS** | POST `/api/workspaces` **201** — `name: "FTMO Trader Training Platform"`, `defaultDomainPackId: "challengeready"` |
| 3 | Tạo Session | **PASS** | POST sessions **201** — `status: "DISCOVERY"`, problem/objective FTMO |
| 4 | DEEP + Định khung | **PASS** | AgentRun ANALYST `gemini`/`gemini-3.6-flash` **COMPLETED**; session → **VALIDATING**; 2 options + 2 assumptions FTMO |
| 5 | DEEP + Sinh phương án | **PASS** (kèm khiếm khuyết persist) | ANALYST Gemini COMPLETED; chat nêu 3 MVP FTMO; **API vẫn 2 options** tới trước PREPARE |
| 6 | DEEP + Phản biện | **PASS** | SECOND_OPINION `deepseek`/`deepseek-chat` + CRITIC `groq`/`openai/gpt-oss-120b` COMPLETED. Judge **không** chạy ở CRITIQUE (đúng routing). `judgeDraft` xuất hiện ở bước 8 |
| 7 | DEEP + Xác minh | **PASS** kỹ thuật / **FAIL** chất lượng evidence | VERIFY tools 382ms; evidence `4/5 = 0.8` VERIFIED — false positive từ `MT4/MT5` |
| 8 | DEEP + Chuẩn bị quyết định | **PASS** (cổng trạng thái chặn đúng) | 4 vai: Analyst Gemini, SO DeepSeek, Critic Groq, Judge Gemini — đều COMPLETED. `judgeDraft.agentAgreementMethod = "JUDGE_HEURISTIC"`. `transition.rejected` ×2 |
| 9 | Duyệt quyết định | **BLOCKED** | `approve-decision` không render (`status !== DECISION_READY`). POST `/decision` **409** `Session must be DECISION_READY`. `decision: null` |
| 10 | Blueprint DRAFT→APPROVED | **BLOCKED** | `generate-blueprint` không render; GET blueprint `null` — không có DecisionRecord |
| 11 | Decision Canvas | **PARTIAL** | Options/Assumptions/state có và đặc thù FTMO; **không có section Unknowns** dù JSON có 3 unknowns |

---

## 3. Bằng chứng chính (payload trích dẫn)

### 3.1 Workspace 201

```json
{
  "workspace": {
    "name": "FTMO Trader Training Platform",
    "defaultDomainPackId": "challengeready",
    "status": "ACTIVE",
    "id": "47a672b2-b178-40e4-9484-5573d43a4aa8"
  }
}
```

### 3.2 Session sau tạo (DISCOVERY)

- `id`: `93cd97e1-9cf0-4886-be8a-812b744556bd`
- `title`: `MVP web app training giúp trader vượt FTMO Challenge`
- `status`: `DISCOVERY`
- `domainPackId`: `challengeready`
- Problem: xây web app training giúp trader chuẩn bị và vượt qua FTMO Challenge, tập trung kỷ luật quản trị rủi ro (giới hạn thua lỗ hàng ngày, thua lỗ tổng, mục tiêu lợi nhuận theo giai đoạn Challenge → Verification).
- Objective: chốt phạm vi MVP — tính năng bắt buộc để luyện kỷ luật rủi ro trước Challenge, tính năng cắt bỏ khỏi MVP.

### 3.3 AgentRun (toàn phiên, tất cả COMPLETED)

| Role | Provider | Model | costUsd |
|---|---|---|---|
| ANALYST ×3 | gemini | gemini-3.6-flash | 0.00052 / 0.00077 / 0.000856 |
| SECOND_OPINION ×2 | deepseek | deepseek-chat | 0.000732 / 0.00094 |
| CRITIC ×2 | groq | openai/gpt-oss-120b | 0.000998 / 0.001093 |
| JUDGE ×1 | gemini | gemini-3.6-flash | 0.000819 |

Provider khác nhau thật: Gemini ≠ Groq ≠ DeepSeek. Analyst và Judge cùng nhà Gemini — đúng thiết kế hiện tại.

### 3.4 VERIFY evidence (sai ngữ nghĩa)

```json
{
  "type": "CALCULATION",
  "claim": "4/5 = 0.8",
  "source": "calculator.evaluate",
  "verificationStatus": "VERIFIED",
  "supportsUnknownIds": ["3c0052d5-9b8c-48fa-98f2-178722f3ceb9"],
  "metadata": { "expression": "4/5", "value": 0.8 }
}
```

Unknown đó hỏi upload MT4/MT5 vs API — regex `ARITHMETIC_RE` nuốt `MT4/MT5` thành phép chia. Giả định FTMO định tính vẫn UNVERIFIED.

### 3.5 judgeDraft sau PREPARE

```json
{
  "runId": "96d32493-08dc-4fe2-b449-6d984da0fb7c",
  "decision": "ACCEPT_WITH_CHANGES",
  "agentAgreement": 0.6,
  "agentAgreementMethod": "JUDGE_HEURISTIC",
  "agentAgreementRationale": "Cả hai bên đều đồng thuận việc tập trung vào quy tắc FTMO và cơ chế Kill-switch để chặn vi phạm Daily Loss, nhưng khác biệt ở chỗ Second Opinion muốn đưa Journal vào ngay MVP trong khi Analyst đề xuất lùi Journal sang giai đoạn sau để giữ phạm vi MVP gọn nhẹ.",
  "confidenceLabel": "MEDIUM",
  "confidenceScore": 50,
  "unresolvedUnknownIds": [
    "dce91454-8406-4692-bc93-a892919b31bb",
    "beaca77c-34bd-4599-9a6e-0521f39be246"
  ]
}
```

`confidence.factors` **chưa** có trên DecisionRecord — record không được tạo. Factors chỉ được tính trong `approveDecision()` sau khi qua HardPolicyGate.

### 3.6 Approve bị chặn

```json
{
  "code": "SESSION_INVALID_STATE",
  "message": "Session must be DECISION_READY",
  "retryable": false,
  "requestId": "4dc8b129-4014-4b81-b591-339e44baac1f"
}
```

HTTP 409. GET sau đó: `status: "VALIDATING"`, `decision: null`, `blueprint: null`, `unknownOpenHigh: 2`.

### 3.7 Log server

```text
orchestrator.completed costUsd=0.00052 calls=1   (FRAME)
orchestrator.completed costUsd=0.00077 calls=1   (GENERATE)
orchestrator.completed costUsd=0.00173 calls=3   (CRITIQUE)
transition.rejected proposedBy=ANALYST from=VALIDATING to=DECISION_READY reason=canEnterDecisionReady requirements not met
transition.rejected proposedBy=JUDGE to=DECISION_READY reason=canEnterDecisionReady requirements not met
orchestrator.completed costUsd=0.003708 calls=6  (PREPARE)
```

Cổng `canEnterDecisionReady` yêu cầu `highPriorityOpenUnknowns === 0`. Session còn 2 unknown HIGH OPEN về luật FTMO — chặn là đúng (P0-01), không phải bypass.

### 3.8 Ảnh chụp

- Playwright: `%USERPROFILE%\step4-frame-after-debate.png`, `step6-deep-debate.png`, `step8-canvas.png`
- Chrome DevTools: `step11-chrome-canvas.png` (temp Cursor screenshots)

---

## 4. Đánh giá bám chủ đề FTMO

**Không trôi dạt sang sản phẩm/lĩnh vực khác.** Coursera/Udemy, e-commerce, healthcare, crypto chỉ xuất hiện như **phạm vi loại trừ**, không phải phương án thay thế.

Trích Analyst (FRAME):

> Đã định khung bài toán cho sản phẩm Web App Training giúp trader chuẩn bị vượt FTMO Challenge. Định hướng sản phẩm tập trung vào luyện tập kỷ luật rủi ro, tâm lý và tuân thủ quy tắc của FTMO (giai đoạn Challenge → Verification), tuyệt đối không cung cấp tín hiệu giao dịch hay cam kết đỗ.

Trích SecondOpinion (CRITIQUE, DeepSeek):

> Tôi ủng hộ phương án MVP kết hợp ChallengeGuard & Behavioral Journal, nhưng cần thận trọng: mô phỏng luật FTMO sai có thể gây hiểu lầm và rủi ro pháp lý/thương hiệu… Để giảm rủi ro trader vẫn vi phạm max daily loss, nên thêm kill-switch tự động trong mô phỏng…

Trích Judge:

> Chấp nhận có điều chỉnh (ACCEPT_WITH_CHANGES) đối với phương án tập trung vào Simulator ChallengeGuard với cơ chế cảnh báo & ngắt giao dịch mô phỏng (Kill-switch)… gắn nhãn UNVERIFIED cho các giả định về quy tắc FTMO chi tiết và tỷ lệ trượt do kỷ luật.

`agentAgreementRationale` nêu đúng điểm đồng (FTMO rules + kill-switch / Daily Loss) và bất đồng (Journal trong MVP vs Phase 2) — không phải câu chung chung.

Ghi nhận nhỏ: Critic gõ nhầm **「hợp đồng FTFTM」** — vẫn trong ngữ cảnh FTMO, không phải drift.

Options/Assumptions sinh ra đặc thù FTMO (ChallengeGuard, Daily Max Loss, revenge trading, kill-switch, Challenge → Verification), không phải mẫu chung “app học trực tuyến”.

---

## 5. Khiếm khuyết phát hiện

Không vá mã để test pass.

| Mức | Phát hiện |
|---|---|
| **High** | Vòng đời kẹt VALIDATING: unknown HIGH OPEN (đúng với giả định chưa kiểm chứng) nhưng Canvas **không có UI Unknowns** để resolve → `approve-decision` không hiện; không tới DECIDED/Blueprint trên luồng người dùng. |
| **Medium** | VERIFY calculator: `MT4/MT5` → evidence `4/5 = 0.8` gắn `VERIFIED` / HIGH. Giả định FTMO định tính vẫn UNVERIFIED — pipeline không xác minh luật Challenge. |
| **Medium** | GENERATE_OPTIONS viết 3 phương án trên chat nhưng **không merge** vào `session.options` (vẫn 2). Option 3–4 chỉ xuất hiện sau PREPARE. |
| **Low** | `judgeDraft` đã có trong JSON nhưng Canvas vẫn hiện “Chạy DEEP + PREPARE_DECISION…” vì UI đòi `status === DECISION_READY`. |
| **Low** | Assumptions bị nhân đôi sau PREPARE (cùng nội dung FTMO, id khác). |
| **Low** | `constraints: []` suốt phiên dù Analyst nói ràng buộc FTMO. |
| **Low** | UI cost lúc snapshot Playwright `~$0.0104` vs tổng `AgentRun.costUsd` **$0.006728** (Chrome sau reload khớp ~$0.0067). |

`transition.rejected` **không** phải lỗi — đây là hành vi P0-01 đúng.

Tiêu chí “bước 6 phải có `judgeDraft.agentAgreementMethod = JUDGE_HEURISTIC`” **lệch routing hiện tại**: CRITIQUE chỉ chạy Critic + SecondOpinion. Field đó xuất hiện đúng ở bước 8 (PREPARE_DECISION).

---

## 6. Chi phí API thật đã tiêu

- Tổng `AgentRun.costUsd` = **$0.006728**
- Tổng `orchestrator.completed.costUsd` = 0.00052 + 0.00077 + 0.00173 + 0.003708 = **$0.006728**
- VERIFY không gọi LLM (0 USD)
- Quota không hết; DeepSeek COMPLETED (không phải blocker provider)

---

## 7. Blocker ngoài tầm kiểm soát

1. Firestore production thiếu composite indexes / IAM 403 khi deploy rules — **đã né** bằng memory store; kết luận này **không** chứng minh persistence production.
2. Không có cách UI để đóng unknown HIGH — blocker **trong sản phẩm**, không phải quota/DeepSeek.

---

## 8. Kết luận

**PARTIAL.**

- **(A)** Hội đồng đa tác tử chạy thật: FRAME/GENERATE = Gemini Analyst; CRITIQUE = DeepSeek + Groq; PREPARE = đủ 4 vai, provider khác nhau, `status=COMPLETED`. Cổng trạng thái chặn DECISION_READY khi unknown HIGH còn mở. **Không** hoàn tất DISCOVERY → DECIDED → Blueprint.
- **(B)** Nội dung bám Challenge/Verification, daily/max loss, kỷ luật/tâm lý, kill-switch, disclaimer không phải sản phẩm FTMO chính thức. Không đẩy sang Coursera/Udemy/e-commerce/healthcare như hướng giải pháp.

Lý do không PASS: vòng đời quyết định + Blueprint không đóng được trên luồng thật vì unknown HIGH OPEN + thiếu UI resolve + VERIFY không xác minh được claim FTMO.
