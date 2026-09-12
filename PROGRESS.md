# PROGRESS — AI for Boss

Cập nhật: 2026-09-12
Nhánh: `main` (mục lịch sử bên dưới ghi theo `experiment/beta-0`)
Base: `8f43070` (hợp nhất `feature/0.6-sandbox-feasibility` vào nhánh thử nghiệm)

## Trạng thái 2026-09-12

Beta37 đang chờ phát hành bằng workflow GitHub sau khi gộp bản ghim lại plugin kênh (spec 0054). Trên main đã có: màn hình Kết nối ba bậc (0051), tỉa runtime (0052), gỡ cài đặt trong .NET (0053), quy trình phát hành (0054). Nhánh `feat/harness-sme` mang đợt một của kế hoạch harness cho SME: plugin `aifb-harness` (0055), ba nút hợp đồng (0056), gói mười hai kỹ năng (0057), bốn mẫu agent (0058), và sửa lỗi bộ xuất tài liệu chưa từng được đăng ký. Còn lại theo kế hoạch: trang sử dụng, bảng dịch quyền xuống chế độ phiên (0060), kho eval riêng (0061), khoá ký vào CI.

## Phạm vi phiên beta 0 (lịch sử)

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
- CI Desktop shell #16 (commit `ac4b9e2`) xanh cả ba nền tảng, mỗi nền tảng để lại một artifact smoke có digest: Windows `573143ac…`, macOS `1686666f…`, Linux `8f78b10a…`.

## Câu hỏi WSL đã có câu trả lời

Windows chạy Gateway **nguyên bản, không cần WSL2**. Runner `windows-latest` khởi động tiến trình con bằng Node thật, Gateway lắng nghe với 13 plugin và handshake `operator` hoàn tất.

Lượt CI đầu tiên trên Windows lộ một lỗi thật: khi thư mục dữ liệu là đường dẫn 8.3 (`C:\Users\RUNNER~1\…`), bộ theo dõi tệp libuv bên trong OpenClaw tự bắn `Assertion failed: !_wcsnicmp` và giết tiến trình với mã `3221226505`, Gateway sập thành vòng lặp khởi động lại. Supervisor xử lý đúng, ba lần rồi Safe Mode. Host nay giải mọi đường dẫn sang dạng dài bằng `realpathSync.native` trước khi trao cho tiến trình con, và lượt sau xanh. Ghi ở R-034, còn nợ một báo cáo ngược thượng nguồn.

## Kế thừa từ Feature 0.6 (`feature/0.6-sandbox-feasibility`)

- Product Owner chưa chấp nhận backend production nào cho sandbox; mặc định vẫn là execution blocked, sandbox off, workspace và network `none`, không tự fallback về host.
- R-028, R-029 và R-030 vẫn Open: container daemon và bind mount mở rộng blast radius, remote sandbox làm dữ liệu rời thiết bị, native restriction khác nhau theo OS tạo parity giả. Beta 0 không chạm vào ba rủi ro này và không mở bất kỳ đường thực thi nào.

## Chưa xong và biết rõ

- Windows và macOS chưa có bằng chứng; câu trả lời cho câu hỏi WSL2 nằm ở lượt CI đầu tiên trên nhánh này (R-031).
- Runtime agent mặc định là `codex` và harness đó vắng mặt, nên lượt chạy báo lỗi trước khi gọi model. Ứng dụng hiển thị nguyên văn lỗi (R-032).
- Bản đóng gói vẫn chưa mang theo Node runtime nên chưa chạy được trên máy sạch; đó là việc của bước bộ cài.
- Senior platform/security review độc lập vẫn là điều kiện chưa đạt của Cổng 0.

## Bước nhỏ kế tiếp

Đọc kết quả smoke ba nền tảng từ CI của nhánh này, rồi quyết định: chọn agent runtime `openclaw` cùng đường xác thực nhà cung cấp (bước 2), hay xử lý trước ràng buộc WSL nếu Windows thất bại.
