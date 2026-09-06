# Feature Spec — Màn hình Kết nối model

## 1. Trạng thái

- Cổng: 1, tiếp nối beta 0
- Owner kỹ thuật: Fable; chờ senior platform/security reviewer trước khi qua Cổng 1
- Product Owner: Lê Đình Lực
- Trạng thái: đang thi công trên nhánh `feature/connect-screen`
- Ngày mở: 2026-09-05
- Điểm xuất phát đã xác minh: `3675ded` (beta 0 đã gộp vào `main`)
- Phân loại artifact: `experimental-internal`

## 2. Mục tiêu vận hành

Người dùng nối được model của họ mà không mở terminal, không đọc tài liệu, không phải biết OpenClaw là gì.

Chỉ thị của Product Owner: **"OpenClaw cứ có kết nối gì thì bê ra kết nối đó."** Nghĩa là màn hình này không chọn lọc nhà cung cấp. Danh mục do lõi báo lên lúc chạy, nên nhà cung cấp OpenClaw thêm sau này tự xuất hiện mà không phải sửa một dòng mã nào trong vỏ.

## 3. Trong phạm vi

- Kênh cài đặt riêng trong tiến trình chính, mang scope `operator.admin`, chỉ gọi được mười phương thức của việc nối model. Adapter chat giữ nguyên ba scope cũ.
- `openclaw.setup.detect` mở màn: hiện trước những gì đã có sẵn trên máy, ví dụ một phiên Claude Code đang đăng nhập, rồi mới tới danh mục đầy đủ theo nhóm nhà cung cấp.
- `openclaw.setup.activate.start` và `openclaw.setup.auth.start` khởi động luồng xác thực, `wizard.next` đi tiếp, `wizard.cancel` dừng giữa chừng.
- Trình vẽ bước tổng quát cho bảy loại bước của lõi: note, select, text, confirm, multiselect, progress, action.
- Lớp tiếng Việt hai tầng: khung và nút luôn tiếng Việt; nội dung bước được dịch khi nhận ra chữ ký quen thuộc, còn lại hiện nguyên văn kèm ghi chú nói rõ đây là chữ của OpenClaw.
- `openclaw.setup.verify` gọi thử model thật và hiển thị độ trễ, thay cho việc đoán là đã nối xong.
- Kích hoạt nhà cung cấp làm Gateway yêu cầu khởi động lại; Supervisor tự lo, hai kênh nối lại, giao diện không bao giờ nói chuyện với một tiến trình đã chết.

## 4. Ngoài phạm vi

- Bộ cài, ký số, updater.
- Advisor thật, tool, duyệt hành động, quản lý dự án.
- Sửa cấu hình OpenClaw ngoài luồng xác thực. `config.*`, `secrets.*`, `plugins.*`, `tools.*`, `exec.*`, `terminal.*` bị chặn ngay cả trên kênh cài đặt.
- Dịch trọn vẹn mọi bước của lõi. Bản này dịch những bước nhận ra được, phần còn lại vá dần ở các bản sau theo chỉ thị của Product Owner.
- Onboarding toàn phần của OpenClaw. Luồng `wizard.start` mặc định hỏi cả cổng Gateway, chế độ mạng và telemetry, tức là giẫm lên phần Supervisor đã sở hữu, nên không dùng.

## 5. Giả định và điểm chưa chắc

- `openclaw.setup.*` và `wizard.*` đòi `operator.admin`. Ở đây admin chỉ có nghĩa quản trị chính tiến trình con của ứng dụng, chạy loopback với token do ứng dụng sinh, không phải quản trị thứ gì của người dùng.
- Danh mục đo được trên một máy trắng là 16 nhà cung cấp trong 14 nhóm, cộng các mục tự phát hiện. Con số này thay đổi theo plugin đã cài, nên vỏ không được ghi cứng.
- Chữ ký nhận dạng bước sẽ trượt khi thượng nguồn đổi câu chữ. Hậu quả là bước đó rơi về hiển thị nguyên văn, không phải dịch sai.

## 6. Trường hợp biên và hành vi khi lỗi

| Trường hợp | Hành vi mong đợi |
|---|---|
| Kênh cài đặt chưa kết nối | Nút "Kết nối model" bị khoá, bảng trạng thái ghi rõ |
| Renderer gọi phương thức ngoài danh sách cài đặt | Tiến trình chính từ chối kèm tên phương thức |
| Renderer gọi `config.patch` qua kênh cài đặt | Bộ chặn theo tiền tố từ chối trước cả danh sách cho phép |
| Bước lạ, chưa có bản dịch | Hiện nguyên văn tiếng Anh kèm ghi chú, không đoán nghĩa |
| Người dùng huỷ giữa chừng | `wizard.cancel`, quay về danh mục, không để lại phiên treo |
| Kích hoạt xong Gateway đòi khởi động lại | Supervisor dừng và chạy lại tiến trình con, hai kênh nối lại rồi mới trả kết quả |
| Kiểm tra kết nối thất bại | Hiện nguyên trạng thái lõi trả về, ví dụ `auth`, `billing`, `rate_limit`, không nuốt |

## 7. Tiêu chí nghiệm thu

1. `pnpm verify` xanh.
2. Smoke ba nền tảng chứng minh kênh cài đặt kết nối được, đọc được danh mục, và bị từ chối khi gọi `config.patch`.
3. Không có tên nhà cung cấp nào bị ghi cứng trong vỏ, có test chứng minh.
4. Adapter chat vẫn không mang scope admin, có test chứng minh.
5. Bước không nhận dạng được thì hiện nguyên văn kèm ghi chú.

## 8. Rollback

Nhánh riêng, `main` không đổi cho tới khi gộp. Bỏ nhánh là quay lui đầy đủ.

## 9. Quyết định liên quan

- D-0021 tách quyền admin sang một kênh riêng thay vì nới scope của adapter chat.
- D-0022 danh mục nhà cung cấp lấy từ lõi lúc chạy, vỏ không giữ danh sách riêng.
