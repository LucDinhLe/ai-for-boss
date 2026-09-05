# PROGRESS — AI for Boss

Cập nhật: 2026-09-05
Nhánh: `experiment/beta-0`
Base: `8f43070` (hợp nhất `feature/0.6-sandbox-feasibility` vào nhánh thử nghiệm)

## Phạm vi phiên này

Beta 0: nuôi một Gateway OpenClaw thật bên trong ứng dụng và mở một cửa sổ trò chuyện tối thiểu trên đó. Không làm bộ cài, updater, kết nối nhà cung cấp model, Advisor thật, tool, duyệt hành động hay quản lý dự án.

## Đã hoàn thành

- Supervisor: cổng loopback do hệ điều hành cấp, token sinh mới mỗi lần mở, spawn gói `openclaw` đã cài bằng Node runtime thật, bộ biến môi trường nhúng theo `docs/gateway/embedding.md`, xử lý mã thoát 78 bằng một lượt `doctor --fix`, khởi động lại tối đa ba lần mỗi phút rồi Safe Mode, tắt sạch khi thoát.
- Danh tính thiết bị Ed25519 do host giữ; `deviceId` dẫn xuất bằng đúng luật của Gateway; device token lưu theo vai trò; tệp hỏng hoặc bị sửa thì thay chứ không tin.
- Adapter trên `@openclaw/gateway-client` công khai: handshake, vai trò `operator` với ba scope của chat, danh sách 18 phương thức cho phép, 7 sự kiện được chuyển tiếp.
- Cầu IPC đóng: ba kênh gọi vào, một helper nhận sự kiện, mọi lệnh kiểm tra người gửi rồi đối chiếu danh sách cho phép ở tiến trình chính.
- Cửa sổ trò chuyện: danh sách phiên, tạo phiên, gửi và dừng lượt chạy, transcript theo thời gian thực, đồng hồ dung lượng ngữ cảnh, bảng trạng thái nền, ô Advisor ghi rõ "chưa bật", tiếng Việt.
- Hành trình first-run bằng fixture chuyển sang `apps/desktop/src/first-run/`, giữ nguyên mọi bất biến Feature 0.5.
- Smoke tích hợp chạy chính Supervisor và Adapter của sản phẩm; thêm vào CI cho Windows, macOS và Linux.
- Candidate train `oc-2026.9.1-candidate.1` tách khỏi locked train, kèm năm điều kiện chưa đạt.

## Bằng chứng

- `pnpm verify` xanh: 105 test, lint, typecheck, build, bốn validator.
- `artifacts/beta-0/gateway-smoke-linux-x64.json`: handshake đạt trong 7,5 giây, giao thức v4, máy chủ 2026.9.1, 388 phương thức, bảy RPC đọc đạt, `config.patch` bị chặn đúng như thiết kế, không dùng Linux subsystem.
- `artifacts/beta-0/app-launch-linux-x64.json`: ứng dụng Electron chạy thật dưới Xvfb, nuôi tiến trình con, được Gateway duyệt thiết bị với vai trò `operator`, lần mở thứ hai dùng lại danh tính đã lưu.
- `artifacts/beta-0/gateway-handshake.json`: danh mục đầy đủ 388 phương thức và 61 sự kiện của bản đã ghim, dùng làm cơ sở cho các bước sau.

## Chưa xong và biết rõ

- Windows và macOS chưa có bằng chứng; câu trả lời cho câu hỏi WSL2 nằm ở lượt CI đầu tiên trên nhánh này (R-031).
- Runtime agent mặc định là `codex` và harness đó vắng mặt, nên lượt chạy báo lỗi trước khi gọi model. Ứng dụng hiển thị nguyên văn lỗi (R-032).
- Bản đóng gói vẫn chưa mang theo Node runtime nên chưa chạy được trên máy sạch; đó là việc của bước bộ cài.
- Senior platform/security review độc lập vẫn là điều kiện chưa đạt của Cổng 0.

## Bước nhỏ kế tiếp

Đọc kết quả smoke ba nền tảng từ CI của nhánh này, rồi quyết định: chọn agent runtime `openclaw` cùng đường xác thực nhà cung cấp (bước 2), hay xử lý trước ràng buộc WSL nếu Windows thất bại.
