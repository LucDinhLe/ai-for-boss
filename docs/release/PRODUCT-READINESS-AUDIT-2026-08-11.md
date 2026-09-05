# AI for Boss — Audit mức sẵn sàng đóng gói sản phẩm

Ngày audit: 2026-08-11  
Người thực hiện: Codex self-review  
Product Owner: Lê Đình Lực  
Phạm vi: Từ repo hiện tại tới sản phẩm cho người phổ thông tải và dùng trên Windows, macOS và Linux

## 1. Kết luận điều hành

**AI for Boss chưa thể đóng gói hoặc phát hành cho người dùng.** Repo hiện có governance, release train đã khóa, capability/auth/source/threat contract, Gateway contract lock, desktop shell, first-run prototype nội bộ và sandbox feasibility contract bằng dữ liệu giả. Repo chưa có Supervisor, Gateway Adapter, onboarding/runtime thật, sandbox sản phẩm, installer, updater hoặc artifact đã ký.

Update cùng ngày đã gỡ blocker Feature 0.2:

- `openclaw` stable: `2026.7.1-2`.
- Hai workspace package Gateway trong đúng tag là `0.0.0-private`, `private: true`; tài liệu chính thức yêu cầu external app dùng WebSocket RPC công bố thay vì chờ public npm package.
- Contract lock đã pin npm integrity, git tag/commit, protocol v4, doc blob và private workspace tree fingerprint. Gateway startup cùng authenticated `health` RPC đạt trong loopback-only lab.

Feature 0.2 chuyển sang `complete` và manifest thành `locked`. Beta, private source vendoring và hashed `dist` imports vẫn bị cấm. Việc gỡ blocker chỉ mở feature kế tiếp; không tạo executable giả vờ hoàn chỉnh.

Feature 0.3 cũng đã hoàn thành ở mức hợp đồng và kiểm tra cục bộ: 23 nhóm
capability, 9 auth mode, 9 nguồn sự thật, 8 data flow, Agent Genesis contract
và 14 threat/abuse case. Toàn bộ capability vẫn `advertisable: false`; senior
platform/security review vẫn là điều kiện trước khi qua Cổng 0.

Audit competitive parity bổ sung cùng ngày xác nhận sản phẩm cũng chưa đạt hành trình ba bước, benchmark thị giác hoặc Headless implementation. Xem [Competitive parity, ba bước và Always-on](COMPETITIVE-PARITY-AND-HEADLESS-AUDIT-2026-08-11.md).

## 2. Những gì đã có

| Lớp | Bằng chứng hiện tại | Trạng thái |
|---|---|---|
| Governance | Rulebook, Master Plan, AGENTS, Decision Log, Risk Register, Feature Spec | Có nền |
| Release train | OpenClaw, Node, Electron, pnpm và Gateway contract có version/hash cụ thể | Locked |
| Runtime manifest | Schema và manifest cho sáu tổ hợp nền tảng | Locked, chưa có artifact sản phẩm |
| Capability/data/security contract | 23 capability, 9 auth mode, 9 nguồn, 8 flow, Agent Genesis và 14 threat | Hoàn thành Feature 0.3; chưa phải control đã triển khai |
| License/SBOM | Inventory, third-party notice và SBOM nền | Có nền, chưa phải SBOM artifact cuối |
| Lab | WSL2 riêng, không mount ổ Windows, không credential | Đạt mục tiêu Feature 0.2 |
| Product UX | Desktop shell và first-run prototype ba bước bằng fixture `live:false` | Có vertical slice nội bộ; chưa có human usability |
| Desktop/Supervisor/Adapter | Electron/React shell có secure renderer boundary; Supervisor/Adapter chưa có | Shell thử nghiệm, runtime chưa có |
| Sandbox feasibility | ADR, manifest/schema, fail-closed policy và fixture-only probe | Có khuyến nghị kỹ thuật; chưa có backend hoặc isolation proof |
| Installer/updater/signing | Chưa có | Chưa có |
| Pilot/security/legal | Chưa thực hiện | Chưa có |

## 3. Khoảng trống bắt buộc theo thứ tự

### 3.1. Feature 0.2 đã hoàn thành

Release train thống nhất gồm OpenClaw, Node, Electron, package manager và Gateway integration contract công khai của đúng tag stable.

Đường đã chọn:

1. Dùng WebSocket text/JSON và RPC mà `docs/gateway/external-apps.md` công bố cho external app.
2. Pin tag/commit, protocol/doc blob và tree fingerprint của workspace package private để phát hiện drift.
3. Không bundle private package. AI for Boss Adapter thuộc feature sau và phải contract-test với Gateway thật.

Đường bị cấm: dùng beta ghép stable, coi placeholder npm `0.0.0` là dependency, chép private package, import hashed `dist` hoặc tự viết giao thức khác tài liệu công khai.

### 3.2. Hoàn thành Cổng 0

Feature 0.3 đã hoàn thành ở mức contract. Các phần còn lại của Cổng 0 là:

- Feature 0.4: Electron shell, renderer sandbox và CI Windows/macOS/Linux đã có; artifact vẫn experimental/unsigned.
- Feature 0.5: first-run vertical slice đang ở correction pass; IPC ghi, release policy đầy đủ, redaction và incident skeleton vẫn là acceptance gap của Cổng 0.
- Feature 0.6: ADR/manifest/policy cùng fixture-only probe đã có; CI ba OS chỉ kiểm contract/presence/temp-boundary. Product Owner và senior platform/security review chưa chấp nhận backend; sandbox thật vẫn chưa triển khai.

Không được mở host exec, elevated hoặc browser nhạy cảm chỉ vì Feature 0.6 đã có ADR; các capability này tiếp tục khóa cho tới khi backend thật đạt review và implementation/security gate.

### 3.3. Tích hợp lõi Windows

- Supervisor sở hữu OpenClaw process, profile, cổng động và recovery.
- Gateway Adapter dùng WebSocket RPC contract, protocol v4 và schema/frame validator đúng release train.
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
| Sandbox local/remote/native | Sau Feature 0.6 ADR và trước Feature 1.1 product exec | Khuyến nghị local managed container có điều kiện; execution/sandbox/workspace/network vẫn tắt |
| License nguồn và thương mại | Trước Cổng 4 | Repo private, không phân phối |
| Windows installer và signing provider | Trước Cổng 4 | Không phát hành unsigned |
| macOS Developer account/certificate owner | Trước Cổng 4 | Không phát hành macOS |
| Linux package/update strategy | Trước Cổng 4 | Chỉ artifact thử nghiệm nội bộ |
| Update hosting và release promotion | Trước Cổng 4 | Chưa có auto-update |
| Recovery key `.aifb` | Trước Cổng 3 | Chưa xuất portable full backup |
| Telemetry/support upload/retention | Trước Cổng 5 | Tắt mặc định |
| Giá và license activation | Trước Cổng 5 | Không khóa người dùng |

## 11. Đường ngắn nhất tới bản người dùng tải được

1. Bàn giao Feature 0.4 đến 0.6, Product Owner chốt sandbox direction và hoàn thành review kiến trúc độc lập.
2. Thuê hoặc chỉ định một desktop/platform engineer senior chịu trách nhiệm.
3. Làm Windows x64 technical spike với Supervisor/Gateway Adapter.
4. Hoàn thành onboarding, Agent Genesis, session/model/Advisor và recovery tối thiểu.
5. Test ít nhất 10 người không kỹ thuật với dữ liệu giả; đạt hành trình ba bước và Cổng Worth-Building.
6. Chọn và mua/thiết lập code-signing; build installer Windows x64 đã ký.
7. Private alpha 20–30 người, có support và incident owner.
8. Mở macOS/Linux theo dependency và máy test, không mở đồng thời bằng lời hứa.
9. Spike Headless Linux single-tenant, remote access và restore trước khi quảng cáo Always-on.
10. Pentest, legal review, signed release, staged rollout rồi mới public download.

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
