# 0056 — Ba nút hợp đồng tác vụ trong ô soạn

## Vì sao cần

Nghiên cứu harness đề xuất hợp đồng bốn trường cho mỗi việc: loại việc, mức rủi ro, mức tự chủ, trần ngân sách. Chủ doanh nghiệp nhỏ sẽ không điền bốn trường trước mỗi câu hỏi. Họ bấm được một nút.

## Quyết định

- Ba nút trong ô soạn, ngay trên ô nhập: **Nhanh**, **Kỹ**, **Quyết định quan trọng**. Bấm lần nữa để bỏ chọn. Nút gắn với phiên hiện tại và với `sessionId` hiện tại của phiên; `/new` hay xoá phiên làm hợp đồng hết hiệu lực.
- Bảng ánh xạ nằm ở một chỗ, `packages/harness-plugin/contract.mjs`: mỗi nút cho một thứ tự ưu tiên mức suy nghĩ, trần bước công cụ và trần token một lượt (8/60k, 30/300k, 60/800k). `apps/desktop/src/task-contract.ts` chỉ chép nhãn, gợi ý và thứ tự mức suy nghĩ; test khoá hai bản giống nhau và cấm trần xuất hiện ở phía giao diện.
- Nút **không đổi mô hình hay tài khoản** (quyết định 4, 12/09/2026). Nút chọn mức suy nghĩ trong số mức mà mô hình đang dùng thật sự cung cấp, qua đúng đường ghi đè theo lượt đã có (`changeThinking`), và gửi chế độ cho plugin qua `aifb.harness.contract` để plugin đặt trần và chèn một đoạn hướng dẫn tiếng Việt ở đuôi prompt.
- Với **Quyết định quan trọng**, đoạn hướng dẫn yêu cầu ít nhất hai phương án, điểm mạnh yếu, rủi ro, phương án nên loại, kết thúc bằng câu hỏi chốt, và gọi `aifb_record_decision` khi người dùng chốt. Advisor giữ vai giám sát như hiện tại; chưa ép bật Advisor theo nút ở đợt này.
- Bản đầu chỉ dùng luật và lựa chọn của người dùng. Không có bộ phân loại bằng mô hình; nó chỉ đến khi eval cho thấy người dùng chọn sai ở đâu.

## Luồng

1. Mở phiên, `chat.history` trả `sessionInfo.sessionId`; vỏ đọc hợp đồng hiện tại bằng `harness-contract` (không có `mode`) và tô nút.
2. Bấm nút: `harness-contract` với `mode`; plugin kiểm phiên chưa đổi rồi lưu; vỏ đổi mức suy nghĩ theo bảng nếu mô hình có mức đó; bỏ chọn thì trả mức suy nghĩ về Tự động.
3. Lượt gửi tiếp theo: `before_prompt_build` chèn hướng dẫn chế độ và dòng "đã dùng x/y bước, a/b token"; `before_tool_call` chặn khi vượt trần; `agent_end` ghi trace với chế độ.

## Giữ nguyên

Nút vô hiệu khi đang chạy, đang đổi mô hình, chưa có `sessionId`. Không gửi `sessions.patch` từ renderer. Không thêm phương thức nào vào `SETUP_METHODS`.

## Bằng chứng

- `tests/unit/composer.test.mjs`: ba radio, một cái được chọn, bấm lại thì bỏ, ẩn khi không có handler, khoá khi chưa biết `sessionId`, nằm trên ô nhập.
- `tests/unit/host-plugins.test.mjs`: bảng renderer trùng bảng plugin; `main.mjs` chỉ chuyển tiếp hai hành động `harness-*` qua broker.
- Kiểm tra bằng tay trên bản cài: chọn Nhanh rồi yêu cầu một việc cần hơn tám bước công cụ, phải thấy câu dừng tiếng Việt và lời đề nghị nâng trần.
