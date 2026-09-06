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
- `artifacts/beta-0/packaged-runtime-linux-x64.json`: gói đã đóng khởi động Gateway với `PATH` rỗng, dùng node và OpenClaw của chính nó, handshake 15,6 giây, `health` đạt.
- `artifacts/beta-0/provider-verify-linux-x64.json`: kết nối thật đầu cuối trên Linux, `verify` đạt sau 1.865 ms với `anthropic/claude-opus-5`, model của trợ lý rời mặc định `openai/gpt-5.6-sol`, một lượt chat có trả lời sau 8.465 ms, không có failure.
- `pnpm verify:provider --list` trên Linux đọc được danh mục lõi: một ứng viên tự phát hiện và mười sáu nhà cung cấp khai báo tay, gom thành mười bốn nhóm.
- CI Desktop shell #16 (commit `ac4b9e2`) xanh cả ba nền tảng, mỗi nền tảng để lại một artifact smoke có digest: Windows `573143ac…`, macOS `1686666f…`, Linux `8f78b10a…`.

## Câu hỏi WSL đã có câu trả lời

Windows chạy Gateway **nguyên bản, không cần WSL2**. Runner `windows-latest` khởi động tiến trình con bằng Node thật, Gateway lắng nghe với 13 plugin và handshake `operator` hoàn tất.

Lượt CI đầu tiên trên Windows lộ một lỗi thật: khi thư mục dữ liệu là đường dẫn 8.3 (`C:\Users\RUNNER~1\…`), bộ theo dõi tệp libuv bên trong OpenClaw tự bắn `Assertion failed: !_wcsnicmp` và giết tiến trình với mã `3221226505`, Gateway sập thành vòng lặp khởi động lại. Supervisor xử lý đúng, ba lần rồi Safe Mode. Host nay giải mọi đường dẫn sang dạng dài bằng `realpathSync.native` trước khi trao cho tiến trình con, và lượt sau xanh. Ghi ở R-034, còn nợ một báo cáo ngược thượng nguồn.

## Kế thừa từ Feature 0.6 (`feature/0.6-sandbox-feasibility`)

- Product Owner chưa chấp nhận backend production nào cho sandbox; mặc định vẫn là execution blocked, sandbox off, workspace và network `none`, không tự fallback về host.
- R-028, R-029 và R-030 vẫn Open: container daemon và bind mount mở rộng blast radius, remote sandbox làm dữ liệu rời thiết bị, native restriction khác nhau theo OS tạo parity giả. Beta 0 không chạm vào ba rủi ro này và không mở bất kỳ đường thực thi nào.

## Chưa xong và biết rõ

- Lần kiểm nhà cung cấp thật mới chạy trên Linux. Windows và macOS chưa chạy, đó là điều kiện chưa đạt còn lại của candidate train (R-032).
- Gói đã mang theo Node runtime và OpenClaw, nhưng nặng khoảng 900 MB một nền tảng nên chưa đưa cho người dùng tải được (R-035).
- Bộ cài thật, chữ ký số và cập nhật tự động vẫn chưa có.
- Senior platform/security review độc lập vẫn là điều kiện chưa đạt của Cổng 0.

## Bước nhỏ kế tiếp

Giảm dung lượng gói xuống mức tải được, rồi bọc nó thành bộ cài Windows.
