# 0055 — Plugin `aifb-harness`: trần ngân sách, sổ quyết định, trace

## Vì sao cần

Bản đánh giá ngày 12/09/2026 (`KE-HOACH-AI-FOR-BOSS-HARNESS-SME.md`) chỉ ra ba khoảng trống so với nghiên cứu harness: không có trần cho một lượt việc nên một vòng lặp công cụ chạy tới khi hết hạn mức tài khoản; không có trí nhớ quyết định nên người dùng phải nhắc lại điều đã chốt; không có trace theo lượt nên mọi nhận định về chất lượng và chi phí đều là cảm giác. Lõi có sẵn các hook để lấp cả ba mà không đụng vào định tuyến mô hình.

Trong lúc rà, phát hiện thêm một lỗi cũ: `prepareDocumentTools` chỉ được gọi trong fixture `native-document-export-fixture.mjs`, chưa bao giờ được gọi từ `main.mjs`. Bộ xuất tài liệu đi kèm ứng dụng từ beta33 vì thế chưa từng được đăng ký với lõi trong bản chạy thật; công cụ `aifb_export_document` không xuất hiện với mô hình. Spec này sửa luôn bằng cùng một đường đăng ký.

## Quyết định

- Gói `packages/harness-plugin`, id `aifb-harness`, cùng hình dạng với `aifb-documents`: `openclaw.plugin.json` khai công cụ `aifb_record_decision` (tuỳ chọn) và thư mục `skills`, không phụ thuộc bên ngoài, sao chép nguyên vẹn vào `apps/desktop/resources/harness-plugin` bằng `scripts/stage-harness-plugin.mjs`.
- **Trần theo bước và token, không theo tiền.** Người dùng ưu tiên gói thuê bao đã trả (quyết định 4, 12/09/2026), nên tiền không phải đơn vị đo có nghĩa với họ. `llm_output` cộng `usage` vào lượt; `before_tool_call` đếm bước và trả `{block, blockReason}` bằng một câu tiếng Việt nói rõ đã dùng bao nhiêu trên trần nào và đề nghị nâng trần hay chốt. Công cụ `aifb_record_decision` không bao giờ bị chặn để mô hình vẫn ghi được điều người dùng vừa chốt. Không có hợp đồng thì dùng lưới an toàn 100 bước và 1,5 triệu token một lượt.
- **Sổ quyết định trong thư mục làm việc.** `aifb_record_decision` ghi `QUYET-DINH.md` (bảng người đọc) và `QUYET-DINH.jsonl` (máy đọc) tại gốc workspace của phiên, sau khi kiểm tra phiên chưa đổi, có quyền ghi, và gốc phiên trùng gốc chính sách tệp, đúng như bộ xuất tài liệu. `before_prompt_build` nạp tối đa mười quyết định gần nhất, giới hạn 2.500 ký tự, đặt trong `appendContext` (phần đuôi biến động) để không phá prompt cache.
- **Quy tắc điều hành là system context tĩnh.** Thân của `skills/quy-tac-dieu-hanh/SKILL.md` được đọc một lần và chèn qua `appendSystemContext` để nhà cung cấp cache được. Kỹ năng và khối chèn là cùng một tệp; không có bản sao thứ hai để lệch.
- **Trace.** `agent_end` ghi một dòng JSONL vào `<state>/aifb-harness/trace.jsonl`: chế độ, nhà cung cấp, mô hình, mức suy nghĩ, số lượt gọi, số bước, token, số lần bị chặn, kết quả, thời lượng. Sổ `ledger.json` cộng dồn theo phiên; `aifb.harness.usage` (scope `operator.admin`) đọc sổ đó cho trang sử dụng. Không ghi nội dung hội thoại.
- **Đăng ký plugin của vỏ.** `host-plugin-setup.mjs` tổng quát hoá `document-tools-setup.mjs`: danh sách cố định `HOST_PLUGINS` gồm hai id, kiểm manifest và hợp đồng công cụ, chỉ thay bản cũ cùng dòng cài đặt, cấp `allowConversationAccess` và `allowPromptInjection`, khởi động lại Gateway nhiều nhất một lần mỗi lần đổi. `main.mjs` gọi `prepareHostPlugins()` khi kênh thiết lập lên `connected`, tối đa hai lượt mỗi lần mở ứng dụng để cấu hình hỏng không thể tạo vòng lặp khởi động lại. `prepareDocumentTools` giữ nguyên chữ ký cho fixture và test cũ.
- `HostExecutionPolicy` thêm `aifb_record_decision` vào danh sách công cụ được thấy; sàn phê duyệt không đổi.

## Giữ nguyên

Không đổi mô hình hay nhà cung cấp trong bất kỳ hook nào. Không nới `SETUP_METHODS`; hai phương thức mới đi qua `workspaceRequest` như `aifb.documents.inspect`. Không đọc state riêng của OpenClaw ngoài `resolveStateDir()` mà API plugin cấp. Không ghi ra ngoài thư mục làm việc của phiên.

## Bằng chứng

- `tests/unit/harness-plugin.test.mjs`: bảng chế độ không chứa mô hình; chặn đúng ở bước thứ chín của chế độ Nhanh với câu tiếng Việt; công cụ quyết định không bị chặn; một dòng trace mỗi lượt với đúng số; sổ quyết định ghi bảng và JSONL, nạp lại mười dòng mới nhất; công cụ từ chối phiên chỉ đọc.
- `tests/unit/host-plugins.test.mjs`: manifest khớp hợp đồng; đăng ký thay đúng bản cũ cùng dòng và cấp hai quyền hook; `main.mjs` gọi đăng ký khi kết nối và có trần hai lượt; danh sách công cụ của host có `aifb_record_decision`.
- `tests/unit/document-tools-setup.test.mjs` giữ nguyên và vẫn đạt qua lớp tổng quát.
- Chưa chạy trên Gateway thật trong phiên này (môi trường không có lõi); smoke `native-document-export-fixture.mjs` trên CI Windows là bước xác nhận tiếp theo, và bản beta37 cài trên máy anh Lực là bằng chứng cuối.

## Chưa làm

Trang sử dụng trong giao diện mới có phương thức, chưa có màn hình; đợt sau. Bộ định tuyến mô hình theo chế độ cố ý không làm (quyết định 4). Xuất trace sang OTel để dành cho `diagnostics-otel`.
