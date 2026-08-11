# Changelog

Mọi thay đổi đáng kể của AI for Boss được ghi tại đây bằng ngôn ngữ người vận hành có thể hiểu.

## [Unreleased]

### Added

- Khởi tạo Cổng 0, Feature 0.1 — Repo Governance.
- Bộ quy tắc build và Master Execution Plan được đưa vào repo.
- Decision Log, Risk Register, Feature Spec template và quy tắc đóng góp.
- Kiểm tra tự động cho governance lock, tài liệu bắt buộc và dấu hiệu bí mật.
- Cấu trúc thư mục dự kiến cho desktop, Supervisor, OpenClaw Adapter, policy và test.

### Security

- Repo mặc định private.
- Chưa cho phép credential, dữ liệu thật, OAuth, Gateway nhúng hoặc host execution.

### Verified

- Governance validation đạt trên máy local và GitHub Actions.
- Rulebook và Master Plan giữ đúng SHA-256 trong governance lock.
- Nhánh `main` của kho private `LucDinhLe/ai-for-boss` đồng bộ với commit nền.
