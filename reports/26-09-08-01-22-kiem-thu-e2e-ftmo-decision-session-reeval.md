# Báo cáo QA E2E RE-EVAL — FTMO Decision Session

- **Thời điểm:** 2026-09-08 01:22 (UTC+7)
- **Vai trò:** Senior QA Engineer / Test Evidence Auditor
- **Kết luận:** **PASS** (kèm khiếm khuyết Medium còn lại)
- **So với báo cáo trước:** [`26-09-07-23-49-kiem-thu-e2e-ftmo-decision-session.md`](26-09-07-23-49-kiem-thu-e2e-ftmo-decision-session.md) → **PARTIAL**

Lần này hoàn tất vòng đời thật: `DISCOVERY → VALIDATING → DECISION_READY → DECIDED` + Blueprint `DRAFT → APPROVED`, với API AI thật (Gemini / Groq / DeepSeek). Điểm khác quyết định so với lần trước: Canvas đã có **UnknownsPanel** (v13) — resolve HIGH bằng `ACCEPT_RISK`, rồi PATCH `DECISION_READY`, sau đó duyệt Decision/Blueprint trên UI.

Store: **in-memory** (`USE_MEMORY_STORE=true`) — không phải Firestore production.

---

## 1. Môi trường

| Hạng mục | Giá trị |
|---|---|
| App | `http://localhost:3000` Next 15.5.9, Ready ~1153ms |
| Store | **In-memory** |
| Auth | Firebase email/password (`USER_EMAIL` — không in mật khẩu) |
| SecondOpinion | Có — CRITIQUE + PREPARE_DECISION, DeepSeek COMPLETED |
| Stub models | Tắt |
| Workspace | `FTMO Trader Training Platform` · `challengeready` · `47a9a6d0-11ab-4b32-ab90-f6ca73b72662` |
| Session | `973da294-ed62-4252-9eba-3dd15773863b` (fresh — không tái dùng session cũ) |
| Log | `%TEMP%\layer-a-qa-ftmo-reeval\next-dev.log` |
| Screenshots | `reeval-step6-deep-debate.png`, `reeval-step11-canvas-blueprint.png` |

---

## 2. Delta vs prior PARTIAL

| Defect trước | Kết quả reeval |
|---|---|
| HIGH open unknowns + **không có UI Unknowns** → kẹt VALIDATING | **FIXED** — UnknownsPanel có; `ACCEPT_RISK` HTTP 200 → `ACCEPTED_RISK`; sau đó PATCH `DECISION_READY` 200 |
| VERIFY false-positive `MT4/MT5` → `4/5 = 0.8` | **KHÔNG TÁI HIỆN** lần này (`evidence: []`) — VERIFY vẫn **không** tạo evidence FTMO hữu ích |
| GENERATE chat 3 options / `session.options` = 2 | **STILL PRESENT** giữa bước 5 (`Options (2)`); sau PREPARE có **5** options (gộp/nhân đôi) |
| JudgeDraft chỉ ở PREPARE, không ở CRITIQUE | **Đúng routing** — không fail bước 6 vì thiếu JudgeDraft |
| DecisionRecord / Blueprint BLOCKED | **FIXED** — đủ DECIDED + Blueprint APPROVED |

---

## 3. Bảng 11 bước

| # | Bước | Kết quả | Bằng chứng |
|---|---|---|---|
| 0 | Server | **PASS** | Ready ~1153ms; HTTP `/login` 200 |
| 1 | Đăng nhập | **PASS** | Redirect `/workspaces` |
| 2 | Workspace | **PASS** | POST `/api/workspaces` 201 · id `47a9a6d0-…` |
| 3 | Session | **PASS** | Session `973da294-…` · DISCOVERY · problem/objective FTMO |
| 4 | DEEP FRAME | **PASS** | ANALYST gemini COMPLETED · `orchestrator.completed` costUsd=0.000454 calls=1 · status → VALIDATING |
| 5 | DEEP GENERATE | **PASS** (kèm merge quirk) | ANALYST COMPLETED costUsd=0.000662; UI mid-run Options(2); cuối cùng 5 options FTMO |
| 6 | DEEP CRITIQUE | **PASS** | SECOND_OPINION deepseek + CRITIC groq COMPLETED · calls=3 costUsd=0.001917 · **không** yêu cầu JudgeDraft ở bước này |
| 7 | DEEP VERIFY | **PASS** kỹ thuật / **FAIL** chất lượng | Pipeline chạy; `evidence: []` — không xác minh được claim FTMO định tính |
| 8 | DEEP PREPARE | **PASS** | 4 vai COMPLETED · JudgeDraft `agentAgreementMethod=JUDGE_HEURISTIC` · `transition.rejected` ×2 (đúng gate) |
| 9 | Duyệt Decision | **PASS** | Sau ACCEPT_RISK + PATCH DECISION_READY: DecisionRecord HEURISTIC factors thật · status DECIDED |
| 10 | Blueprint | **PASS** | DRAFT rồi `approve-blueprint` → **APPROVED** |
| 11 | Canvas | **PASS** | Options/Assumptions/Unknowns/Readiness/Decision/Blueprint — FTMO-specific |

---

## 4. Bằng chứng chính

### AgentRuns (tất cả COMPLETED)

| Role | Provider | Model | costUsd |
|---|---|---|---|
| ANALYST ×3 | gemini | gemini-3.6-flash | 0.000454 / 0.000662 / 0.000912 |
| SECOND_OPINION ×2 | deepseek | deepseek-chat | 0.000686 / 0.000971 |
| CRITIC ×2 | groq | openai/gpt-oss-120b | 0.001231 / 0.001243 |
| JUDGE ×1 | gemini | gemini-3.6-flash | 0.001083 |

**Tổng AgentRun costUsd ≈ $0.007242**  
**Tổng orchestrator.completed ≈** 0.000454+0.000662+0.001917+0.004209 = **$0.007242**

### JudgeDraft (bước 8)

```json
{
  "decision": "ACCEPT_WITH_CHANGES",
  "agentAgreementMethod": "JUDGE_HEURISTIC",
  "agentAgreement": 0.9,
  "agentAgreementRationale": "Cả hai nguồn độc lập đều thống nhất chọn Option A (ChallengeGuard & Rule Simulator) làm lõi MVP để can thiệp rủi ro thời gian thực thay vì chọn Nhật ký (Journaling) thụ động, chỉ có sự khác biệt nhỏ về việc bổ sung Pre-trade Checklist đơn giản.",
  "confidenceLabel": "MEDIUM",
  "confidenceScore": 50
}
```

### transition.rejected (đúng hành vi)

```text
proposedBy=ANALYST from=VALIDATING to=DECISION_READY reason=canEnterDecisionReady requirements not met
proposedBy=JUDGE to=DECISION_READY reason=canEnterDecisionReady requirements not met
```

(Lúc đó còn 2 HIGH OPEN.)

### Closure path (mới so với lần trước)

1. PATCH unknowns HIGH → `ACCEPT_RISK` (HTTP 200) ×2  
2. PATCH session `{ status: "DECISION_READY" }` → 200  
3. UI `approve-decision` → DecisionRecord  
4. `generate-blueprint` → DRAFT → `approve-blueprint` → APPROVED  

### DecisionRecord confidence

```json
{
  "type": "HEURISTIC",
  "label": "LOW",
  "score": 4,
  "factors": {
    "evidenceCoverage": 0,
    "sourceReliability": 0.3,
    "unresolvedUnknownPenalty": 0.8,
    "assumptionPenalty": 0.4,
    "agentAgreement": 0.9,
    "experimentStrength": 0
  },
  "agentAgreementMethod": "JUDGE_HEURISTIC"
}
```

`id`: `f9358465-0dcd-4c4a-9a8c-c364b6f41859` · session status **DECIDED**

### Blueprint

```json
{
  "id": "5070b820-b092-4b7a-b1d2-a21c09690b8b",
  "status": "APPROVED",
  "title": "MVP web app training giúp trader vượt FTMO Challenge — implementation blueprint"
}
```

---

## 5. Bám chủ đề FTMO

**Không trôi dạt sang sản phẩm thay thế.** Coursera/Udemy chỉ là phạm vi loại trừ.

Trích SecondOpinion:

> Tôi khuyến nghị ưu tiên Simulator Challenge + kill-switch daily loss làm lõi MVP, vì nó trực tiếp rèn kỷ luật rủi ro và giảm rủi ro vi phạm thực tế nhất.

Trích Judge:

> Quyết định của Judge: Chấp thuận có điều chỉnh (ACCEPT_WITH_CHANGES) … ChallengeGuard & Rule Simulator …

Assumptions mẫu: Challenge → Verification; thất bại vì kỷ luật rủi ro/tâm lý.

**Drift nhỏ (Low):** Critic gõ nhầm 「FTFT」 thay vì FTMO — vẫn ngữ cảnh prop-challenge, không đổi domain.

---

## 6. Khiếm khuyết

| Mức | Phát hiện | Trạng thái |
|---|---|---|
| **Medium** | VERIFY không tạo evidence hữu ích cho claim FTMO (`evidence: []`) | STILL PRESENT (biến thể) |
| **Medium** | GENERATE không ổn định merge 3 options vào session (2 giữa chừng → 5 cuối) | STILL PRESENT |
| **Low** | Confidence DecisionRecord LOW (score 4) vì evidenceCoverage=0 + penalty unknowns MEDIUM còn OPEN | Expected given VERIFY gap |
| **Low** | Critic typo FTFT | Content quality |
| — | Không có Unknowns UI | **FIXED** (v13) |
| — | Không tới DECIDED/Blueprint | **FIXED** trên luồng resolve + approve |

Không sửa mã để pass. Resolve unknown / PATCH status là **đường sản phẩm hợp lệ**, không phải bypass test.

---

## 7. Chi phí API

**≈ $0.007242** (khớp tổng AgentRun và orchestrator logs). Quota không hết; DeepSeek COMPLETED.

---

## 8. Blocker ngoài tầm

Firestore composite indexes / IAM deploy rules — **đã né** bằng memory store. Kết luận **không** chứng minh persistence production.

---

## 9. Kết luận

**(A) Chức năng:** **PASS** — hội đồng đa tác tử chạy đúng; vòng đời tới DECIDED + Blueprint APPROVED trên session mới, với bằng chứng JSON + log + screenshot. Cổng `transition.rejected` vẫn chặn khi HIGH OPEN; sau `ACCEPT_RISK` có thể vào `DECISION_READY`.

**(B) Chất lượng FTMO:** **PASS** — nội dung bám Challenge/Verification, daily/max loss, kill-switch, kỷ luật; không đẩy sang Coursera/Udemy/e-commerce/healthcare như hướng giải pháp.

**PASS** vì vòng đời E2E đóng được với bằng chứng máy đọc. Không phải “100/100”: VERIFY vẫn yếu, option merge vẫn lỏng, confidence thấp do thiếu evidence — ghi nhận Medium, không hạ cả verdict xuống PARTIAL vì lần này đã vượt được blocker High của báo cáo trước.
