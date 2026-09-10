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

## Fix sản phẩm: [[unknown-resolution-workflow]] — HIGH-01 (MASTER CODING PROMPT v13, 2026-09-08)

**Nguồn:** phát hiện thật từ `reports/26-09-07-23-49-kiem-thu-e2e-ftmo-decision-session.md`
— hội đồng đa tác tử chạy thật (Gemini/Groq/DeepSeek) tới JudgeDraft, nhưng
session kẹt VALIDATING vĩnh viễn: 2 unknown HIGH OPEN, Decision Canvas không
có UI để đóng unknown, nút duyệt không hiện, `/decision` trả 409. Cổng
`canEnterDecisionReady` (P0-01) chặn ĐÚNG — vấn đề là sản phẩm thiếu đường
hợp lệ để thoả mãn cổng đó, không phải cổng sai.

**Lỗ hổng ngữ nghĩa đi kèm (chưa từng bị khai thác nhưng có thật):** cổng cũ
chỉ chặn khi `resolution === "OPEN"`. Một Unknown HIGH được gắn
`VERIFY_NOW`/`EXPERIMENT_REQUIRED`/`HUMAN_DECISION_REQUIRED` (tức "đã được
gắn cờ cần xử lý" — KHÔNG phải "đã xử lý xong") sẽ vô tình KHÔNG còn chặn
DECISION_READY, dù chưa có evidence/thí nghiệm/quyết định con người nào thật
sự xảy ra.

**Fix — domain model:**
- `Unknown.resolution` thêm 2 giá trị TERMINAL mới: `HUMAN_DECISION` (quyết
  định thủ công có ghi chú, KHÔNG BAO GIỜ báo cáo như sự thật đã kiểm
  chứng) và `ACCEPTED_RISK` (chấp nhận rủi ro còn lại tường minh). Thêm
  `resolutionNote`/`resolvedAt`/`resolvedBy` để giữ provenance.
- `src/domain/decision/unknown-policy.ts` — DUY NHẤT một nơi quyết định
  Unknown có đang chặn hay không (`isUnknownBlocking`/
  `countBlockingHighUnknowns`, cùng pattern với
  `gateStatusTransition`): CHỈ `RESOLVED`/`HUMAN_DECISION`/`ACCEPTED_RISK`
  mới ngừng chặn — `OPEN`/`VERIFY_NOW`/`EXPERIMENT_REQUIRED`/
  `HUMAN_DECISION_REQUIRED` đều vẫn chặn vì chưa có gì thật sự được giải
  quyết. Tất cả nơi từng tự tính `highPriorityOpenUnknowns` inline
  (`stop-conditions.ts`, `decision-orchestrator.ts` ×3, `route.ts`) giờ gọi
  qua đúng một hàm này.
- `resolveUnknown()` (cùng file) — 6 action giới hạn: `VERIFY_NOW`,
  `MARK_EXPERIMENT`, `REQUEST_HUMAN_DECISION` (chỉ gắn cờ, không tự giải
  quyết), `RESOLVE_WITH_EVIDENCE` (bắt buộc evidenceIds thật, đã tồn tại
  trong session, `verificationStatus === "VERIFIED"` — không chấp nhận ID
  tuỳ tiện), `HUMAN_DECISION`/`ACCEPT_RISK` (bắt buộc `resolutionNote`
  không rỗng). Không có action nào cho phép "Resolved" trống — đúng yêu cầu
  chống bypass rỗng.
- `computeReadiness()` — tóm tắt readiness xác định (KHÔNG dùng LLM), trả
  `blocking`/`nonBlocking` với `code` máy đọc được (`NO_OPTIONS`,
  `NO_ASSUMPTIONS`, `HIGH_UNKNOWNS_OPEN`, `CONTRADICTED_ASSUMPTIONS`,
  `NON_HIGH_UNKNOWNS_OPEN`).

**Fix — API:** `PATCH /api/sessions/:sessionId/unknowns/:unknownId`
(`src/app/api/.../unknowns/[unknownId]/route.ts`) là đường DUY NHẤT client
được đổi `resolution`. `UpdateSessionSchema` (PATCH session chung) đã BỎ
field `unknowns` — trước đây một client có thể PATCH thẳng mảng `unknowns`
với `resolution: "RESOLVED"` không cần bằng chứng gì (đúng lỗ hổng "empty
resolve bypass" mà v13 §8 cấm); giờ endpoint đó chỉ còn tác dụng lên
`options`/`assumptions`/`constraints`/`criteria`.

**Fix — UI:** `src/features/decision-canvas/UnknownsPanel.tsx` — Decision
Canvas giờ có section Unknowns hiển thị mọi unknown (câu hỏi, importance,
resolution, evidence liên kết, resolutionNote), với 5 nút hành động cho
unknown HIGH đang chặn. Thêm section Constraints (trước đây không hiện dù
domain model đã có). Thêm section "Decision Readiness" xác định
(`computeReadiness`). Sửa lỗi hiển thị JudgeDraft (LOW-01 cũ): trước đây
điều kiện `status === "DECISION_READY"` làm JudgeDraft biến mất hoàn toàn
khi bị cổng chặn — giờ luôn hiện "Đề xuất Judge" khi có `judgeDraft`, kèm
danh sách blocker cụ thể nếu session chưa `DECISION_READY` (không còn phải
đoán tại sao nút Duyệt không xuất hiện).

**Test:** `src/tests/unit/unknown-policy.test.ts` (22 test, đúng danh sách
v13 §40: HIGH+OPEN/VERIFY_NOW/EXPERIMENT_REQUIRED/HUMAN_DECISION_REQUIRED
đều chặn, HIGH+RESOLVED/HUMAN_DECISION/ACCEPTED_RISK đều hết chặn,
MEDIUM/LOW không bao giờ chặn, resolve rỗng bị từ chối, evidence sai
owner/chưa VERIFIED bị từ chối, readiness trả đúng blocker code).
`src/tests/integration/unknown-resolution-closure.test.ts` (5 test) — vòng
lặp đóng ĐẦY ĐỦ qua route handler thật (v13 §44, mandatory release test):
HIGH Unknown chặn → `/decision` 409 → giải quyết hợp lệ bằng
RESOLVE_WITH_EVIDENCE → PATCH status DECISION_READY thành công → approve
→ DECIDED → Blueprint DRAFT → APPROVED; cộng cross-user 404, ID unknown
lạ 404, bulk-array bypass đã đóng.

## Fix bảo mật/chất lượng: [[ftmo-verify-classifier]] — HIGH-02 (MASTER CODING PROMPT v13, 2026-09-08)

**Nguồn:** cùng báo cáo QA — Unknown hỏi "upload MT4/MT5 hay dùng API?" bị
regex VERIFY cũ (`ARITHMETIC_RE` nuốt filler tuỳ ý giữa 2 nhóm chữ số)
hiểu nhầm thành phép chia `4/5 = 0.8`, tạo Evidence CALCULATION
`VERIFIED` sai hoàn toàn — false-positive verification.

**Fix:** `src/ai/orchestration/arithmetic-classifier.ts` — tách classify
khỏi extract. Vẫn giữ gap tuỳ ý giữa 2 số (`\D{0,24}`) để bắt được câu tự
nhiên hợp lệ như "20 users x $15", nhưng validate: KHÔNG cho phép chữ cái
Unicode (`\p{L}`) chạm trực tiếp vào 1 trong 2 nhóm chữ số ở CẢ 2 phía
(trước/sau) — dùng regex flag `d` (indices) để biết chính xác vị trí từng
nhóm. Đây là điều phân biệt "20" (số thật) với "4" trong "MT4" hay "2"
trong "IPv2" (số dính danh định). Không dùng blacklist liệt kê — tổng quát
cho MT4/MT5, H264/H265, IPv4/IPv6, USB2/USB3, Gen4/Gen5, v1/v2, 4K/8K,
ISO27001/27002, A/B (A/B tự động an toàn vì không có chữ số nào để khớp).

**Verification coverage (v13 §17-19):** thêm `VerificationCoverage =
"NONE"|"PARTIAL"|"FULL"` (`src/domain/evidence/types.ts`, field
`originalClaim`/`verifiedFragment`/`verificationCoverage` trên
`EvidenceItem`). Coverage = tỉ lệ độ dài fragment đã verify / độ dài toàn
bộ claim (ngưỡng 0.85 = FULL). Assumption chỉ được tự động chuyển
`SUPPORTED` khi coverage FULL; PARTIAL vẫn gắn evidence (không giấu) nhưng
GIỮ NGUYÊN status — không còn báo cáo "20 users × $15 = $300 MRR và tất cả
sẽ subscribe" là đã verified chỉ vì phần số học `20×15` đúng. Tương tự
Unknown chỉ chuyển `RESOLVED` khi coverage FULL.

**Test:** `src/tests/unit/arithmetic-classifier.test.ts` (19 test, đúng
danh sách v13 §41) + `src/tests/unit/verify-pipeline.test.ts` (bổ sung 3
test: compound claim → PARTIAL không auto-SUPPORTED, pure arithmetic →
FULL → SUPPORTED, MT4/MT5 trong Unknown thật → không gọi calculator, không
tạo evidence, resolution giữ nguyên OPEN).

## Fix phát hiện qua live QA: [[agent-structured-parse-recovery]] (2026-09-08)

**Nguồn:** phát hiện TRỰC TIẾP khi verify HIGH-01/LOW-01 bằng browser thật
(không phải suy đoán) — chạy `PREPARE_DECISION` thật, Judge (Gemini) trả
lời bình thường trong chat, `AgentRun` ghi `status=COMPLETED`, nhưng
`session.judgeDraft` HOÀN TOÀN KHÔNG được lưu — nút "Duyệt Decision Record"
không bao giờ xuất hiện, không có lỗi nào lộ ra. Đây là bug thật đang tồn
tại trong code trước khi bắt đầu phiên làm việc này, không phải do các fix
HIGH-01/HIGH-02.

**Nguyên nhân gốc:** `src/ai/providers/gemini-provider.ts` làm
`JSON.parse(content)` thô (không bọc fence-recovery) để tạo `structured` —
nếu Gemini bọc JSON trong ```json fence hoặc thêm text thừa, `JSON.parse`
throw, `structured` thành `undefined`. Điều đó tự nó vô hại vì
`judge.ts`/`analyst.ts`/`critic.ts`/`second-opinion.ts` đều có lớp phục hồi
tự viết bằng `parseLooseJson` — NHƯNG lớp phục hồi đó chỉ được gọi khi
`result.structured` HOÀN TOÀN falsy. Nếu `result.structured` có giá trị
(object) nhưng KHÔNG khớp Zod schema (ví dụ SDK tự parse được JSON nhưng
sai field), code cũ bỏ qua thẳng `parseLooseJson`, không bao giờ thử phục
hồi từ `content` thô — mất toàn bộ output thật của model dù nó có thể phục
hồi được.

**Fix:** áp dụng ĐÚNG MỘT pattern cho cả 4 file
(`judge.ts`/`analyst.ts`/`critic.ts`/`second-opinion.ts`): thử
`result.structured` trước; nếu absent HOẶC parse Zod thất bại, LUÔN thử lại
`parseLooseJson(result.content)` trước khi bỏ cuộc. Đây là đúng bài học đã
ghi ở [[deepseek-second-opinion]] (DeepSeek/SecondOpinion) nhưng lần này áp
dụng rộng ra cả Gemini/Judge — chứng minh lời dặn "nếu sau này thêm role
mới dùng cho output có cấu trúc, áp dụng lại" cũng đúng khi bug xuất hiện ở
provider khác, không chỉ DeepSeek.

**Test:** `src/tests/unit/agent-structured-recovery.test.ts` (6 test, dùng
`ModelGateway` thật với fake `ModelProvider` — không mock module) — tái
hiện chính xác kịch bản lỗi (`structured` present nhưng thiếu field bắt
buộc, `content` chứa JSON đầy đủ trong fence) cho cả Judge/Critic/Analyst,
xác nhận recovery thành công; cộng 1 test xác nhận hành vi cũ (structured
hoàn toàn không parse được → fallback an toàn `INSUFFICIENT_EVIDENCE`,
không mất `reply`) vẫn giữ nguyên.

**Verify sống (không chỉ unit test):** chạy lại đúng kịch bản FTMO qua
browser thật lần 2 sau khi vá — `PREPARE_DECISION` → `judgeDraft` được lưu
đúng → nút "Duyệt Decision Record" xuất hiện → duyệt → DECIDED → tạo
Blueprint DRAFT → duyệt Blueprint → APPROVED. Toàn bộ vòng lặp
DISCOVERY → VALIDATING → (chặn 2 Unknown HIGH) → giải quyết hợp lệ →
DECISION_READY → DECIDED → Blueprint APPROVED chạy được TRỌN VẸN qua UI
thật với API AI thật (Gemini/Groq/DeepSeek) — đúng yêu cầu "Release Hard
Gate" của MASTER CODING PROMPT v13 §70.

## Audit MASTER WORK PROMPT v21 — 5 fix xác nhận (2026-09-10)

**Nguồn:** audit toàn diện thuật toán đa tác tử (algorithm forensics +
research 8+ framework ngoài: AutoGen, CrewAI, LangGraph, MetaGPT, ChatDev,
Mixture-of-Agents, literature về judge self-preference bias...). Kết luận
audit: giả thuyết "model bị giới hạn quá mức / bị đối xử bất công" của
user KHÔNG có bằng chứng trong code — token budget khiêm tốn và scale
đúng theo vai trò, Analyst/SecondOpinion chạy song song thật sự mù nhau,
Judge chọn (select) thay vì trộn (blend) options đúng như research mới
nhất (arXiv:2603.20324) khuyến nghị. Do đó KHÔNG làm redesign kiến trúc
adaptive-council (blind judge/rotating judge/information-gain routing) —
chỉ sửa 5 lỗi cụ thể có bằng chứng. Chi tiết đầy đủ (bảng Mode×Stage×Model,
fairness audit F1-F12, so sánh với 8+ framework, trích dẫn nghiên cứu):
`reports/26-09-10-10-18-layer-a-multiagent-audit.md`.

**5 fix (commit `c66bdab`, đã lên `main`):**
1. STANDARD từng chỉ chạy Analyst ở MỌI stage kể cả PREPARE — Analyst vẫn
   có thể tự đề xuất `suggestedStatus: DECISION_READY` (qua
   `gateStatusTransition`, hợp lệ) nhưng KHÔNG BAO GIỜ có `judgeDraft` (chỉ
   Judge mới ghi field đó) → `approveDecision` luôn từ chối vì thiếu
   `judgeDraft` → session STANDARD kẹt DECISION_READY vĩnh viễn, không thể
   duyệt. Fix: STANDARD PREPARE giờ chạy Judge-only (giống DEEP PREPARE),
   vẫn nằm trong `maxCalls: 2` sẵn có của STANDARD.
2. Nút "Gửi" thường ở QUICK/STANDARD từng luôn gửi kèm `intent` mặc định
   "DISCUSS" từ state UI trừ khi user tự mở panel "Nâng cao/QA" — nghĩa là
   StageController không bao giờ được tự suy luận stage cho user thường.
   Fix: chỉ gửi `intent` thủ công khi user THẬT SỰ đã tương tác với dropdown
   đó (`intentTouched`), khớp hành vi DEEP đã có sẵn.
3. `deriveBlueprintContent` từng hardcode CHÍNH nội bộ Layer A (route
   `/api/sessions/.../run`, vai trò Analyst/Judge/HardPolicyGate,
   Vercel/Firebase) vào `apiContracts`/`aiWorkflow`/`security`/
   `observability`/`test`/`deploymentRequirements` — Blueprint (tài liệu
   bàn giao cho người build SẢN PHẨM MỤC TIÊU, vd. app FTMO) mô tả nhầm
   chính công cụ quyết định thay vì sản phẩm. Fix: các field đó giờ suy ra
   từ option đã chọn/constraints/entity của session.
4. `judgeDraft.selectedEvidenceIds` từng lấy TOÀN BỘ evidence trong session
   bất kể `verificationStatus`; `acceptedAssumptionIds` từng lấy TOÀN BỘ
   assumption kể cả `CONTRADICTED` — cả hai chảy thẳng vào `DecisionRecord`
   bất biến. Fix: lọc `VERIFIED` cho evidence, loại `CONTRADICTED` cho
   assumption trước khi ghi `judgeDraft`.
5. Test E2E `decision-loop.spec.ts` assert text trên `data-testid="auto-workflow"`
   ngay sau khi click — nhưng `Composer.tsx` đổi hẳn sang
   `data-testid="stop-workflow"` ngay khi bắt đầu chạy, nên assertion đó
   luôn fail tất định (không phải flaky) một khi DEEP auto-run chạy lâu hơn
   timeout của assertion. Fix: assert đúng trạng thái mà click thật sự tạo
   ra (`stop-workflow` xuất hiện).

**Phát hiện thêm chưa fix (ghi nợ để làm sau):** `canEnterDecisionReady`
không kiểm tra `status` của assumption — kết hợp với việc Intent thủ công
(`PREPARE_DECISION` qua panel Nâng cao/QA) bỏ qua hẳn cảnh báo tạm dừng
`EVIDENCE_CONTRADICTION` của `decideWorkflowStage` (cảnh báo đó chỉ áp dụng
khi intent được suy luận tự động) — nghĩa là một assumption `CONTRADICTED`
vẫn có thể lọt tới DECISION_READY/DECIDED qua đường Intent thủ công. Fix
#4 ở trên là phòng thủ chiều sâu cho đúng đường này (đã có test), nhưng
đóng hẳn gate thì chưa làm.

## Fix bug production: [[vercel-firebase-admin-500]] (2026-09-10)

**Nguồn:** phát hiện TRỰC TIẾP qua browser thật trên production
(`aichatbot-inky-phi.vercel.app/workspaces`, commit `c66bdab`) — trang báo
"Unexpected server error", console cho thấy CẢ `GET` lẫn `POST
/api/workspaces` đều 500.

**Nguyên nhân gốc:** README chỉ tài liệu hoá MỘT cách cấu hình Firebase
Admin — đặt file `service.json` tại `./service.json`
(`FIREBASE_ADMIN_CREDENTIALS_PATH`). Cách này KHÔNG THỂ hoạt động trên
Vercel vì serverless function không có filesystem bền vững để đặt file lúc
deploy (và tuyệt đối không được commit file đó — có secret). Code
(`src/infrastructure/firebase/admin.ts`) thật ra đã hỗ trợ sẵn cách dùng 3
biến môi trường inline (`FIREBASE_ADMIN_PROJECT_ID` /
`FIREBASE_ADMIN_CLIENT_EMAIL` / `FIREBASE_ADMIN_PRIVATE_KEY`) — đúng cách
phải dùng trên Vercel — nhưng README chưa từng nhắc tới, nên khả năng cao
project Vercel chưa có 3 biến này. Khi `hasFirebaseAdmin=false` trên
production, `getAdminApp()` throw ngay trước khi chạm Firestore → MỌI route
dùng `FirestoreXxxRepository` đều 500 giống nhau — đúng khớp triệu chứng
quan sát được (cả GET lẫn POST cùng lỗi).

**Giới hạn của lần fix này:** không có quyền truy cập Vercel dashboard/logs
từ session này nên KHÔNG THỂ tự xác nhận 100% 3 biến đó đang thiếu — đây là
chẩn đoán có bằng chứng mạnh (khớp message lỗi + đọc code), không phải xác
nhận trực tiếp từ log. Người vận hành cần tự vào Vercel → Project →
Settings → Environment Variables (Production) để set 3 biến trên, dùng
đúng `project_id`/`client_email`/`private_key` từ service account JSON.

**Fix code (giúp tự chẩn đoán, không che dấu triệu chứng):**
`getAdminApp()` trong `admin.ts` từng throw `Error` thường — bị
`handleRouteError` làm phẳng thành `"Unexpected server error"` chung
chung, không có manh mối nào lộ ra ngoài server log (mà tôi không truy cập
được). Giờ throw `AppError("INTERNAL_ERROR", ...)` với message nêu rõ
đúng tên 3 biến còn thiếu — `handleRouteError` giữ nguyên message của
`AppError`, nên body JSON trả về (thấy được ngay trong tab Network của
browser) giờ tự nói rõ nguyên nhân, không cần vào Vercel logs mới biết.

**Test:** `src/tests/unit/env-connected.test.ts` (thêm 1 test) — gọi
`getAdminDb()` khi không có biến Admin nào, xác nhận throw đúng `AppError`
chứa tên biến `FIREBASE_ADMIN_PROJECT_ID` trong message.

**Sửa README.md (đồng bộ với code thật, phát hiện khi đọc toàn bộ codebase
theo yêu cầu audit này):**
- Bảng "Agents and routing": STANDARD giờ có PREPARE=Judge (fix #1 ở
  trên); DEEP PREPARE_DECISION sửa lại đúng là Judge-only dùng artifact cũ
  (KHÔNG chạy lại Analyst+SecondOpinion+Critic như bảng cũ mô tả sai).
- Decision Canvas: xoá câu "không render Unknowns panel" — đã sai từ khi
  HIGH-01 thêm `UnknownsPanel.tsx` (2026-09-08), README chưa từng cập nhật
  theo.
- "Auto Tự động 4 bước": mô tả cũ (DEEP-only, 4 intent cố định) không khớp
  `runAutoWorkflow` thật (mọi Mode, content-driven qua StageController, cap
  an toàn 8 bước) — viết lại đúng hành vi.
- Thêm mục hướng dẫn Vercel-specific cho Firebase Admin (3 biến inline) vào
  phần "Connected mode (Firestore)".

## Nâng cấp năng lực: [[verify-stats-tool]] (2026-09-10)

**Nguồn:** user phản ánh trực tiếp trên một session THẬT (project
"AI-Research-Lab" — phân tích thống kê dự đoán xổ số Mega 6/45): "thuật
toán quá đơn giản, chưa giải quyết được vấn đề". Trước khi đề xuất bất kỳ
nâng cấp nào, đã CHẨN ĐOÁN lại theo đúng bằng chứng — KHÔNG lặp lại tranh
luận "model bị giới hạn/đối xử bất công" đã audit kỹ và bác bỏ ở
[[layer-a-multiagent-audit]] (2026-09-10 sớm hơn cùng ngày). Tìm ra khoảng
trống THẬT, khác hẳn: toàn bộ `src/tools/registry.ts` (dùng chung cho MỌI
DomainPack) trước đây chỉ có DUY NHẤT một connector — `calculator`, chỉ
eval được biểu thức số học đơn giản khớp `/^[\d\s+\-*/().]+$/`. Với một dự
án cần phân tích dữ liệu/thống kê thật (vd. kiểm tra tính đồng đều của tần
suất xổ số), hệ thống hoàn toàn không có công cụ nào — Analyst/Critic/Judge
chỉ có thể TRANH LUẬN VỀ việc cần phân tích thống kê, không thể THẬT SỰ
tính toán gì. Đây là khoảng trống ở tầng tool/VERIFY, không phải ở tầng
thiết kế đa tác tử.

**Nâng cấp (phạm vi hẹp, có chủ đích):**
- `src/tools/registry.ts` — thêm `StatsConnector` (`stats.describe`): tính
  count/sum/mean/min/max/**cả** populationStdev **và** sampleStdev (không
  đoán bừa mẫu số n hay n-1 — báo cả hai, tránh đúng kiểu "overclaim ngầm"
  mà hệ thống này đã có nguyên tắc chống từ trước). READ-only, thêm vào
  `TOOL_ACTION_PERMISSIONS`.
- `src/ai/orchestration/stats-classifier.ts` (mới) — `findStatsCandidate()`
  CHỈ nhận diện tag tường minh `DATA=[n1, n2, ...]` (≥2 số), KHÔNG parse
  tự do câu tiếng Việt/Anh tự nhiên tìm số. Đây là quyết định an toàn có
  chủ đích: lặp lại việc parse tự do (kiểu regex cũ của arithmetic-classifier
  trước khi có fix HIGH-02, xem [[ftmo-verify-classifier]]) sẽ tái tạo đúng
  lớp lỗi false-positive-verification đã tốn cả một chu kỳ fix để sửa. Tag
  tường minh nghĩa là không câu văn tự nhiên nào vô tình khớp — an toàn
  tuyệt đối, đổi lại UX kém tự nhiên hơn (chấp nhận được, vì evidence sai
  còn tệ hơn nhiều so với evidence không tự động sinh ra).
- `verify-pipeline.ts` — refactor phần gán evidence/lật status
  (assumption→SUPPORTED, unknown→RESOLVED khi coverage FULL) thành hàm dùng
  chung `attachEvidence()` cho cả `calculator` và `stats`, tránh lặp code.
  Early-return `NOT_VERIFIABLE` giờ chỉ kích hoạt khi domain pack không cho
  phép CẢ HAI tool (trước đây chỉ kiểm tra `calculator`, nên một pack chỉ
  bật `stats` sẽ bị chặn nhầm ngay từ đầu).
- `src/domain-packs/generic.ts::getToolConnectorIds()` — thêm `"stats"` vào
  allowlist mặc định. `challengeready` pack giữ nguyên (không cần thay đổi
  ngoài phạm vi khiếu nại).

**Test:** `src/tests/unit/stats-classifier.test.ts` (7 test — bao gồm
đúng kiểu false-positive từng gây lỗi ở arithmetic: "MT4/MT5, v1/v2, 4K/8K"
không kích hoạt); `src/tests/unit/tools-registry.test.ts` (6 test — đối
chiếu với ví dụ thống kê chuẩn sách giáo khoa: dataset `[2,4,4,4,5,5,7,9]`
→ populationStdev=2 chính xác); `verify-pipeline.test.ts` (+4 test — FULL
coverage tự RESOLVED unknown, PARTIAL không tự SUPPORTED assumption, tool
bị chặn đúng khi domain pack không cho phép).

**Không làm (có chủ đích, tránh overreach):** không tính p-value/chi-square
significance test (rủi ro sai số xấp xỉ, dễ overclaim "có ý nghĩa thống
kê" khi công thức gần đúng sai) — chỉ trả thống kê mô tả thô, để
Analyst/Judge tự diễn giải, không tự động gán nhãn "significant"/"not
significant". Không tạo DomainPack mới riêng cho "nghiên cứu/data science"
— thêm `stats` vào Generic pack sẵn có là đủ cho khoảng trống tìm được,
tạo pack mới sẽ là mở rộng phạm vi không có bằng chứng yêu cầu.

## Nợ kỹ thuật: [[firestore-atomic-writes]] (2026-09-10)

**Yêu cầu ban đầu:** "eradicate Firestore race conditions" bằng cách
chuyển toàn bộ dữ liệu chat/session tạm thời sang memory store, chỉ giữ
Firestore cho DecisionRecord/Blueprint.

**Chẩn đoán trước khi sửa:** app này deploy trên Vercel serverless
(`vercel.json`, region `iad1`) — mỗi request có thể rơi vào một container
khác nhau/cold start khác nhau. `getMemoryDb()`
(`infrastructure/repositories/memory-store.ts`) là một `Map` gắn vào
`globalThis` của MỘT process — không sống sót qua cold start, không chia
sẻ giữa các instance. `getServerEnv()` đã chủ động fail-closed cấm
`USE_MEMORY_STORE=true` khi `NODE_ENV=production` chính vì lý do này.
Nếu làm đúng y yêu cầu gốc (chuyển toàn bộ DecisionSession/Message/
AgentRun sang memory), workspace/session/chat của người dùng thật sẽ biến
mất ngẫu nhiên mỗi khi request rơi vào container khác — không phải fix
race condition, mà là một regression hỏng dữ liệu mới, nghiêm trọng hơn
bug gốc. Đã hỏi lại người dùng trước khi code (xem "STRICT_RULES #1" của
chính yêu cầu — chỉ hỏi khi thực sự bị block) và được xác nhận: giữ
Firestore làm nguồn sự thật, sửa đúng cơ chế ghi.

**Root cause thật:** không phải "Firestore sai loại store", mà là pattern
ghi KHÔNG NGUYÊN TỬ lặp lại ở nhiều repository — `get()` (đọc), merge
field trong JS, rồi `set()` (ghi) — ba round-trip tách rời, không transaction.
Hai request đồng thời cùng PATCH một document (vd. orchestrator SSE đang
ghi `workflow` trong khi client PATCH `unknowns` qua UnknownsPanel) có thể
đọc cùng một bản snapshot cũ, và request ghi sau sẽ ghi đè mất patch của
request ghi trước (lost update) — đây chính là "race condition" thật sự
cần eradicate.

**Fix (phạm vi hẹp — chỉ các method có pattern get-then-set):**
- `FirestoreDecisionSessionRepository.update()`
- `FirestoreAgentRunRepository.update()`
- `FirestoreBlueprintRepository.updateStatus()`
- `FirestoreExperimentRepository.update()`
- `FirestoreWorkspaceRepository.update()`

Mỗi method đổi sang `getAdminDb().runTransaction(async (tx) => { const
snap = await tx.get(ref); ...; tx.set(ref, updated); return updated; })`.
Firestore transaction đọc-và-ghi trong cùng một transaction, tự động
retry khi phát hiện document đã đổi giữa lúc đọc và lúc commit — loại bỏ
lost-update mà không cần đổi loại store, không ảnh hưởng tính bền vững
trên serverless. Giữ nguyên logic merge/field/semantics NOT_FOUND cũ 1:1
— không refactor thêm gì ngoài phạm vi này (vd. `Experiment.getById()`
vốn không check `ownerId`, giữ nguyên không thêm check mới). `create()`,
`Message`/`Evidence`/`DecisionRecord` (chỉ tạo doc mới, không đọc-sửa) và
`FirestoreIdempotencyStore`/`FirestoreRateLimitStore` (đã atomic sẵn qua
`create()`/`runTransaction()` từ trước) không đụng tới.

**Verify (không tin test giả):**
1. `pnpm typecheck` — pass. `pnpm test` — 198/198 test cũ vẫn pass
   nguyên (test suite chạy trên memory store nên không tự động phủ được
   code path Firestore mới — không đủ để chứng minh fix đúng).
2. Viết script độc lập chạy trực tiếp trên Firestore emulator thật
   (`firebase emulators:exec --only firestore`), mô phỏng lại NGUYÊN VĂN
   pattern cũ (get-then-set) và pattern mới (runTransaction) trên cùng
   một document, bắn 2 write đồng thời vào 2 field khác nhau, lặp 20 lần:
   pattern cũ mất 20/40 write đồng thời (chứng minh race có thật); pattern
   mới mất 0/40 (chứng minh fix loại bỏ đúng race).
3. `pnpm test:rules` (Firestore security rules, cũng chạy trên emulator) —
   14/14 pass, không bị ảnh hưởng.
4. Browser MCP trên dev server thật đang nối Firestore project thật
   (`USE_MEMORY_STORE=false`, xác nhận qua `.env.local`): tạo tài khoản
   Firebase Auth thật, tạo workspace + session thật, gửi 2 lượt chat liên
   tiếp ở Mode QUICK (route qua Groq) — cả 2 lần `/api/sessions/:id/run`
   trả 200, Analyst trả lời thật, `workflow.currentStage` cập nhật đúng
   (FRAME), 0 lỗi console ngoài 404 favicon có sẵn từ trước (không liên
   quan tới thay đổi này).

**Không làm (có chủ đích):** không thêm Vercel KV/Redis hay store thứ hai
— không cần thiết cho root cause thật (ghi không nguyên tử), sẽ là hạ
tầng mới không có bằng chứng yêu cầu. Không sửa `memory-store.ts` (chỉ
dùng cho dev/test, không có race đáng kể trong ngữ cảnh single-process
test hiện tại, và nằm ngoài phạm vi "Firestore race condition").

## Redesign thuật toán: [[pipeline-soft-gate]] (2026-09-10)

**Triệu chứng thật (runtime, không phải giả thuyết):** sau khi Parallel
Blind Framing (gemini∥deepseek∥groq) chạy xong FRAME, một session DEEP
điển hình có ~8-10 HIGH Unknown mở (hợp lý — 3 framer độc lập tất yếu nêu
ra nhiều câu hỏi hơn 1 Analyst). `decideWorkflowStage()` khi đó PAUSE
tuyệt đối trước OPTIONS/CRITIQUE/PREPARE cho tới khi con số này về 0 —
nhưng "0 HIGH Unknown" gần như không bao giờ đạt được chỉ bằng chat, vì
mỗi vòng OPTIONS/CRITIQUE lại có thể phát sinh thêm Unknown mới. Kết quả:
pipeline treo vĩnh viễn ngay sau FRAME, nút "Tiếp tục quy trình" vô tác
dụng — không phải bug hiếm, mà là hành vi MẶC ĐỊNH của mọi session DEEP
nghiêm túc.

**Chẩn đoán gốc rễ:** `decideWorkflowStage()` (`workflow-stage.ts`) từng
có BA lớp gate riêng biệt, chồng lặp, đều dùng chung một tín hiệu sai
mục đích — `countBlockingHighUnknowns() > 0` — để chặn CẢ pipeline
(StageController) LẪN business gate (DECISION_READY). Đây là hai câu hỏi
khác nhau: "còn câu hỏi mở không" (đúng, luôn có ở early-stage) vs "có đủ
điều kiện để CON NGƯỜI duyệt quyết định không" (câu hỏi thật). Conflating
hai câu hỏi này là root cause — không phải feature Parallel Blind Framing
(nó chỉ làm lộ bug vốn đã tồn tại, vì tạo ra volume Unknown lớn hơn nhiều
so với single-Analyst).

**Fix (Pipeline Soft Gate — đã chọn qua REQUIRED_OUTPUT phân tích 3 trụ
cột, xem session redesign 2026-09-10):**
- `collectPipelineBlockers()` (đổi tên từ `collectPauseBlockers()`) giờ
  CHỈ trả về `EVIDENCE_CONTRADICTION` — assumption tự mâu thuẫn là lý do
  DUY NHẤT còn hợp lý để dừng pipeline (xây OPTIONS/CRITIQUE/JudgeDraft
  trên một giả định đã biết là sai khác về chất so với "còn câu hỏi mở").
  HIGH Unknown (OPEN/VERIFY_NOW/EXPERIMENT_REQUIRED/HUMAN_DECISION_REQUIRED)
  không còn nằm trong danh sách này.
- Bỏ hoàn toàn "absolute post-selection gate" (đoạn code từng redirect
  OPTIONS/CRITIQUE/PREPARE → VERIFY/PAUSE khi `remainingHigh > 0`) — dư
  thừa, cùng một class bug với 2 lớp kia.
- Nhánh PREPARE: Judge ĐƯỢC PHÉP chạy và tạo `judgeDraft` dù còn HIGH
  Unknown mở — nhưng `readiness.ready`/`gateStatusTransition()`/
  `canEnterDecisionReady()` (không đổi, vẫn là thẩm quyền duy nhất) tiếp
  tục từ chối DECISION_READY cho tới khi `countBlockingHighUnknowns()===0`.
  `judgeDraft` tồn tại ≠ session duyệt được — tách biệt này vốn đã đúng ở
  tầng `approveDecision()`/`applyAnalystState()`, giờ StageController mới
  thực sự tận dụng được nó thay vì tự chặn trước khi Judge kịp chạy.
- `WorkflowDecision.blockers` chỉ mang `HIGH_UNKNOWNS_OPEN` ở trạng thái
  TERMINAL (`COMPLETED` sau khi JudgeDraft đã tồn tại) — không bao giờ khi
  `state==="RUNNING"` (đang tiến), để tránh `WorkflowStepper.tsx` (dấu
  "BLOCKED !" khi `blockers.length>0` bất kể state) hiển thị sai một giai
  đoạn đang chạy bình thường là "bị chặn". Banner "còn N HIGH Unknown" đã
  tồn tại sẵn, độc lập, chính xác qua `computeReadiness()` ở Decision
  Canvas ("Decision Readiness" + `judge-draft-panel`/`judge-blocked`) —
  không cần thêm UI mới cho yêu cầu "không che rủi ro".
- Dọn 4 chỗ debug leftover `fetch("http://127.0.0.1:7741/ingest/...")`
  (2 trong `decision-orchestrator.ts`, 1 trong `workflow-stage.ts`, 1
  trong `decision/route.ts`) — network call tới debug server nội bộ của
  phiên làm việc trước, vô tình lọt vào code đã merge; nguy hiểm nếu chạy
  production (leak nội dung request tới một cổng localhost không tồn tại
  ở đó) dù bọc `.catch()`.

**Không đổi (đã đúng từ trước, xác nhận qua audit):** `gateStatusTransition`/
`canEnterDecisionReady`/`HardPolicyGate` vẫn là thẩm quyền duy nhất cho
DECISION_READY/DECIDED; `humanApproveProof` (HMAC, server-mint) vẫn là
đường duy nhất set `origin=HUMAN_APPROVE`; `resolveUnknown()` vẫn cấm
empty-resolve; framer quorum ≥2 và Conflict Engine (deterministic, không
LLM) không đổi.

**Test:** `src/tests/unit/workflow-stage.test.ts` — 3 test cũ mã hoá đúng
hành vi bug (PAUSED khi còn HIGH Unknown trước OPTIONS/CRITIQUE/PREPARE)
được viết lại thành test mã hoá hành vi đúng (RUNNING, advance); thêm 1
test xác nhận `EVIDENCE_CONTRADICTION` vẫn dừng pipeline (khác HIGH
Unknown). `src/tests/integration/automatic-workflow.test.ts` — viết lại
2 test: (1) HIGH Unknown không còn pause trước CRITIQUE; (2) test đầy đủ
"reaches PREPARE despite HIGH Unknown open; DECISION_READY unlocks only
after resolving it" — chạy `runDecisionOrchestrator` thật với scripted
providers, xác nhận `judgeDraft` được tạo trong khi `session.status`
KHÔNG lên DECISION_READY, rồi resolve Unknown + re-run với intent
`PREPARE_DECISION` mới thấy DECISION_READY. Toàn bộ 212 test (27 file)
pass, không có test nào khác bị ảnh hưởng.

**Verify sống (MCP, không tin test giả):** tạo session DEEP thật trên
Firebase project thật (domain Mega 6/45, cố tình chọn để tạo nhiều
Unknown), chạy "Bắt đầu phân tích" (auto-workflow thật, real Gemini/Groq/
DeepSeek calls). Kết quả đọc trực tiếp qua `fetch('/api/sessions/:id')`
từ browser (không suy đoán từ UI text): `completedStages: [FRAME,
OPTIONS, CRITIQUE, VERIFY, PREPARE]`, `hasJudgeDraft: true`,
`judgeDecision: "EXPERIMENT_FIRST"`, đồng thời `highBlockingCount: 10`
(10/18 Unknown HIGH vẫn mở) và `status: "VALIDATING"` (không phải
DECISION_READY) — đúng chính xác contract Soft Gate: pipeline không còn
treo, nhưng business gate vẫn giữ nguyên. 0 lỗi console.

## Fix bảo mật: [[contradicted-decision-ready-gap]] — P0-A (2026-09-10)

**Lỗ hổng thật, xác nhận bằng đọc trực tiếp mã nguồn (không suy đoán):**
`canEnterDecisionReady()` (`state-machine.ts`) chỉ kiểm tra
`assumptionCount >= 1` — KHÔNG kiểm tra status của từng assumption. Một
session có đủ `optionCount`, `assumptionCount`, 0 HIGH Unknown, 0 domain
error nhưng có 1 assumption ở trạng thái `CONTRADICTED` (đã bị bác bỏ bởi
evidence) vẫn PASS gate này và được phép vào `DECISION_READY` — mâu thuẫn
trực tiếp với nguyên tắc "chỉ VERIFIED evidence/không-CONTRADICTED
assumption mới được đưa vào quyết định" đã áp dụng ở `judgeDraft` (H8
fix, `acceptedAssumptionIds` lọc `status !== "CONTRADICTED"`) nhưng chưa
bao giờ được áp ở gate DECISION_READY thật sự. Đường khai thác thực tế:
(a) Judge trả `decision: ACCEPT`/`ACCEPT_WITH_CHANGES` khi vẫn còn
assumption CONTRADICTED trong session; (b) client PATCH trực tiếp
`/api/sessions/:id` với `status: "DECISION_READY"`; (c) Analyst
`suggestedStatus: "DECISION_READY"` qua `applyAnalystState()`. Cả ba
route đều dùng chung `gateStatusTransition()`/`canEnterDecisionReady()`
(đúng nguyên tắc [[transition-gate-unification]]) nên lỗ hổng tồn tại ở
CẢ BA nơi cùng lúc — và fix một chỗ (thêm tham số vào gate) sửa cả ba.

**Fix:** thêm field bắt buộc `contradictedAssumptionCount` vào
`canEnterDecisionReady()` và `GatedTransitionContext`; gate trả `false`
khi `contradictedAssumptionCount > 0`. Cập nhật 4 call site tính giá trị
này từ danh sách assumption đã merge tại thời điểm gọi (không phải từ
snapshot cũ): `decision-orchestrator.ts` (Judge ACCEPT path — dùng
`mergedAssumptions`; `applyAnalystState()` — dùng `assumptions` vừa
merge; `approveDecision()` — dùng `args.session.assumptions`, giữ để
type-safe dù nhánh DECIDED không gọi `canEnterDecisionReady`),
`parallel-frame-merge.ts` (đề xuất VALIDATING, không DECISION_READY, vẫn
cần field để type-check), `app/api/sessions/[sessionId]/route.ts` (PATCH
trực tiếp từ client — đường bypass nguy hiểm nhất vì không qua LLM).

**Không đổi:** `HardPolicyGate`, `humanApproveProof`, `resolveUnknown()`
empty-resolve ban, Pipeline Soft Gate ([[pipeline-soft-gate]]) — fix này
chỉ thắt chặt gate DECISION_READY hiện có, không thêm gate mới, không
đổi hành vi StageController.

**Test:** `src/tests/unit/transition-gate.test.ts` — thêm test
`gateStatusTransition` từ chối DECISION_READY khi
`contradictedAssumptionCount: 1` dù mọi điều kiện khác pass; thêm test
`applyAnalystState` bỏ qua `suggestedStatus: "DECISION_READY"` khi session
có assumption CONTRADICTED thật (không phải giả lập gián tiếp qua
optionCount/assumptionCount). `src/tests/unit/core.test.ts` — thêm case
`canEnterDecisionReady` false khi `contradictedAssumptionCount: 1`. Toàn
bộ 211 test (27 file) + `tsc --noEmit` pass sau fix.

**Chưa làm (ngoài phạm vi P0-A, còn mở):** P0-B (trạng thái deploy thật
của Firestore rules/indexes — chưa từng chạy `firebase deploy` trong
phiên này, không được giả định là đã xong), P1 (`maxDuration` trên route
`run`, persist `sessionPatch` ngay sau Parallel Frame thay vì chỉ ở cuối
hàm), P2 (near-duplicate clustering cho Unknown/Assumption — hiện chỉ có
exact-match dedup qua `dedupeByKey()`/`applyParallelFrameState()`), P2+
(topical-relevance check cho `RESOLVE_WITH_EVIDENCE`).
