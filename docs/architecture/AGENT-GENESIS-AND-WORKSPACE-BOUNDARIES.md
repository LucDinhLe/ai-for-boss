# Agent Genesis và biên workspace

Ngày chốt: 2026-08-11  
Owner sản phẩm: Lê Đình Lực  
Trạng thái: Yêu cầu kiến trúc đã duyệt; triển khai thuộc Feature 0.3, 2.2 và 2.5

## 1. Mục tiêu

AI for Boss giữ nghi thức bootstrapping của OpenClaw nhưng đưa nó vào một trải nghiệm dễ hiểu cho người phổ thông. Lần cài đầu tạo Agent chính; mỗi lần tạo Agent mới cũng có một nghi thức khai sinh riêng.

Kết quả đạt khi:

- Người dùng đặt được tên, vai trò, giọng điệu, emoji/avatar, cách xưng hô và ranh giới của Agent bằng hội thoại ngắn.
- Agent đọc lại đúng danh tính ở phiên sau và danh tính hiển thị nhất quán trên UI/channel.
- `BOOTSTRAP.md` chỉ tồn tại trước khi cấu hình hoàn tất và không tự xuất hiện lại sau restart.
- Hai Agent không dùng chung identity, memory, session hoặc auth store.
- Dữ liệu dự án của doanh nghiệp không bị trộn với hồ sơ hệ thống của Agent.

## 2. Bằng chứng upstream

OpenClaw `2026.7.1-2` được chọn làm candidate tại Feature 0.2. Tài liệu đi kèm package xác nhận:

- Workspace mới được seed `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md` và `BOOTSTRAP.md`.
- First-run ritual ghi lại danh tính rồi xóa `BOOTSTRAP.md`.
- Workspace được coi là đã cấu hình nếu `SOUL.md`, `IDENTITY.md` hoặc `USER.md` khác template, hoặc đã có thư mục `memory/`.
- Agent phụ có workspace, session và auth profile riêng.
- `openclaw agents set-identity` có trong candidate và hỗ trợ đồng bộ tên, theme, emoji và avatar bằng CLI chính thức.

Nguồn tham chiếu:

- <https://docs.openclaw.ai/start/bootstrapping>
- <https://docs.openclaw.ai/agent-workspace>
- <https://docs.openclaw.ai/concepts/agent>
- <https://docs.openclaw.ai/cli/agents>

Tài liệu online có thể đi trước release stable và đã cho thấy bootstrap contract đang thay đổi. Mọi triển khai phải dùng template, CLI/RPC và contract test của release train đã khóa; không lấy nội dung online mới nhất làm mặc định nếu chưa nâng release train.

## 3. Ba vùng dữ liệu phải tách biệt

| Vùng | Mục đích | Dữ liệu điển hình | Quyền |
|---|---|---|---|
| Agent Home | Nhà riêng của đúng một Agent | `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, memory | Chỉ Agent tương ứng và Supervisor theo contract |
| `agentDir` | State riêng do OpenClaw quản lý | auth profile, session store, Codex runtime state | Không cho renderer hoặc file browser đọc trực tiếp |
| Không gian dự án | Thư mục nghiệp vụ do người dùng chọn | Tài liệu, nguồn, artifact và file làm việc | Cấp riêng theo Agent và phiên: `none`, `read-only`, `read-write` |

Ví dụ hiển thị:

```text
Dự án: Happy Training
Đường dẫn: D:\Happy Training
Agent được cấp quyền:
  - Trợ lý Điều hành: read-write
  - Advisor: read-only qua gói review tối thiểu
  - Agent Marketing: none
```

Đường dẫn Agent Home nằm trong vùng dữ liệu riêng của AI for Boss và chỉ hiện ở Chẩn đoán nâng cao. Không đặt identity file vào thư mục dự án chung và không dùng một workspace OpenClaw cho nhiều Agent.

## 4. Trạng thái khai sinh

```text
UNSEEDED
   |
   v
SEEDED
   |
   v
CONVERSING
   |
   v
STAGING
   |
   v
VERIFYING
   |
   v
ACTIVE
```

Mọi lỗi từ `SEEDED` đến `VERIFYING` chuyển sang `PENDING_RESUME`, giữ `BOOTSTRAP.md` và dữ liệu staging. Không được báo Agent đã sẵn sàng.

`ACTIVE` chỉ đạt khi:

1. Các file bắt buộc tồn tại và nằm trong đúng Agent Home.
2. `IDENTITY.md`, `USER.md` và `SOUL.md` đã khác starter template theo nội dung người dùng duyệt.
3. Nội dung đọc lại đúng encoding UTF-8 và vượt schema/content validation.
4. Avatar là đường dẫn tương đối hợp lệ trong Agent Home, URL HTTPS được phép hoặc data URI trong giới hạn đã chốt.
5. Lệnh/RPC đồng bộ danh tính trả thành công và truy vấn lại khớp.
6. Gateway health và Agent discovery đạt.
7. Snapshot trước khi promote tồn tại.
8. `BOOTSTRAP.md` đã bị xóa khỏi workspace hoạt động.

## 5. Hội thoại khai sinh

### 5.1. Lần cài đầu

1. Chọn ngôn ngữ và Không gian dự án.
2. Kết nối ít nhất một model hoặc chọn model cục bộ tương thích.
3. Supervisor xác minh Gateway và model trước khi cho Agent nói.
4. Agent hỏi người dùng muốn gọi mình là gì.
5. Agent làm rõ vai trò/bản chất, giọng điệu, emoji/avatar, cách xưng hô, ưu tiên và ranh giới.
6. Người dùng xem bản tóm tắt và xác nhận.
7. Hệ thống lưu, kiểm tra và chuyển Agent sang `ACTIVE`.

Nghi thức là hội thoại ngắn, không phải bảng hỏi dài. Người dùng có thể bỏ qua trường không bắt buộc và sửa lại trong Cài đặt Agent.

### 5.2. Agent tạo sau

- Kế thừa tên và cách xưng hô của người dùng từ hồ sơ cấp ứng dụng sau khi người dùng xác nhận.
- Không kế thừa persona, memory, quyền, project grant hoặc auth profile của Agent khác.
- Cho phép chọn model mặc định, Advisor policy và template vai trò sau khi danh tính cơ bản đã được tạo.
- Tạo workspace, `agentDir`, session store và auth profile riêng trước khi bind channel.

### 5.3. Khai sinh lại

`Khai sinh lại Agent` là hành động có khả năng thay đổi danh tính và memory. UI phải:

1. Giải thích dữ liệu nào sẽ thay đổi và dữ liệu nào được giữ.
2. Tạo snapshot.
3. Yêu cầu xác nhận tên Agent.
4. Tạm dừng schedule, channel và task đang chạy.
5. Reset bằng contract chính thức, không tự chép hoặc xóa state SQLite.
6. Cho phép rollback nếu người dùng hủy hoặc validation lỗi.

## 6. Quy tắc ghi file

- Sinh nội dung trong thư mục staging cùng volume với Agent Home khi nền tảng cho phép.
- Chuẩn hóa encoding UTF-8, line ending theo policy repo và kích thước theo giới hạn bootstrap của release train.
- Không ghi secret, cookie, token, mật khẩu hoặc đường dẫn credential vào Markdown.
- Validate tên file cố định và path nằm trong Agent Home.
- Ghi file bằng replace nguyên tử; nếu một bước thất bại, giữ bản cũ.
- Gọi RPC/CLI chính thức để đồng bộ identity hiển thị.
- Chỉ xóa `BOOTSTRAP.md` sau khi readback và health check đạt.
- Tạo audit event chỉ chứa agent id, trạng thái, thời điểm và version template; không ghi nội dung riêng tư của cuộc hội thoại.

## 7. Memory và heartbeat

- Không tạo thư mục `memory/` trước khi bootstrap hoàn tất.
- `MEMORY.md` là tùy chọn; chỉ tạo khi có nội dung dài hạn đầu tiên hoặc người dùng chủ động bật.
- `HEARTBEAT.md` mặc định trống/comment-only để không sinh API call nền.
- Khi bật heartbeat, UI phải hiển thị lịch, model, quyền, ngân sách và kênh nhận kết quả.
- Main/private session mới được nạp long-term memory; group/channel context phải tuân theo boundary của release train và policy sản phẩm.

## 8. Trường hợp biên

| Trường hợp | Hành vi bắt buộc |
|---|---|
| Mất điện hoặc app crash khi đang ghi | Giữ bootstrap; lần mở sau tiếp tục từ checkpoint an toàn |
| Model lỗi giữa hội thoại | Giữ câu trả lời đã duyệt; không xóa bootstrap hoặc đổi model âm thầm |
| Hai Agent trùng tên hiển thị | Cho phép tên hiển thị trùng nhưng `agentId`, Agent Home và `agentDir` phải duy nhất; UI cảnh báo để tránh nhầm |
| Unicode, emoji, tên dài | Lưu UTF-8; giới hạn hiển thị không được cắt hỏng dữ liệu gốc |
| Avatar không đọc được hoặc quá lớn | Giữ avatar cũ/default và yêu cầu chọn lại; không chặn lưu các phần danh tính khác nếu policy cho phép |
| Không gian dự án biến mất | Agent vẫn giữ identity nhưng project grant chuyển `unavailable`; không tự chọn thư mục khác |
| Người dùng chọn cùng Agent Home cho Agent khác | Chặn trước khi ghi và giải thích nguy cơ ghi đè identity/memory |
| `memory/` tồn tại trong workspace mới | Đưa vào migration/recovery review; không giả định bootstrap đã hoàn tất |
| `BOOTSTRAP.md` bị xóa thủ công khi chưa đủ dữ liệu | Báo cấu hình chưa hoàn tất và đề nghị khôi phục từ snapshot hoặc chạy lại onboarding có xác nhận |
| Restore từ máy khác | Sinh mới device/Gateway identity; giữ Agent identity theo gói phục hồi; channel/schedule nhạy cảm tạm dừng |

## 9. Kiểm thử nghiệm thu

1. Fresh install tạo Agent chính và chỉ chạy birth sequence một lần.
2. Restart ở từng trạng thái không tạo Agent hoặc file trùng.
3. Xóa bootstrap chỉ xảy ra sau validation và health check.
4. Tạo Agent thứ hai không thay đổi file, memory, session hoặc auth của Agent đầu.
5. Hai Agent cùng được cấp quyền dự án vẫn giữ identity/memory riêng.
6. `read-only` chặn mọi thao tác ghi; `none` chặn cả đọc.
7. Path traversal, symlink và hardlink ra ngoài vùng cấp quyền bị chặn.
8. Tên tiếng Việt, emoji, dấu nháy, chuỗi dài và avatar lỗi không phá trạng thái.
9. Không API key, OAuth token, cookie hoặc Gateway credential xuất hiện trong workspace, log, crash report hoặc support bundle.
10. Khai sinh lại có snapshot, pause schedule/channel và rollback đạt.
11. Gỡ app mặc định giữ Agent Home; cài lại nhận diện workspace đã attested và không tự seed bootstrap.
12. Restore sang máy khác đạt migration, identity sync và channel/schedule review.

## 10. Phân bổ theo feature

| Feature | Đầu ra liên quan |
|---|---|
| 0.2 | Khóa template/CLI capability của release train; ghi drift upstream |
| 0.3 | Data flow, threat model, capability manifest và source-of-truth cho Agent Home/project grant |
| 0.4 | App shell có màn trạng thái onboarding giả lập, chưa dùng credential thật |
| 0.5 | State machine/UI preview, resume idempotent, fail-closed và security test policy bằng dữ liệu giả; chưa ghi Agent Home |
| 0.6 | Chứng minh project grant và sandbox trên từng OS |
| 1.x | Supervisor/Gateway/identity sync trên Windows bằng dữ liệu giả hoặc tài khoản test |
| 2.2 | Onboarding và khai sinh Agent chính |
| 2.5 | Khai sinh Agent mới, template và phối hợp nhiều Agent |
| 3.x | Memory, heartbeat, channel và capability nâng cao |
| 4.x | Cài mới, update, uninstall và restore trên từng OS/architecture |

## 11. Ngoài phạm vi của bản vá tài liệu này

- Chưa viết UI, Supervisor, installer hoặc OAuth.
- Chưa chọn sandbox backend.
- Chưa chọn đường lưu project grant nếu OpenClaw release train thiếu contract cưỡng chế phù hợp.
- Chưa dùng workspace hoặc credential thật của Product Owner làm fixture.

Những mục trên tiếp tục bị chặn bởi AGENTS.md và thứ tự cổng hiện hành.
