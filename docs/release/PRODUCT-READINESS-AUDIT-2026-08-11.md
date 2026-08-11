# AI for Boss — Audit mức sẵn sàng đóng gói sản phẩm

Ngày audit: 2026-08-11  
Người thực hiện: Codex self-review  
Product Owner: Lê Đình Lực  
Phạm vi: Từ repo hiện tại tới sản phẩm cho người phổ thông tải và dùng trên Windows, macOS và Linux

## 1. Kết luận điều hành

**AI for Boss chưa thể đóng gói hoặc phát hành cho người dùng.** Repo hiện có governance, runtime candidate, manifest/schema, license inventory nền và một phòng thử nghiệm WSL2. Repo chưa có desktop application code, Supervisor, Gateway Adapter, onboarding thật, sandbox sản phẩm, installer, updater hoặc artifact đã ký.

Blocker gần nhất vẫn tồn tại tại thời điểm audit:

- `openclaw` stable: `2026.7.1-2`.
- `@openclaw/gateway-client` và `@openclaw/gateway-protocol`: dist-tag `latest` vẫn là placeholder `0.0.0`; chỉ có beta `2026.8.1-beta.1`.
- Không được ghép OpenClaw stable với Gateway packages beta để tạo release train giả.

Do đó Feature 0.2 tiếp tục ở trạng thái `blocked upstream`. Bản vá hiện tại chỉ hoàn thiện yêu cầu, kiến trúc và đường phát hành; không tạo executable giả vờ hoàn chỉnh.

Audit competitive parity bổ sung cùng ngày xác nhận sản phẩm cũng chưa đạt hành trình ba bước, benchmark thị giác hoặc Headless implementation. Xem [Competitive parity, ba bước và Always-on](COMPETITIVE-PARITY-AND-HEADLESS-AUDIT-2026-08-11.md).

## 2. Những gì đã có

| Lớp | Bằng chứng hiện tại | Trạng thái |
|---|---|---|
| Governance | Rulebook, Master Plan, AGENTS, Decision Log, Risk Register, Feature Spec | Có nền |
| Upstream candidate | OpenClaw, Node, Electron, pnpm có version cụ thể | Một phần |
| Runtime manifest | Schema và candidate manifest cho sáu tổ hợp nền tảng | Có nền, đang `blocked` |
| License/SBOM | Inventory, third-party notice và SBOM nền | Có nền, chưa phải SBOM artifact cuối |
| Lab | WSL2 riêng, không mount ổ Windows, không credential | Đạt mục tiêu Feature 0.2 |
| Product UX | Prototype ba panel ngoài repo sản phẩm | Chỉ minh họa, chưa phải app |
| Desktop/Supervisor/Adapter | Chỉ có README placeholder | Chưa có |
| Installer/updater/signing | Chưa có | Chưa có |
| Pilot/security/legal | Chưa thực hiện | Chưa có |

## 3. Khoảng trống bắt buộc theo thứ tự

### 3.1. Kết thúc Feature 0.2

Phải có một release train thống nhất gồm OpenClaw, Node, Electron, package manager, Gateway client và protocol package cùng contract.

Các đường hợp lệ:

1. Chờ upstream phát hành Gateway packages stable cùng nhịp.
2. Chuyển sang một OpenClaw stable mới hơn khi cả core và packages đã đồng bộ, rồi chạy lại toàn bộ smoke/license/SBOM.
3. Làm việc với upstream để có distribution contract chính thức nếu packages tiếp tục không được phát hành.

Đường bị cấm: dùng beta ghép stable, dùng placeholder `0.0.0`, chép riêng `dist` hoặc tự viết lại protocol từ output quan sát được.

### 3.2. Hoàn thành Cổng 0

- Feature 0.3: capability inventory, source-of-truth map, data flow, threat model, auth matrix và Agent Genesis contract.
- Feature 0.4: Electron shell trống, renderer sandbox và CI Windows/macOS/Linux.
- Feature 0.5: IPC schema, CSP, navigation policy, release policy, redaction và incident skeleton.
- Feature 0.6: ADR và spike sandbox trên từng họ hệ điều hành.

Không được mở host exec, elevated hoặc browser nhạy cảm trước Feature 0.6.

### 3.3. Tích hợp lõi Windows

- Supervisor sở hữu OpenClaw process, profile, cổng động và recovery.
- Gateway Adapter dùng package/schema đúng release train.
- Handshake, scope, health, `models.list`, reconnect, history và approval backfill.
- OAuth/API key flow bằng tài khoản test chuyên dụng.
- Secret không xuất hiện trong renderer, command line, log hoặc support bundle.
- Máy Windows x64 sạch cài và chạy không cần Node, Git, WSL hoặc OpenClaw có sẵn.

Windows x64 là platform chứng minh đầu tiên. ARM64, macOS và Linux chỉ mở khi dependency matrix cho phép.

### 3.4. Trải nghiệm cốt lõi

- Onboarding không terminal và không copy callback.
- Khai sinh Agent chính và mỗi Agent mới theo [Agent Genesis](../architecture/AGENT-GENESIS-AND-WORKSPACE-BOUNDARIES.md).
- Trung tâm kết nối model/provider.
- Phiên, model theo phiên, Advisor, artifact, file preview và progress.
- Agent Home tách khỏi Không gian dự án.
- Permission preview, Approval Inbox và emergency stop.
- Dữ liệu & Phục hồi, System Health và Chẩn đoán nâng cao.
- Tiếng Việt/Anh, sáng/tối, bàn phím và accessibility.
- Hành trình ba bước từ tải/cài, kết nối/khai sinh tới giao việc đầu tiên.
- Advisor phản biện kế hoạch trước thực thi và kiểm tra đầu cuối trước bàn giao.
- Worth-Building Gate gồm human usability, independent visual review và benchmark token/rework.

### 3.5. Phủ capability OpenClaw

Mỗi capability phải có trạng thái, quyền, failure behavior và test. Advanced mode không được biến thành một nút mở terminal để bù cho phần chưa làm.

Các nhóm còn thiếu toàn bộ implementation: provider/model, agent/sub-agent, memory, tool, browser, skill, plugin, MCP, channel, schedule, heartbeat, node, media, speech, diagnostics, backup và update.

### 3.6. Mode Always-on

- Headless Supervisor trên Linux bằng non-root service user.
- Một runtime/Gateway riêng cho mỗi khách hoặc biên tin cậy.
- Gateway loopback-only; Tailscale/SSH trước, HTTPS remote sau audit.
- One-time claim, device pairing/revoke, auto-restart, backup/restore và signed update.
- Cross-tenant, reboot, reconnect, claim-reuse, ingress và restore tests.
- Chưa chọn provider cloud; mặc định là VPS riêng trong tài khoản khách.

## 4. Nghĩa vụ đóng gói theo nền tảng

### Windows

Đường tải trực tiếp từ website cần:

- Artifact x64 trước; ARM64 chỉ khi runtime manifest đạt.
- Installer format được chốt bằng ADR: EXE/MSI hoặc MSIX direct distribution. Microsoft Store có thể là kênh bổ sung, không thay yêu cầu tải trực tiếp.
- Authenticode bằng chứng thư tin cậy hoặc managed signing đủ điều kiện; self-signed và unsigned không phù hợp phát hành công khai.
- Timestamp, signature verification sau download và kiểm tra mọi executable/DLL đi kèm.
- Cài bằng user thường khi có thể; quyền quản trị chỉ yêu cầu đúng lúc và giải thích lý do.
- Test SmartScreen, UAC, uninstall giữ dữ liệu, rollback và side-by-side với OpenClaw/AICoworker.

Nguồn: <https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options>

Quyết định chưa chốt: nhà cung cấp code-signing phù hợp pháp nhân tại Việt Nam và định dạng installer chính.

### macOS

- Build trên runner/máy macOS cho Apple Silicon; Intel chỉ khi dependency matrix còn hỗ trợ.
- Ký toàn bộ app, helper, Node binary và nested code bằng Developer ID phù hợp.
- Hardened Runtime, entitlement tối thiểu và không có `get-task-allow` trong production.
- Notarize bằng `notarytool`, kiểm tra notary log và staple ticket.
- Test Gatekeeper offline/online, upgrade, rollback, uninstall và permission prompts.
- Chốt DMG/PKG/ZIP theo updater contract; app update phải dùng artifact đã ký.

Nguồn: <https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution>

Điều kiện tổ chức: Apple Developer account, certificate owner, quy trình rotate/revoke và máy/runner macOS tin cậy.

### Linux

- Chọn distro hỗ trợ dựa trên dependency matrix; không quảng cáo chung “mọi Linux”.
- AppImage cho portable direct download và DEB cho Ubuntu/Debian là candidate, chưa phải quyết định cuối.
- Checksum cùng chữ ký GPG; AppImage có thể mang chữ ký nhúng.
- Test desktop integration, file permission, Secret Service, sandbox backend, Wayland/X11 và package uninstall.
- Electron không có autoUpdater tích hợp sẵn cho Linux; phải dùng package manager của distro hoặc xây signed update flow có rollback và test riêng.

Nguồn:

- <https://docs.appimage.org/packaging-guide/optional/signatures.html>
- <https://www.electronjs.org/docs/latest/api/auto-updater/>

Quyết định chưa chốt: AppImage-only, AppImage + DEB, repository package hay updater riêng.

## 5. Chuỗi cung ứng và phát hành

Mỗi release phải sinh từ CI sạch và tạo:

- Installer/application artifact theo OS/architecture.
- SHA-256 checksum và chữ ký xác minh được.
- Runtime manifest và capability manifest của đúng bản.
- SBOM theo artifact thực tế, không chỉ dependency nền.
- Third-party notices, OpenClaw attribution và license text.
- Dependency/CVE/secret scan cùng kết quả policy.
- Release notes, known issues, compatibility matrix và rollback manifest.
- Provenance/attestation phù hợp với plan GitHub đang dùng. GitHub artifact attestation cho private repo có giới hạn theo plan; nếu không đủ điều kiện phải chọn cơ chế provenance khác thay vì bỏ qua.
- Hai người tách vai build và promote release khi sản phẩm bước vào pilot thật.

Nguồn Electron về đóng gói/phân phối: <https://www.electronjs.org/docs/latest/tutorial/distribution-overview>

## 6. Updater, rollback và phục hồi

- Update feed tách theo channel, OS và architecture.
- Manifest update được ký và chống downgrade.
- Download vào staging, xác minh signature/hash/SBOM policy rồi mới cài.
- Snapshot dữ liệu trước migration.
- Mất điện, mất mạng hoặc app crash không tạo trạng thái nửa vời.
- Giữ ít nhất một bundle đã xác minh để rollback.
- Linux có chiến lược riêng vì Electron không cung cấp autoUpdater tích hợp.
- Gỡ app mặc định giữ dữ liệu; tùy chọn xóa dữ liệu phải xác nhận riêng.
- Restore `.aifb` chạy staging, migration, health check, atomic swap và rollback.
- Agent Home, identity, project grant, schedule/channel pause và device identity phải có test restore.

## 7. Website tải và trải nghiệm người dùng

Website chỉ đề xuất bản tải bằng OS/architecture nhận diện sơ bộ. Nó phải luôn có:

- Danh sách tải thủ công.
- Phiên bản, ngày phát hành, OS/architecture và trạng thái support.
- Dung lượng, checksum, chữ ký và hướng dẫn xác minh.
- Release notes, known issues và yêu cầu kế thừa từ runtime manifest.
- Hướng dẫn cài/gỡ/khôi phục bằng ngôn ngữ phổ thông.
- Privacy notice, Terms/EULA, license và OpenClaw attribution.
- Link báo lỗ hổng và kênh hỗ trợ.

Installer mới là nơi kiểm tra điều kiện cứng, dung lượng thực tế, quyền và xung đột phiên bản. Website không quét sâu phần cứng và không cài helper trước khi người dùng tải.

## 8. Bảo mật, pháp lý và vận hành

Trước private alpha:

- Senior platform reviewer và security reviewer ký kiến trúc.
- Threat model, privacy inventory, retention và incident playbook.
- Support bundle redaction test bằng dữ liệu giả chứa secret canary.
- Restore drill và update rollback drill.
- Người phụ trách support, incident và release được nêu tên.

Trước beta công khai:

- Pentest độc lập; không còn lỗi High/Critical.
- Legal/privacy review cho dữ liệu cá nhân tại thị trường phát hành.
- License sản phẩm, Terms/EULA, privacy notice và trademark review.
- Vulnerability disclosure và quy trình revoke signing credential.
- Kế hoạch hỗ trợ khi Product Owner hoặc AI không trực tuyến.

## 9. Ma trận test máy thật tối thiểu

| Nhóm | Tình huống bắt buộc |
|---|---|
| Máy sạch | Không Node, Git, WSL, OpenClaw hoặc AICoworker |
| Máy có app liên quan | OpenClaw/AICoworker đang chạy, cổng tương tự bị chiếm |
| Quyền | User thường, UAC/sudo chỉ khi thật sự cần |
| Mạng | Offline, chậm, proxy, firewall, rớt giữa OAuth/update |
| Dữ liệu | Unicode, emoji, file lớn, file thực thi đổi đuôi, symlink/path traversal |
| Vòng đời | Cài mới, restart, crash, update, rollback, uninstall giữ dữ liệu, restore |
| Nhiều Agent | Identity, memory, session, auth và project grant tách biệt |
| An toàn Agent | Prompt injection, memory poisoning, excessive agency, denial-of-wallet |
| Accessibility | Bàn phím, screen reader, zoom, sáng/tối, Việt/Anh |
| Human usability | Người phổ thông làm tác vụ đầu mà không terminal hoặc callback copy |

Mỗi OS/architecture được quảng cáo cần runner sạch và ít nhất một máy thật đại diện. Build CI đạt chưa chứng minh máy khách chạy được.

## 10. Quyết định Product Owner còn phải chốt

| Quyết định | Hạn | Mặc định an toàn |
|---|---|---|
| Sandbox local/remote/native | Feature 0.6 | Tool nguy hiểm tắt |
| License nguồn và thương mại | Trước Cổng 4 | Repo private, không phân phối |
| Windows installer và signing provider | Trước Cổng 4 | Không phát hành unsigned |
| macOS Developer account/certificate owner | Trước Cổng 4 | Không phát hành macOS |
| Linux package/update strategy | Trước Cổng 4 | Chỉ artifact thử nghiệm nội bộ |
| Update hosting và release promotion | Trước Cổng 4 | Chưa có auto-update |
| Recovery key `.aifb` | Trước Cổng 3 | Chưa xuất portable full backup |
| Telemetry/support upload/retention | Trước Cổng 5 | Tắt mặc định |
| Giá và license activation | Trước Cổng 5 | Không khóa người dùng |

## 11. Đường ngắn nhất tới bản người dùng tải được

1. Gỡ blocker release train hoặc chuyển sang stable release đồng bộ.
2. Hoàn thành Feature 0.3 đến 0.6 và review kiến trúc.
3. Thuê hoặc chỉ định một desktop/platform engineer senior chịu trách nhiệm.
4. Làm Windows x64 technical spike với Supervisor/Gateway Adapter.
5. Hoàn thành onboarding, Agent Genesis, session/model/Advisor và recovery tối thiểu.
6. Test ít nhất 10 người không kỹ thuật với dữ liệu giả; đạt hành trình ba bước và Cổng Worth-Building.
7. Chọn và mua/thiết lập code-signing; build installer Windows x64 đã ký.
8. Private alpha 20–30 người, có support và incident owner.
9. Mở macOS/Linux theo dependency và máy test, không mở đồng thời bằng lời hứa.
10. Spike Headless Linux single-tenant, remote access và restore trước khi quảng cáo Always-on.
11. Pentest, legal review, signed release, staged rollout rồi mới public download.

Đường này ưu tiên một bản Windows x64 có bằng chứng trước. Mục tiêu đa nền tảng vẫn giữ nguyên, nhưng mỗi platform được mở bằng test và chữ ký riêng.

## 12. Định nghĩa “đủ để mọi người tải dùng”

Chỉ dùng câu này khi đồng thời đạt:

- Artifact production đã ký cho từng platform công bố.
- Cài mới, update, rollback, uninstall và restore đạt trên máy thật.
- Gateway, model connection, Agent Genesis và tác vụ đầu đạt không cần terminal.
- Sandbox/policy/approval cưỡng chế đúng và security suite đạt.
- Không còn lỗi High/Critical; pentest và legal review hoàn tất.
- SBOM, license, privacy, support matrix và incident contact đã công bố.
- Có owner kỹ thuật, release, support và incident bằng tên.
- Product Owner ký chấp nhận release dựa trên bằng chứng.

Trước thời điểm đó, mọi artifact chỉ được gọi là lab, prototype, internal build hoặc private alpha theo đúng cổng.
