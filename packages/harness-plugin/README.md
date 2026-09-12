# AI for Boss Harness (`aifb-harness`)

Plugin OpenClaw do vỏ AI for Boss sở hữu, cùng hình dạng với `aifb-documents`. Không có phụ thuộc bên ngoài, được sao chép nguyên vẹn vào `apps/desktop/resources/harness-plugin` khi build.

Bốn khối, theo spec 0055 và 0056:

- **Hợp đồng tác vụ.** Ba nút trong ô soạn (Nhanh, Kỹ, Quyết định quan trọng) ánh xạ xuống mức suy nghĩ ưu tiên, trần bước công cụ và trần token cho một lượt (`contract.mjs`). Nút không đổi mô hình hay tài khoản (quyết định 12/09/2026).
- **Trần và điều kiện dừng.** `llm_output` cộng token, `before_tool_call` đếm bước và chặn khi vượt trần với một câu tiếng Việt nói rõ đã dùng bao nhiêu (`ledger.mjs`).
- **Sổ quyết định.** Công cụ `aifb_record_decision` ghi `QUYET-DINH.md` và `QUYET-DINH.jsonl` trong thư mục làm việc; mười quyết định gần nhất được nạp ở phần đuôi biến động của prompt (`decisions.mjs`).
- **Trace.** `agent_end` ghi một dòng JSONL mỗi lượt vào `<state>/aifb-harness/trace.jsonl`; `aifb.harness.usage` đọc cùng sổ cho trang sử dụng.

Thư mục `skills/` chứa mười hai kỹ năng doanh nghiệp tiếng Việt, được lõi nạp như kỹ năng plugin (tầng thấp nhất, cùng cơ chế `agents.<id>.skills` để giới hạn theo agent). `quy-tac-dieu-hanh` vừa là kỹ năng vừa là nguồn duy nhất của khối quy tắc tĩnh mà plugin chèn vào system prompt.
