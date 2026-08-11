# Changelog

Mọi thay đổi đáng kể của AI for Boss được ghi tại đây bằng ngôn ngữ người vận hành có thể hiểu.

## [Unreleased]

### Added

- Khởi tạo Cổng 0, Feature 0.1 — Repo Governance.
- Bộ quy tắc build và Master Execution Plan được đưa vào repo.
- Decision Log, Risk Register, Feature Spec template và quy tắc đóng góp.
- Kiểm tra tự động cho governance lock, tài liệu bắt buộc và dấu hiệu bí mật.
- Cấu trúc thư mục dự kiến cho desktop, Supervisor, OpenClaw Adapter, policy và test.
- Feature 0.2 candidate manifest, JSON Schema, baseline SBOM, license inventory và third-party notice.
- Bộ script tạo, harden, kiểm tra và gỡ có xác nhận cho WSL2 lab `AIForBossLab`.
- Smoke evidence cho OpenClaw `2026.7.1-2`, Node `24.19.0` và pnpm `11.2.2` không dùng credential.

### Security

- Repo mặc định private.
- Chưa cho phép credential, dữ liệu thật, OAuth, Gateway nhúng hoặc host execution.
- Lab tắt Windows drive automount và interop; smoke command chạy trong network namespace không mạng rồi distro được terminate.
- Dependency build scripts chỉ cho phép bốn package/phiên bản xuất hiện trong lock, không bật allow-all.
- Bộ cài từ chối distro trùng tên nhưng sai registry BasePath/WSL version và truyền input đã pin mà không mount ổ host.

### Verified

- Governance validation đạt trên máy local và GitHub Actions.
- Rulebook và Master Plan giữ đúng SHA-256 trong governance lock.
- Nhánh `main` của kho private `LucDinhLe/ai-for-boss` đồng bộ với commit nền.
- OpenClaw package/CLI version, help và Gateway help chạy đạt trong lab; AI Coworker trên host vẫn hoạt động.
- Lượt cài lại bằng frozen lockfile, kiểm tra BasePath fail-closed và removal `-WhatIf` đều đạt.

### Blocked

- Feature 0.2 chưa thể promote vì hai package Gateway stable `2026.7.1-2` chưa tồn tại trên npm; beta không được trộn vào stable.
