# Feature Spec — Beta 0: OpenClaw được giám sát và một cửa sổ trò chuyện

## 1. Trạng thái

- Cổng: 1, bản thử nghiệm mở đường (spike), không phải bản phát hành
- Owner kỹ thuật: Fable; chờ senior platform/security reviewer trước khi qua Cổng 1
- Product Owner: Lê Đình Lực
- Trạng thái: đang thi công trên nhánh `experiment/beta-0`
- Ngày mở: 2026-09-05
- Điểm xuất phát đã xác minh: `8f43070` (hợp nhất `feature/0.6-sandbox-feasibility` vào nhánh thử nghiệm)
- Phân loại artifact: `experimental-internal`

## 2. Mục tiêu vận hành

Trả lời một câu hỏi sản phẩm bằng bằng chứng thay vì phỏng đoán: **AI for Boss có thể tự nuôi một Gateway OpenClaw bên trong ứng dụng và nói chuyện với nó qua giao thức chính thức trên từng hệ điều hành mục tiêu hay không, và Windows có bắt buộc phải mượn Linux subsystem hay không.**

Câu hỏi này chặn mọi thứ phía sau. Nếu Windows buộc phải chạy WSL, lời hứa "cài một lần, không WSL, không Node, không Gateway" trong README phải viết lại, và bộ cài phải tự dựng WSL như Windows Hub của OpenClaw. Không có câu trả lời này thì mọi công sức bỏ vào giao diện đều đứng trên giả định.

Mục tiêu phụ: đưa bố cục ba cột mà Product Owner đã chốt ở giao diện v32 (thanh phiên, khung trò chuyện, bảng trạng thái, đồng hồ dung lượng ngữ cảnh, chỗ dành cho Advisor) lên lõi OpenClaw thật, ở mức tối thiểu đủ để cầm nắm.

## 3. Trong phạm vi

- Supervisor trong tiến trình chính Electron: xin cổng loopback trống, sinh token mới mỗi lần mở, spawn gói `openclaw` đã cài bằng một Node runtime thật, khởi động lại có giới hạn, Safe Mode, tắt sạch khi thoát.
- Bộ biến môi trường nhúng theo `docs/gateway/embedding.md` của chính bản đã ghim.
- Xử lý mã thoát `78` (`EX_CONFIG`) bằng một lượt `doctor --fix` rồi thử lại đúng một lần; hỏng tiếp thì fail closed.
- Danh tính thiết bị Ed25519 do host giữ, `deviceId` dẫn xuất đúng luật Gateway, device token lưu theo vai trò, tệp hỏng thì thay chứ không tin.
- Adapter trên `@openclaw/gateway-client`: handshake, vai trò `operator` với ba scope của chat, danh sách phương thức cho phép, lọc sự kiện.
- Cầu IPC: ba kênh renderer gọi vào, hai kênh chính đẩy ra, mọi lệnh kiểm tra người gửi và đối chiếu danh sách cho phép ở tiến trình chính.
- Giao diện một cửa sổ: danh sách phiên, tạo phiên, gửi tin, transcript theo thời gian thực, dừng lượt chạy, đồng hồ dung lượng ngữ cảnh, bảng trạng thái nền, tiếng Việt.
- Smoke tích hợp chạy chính Supervisor và Adapter của sản phẩm trên Windows, macOS và Linux trong CI, ghi bằng chứng máy đọc được vào `artifacts/beta-0/`.
- Candidate train `oc-2026.9.1-candidate.1` tách khỏi locked train, kèm danh sách điều kiện chưa đạt để được promote.

## 4. Ngoài phạm vi

- Bộ cài, ký số, updater, phát hành. Bản đóng gói vẫn là `experimental-internal`, chưa chứa Node runtime và chưa chạy được trên máy sạch.
- Kết nối nhà cung cấp model thật, OAuth, khoá API, chọn agent runtime. Lượt chạy sẽ báo lỗi thiếu harness; đó là hành vi đúng ở bước này.
- Advisor thật. Giao diện chỉ giữ đúng chỗ của nó và ghi rõ "chưa bật".
- Tool, duyệt hành động, browser, terminal, plugin, skill, cron, node, kênh.
- Quản lý dự án. OpenClaw có `projects.*` và `sessions.create` nhận `projectId`; beta 0 chỉ đọc danh sách để chứng minh đường đi, chưa dựng giao diện.
- Promote candidate train thành locked train. Việc đó cần capability diff, SBOM, license inventory và bằng chứng ba nền tảng.
- Bất kỳ tuyên bố hỗ trợ thiết bị nào.

## 5. Đầu vào và đầu ra

| Loại | Mô tả |
|---|---|
| Đầu vào | Shell Feature 0.4, hợp đồng Feature 0.3, ADR sandbox 0.6, `docs/gateway/embedding.md` và `clients.md` của gói đã ghim |
| Đầu ra | Supervisor, danh tính thiết bị, Adapter, cầu IPC, giao diện một cửa sổ, smoke ba nền tảng, candidate manifest, validator và test |
| Dữ liệu đọc | Gateway RPC; thư mục state riêng của ứng dụng |
| Dữ liệu ghi | Thư mục state riêng dưới `userData`, khoá thiết bị và device token; nguồn và tài liệu trong repo |

## 6. Giả định và điểm chưa chắc

- Gói `openclaw` phải được cài như một cây package bình thường. Sao chép `dist` hoặc dàn phẳng vào app bundle là vi phạm hợp đồng nhúng của thượng nguồn.
- `process.execPath` dưới Electron là binary Electron, không phải Node. Supervisor phải giải một Node thật; bản đóng gói sau này phải mang theo Node.
- Gateway nhận WebSocket trước khi khởi động xong. Readiness đo bằng handshake, không bằng chuỗi trong log.
- Runtime agent mặc định trong một thư mục state trắng là `codex`, và harness đó vắng mặt. Chọn runtime và nhà cung cấp là việc của bước sau.
- CI runner chứng minh nền tảng chạy được, không chứng minh máy khách sạch hay trải nghiệm cài đặt.
- Danh sách `client.id` của Gateway là tập đóng; ứng dụng bên thứ ba xưng `gateway-client` và mang tên sản phẩm ở `clientDisplayName`.
- Windows chạy Gateway nguyên bản, không cần Linux subsystem. Điều kiện là mọi đường dẫn trao cho tiến trình con phải ở dạng dài; đây là phát hiện của lượt CI đầu tiên, không phải giả định.

## 7. Trường hợp biên và hành vi khi lỗi

| Trường hợp | Hành vi mong đợi |
|---|---|
| Không tìm thấy Node runtime | Safe Mode, nêu lý do, không spawn gì |
| Không tìm thấy gói OpenClaw | Safe Mode, nêu lý do |
| Cổng bị chiếm | Xin cổng mới từ hệ điều hành, không đoán cổng cố định |
| Gateway thoát mã 78 | Chạy `doctor --fix` một lần, thử lại một lần, sau đó Safe Mode |
| Gateway chết lặp lại | Khởi động lại tối đa ba lần trong một phút rồi Safe Mode |
| Handshake quá hạn | Báo trạng thái, không giả vờ đã kết nối |
| Renderer gọi phương thức ngoài danh sách | Tiến trình chính từ chối, kèm tên phương thức |
| Sự kiện ngoài danh sách | Không chuyển ra renderer |
| IPC từ frame lạ | Từ chối |
| Tệp danh tính hỏng hoặc bị sửa | Thay bằng danh tính mới thay vì tin |
| Lượt chạy lỗi vì thiếu harness | Hiển thị nguyên văn lỗi của Gateway, không nuốt |
| Thoát ứng dụng | Ngắt adapter, SIGTERM tiến trình con, SIGKILL sau 5 giây |
| Thư mục dữ liệu là đường dẫn 8.3 trên Windows | Host giải sang dạng dài trước khi trao cho tiến trình con; nếu không, bộ theo dõi tệp của libuv fast-fail và Gateway sập thành vòng lặp (R-034) |

## 8. Tiêu chí nghiệm thu

1. `pnpm verify` xanh, gồm validator beta 0.
2. `pnpm smoke:gateway` đạt trên Linux, Windows và macOS trong CI, mỗi nền tảng ghi một tệp bằng chứng có `handshake.connected = true` và `failures = []`.
3. Tệp bằng chứng ghi rõ nền tảng nào cần Linux subsystem.
4. Danh sách phương thức cho phép chặn được `config.patch`, `tools.invoke`, `terminal.open`, `plugins.install` và các bề mặt chưa xây khác, có test chứng minh.
5. Renderer không mở transport hay bộ nhớ cục bộ nào của riêng nó.
6. Candidate train không tự nhận là locked, và mọi mục bằng chứng chưa có đều ở mức `assumption-pending`.

## 9. Rollback

Nhánh `experiment/beta-0` không chạm `main`. Bỏ nhánh là quay lui đầy đủ. Locked train, capability manifest và mọi hợp đồng Cổng 0 giữ nguyên trong lượt này.

## 10. Quyết định liên quan

- D-0019 thay thế D-0013 về nguồn client Gateway.
- D-0018 (Feature 0.6) về sandbox vẫn giữ nguyên: host exec, elevated và browser nhạy cảm tiếp tục khoá.
