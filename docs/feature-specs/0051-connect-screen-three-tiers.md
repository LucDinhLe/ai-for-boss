# 0051 — Màn hình Kết nối AI theo ba bậc

## Vấn đề

Bản beta36 hiển thị trên một màn hình sáu khối khác nhau (danh sách 66 nhà cung cấp trong gói, thanh lọc theo thương hiệu, ứng dụng dò được, đăng nhập tài khoản, 14 nhóm nút API key, danh mục 35 phương thức của OpenClaw). Người dùng lần đầu không biết bắt đầu từ đâu, và màn hình trống tới khi lượt dò tài khoản trên máy (tối đa 30 giây) trả về. Hai lỗi luồng làm việc kết nối thất bại dù tài khoản hợp lệ: (1) `settle` tự huỷ trình hướng dẫn sau 90 giây trong khi `wizard.next` chặn trên Gateway cho tới khi người dùng đăng nhập xong trên trình duyệt; (2) kích hoạt xong thì Gateway khởi động lại, `ready` tụt xuống trong giây lát, biên nhận kích hoạt về sau mốc đó bị bỏ qua nên màn hình không bao giờ báo đã kết nối.

## Quyết định

- Ba bậc theo thứ tự ưu tiên cố định: **1. Đăng nhập bằng tài khoản có sẵn** (OAuth, mã thiết bị) → **2. Ứng dụng đã đăng nhập trên máy** (Claude Code, Codex CLI, kết nối đã lưu) → **3. Dán API key** (một ô chọn nhà cung cấp và một ô dán). Bậc 1 chỉ hiện bốn tài khoản phổ biến nhất, phần còn lại gập trong "Thêm cách đăng nhập khác".
- Thứ tự phổ biến nằm trong `provider-order.ts`, là trình bày thuần tuý (D-0022 giữ nguyên): ChatGPT/OpenAI, Claude/Anthropic, Gemini/Google, OpenRouter, GitHub Copilot, Grok/xAI, DeepSeek, MiniMax, rồi tới các tên còn lại theo bảng chữ cái. Vỏ không thêm bớt tuyến kết nối nào ngoài kết quả `openclaw.setup.detect`.
- Trước khi lượt dò trả về, danh sách gói đi kèm chỉ dựng khung ba bậc ở trạng thái mờ và không bấm được. Kết quả dò gần nhất được giữ trong bộ nhớ phiên để mở lại màn hình là thấy ngay; mất kết nối Gateway thì xoá.
- Thẻ trạng thái ở đầu màn hình đọc `configuredModel` từ lượt dò và `models.authStatus` để nói rõ đang dùng mô hình nào, tài khoản nào còn hạn. Chỉ gọi `models.authStatus` khi đã có tuyến kết nối.
- Bỏ khối danh mục 35 phương thức, thanh lọc thương hiệu, ô tìm kiếm và nút mở tài liệu OpenClaw khỏi màn hình này.
- Luồng: `settle` không còn hạn 90 giây; kênh thiết lập cho `wizard.next` chờ tới 26 phút (Gateway tự hết hạn phiên đăng nhập sau 25 phút). Biên nhận kích hoạt cuối cùng (`done`, `status: done`, `modelActivation.modelRef`) luôn được hiển thị dù thẻ luồng đã đổi vì Gateway khởi động lại; bước đang chờ thì vẫn không được nối lại qua mốc đó.
- Nút tiếp tục ở bước đăng nhập đổi thành "Đã đăng nhập xong, tiếp tục" để người dùng biết thứ tự hai thao tác.

## Bằng chứng

- `tests/unit/connect-screen.test.mjs`: 27 phép thử, gồm thứ tự phổ biến và gập phần đuôi, khung mờ không bấm được, bộ chọn API key và ghi chú Google, thẻ trạng thái, biên nhận sống qua khởi động lại, đăng nhập dài không bị huỷ; các bất biến cũ (một luồng một lúc, huỷ đúng phiên, không bịa câu trả lời, không nối lại bước cũ sau khi mất kết nối) giữ nguyên.
- `scripts/first-session-ui-smoke.cjs` đã cập nhật theo giao diện mới nhưng chưa chạy lại trong lượt sửa này; cần chạy `pnpm smoke:ui` trước khi đóng gói beta37.

## Cài đặt → Nhà cung cấp

Trang này trước đây mở thẳng danh mục 66 tên và gọi `openclaw.setup.detect` mỗi lần mở. Nay `ProviderSettings.tsx` dẫn đầu bằng thẻ "Tài khoản đang dùng" (đọc từ danh sách mô hình khả dụng, không gọi thêm RPC), một nút vào màn hình Kết nối AI, và danh mục đầy đủ chỉ được gắn khi người dùng bấm "Xem toàn bộ danh mục". Test: `tests/unit/provider-settings.test.mjs`.

## Ngoài phạm vi

Đăng xuất tài khoản (`models.authLogout`) từ màn hình này; rút ngắn thời gian dò của OpenClaw (thuộc lõi).
