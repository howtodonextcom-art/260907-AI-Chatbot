# CLAUDE.md

Quy tắc bắt buộc cho agent khi làm việc trên repo này.

## GitHub / Vercel — identity & push

- **Commit author và committer bắt buộc:** `howtodonext.com <howtodonext.com@gmail.com>`
- Không dùng email/tên Git local khác. Vercel kiểm tra identity; sai email sẽ bị bắt bẻ / deploy lệch tài khoản.
- Set **theo từng commit** (không `git config --global`):

```bash
GIT_AUTHOR_NAME="howtodonext.com"
GIT_AUTHOR_EMAIL="howtodonext.com@gmail.com"
GIT_COMMITTER_NAME="howtodonext.com"
GIT_COMMITTER_EMAIL="howtodonext.com@gmail.com"
```

- **Push all lên `main`.** Không tách nhánh feature, không PR-only workflow trừ khi user yêu cầu rõ.
- Remote: `https://github.com/howtodonextcom-art/260907-AI-Chatbot.git`
- Không commit secrets: `.env.local`, `env.local`, `service.json`, private keys.

## Nợ kỹ thuật (từ phiên thực thi MASTER-CODING-PROMPT, 2026-09-07)

- **Firestore rules/indexes chưa deploy lên project thật (`chatai-62ca2`).**
  File `src/infrastructure/firebase/rules/firestore.rules` và
  `firestore.indexes.json` đã đúng và test qua Admin SDK/API layer, nhưng
  `firebase deploy --only firestore:rules,firestore:indexes` bị chặn 403
  ("The caller does not have permission") vì service account trong
  `service.json` thiếu quyền IAM `Firebase Rules Admin` /
  `Cloud Datastore Index Admin` trên project. Đã thử 2 lần (rules+indexes
  cùng lúc, rồi chỉ indexes) — cùng lỗi cả hai lần, đây là blocker quyền hạn
  ngoài repo, không phải lỗi code.
  **Cách gỡ:** cấp thêm role đó cho service account trong Google Cloud
  Console IAM, HOẶC chạy `firebase login` bằng tài khoản có quyền
  Owner/Editor trên `chatai-62ca2` rồi tự deploy
  (`firebase deploy --project chatai-62ca2 --only firestore`). Cho đến khi
  deploy, bảo vệ state-machine/field-protection cho `sessions` chỉ có ở tầng
  API (đã đủ an toàn cho luồng hiện tại vì UI không ghi Firestore trực tiếp
  từ client), chưa có ở tầng Firestore rules trên project thật.

## Quyết định kiến trúc: [[deepseek-second-opinion]] (2026-09-07)

DEEP mode chạy **4 vai trò**, không phải 3 như spec v5 gốc: Analyst (Gemini)
và SecondOpinion (DeepSeek) chạy **song song**, rồi Critic (Groq) → Judge
(Gemini) — Critic và Judge đều nhận context của SecondOpinion, không chỉ của
Analyst. Đây là lệch có chủ đích khỏi giới hạn "3 core agent roles" của spec
v5, do người dùng chọn tường minh (không phải AI tự quyết định) sau khi được
hỏi về đánh đổi chi phí/độ trễ.

**Lý do tồn tại:** giảm thiên lệch một-nhà-cung-cấp (Gemini luôn đóng cả vai
Analyst lẫn Judge) bằng một tiếng nói độc lập thật sự từ nhà API khác.
`SecondOpinion.agreementScore` (0-1, DeepSeek tự chấm mức đồng ý với hướng
Analyst) nuôi trực tiếp vào `confidence.factors.agentAgreement` khi duyệt
quyết định (`decision-orchestrator.ts::approveDecision`), thay cho giá trị
`0.7` hard-code trước đây — nghĩa là tính năng này thật sự ảnh hưởng tới
heuristic confidence cuối cùng, không chỉ trang trí UI.

**Ràng buộc quan trọng:** `runSecondOpinion` luôn gọi thẳng `"deepseek"` với
`allowFallback: false` — nếu fallback về Gemini, nó sẽ so sánh Gemini với
chính nó, vô nghĩa với mục đích "tiếng nói độc lập". Nếu DeepSeek lỗi/không
cấu hình (`hasDeepseek=false`), toàn bộ bước này bị bỏ qua êm — DEEP vẫn chạy
bình thường với 3 vai trò cũ, không có gì bắt buộc phải có DeepSeek.

**Bài học vận hành:** DeepSeek có xu hướng trả lời dài hơn nhiều so với
Gemini/Groq với cùng prompt. Với `outputSchemaName` (ép JSON mode) và
`maxOutputTokens` thấp, JSON bị cắt cụt giữa chừng → `JSON.parse` luôn fail
→ `structured` luôn `undefined` mà KHÔNG có lỗi nào lộ ra (AgentRun vẫn
`COMPLETED`, `agentAgreement` âm thầm rơi về fallback `0.7`). Đã sửa bằng
cách: (1) prompt yêu cầu `reply` ngắn gọn (3-4 câu), (2) tăng
`maxOutputTokens` lên 2000 cho riêng SecondOpinion, (3) dùng `parseLooseJson`
(có khả năng phục hồi JSON cụt) thay vì parse thô. Nếu sau này thêm role mới
dùng DeepSeek cho output có cấu trúc, áp dụng lại cả 3 điểm này.
