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
