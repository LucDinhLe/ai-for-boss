# Changelog

Mọi thay đổi đáng kể của AI for Boss được ghi tại đây bằng ngôn ngữ người vận hành có thể hiểu.

## [Unreleased]

### Added

- Khởi tạo Cổng 0, Feature 0.1 — Repo Governance.
- Bộ quy tắc build và Master Execution Plan được đưa vào repo.
- Decision Log, Risk Register, Feature Spec template và quy tắc đóng góp.
- Kiểm tra tự động cho governance lock, tài liệu bắt buộc và dấu hiệu bí mật.
- Cấu trúc thư mục dự kiến cho desktop, Supervisor, OpenClaw Adapter, policy và test.
- Feature 0.2 runtime manifest, JSON Schema, baseline SBOM, license inventory và third-party notice; manifest được rename thành `runtime-manifest.lock.json` sau khi contract đạt.
- Bộ script tạo, harden, kiểm tra và gỡ có xác nhận cho WSL2 lab `AIForBossLab`.
- Smoke evidence cho OpenClaw `2026.7.1-2`, Node `24.19.0` và pnpm `11.2.2` không dùng credential.
- Đặc tả Agent Genesis: bootstrap một lần, identity sync, crash resume và xóa `BOOTSTRAP.md` sau validation.
- Biên Agent Home/`agentDir`/Không gian dự án cho nhiều Agent không ghi đè danh tính, memory hoặc auth.
- Audit mức sẵn sàng đóng gói Windows, macOS và Linux cùng checklist ký, notarize, update, rollback, legal và support.
- Hướng thiết kế Editorial Calm: nền giấy ấm, serif/sans, copper và ba panel theo ngữ cảnh; giữ nhận diện độc lập với sản phẩm tham chiếu.
- Prototype tương tác có welcome/session, Việt/Anh, light/dark, model theo phiên, Advisor, Gateway, Browser, tệp và Trung tâm điều khiển.
- Concept mark vector **La bàn quyết định** cùng app tile riêng, thay biểu tượng robot/AI tham chiếu trong prototype.
- Audit competitive parity đối chiếu AICoworker, phân biệt rõ implementation, prototype, planned và missing.
- Hành trình ba bước từ tải/cài tới giao việc đầu tiên cùng Cổng Worth-Building có chỉ số usability/visual cụ thể.
- Advisor hai checkpoint: phản biện kế hoạch trước thực thi và kiểm tra đầu cuối trước bàn giao.
- Kiến trúc Always-on single-tenant trên Linux, remote access riêng tư, health, auto-restart, backup và rollback.
- Gateway contract lock gồm npm integrity, tag/commit, protocol v4, doc blob và private workspace tree fingerprint.
- Contract tests fail-closed khi stable train lẫn beta, private package bị bundle, fingerprint drift hoặc policy đòi public package trái tài liệu upstream.
- Gateway startup và authenticated `health` RPC smoke trong network namespace chỉ có loopback bằng token tạm trong memory.
- Feature 0.3 capability manifest v1 ánh xạ đủ 23 nhóm OpenClaw thành `WRAPPED`, `RESTRICTED` hoặc `BLOCKED`, kèm nguồn, quyền, dữ liệu, failure behavior và test gate.
- Auth-support matrix cho 9 đường OpenAI, Anthropic, Google, provider plugin và local model; tất cả vẫn `documented-only` hoặc `blocked`, chưa có live-auth claim.
- Source-of-truth manifest gồm 9 nguồn có quyền duy nhất và 8 luồng dữ liệu cốt lõi cho install, provider, session, Advisor, Genesis, tool/browser, recovery và Always-on.
- Agent Genesis contract khóa 7 reference template, state machine crash-resume, activation preconditions và ba vùng Agent Home/`agentDir`/Không gian dự án.
- Threat model gồm 10 tài sản, 10 tác nhân, 10 trust boundary và 14 abuse case truy vết về Risk Register.
- Validator và 14 contract tests Feature 0.3 fail-closed khi capability thiếu, release drift, private package source, OAuth storage sai, nguồn sự thật trùng, threat mất trace hoặc bootstrap bị làm yếu.

### Changed

- Concept **La bàn quyết định** chuyển sang trạng thái rejected; icon production để feature thương hiệu sau.
- Rulebook lên 1.2 và Master Execution Plan lên 1.1 để thêm parity gate, hành trình ba bước và Headless track.
- Rulebook lên 1.3 và Master Execution Plan lên 1.2 để dùng external-app WebSocket RPC contract mà OpenClaw stable thực sự hỗ trợ.

### Security

- Repo mặc định private.
- Chưa cho phép credential, dữ liệu thật, OAuth, Gateway nhúng hoặc host execution.
- Lab tắt Windows drive automount và interop; smoke command chạy trong network namespace không mạng rồi distro được terminate.
- Dependency build scripts chỉ cho phép bốn package/phiên bản xuất hiện trong lock, không bật allow-all.
- Bộ cài từ chối distro trùng tên nhưng sai registry BasePath/WSL version và truyền input đã pin mà không mount ổ host.
- Bootstrap fail-closed: chưa xác minh thì chưa xóa file, chưa tạo memory sớm và chưa báo Agent sẵn sàng.
- Mọi capability Feature 0.3 bị khóa `advertisable: false`; Critical/High threat không được đóng bằng mô tả và tiếp tục chặn phát hành cho tới khi có test thực thi.
- Static secret, OAuth token, CLI credential và plugin-owned auth có storage authority riêng; cấm plaintext/silent fallback.

### Verified

- Governance validation đạt trên máy local và GitHub Actions.
- Rulebook và Master Plan giữ đúng SHA-256 trong governance lock.
- Nhánh `main` của kho private `LucDinhLe/ai-for-boss` đồng bộ với commit nền.
- OpenClaw package/CLI version, help và Gateway help chạy đạt trong lab; AI Coworker trên host vẫn hoạt động.
- Lượt cài lại bằng frozen lockfile, kiểm tra BasePath fail-closed và removal `-WhatIf` đều đạt.
- 58 đường nguồn upstream được tham chiếu trong capability/auth manifest đều tồn tại trong đúng npm package OpenClaw `2026.7.1-2` trên máy kiểm tra.
- Feature 0.3 validator đạt 23 capability, 9 auth mode, 9 nguồn sự thật, 8 data flow và 14 threat; tổng contract suite đạt 19/19.

### Unblocked

- Feature 0.2 đã promote thành `locked`. Blocker package npm được loại vì upstream stable xác nhận hai package vẫn private và chỉ định WebSocket RPC cho external app.

### Blocked

- Chưa có desktop code, Supervisor, AI for Boss Gateway Adapter, sandbox sản phẩm, installer, updater hoặc signing identity; chưa được phát hành cho người dùng.
