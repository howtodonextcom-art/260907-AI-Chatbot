# Groq Critic sau OPTIONS (v19)

- **Thời điểm:** 2026-09-10 03:15 (UTC+7)
- **Vấn đề UI:** session DEEP đã hiện ANALYST Gemini + SECOND_OPINION DeepSeek, không có CRITIC Groq.

## RCA

| ID | Kết luận |
|---|---|
| A (chính) | `decideWorkflowStage` pause khi `pastOptions && HIGH_UNKNOWNS_OPEN` **trước khi** chọn CRITIQUE. Analyst vừa tạo Unknown HIGH ở OPTIONS → pipeline/`Gửi` dừng. Groq không bao giờ được gọi. |
| B | `Gửi` = 1 giai đoạn: sau OPTIONS phải gửi lần nữa mới tới CRITIQUE. Copy cũ không nói “bấm tiếp = Groq”. |
| C | Fallback Groq→Gemini đã gắn nhãn từ v18; screenshot không có bubble CRITIC nên không phải C. |
| D | `.env.local` vẫn có `GROQ_API_KEY` + `ENABLE_CRITIC=true`. |

Unknown HIGH **vẫn** chặn `canEnterDecisionReady` / nút Duyệt. Không weaken gate.

## Fix

- CRITIQUE pending → **không pause**, `nextStage=CRITIQUE` (Critic/Groq) dù HIGH OPEN.
- Sau CRITIQUE CURRENT: pause / VERIFY như cũ; PREPARE vẫn bị readiness blockers.
- Hint: “Bước tiếp theo: CRITIQUE — Critic (Groq). Gửi = chạy Groq ngay.”

## Tests

- Unit: OPTIONS CURRENT + HIGH OPEN → CRITIQUE, `shouldAdvance=true`.
- Unit: HIGH OPEN sau CRITIQUE+VERIFY → vẫn PAUSED (không PREPARE).
- Integration: omitted-intent + HIGH OPEN + SO already contributed → `lastRun.stage=CRITIQUE`, Critic `groq` COMPLETED, `calls=1`.
- `pnpm typecheck` + `pnpm test` **177** pass.

## Cách thấy Groq trên UI

Mode DEEP. Nếu chat đã có DeepSeek: bấm **Gửi** (nội dung bất kỳ / “tiếp tục”) hoặc **Tiếp tục quy trình**. Bubble `CRITIC groq/openai/gpt-oss-120b`. Unknown HIGH vẫn mở; nút duyệt Decision vẫn ẩn cho đến khi giải quyết unknown.
