# 0067 — Trang Nhà cung cấp theo mẫu, và đăng nhập một cú bấm

Trạng thái: Done trên nhánh `feat/0067-nha-cung-cap-theo-mau`, chờ Product Owner thử trên máy. Mở ngày 2026-09-25.

## Vấn đề

Ngày 25/09 Product Owner gửi hai ảnh chụp trang nhà cung cấp của AICoworker đang chạy trên máy mình và yêu cầu: giao diện chính xác như hình, đường kết nối đơn giản và thuận tiện, "không lằng nhằng nữa".

Đếm lại đường đăng nhập OpenAI trên beta44 theo mã lõi `2026.9.1`: lõi chạy luồng xác thực qua Gateway với `isRemote: true`, nên sau khi chọn hãng người dùng gặp lần lượt một ghi chú "remote/VPS", một ghi chú chứa đường dẫn (phải bấm Mở trang đăng nhập rồi bấm Đã đăng nhập xong), rồi một ô "Paste the redirect URL". Trong khi đó lõi vẫn tự mở máy nghe callback trên `localhost:1455` cùng máy, nên đăng nhập thường tự xong mà không cần dán gì. Ba cú bấm và một ô nhập thừa là chỗ "lằng nhằng".

## Quyết định

**1. Trang theo mẫu.** Thẻ nhà cung cấp: logo, tên hiển thị của lõi, mã lõi viết hoa đầu chữ, một thanh xám chứa khiên và viên trạng thái, ngôi sao, cây bút. Tài khoản treo dưới thẻ trên một đường dọc, khung viền đứt, số thứ tự, nhãn `primary`, dòng phụ "OAuth" hoặc "OAuth · email". Sáu biểu tượng mỗi dòng: mức dùng, nhãn, đăng nhập lại, lên, xuống, gỡ.

**2. Mỗi biểu tượng phải có đường thực thi thật** (giữ luật của 0063):

| Biểu tượng | Việc | Đường thực thi |
| --- | --- | --- |
| Ngôi sao (thẻ) | Chọn nhà cung cấp cho cuộc trò chuyện mới | `default-model-set` với mô hình khả dụng đầu tiên lõi báo cho hãng đó |
| Cây bút (thẻ) | Mở hộp thoại ở đúng hãng | `onConnect(provider)` → `initialQuery` |
| Biểu đồ (dòng) | Xem mức dùng | `usage` cấp nhà cung cấp; nói rõ là số của cả hãng |
| Nhãn (dòng) | Đặt tên phân biệt | `localStorage` của vỏ, không gửi vào lõi |
| Mũi tên vòng | Đăng nhập lại | như cây bút |
| ↑ ↓ | Đổi thứ tự dự phòng | `provider-order-set` |
| Thùng rác | Gỡ | `models.authLogout` |

0063 đã loại ngôi sao, nhãn và bút chì vì chưa có đường thực thi. Spec này gỡ lại cả ba với đường thực thi ghi ở bảng trên. Nhãn khác với ô đặt tên mà 0063 mục 3b loại: nó không giả vờ gửi vào lõi, `title` nói rõ "chỉ lưu trên máy này".

**3. Đăng nhập một cú bấm.** Khi bước của lõi mang `externalUrl` hoặc `deviceCode`, hộp thoại tự gọi `setup.openPage(sessionId)` (vẫn chỉ gửi mã phiên, host chỉ mở đường dẫn lõi trả về và đã qua `isAllowedSetupPage`). Mở được thì tự xác nhận ghi chú đăng nhập (ghi chú chỉ chờ "đã xem"), giữ mã thiết bị trên màn hình tới khi xong. Không mở được thì giữ nguyên đường tay cũ. Câu hỏi thật (select, multiselect, text) không bao giờ được trả lời thay người dùng. Ô "paste redirect URL" hiện như lối dự phòng, không tự lấy tiêu điểm.

**4. Hộp thoại gọn lại.** Chọn hãng được ngay khi mở (hãng có trong gói đi kèm), bước sau chờ lượt dò. Bỏ khối nhắc lại tài khoản (một RPC `models.authStatus` ít hơn mỗi lần mở) và hai nút cuối; "Tải lại danh sách" chỉ hiện khi lỗi hoặc rỗng. Kết nối sạch thì tự đóng sau 1,5 giây khi bộ chạy đã sẵn sàng.

## Cố ý không làm

- Không dựng thẻ Local LLM của ảnh mẫu. Đó là spec 0064, còn chờ đo bốn câu hỏi (cài plugin lúc chạy, llama-cpp hay ollama, dò phần cứng, nơi để mô hình nhiều GB).
- Không thêm OAuth cho Anthropic, Google hay Antigravity. Lõi không có tuyến này (Anthropic chỉ API key hoặc Claude Code; Google đã khoá; Antigravity chờ 0066). Ảnh mẫu hiện "OAuth đang hoạt động" cho các hãng này là việc của AICoworker, trang của mình chỉ hiện đúng thứ lõi báo.
- Không đổi hợp đồng IPC, không thêm phương thức vào `SETUP_METHODS` hay `ALLOWED_METHODS`.
- Không đọc hay sao chép gì từ AICoworker; chỉ dựng lại hình dạng nhìn thấy trên ảnh.

## Bằng chứng

- `pnpm verify` exit 0: 808 phép, 805 xanh, 0 hỏng, 3 bỏ qua (chạy cả ba phép PowerShell governance bằng pwsh 7.4).
- `tests/unit/provider-settings.test.mjs` viết lại theo hợp đồng mới: đúng 18 biểu tượng cho ba tài khoản cộng ngôi sao và bút trên mỗi thẻ, mỗi nút có `title` và `aria-label`; ngôi sao gọi đúng `default-model-set`; nhãn không gọi lõi.
- `tests/unit/connect-screen.test.mjs`: thêm phép cho tự mở trang và tự xác nhận đúng một lần; trang không mở được thì giữ đường tay; ô dán đường dẫn là dự phòng; chọn hãng trước khi dò xong; mở thẳng ở một hãng; tự đóng sau khi kết nối sạch.
- Ảnh chụp bản dựng thử (sáng, tối, hộp thoại, bước đăng nhập) đối chiếu với ảnh mẫu.
- Chưa có: `pnpm smoke:ui` trên Windows và thử tay trên máy Product Owner với ChatGPT, Grok và một API key.
