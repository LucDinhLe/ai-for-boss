# 0054 — Phát hành bộ cài Windows bằng máy chủ GitHub

## Vấn đề

Gộp mã vào `main` không tạo ra bản cài. Bộ cài được dựng tay trên một máy Windows có NSIS, Node 24.19.0 và pnpm 11.2.2, nên sau khi PR #9 và #10 được gộp, trang chủ vẫn trỏ về beta36 và người dùng vẫn tải bản dựng ngày 09/09. Ba nguồn có thể lệch nhau mà không ai biết: số phiên bản trong `apps/desktop/package.json`, đường dẫn tải trong README, và danh sách Releases.

## Quyết định

- Thêm `.github/workflows/release-windows.yml`, chạy khi bấm tay trong tab Actions, nhận vào số phiên bản và một tuỳ chọn chạy thử. Quy trình chạy đúng các script sẵn có: `pnpm verify`, `stage:runtime`, `package:desktop`, `validate-feature-0.4 --require-artifact`, rồi `scripts/build-internal-installer.mjs`. Không có đường dựng thứ hai để lệch với đường dựng tay.
- Bước đầu tiên từ chối chạy nếu số phiên bản nhập vào không khớp `apps/desktop/package.json`, hoặc README chưa nhắc tới phiên bản đó. Đây chính là cái đã để trang chủ trôi khỏi mã nguồn; nay muốn phát hành thì phải sửa cả ba chỗ trên `main` trước.
- NSIS lấy từ runner `windows-latest`; nếu thiếu thì cài qua choco. Dựng xong ghi vào phần tóm tắt của lượt chạy: số tệp trong gói, dung lượng, và mã SHA256 của bộ cài. Số tệp là con số đáng báo cáo vì chi phí cài trên Windows tính theo số tệp, và đó cũng là cách duy nhất đo trung thực việc tỉa ở spec 0052.
- Bộ cài và tệp manifest luôn được tải lên làm artifact của lượt chạy, kể cả khi thất bại. Chỉ khi không chọn chạy thử thì mới tạo release, luôn ở dạng pre-release, bằng `gh` với `github.token` thay vì thêm một action bên thứ ba.
- Action được ghim theo SHA như các workflow khác trong kho.

## Ngoài phạm vi, có chủ ý

Kênh cập nhật trong ứng dụng đọc `releases/preview.json`, một phong bì ký Ed25519. Làm mới tệp đó cần khoá ký riêng mà Product Owner đang giữ. Đưa khoá ký vào CI là một quyết định bảo mật riêng, không gộp vào lần này. Hệ quả phải nói rõ với người dùng: bản dựng từ quy trình này chưa xuất hiện trong Cài đặt → Giới thiệu & cập nhật, phải tải thủ công từ trang phát hành. README và ghi chú phát hành đều ghi điều này.

Ký Authenticode cho bộ cài cũng chưa có, không đổi so với trước.

## Bằng chứng

- `tests/unit/release-workflow.test.mjs`: phiên bản trong README và `apps/desktop/package.json` phải trùng nhau (chính là lỗi đã xảy ra), quy trình phải ghim action theo SHA, phải kiểm tra phiên bản trước khi dựng, phải phát hành ở dạng pre-release, và không được nhắc tới khoá ký.
- Bản thân lượt chạy đầu tiên là bằng chứng còn lại: chưa có bộ cài nào được dựng bằng quy trình này. Chạy thử trước với tuỳ chọn chạy thử để xem lượt dựng có xanh không, rồi mới phát hành thật.

## Cách dùng

Sửa `apps/desktop/package.json`, README và CHANGELOG trên `main` cho phiên bản mới. Vào tab Actions, chọn "Release Windows installer", bấm "Run workflow", nhập đúng số phiên bản đó. Khoảng ba mươi tới sáu mươi phút sau, bản thử nghiệm xuất hiện trong mục Releases kèm mã SHA256 và số tệp.

## Lượt chạy đầu tiên, 12/09/2026

Lượt `Release Windows installer #2` (dry run) đi qua kiểm phiên bản, cài phụ thuộc, governance, `pnpm verify` (1 phút 9 giây) và dừng ở `stage:runtime` sau 2 phút 10 giây. Trước khi dừng nó in ra số liệu đầu tiên của spec 0052: **tỉa 12.161 tệp khai báo kiểu và bản đồ mã nguồn (89,8 MiB), cây OpenClaw còn 22.218 tệp.**

Nguyên nhân dừng: `stage-channel-installer.mjs` ghi lại cấu trúc phụ thuộc bắc cầu của từng plugin nhắn tin trong `manifests/channel-installer` và đòi lượt phân giải mới phải trùng khớp tuyệt đối. Một gói bắc cầu trong `@openclaw/discord@2026.9.1` đã ra bản vá trong hai ngày kể từ lần ghi, nên cổng này chặn đúng như thiết kế. Đây là cái giá thường trực của cách ghim này: bất kỳ bản vá thượng nguồn nào trong bốn cấu trúc plugin cũng dừng bản dựng cho tới khi có người rà.

Xử lý: thêm chế độ ghim lại có rà soát. `AIFB_REPIN_CHANNEL_PLUGINS=1` đổi lệnh từ chối thành ghi đè tệp đã ghi kèm danh sách gói đổi phiên bản; workflow `Repin channel plugins` chạy chế độ đó trên runner sạch, đẩy thay đổi lên nhánh `chore/repin-channel-plugins-<số lượt>` và in đường dẫn mở pull request. Quy trình phát hành không bao giờ bật cờ này (có test). Thứ tự khi gặp lại: chạy Repin, mở và gộp PR, chạy lại Release.
