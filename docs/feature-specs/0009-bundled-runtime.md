# 0009 — Gói mang theo runtime, chạy được trên máy trắng

- Trạng thái: Đã làm, chờ review
- Phân loại: `experimental-internal`
- Candidate train: `oc-2026.9.1-candidate.1`
- Liên quan: D-0027, D-0028, R-034, R-035, Feature 0.4, Beta 0

## Vấn đề

Bản đóng gói của Feature 0.4 chạy được trên máy lập trình và không chạy được trên máy người dùng. Hai lý do, cả hai đều nằm ở chỗ gói không tự đủ.

Tiến trình con của Gateway cần một Node nằm trong khoảng OpenClaw chấp nhận. Máy người dùng phổ thông không có Node, hoặc có bản quá cũ, và thông điệp lỗi khi đó là một câu tiếng Anh bảo họ cài nvm.

`node_modules` bị loại khỏi `app.asar` một cách cố ý, nên trong gói không hề có OpenClaw. Ở môi trường phát triển, `import.meta.resolve` tìm thấy gói trong workspace và mọi thứ có vẻ ổn, đó là ảo giác của máy lập trình.

Không giải quyết hai điều này thì bộ cài chỉ là một lớp bọc quanh một ứng dụng không khởi động được.

## Phạm vi

Gói mang theo đúng hai thứ nó cần, Node runtime và một bản cài OpenClaw thật, cùng bằng chứng máy đọc được rằng gói khởi động Gateway khi trên máy không có gì.

## Ngoài phạm vi

Bộ cài thật, chữ ký số, cập nhật tự động, và việc giảm dung lượng. Bốn thứ đó là các bước sau và không được tuyên bố ở bản này.

## Cách làm

`manifests/runtime/bundled-runtime.lock.json` ghim phiên bản Node cùng sha256 của từng gói tải, chép từ `SHASUMS256.txt` chính thức. Ghim theo từng nền tảng và kiến trúc, gồm Windows x64, macOS arm64 và x64, Linux x64 và arm64.

`scripts/stage-runtime.mjs` tải đúng gói đã ghim, so digest trước khi giải nén và dừng hẳn nếu lệch, rồi lấy duy nhất nhị phân `node`. npm, corepack và phần còn lại của bản phân phối không vào gói. Cùng script cài cây OpenClaw đúng phiên bản mà `apps/desktop` ghim, thành một bản cài thật chứ không phải bản chép dẹt, nên tiến trình con giải phụ thuộc y như lúc phát triển. Danh sách gói được phép chạy script cài đặt đọc từ `pnpm-workspace.yaml`, một nguồn sự thật duy nhất cho cả cây phát triển lẫn cây đóng gói.

`scripts/package-desktop.mjs` đưa hai thư mục đó vào gói dưới dạng tài nguyên đi kèm, giữ chúng ngoài `app.asar`, và ghi vào bản kiểm kê phiên bản Node, digest của nhị phân, cùng ba phiên bản OpenClaw. Gói không có runtime vẫn đóng được và bản kiểm kê nói thẳng `selfContained: false`.

`resolveOpenClawEntry` ưu tiên bản cài trong gói, chỉ lùi về workspace khi không có. `resolveNodeExecutable` đã ưu tiên runtime trong gói từ trước.

## Bằng chứng

`scripts/packaged-runtime-smoke.mjs` chạy chính Supervisor và Adapter của sản phẩm với `PATH` rỗng, giải đường dẫn từ trong gói, khởi động Gateway và gọi `health`. `PATH` rỗng là điểm mấu chốt, vì một Node sẵn có trên máy sẽ âm thầm cứu một gói không mang theo gì, và validator từ chối nếu bài kiểm này bỏ bước xoá `PATH`.

Kết quả trên Linux, ngày 2026-09-06, ghi tại `artifacts/beta-0/packaged-runtime-linux-x64.json`: node lấy từ `runtime/node/node`, OpenClaw lấy từ `openclaw/node_modules/openclaw/openclaw.mjs`, handshake xong sau 15,6 giây, `health` đạt, không có failure.

## Điều còn nợ

Gói hiện nặng khoảng 900 MB cho một nền tảng, trong đó cây OpenClaw chiếm 528 MB và nhị phân Node chiếm 121 MB. Con số này không chấp nhận được cho người dùng Việt Nam tải về. Ghi ở R-035, phải giảm trước khi làm bộ cài phát hành.
