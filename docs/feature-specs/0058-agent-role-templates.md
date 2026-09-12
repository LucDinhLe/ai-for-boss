# 0058 — Bốn mẫu agent theo vai và quyền bằng ngôn ngữ kinh doanh

## Vì sao cần

Màn tạo agent hiện hỏi tên, vai trò, mục tiêu, mô hình, biểu tượng, và người dùng phải tự nghĩ ra vai trò từ trang giấy trắng. Với ba đối tượng mục tiêu (quyết định 1, 12/09/2026: cả chủ doanh nghiệp nhỏ, người kinh doanh một mình và người đi làm), bốn vai có sẵn phủ được hầu hết nhu cầu đầu tiên.

## Quyết định

- `packages/agent-templates/<vai>/` gồm `template.json` và ba tệp tiếng Việt `SOUL.md`, `IDENTITY.md`, `USER.md`. Bốn vai đợt một: `dieu-hanh` (Trợ lý điều hành), `ban-hang` (Trợ lý bán hàng), `marketing-noi-dung` (Trợ lý marketing và nội dung), `quan-ly-du-an` (Quản lý dự án). Advisor giữ nguyên là vai giám sát, không phải mẫu.
- `agent-templates.mjs` nạp và kiểm mẫu khi cần: id trùng thư mục, kỹ năng phải có trong gói đi kèm, phải gồm `quy-tac-dieu-hanh`, chế độ mặc định là một trong ba nút, mức quyền phải thuộc bốn mức đang bật. Mẫu hỏng làm cả bộ mẫu bị từ chối chứ không ship nửa vai; ứng dụng vẫn mở với đường tự mô tả.
- `agent-create` nhận `template`. Vỏ ghi ba tệp qua `agents.files.set` (lõi cho phép cả ba), nối vai trò và mục tiêu người dùng nhập vào cuối `SOUL.md` như trước, đọc lại từng tệp; rồi ghi danh sách kỹ năng vào `agents.<id>.skills` bằng `SetupChannel.assignAgentSkills`, một lời gọi host cố định trên kênh thiết lập dùng `config.get` và `config.patch` với `replacePaths: ['agents.list']`, đọc lại và đối chiếu. `config.*` không được thêm vào danh sách phương thức của `workspaceRequest`.
- Màn hình tạo agent hỏi hai câu: anh chị làm gì, và muốn trợ lý này lo việc gì. `suggestTemplate` chấm bằng từ khoá, hoà hoặc trống thì gợi ý Trợ lý điều hành. Chọn mẫu điền sẵn vai trò, mục tiêu và biểu tượng, vẫn sửa được. Nút "Tự mô tả" giữ nguyên đường cũ.
- **Sáu mức quyền bằng ngôn ngữ kinh doanh**: được đọc, được đề xuất, được sửa sau khi duyệt, được tự sửa trong dự án, được gửi ra ngoài, được giao dịch. Hai mức cuối tắt trong mọi mẫu và bị bộ nạp từ chối. Ở đợt này mức quyền là lời hứa hiển thị và là nội dung `IDENTITY.md`; việc thực thi vẫn do `HostExecutionPolicy` (chế độ phiên `workspace`, sàn phê duyệt allowlist, hỏi khi thiếu) đảm nhiệm cho mọi agent. Bảng dịch từng mức xuống chế độ phiên và tool profile riêng là spec 0060.

## Bằng chứng

- `tests/unit/agent-templates.test.mjs`: bốn mẫu nạp được, chỉ dùng kỹ năng có trong gói, không xin quyền tắt, ba tệp nói với "anh chị"; mẫu sai kỹ năng hay sai quyền bị từ chối; gợi ý theo hai câu hỏi và mặc định; `agent-create` với mẫu ghi ba tệp, gán kỹ năng, đọc lại; đường không mẫu không đổi.
- `tests/unit/host-plugins.test.mjs`: `assignAgentSkills` tồn tại, dùng `replacePaths: ['agents.list']`, `config.patch` không lộ qua broker chung.
- Kiểm tra bằng tay: tạo Trợ lý bán hàng, mở phiên, hỏi "anh có những kỹ năng gì", phải thấy đúng năm kỹ năng của vai.

## Chưa làm

Chế độ mặc định của mẫu (`defaultMode`) đã được lưu trong metadata agent nhưng ô soạn chưa tự chọn nút theo agent; đợt sau khi có trang sử dụng.
