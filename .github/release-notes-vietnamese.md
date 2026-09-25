# Hermes Vietnamese 2026.9.5

<!-- current-release:start -->
> **Latest hiện tại là [2026.9.5](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/v2026.9.5), dành cho Windows x64, macOS Apple Silicon và Linux x64.** Đây là community pilot chưa phải stable; Windows chưa ký số, macOS ký ad-hoc, Linux không có cơ chế ký. Ứng dụng báo khi có bản mới kèm SHA-256, không tự tải hay tự cài. Trên macOS, lần mở đầu vào **System Settings → Privacy & Security** bấm **Open Anyway**; nếu báo "damaged", chạy `xattr -cr /Applications/HermesVietnamese.app`. Trên Linux, cấp quyền chạy cho AppImage (`chmod +x`) hoặc cài gói deb.

| Nền tảng | Tải xuống | Kích thước (byte) | SHA-256 |
| --- | --- | --- | --- |
| Windows x64 | [Hermes-2026.9.5-win-x64.exe](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.5/Hermes-2026.9.5-win-x64.exe) | 345901323 | `7fa2e5a4f0d6ced745a927feabd8129e2c80bac1da7b287df7855e3bf8d88592` |
| macOS Apple Silicon | [Hermes-2026.9.5-mac-arm64.dmg](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.5/Hermes-2026.9.5-mac-arm64.dmg) | 385670174 | `eef10d882036563b08c4168bf210ee890461ede6fcd3b20514f21336f56547e6` |
| Linux x64 AppImage | [Hermes-2026.9.5-linux-x86_64.AppImage](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.5/Hermes-2026.9.5-linux-x86_64.AppImage) | 397565884 | `c6d52f44023444fb7cb0511a74fc4113039d4332228832c36a1bb393489f2683` |
| Linux x64 deb | [Hermes-2026.9.5-linux-amd64.deb](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.5/Hermes-2026.9.5-linux-amd64.deb) | 320912888 | `36c022d44f1c55fab3ea94fb02d1bba46285897ae404195dd91863f32889e8cd` |
| Mã kiểm tra toàn vẹn | [SHA256SUMS.txt](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.5/SHA256SUMS.txt) | | |
<!-- current-release:end -->

## Thay đổi

- Hết cảnh báo "Dịch vụ nền đã cũ" lặp lại. Giao diện và lõi đọc cùng một số hợp đồng (6), bản đóng gói sẵn không còn nút cập nhật tại chỗ dễ làm hỏng lõi.
- Hết nhấp nháy ô chat và nút model xoay tròn. Kết nối phụ đang gắn với một phiên chạy không còn bị lõi đóng sau 20 giây rồi mở lại.
- Terminal không còn giật con trỏ khỏi ô chat; ô chat giữ nguyên chữ đang gõ khi kết nối lại.
- Giảm lỗi socket hang up và ECONNRESET. Kết nối giữ sống đóng trước khi lõi đóng, yêu cầu an toàn được thử lại một lần.
- Cây thư mục không còn tự thu gọn khi nạp lại, các thư mục đang mở được giữ theo từng dự án.
- Ô tìm tệp kiểu Ctrl+P của VS Code: ưu tiên tên tệp, gõ không dấu vẫn tìm được, có danh sách mở gần đây, Enter để mở, Ctrl+Enter để đưa tệp vào ô chat.

## Bằng chứng và giới hạn

Bộ kiểm thử giao diện đạt toàn bộ, trừ 6 bài ChatView đã hỏng sẵn trên main từ trước. Cùng mã nguồn này đã chạy dưới tên bản thử nghiệm [v2026.9.5-thunghiem.4](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/v2026.9.5-thunghiem.4) trên máy Windows x64 thật của chủ dự án; nhật ký không còn vòng nạp lại 20 giây và ô tìm tệp chạy đúng. Bộ cài Latest được dựng lại từ tag v2026.9.5 nên khác byte với bản thử nghiệm.

Đây là community pilot, chưa phải stable. Windows chưa ký số, macOS ký ad-hoc, Linux không có cơ chế ký. macOS và Linux mới được dựng, chưa thử trên máy thật. Chưa đo bộ nhớ khi chạy dài ngày; SQLite đóng kèm chưa nâng lên 3.50.7; tìm tệp chưa hỗ trợ kết nối từ xa.

## Cài đè và quay lui

Sao lưu, kiểm tra bản sao, chờ công việc xong rồi đóng ứng dụng/gateway nền trước khi cài. Cài đè giữ dữ liệu theo thiết kế; không chọn gỡ toàn bộ để nâng cấp. Kiểm tra lịch sử và kết nối sau cài. Bản quay lui là [2026.9.4](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/v2026.9.4); giữ bản sao dữ liệu mới hơn trước mọi lần khôi phục.

Xem [hướng dẫn cài đặt](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md) và [sao lưu/khôi phục](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/docs/sao-luu-khoi-phuc.md).

Bản cộng đồng chưa ký số. Không tắt Defender/SmartScreen trên toàn máy; nếu phát hiện mối đe dọa cụ thể, dừng và báo lỗi. Dự án đang hoàn thiện để nộp lại hồ sơ ký số, chưa có chữ ký mới hoặc xác nhận chấp thuận trong đợt này. Không có update feed tự động.
