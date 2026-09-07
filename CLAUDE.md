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

## Đặt tên artifact trong `reports/`

Khi ghi báo cáo QA, audit, hoặc artifact vận hành tương tự vào thư mục `reports/`, dùng đúng pattern:

```text
yy-mm-dd-HH-mm-ten-tinh-nang.md
```

- **yy-mm-dd**: năm 2 chữ số, tháng, ngày
- **HH-mm**: giờ 24h và phút theo giờ máy người vận hành (**UTC+7** trừ khi ghi chú khác)
- **ten-tinh-nang**: slug kebab-case ASCII thường, không khoảng trắng, không secrets trong tên
- **Ví dụ chuẩn:** `26-09-07-23-49-kiem-thu-e2e-ftmo-decision-session.md`
- Chỉ áp dụng cho artifact mới trong `reports/`. File cũ dạng marketing title (vd. `FINAL-VERIFIED-100-AUDIT-v10.md`) có thể giữ nguyên — không dùng làm pattern canonical về sau.

## Nợ kỹ thuật (từ phiên thực thi MASTER-CODING-PROMPT, 2026-09-07)

- **Firestore rules/indexes chưa deploy lên project thật (`chatai-62ca2`).**
  File `src/infrastructure/firebase/rules/firestore.rules` và
  `firestore.indexes.json` đã đúng — bao gồm fix P0-03 (bất biến `ownerId`
  trên `workspaces`) — và được test thật qua Firestore Emulator
  (`pnpm test:rules`, xem [[firestore-rules-testing]]), không chỉ qua
  Admin SDK/API layer. Nhưng
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
  deploy, bảo vệ state-machine/field-protection cho `sessions` và bất biến
  `ownerId` cho `workspaces` chỉ có hiệu lực thật ở tầng API + emulator test
  (đã đủ an toàn cho luồng hiện tại vì UI không ghi Firestore trực tiếp từ
  client), CHƯA có hiệu lực ở tầng Firestore rules trên project thật —
  nghĩa là nếu có ai ghi thẳng vào Firestore production (bỏ qua API), rules
  cũ (không có bất biến `ownerId`) vẫn đang chạy ở đó cho tới khi deploy.

- **`@firebase/rules-unit-testing` ghim ở v4.0.1, không phải bản mới nhất
  (v5.0.2).** Bản v5 yêu cầu peer dep `firebase@^12.0.0`, nhưng repo đang ở
  `firebase@^11.10.0` — nâng cấp `firebase` lên v12 ngoài phạm vi các P0 đang
  sửa nên không tự ý làm. v4.0.1 tương thích đúng peer dep hiện tại và toàn
  bộ 14 rules test đều chạy thật qua emulator, không phải vấn đề chức năng —
  chỉ là nợ version cần cân nhắc khi nâng cấp `firebase` sau này.

- **`next@15.5.9`** is the patched 15.5.x line addressing CVE-2025-55184 / 55183 / 67779
  (advisory https://nextjs.org/blog/security-update-2025-12-11). Stay on 15.5.x
  unless a dedicated Next 16 migration is scheduled. Previous `15.5.7` warning
  is resolved in-repo; production Vercel deploy still needs a push to `main`.

## Quyết định kiến trúc: [[deepseek-second-opinion]] (2026-09-07)

DEEP mode chạy **4 vai trò**, không phải 3 như spec v5 gốc: Analyst (Gemini)
và SecondOpinion (DeepSeek) chạy **song song**, rồi Critic (Groq) → Judge
(Gemini) — Critic và Judge đều nhận context của SecondOpinion, không chỉ của
Analyst. Đây là lệch có chủ đích khỏi giới hạn "3 core agent roles" của spec
v5, do người dùng chọn tường minh (không phải AI tự quyết định) sau khi được
hỏi về đánh đổi chi phí/độ trễ.

**Lý do tồn tại:** giảm thiên lệch một-nhà-cung-cấp (Gemini luôn đóng cả vai
Analyst lẫn Judge) bằng một tiếng nói độc lập thật sự từ nhà API khác.
Agreement giữa SecondOpinion và Analyst được đưa vào
`confidence.factors.agentAgreement` khi duyệt quyết định
(`decision-orchestrator.ts::approveDecision`) — nghĩa là tính năng này thật
sự ảnh hưởng tới heuristic confidence cuối cùng, không chỉ trang trí UI.
**Lưu ý:** cơ chế tính `agentAgreement` đã đổi hoàn toàn kể từ fix P0-02 —
xem [[second-opinion-agreement-semantics]]. SecondOpinion KHÔNG còn tự chấm
điểm đồng ý (field `agreementScore` đã bị xoá khỏi schema).

**Ràng buộc quan trọng:** `runSecondOpinion` luôn gọi thẳng `"deepseek"` với
`allowFallback: false` — nếu fallback về Gemini, nó sẽ so sánh Gemini với
chính nó, vô nghĩa với mục đích "tiếng nói độc lập". SecondOpinion is
**conditional** (`ENABLE_SECOND_OPINION`, CRITIQUE/PREPARE_DECISION, DeepSeek
configured) — not every DEEP intent. Nếu DeepSeek lỗi/không
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

## Fix bảo mật: [[transition-gate-unification]] — P0-01 (2026-09-07)

**Lỗ hổng:** `applyAnalystState()` trong `decision-orchestrator.ts` từng áp
dụng `structured.suggestedStatus` (một field do LLM Analyst tự sinh ra, có
thể bị prompt injection thao túng) trực tiếp bằng `canTransition()` — hàm
này CHỈ kiểm tra cạnh chuyển trạng thái có hợp lệ về mặt cấu trúc (vd.
`DISCOVERY → VALIDATING` là cạnh hợp lệ), KHÔNG kiểm tra các điều kiện nội
dung (`canEnterValidating`, `canEnterDecisionReady`). Nghĩa là Analyst có
thể tự đề xuất `suggestedStatus: "DECISION_READY"` ngay cả khi session chưa
có option/assumption nào, và session sẽ bị đẩy thẳng vào DECISION_READY —
bỏ qua toàn bộ gate nội dung, dù API PATCH (`route.ts`) vẫn kiểm tra gate
đầy đủ khi CLIENT gọi trực tiếp.

**Fix:** tạo duy nhất MỘT hàm thẩm quyền chuyển trạng thái —
`gateStatusTransition()` trong `state-machine.ts` — bọc `canTransition` +
`canEnterValidating` + `canEnterDecisionReady` + chặn cứng `DECIDED` (chỉ
`approveDecision()` sau `HardPolicyGate` mới được gán `DECIDED`). Cả 3 nơi
từng tự ý quyết định chuyển trạng thái (Analyst-suggested trong
orchestrator, Judge-triggered trong orchestrator, client PATCH trong
`route.ts`) giờ đều gọi qua đúng MỘT hàm này — không còn đường tắt nào.

**Test:** `src/tests/unit/transition-gate.test.ts` (9 test) — cố tình mô
phỏng Analyst gửi `suggestedStatus=DECISION_READY` khi thiếu điều kiện,
xác nhận bị từ chối và log `transition.rejected`; xác nhận vẫn cho qua khi
điều kiện thật sự đủ.

## Fix bảo mật: [[second-opinion-agreement-semantics]] — P0-02 (2026-09-07)

**Lỗ hổng ngữ nghĩa:** `SecondOpinion` (DeepSeek) chạy SONG SONG với
Analyst — theo thiết kế, nó không hề thấy output của Analyst khi tạo ra
câu trả lời của chính nó. Nhưng schema cũ yêu cầu nó tự báo cáo
`agreesWithAnalyst`/`agreementScore` — một con số nó KHÔNG THỂ tính đúng vì
chưa từng đọc thứ nó được yêu cầu so sánh. Giá trị này sau đó nuôi thẳng
vào `confidence.factors.agentAgreement`, nghĩa là decision confidence cuối
cùng dựa một phần vào một con số về mặt logic là vô nghĩa.

**Fix:** xoá `agreesWithAnalyst`/`agreementScore` khỏi
`SecondOpinionOutputSchema` — SecondOpinion giờ chỉ báo cáo nhận định độc
lập của chính nó (`recommendedDirection`, `preferredOptionTitle`,
`keyAssumptions`, `divergentRisks`). Judge — agent DUY NHẤT thực sự nhìn
thấy cả output Analyst lẫn SecondOpinion — giờ chịu trách nhiệm đánh giá
mức đồng thuận qua field mới `JudgeOutputSchema.secondOpinionAgreement`
(label LOW/MEDIUM/HIGH + rationale), bỏ qua hoàn toàn nếu không có
SecondOpinion trong lượt chạy đó (không đoán bừa). Hàm thuần
`deriveAgentAgreement()` (exported từ `decision-orchestrator.ts`) chuyển
label → số (`AGREEMENT_LABEL_TO_SCORE`) và gắn `agentAgreementMethod:
"JUDGE_HEURISTIC" | "UNAVAILABLE"` để phân biệt "được suy luận thật" với
"không có dữ liệu" — không còn giá trị `0.7` hard-code ngụy trang thành dữ
liệu thật.

**Test:** `src/tests/unit/second-opinion.test.ts` (16 test) — bao phủ:
schema mới không còn field cũ, `JudgeOutputSchema.secondOpinionAgreement`
hợp lệ ở cả 2 nhãn LOW/HIGH và bị từ chối khi label sai, `deriveAgentAgreement`
cho 5 tình huống (đồng thuận cao, đồng thuận thấp, không có second opinion,
second opinion lỗi/không chạy, Judge structured parse thất bại) đều trả về
đúng `agentAgreementMethod`.

## Fix bảo mật: workspace ownerId immutability — P0-03 (2026-09-07)

**Lỗ hổng:** rule Firestore cho `workspaces/{workspaceId}` chỉ có
`allow read, update: if isOwner(resource.data.ownerId)` — kiểm tra owner
HIỆN TẠI được phép ghi, nhưng không kiểm tra `ownerId` sau khi ghi có đổi
hay không. Một client ghi thẳng Firestore (bỏ qua API) có thể tự đổi
`ownerId` của workspace mình đang sở hữu sang uid khác — về lý thuyết là
một đường "chuyển nhượng"/hijack workspace không qua kiểm soát nào.
Sub-collection `sessions` đã có bất biến này từ trước (dòng
`request.resource.data.ownerId == resource.data.ownerId`), nhưng
`workspaces` ở cấp cha thì chưa.

**Fix:** thêm đúng bất biến đó vào rule `update` của `workspaces` —
xem `src/infrastructure/firebase/rules/firestore.rules`.

**Verify (không chỉ tin, đã kiểm tra thật):** viết
`src/tests/rules/firestore.rules.test.ts` (14 test, chạy qua Firestore
Emulator thật — `pnpm test:rules`, xem [[firestore-rules-testing]]) rồi cố
tình revert fix để xác nhận ĐÚNG MỘT test đó fail (không phải test tự pass
vô nghĩa) — sau đó khôi phục fix và xác nhận cả 14 test xanh trở lại. Nợ
deploy rules lên production vẫn còn (xem mục Nợ kỹ thuật — IAM blocker).

## Hạ tầng test: [[firestore-rules-testing]] (2026-09-07)

`pnpm test:rules` chạy `firebase emulators:exec --only firestore` bọc
`vitest run --config vitest.rules.config.ts` — spin lên Firestore Emulator
thật (port 8080, cấu hình ở `firebase.json`), nạp đúng file
`firestore.rules` đang dùng, rồi chạy test dùng
`@firebase/rules-unit-testing` (`initializeTestEnvironment`,
`assertSucceeds`/`assertFails`, `withSecurityRulesDisabled` để seed dữ liệu
test bỏ qua rules). Tách khỏi `pnpm test` (vitest.config.ts chỉ include
`src/tests/unit` + `src/tests/integration`) vì cần một process emulator
thật, không chỉ Node — không nên bắt buộc mọi lần chạy `pnpm test` phải có
Java/emulator sẵn sàng.

**Version note:** ghim `@firebase/rules-unit-testing@^4.0.1` (không phải
`^5.x` mới nhất) vì `firebase` trong repo đang ở `^11.10.0` và v5 đòi peer
dep `firebase@^12.0.0`. Xem mục Nợ kỹ thuật.
