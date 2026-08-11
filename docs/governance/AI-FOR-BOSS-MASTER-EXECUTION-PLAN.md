# AI for Boss — Kế hoạch triển khai tổng thể

Ngày lập: 2026-08-11  
Chủ sản phẩm: Lê Đình Lực  
Phiên bản: 1.0  
Trạng thái: Kế hoạch thi công trực thuộc Rulebook 1.1

## 0. Vai trò của tài liệu

Tài liệu này trả lời câu hỏi **AI for Boss sẽ được xây như thế nào từ lõi OpenClaw có sẵn cho tới bản phát hành đa nền tảng**.

Nguồn quyết định cao nhất vẫn là [AI-FOR-BOSS-BUILD-RULES.md](AI-FOR-BOSS-BUILD-RULES.md). Nếu hai tài liệu khác nhau, Rulebook thắng. Kế hoạch này được cập nhật khi thứ tự triển khai, bằng chứng kỹ thuật hoặc nguồn lực thay đổi. Mọi thay đổi luật sản phẩm vẫn phải đi qua Decision Log.

Ba tài liệu có vai trò riêng:

| Tài liệu | Trả lời |
|---|---|
| Rulebook 1.1 | Điều gì bắt buộc, điều gì bị cấm, cổng nào phải qua |
| Master Execution Plan | Xây theo lớp nào, thứ tự nào, dùng phần nào của OpenClaw, nghiệm thu ra sao |
| Feature Spec và Decision Log | Phiên build hiện tại làm đúng việc gì và đã chốt lựa chọn nào |

## 1. Kết luận kiến trúc

AI for Boss dùng OpenClaw làm **lõi năng lực và nguồn sự thật của runtime**. AI for Boss xây lớp sản phẩm bao quanh lõi đó.

OpenClaw tiếp tục sở hữu:

- Gateway và giao thức điều khiển.
- Model, provider và hồ sơ xác thực được OpenClaw hỗ trợ.
- Session, transcript, agent runtime, memory và usage.
- Tool, browser, skill, plugin, MCP và channel.
- Cron, task, heartbeat, node và diagnostics.
- Backup phần dữ liệu OpenClaw qua cơ chế chính thức.

AI for Boss sở hữu:

- Bộ cài độc lập và runtime manifest.
- Supervisor khởi động, theo dõi, phục hồi và nâng cấp OpenClaw.
- Giao diện song ngữ Cơ bản và Nâng cao.
- Trung tâm kết nối provider và kiểm tra trạng thái dễ hiểu.
- Model theo phiên, mẫu agent và Advisor theo phiên.
- Policy Compiler & Verifier, Approval Inbox và tuyến quyền trực quan.
- Gói công việc chủ doanh nghiệp, gói lớp học và cấu hình cá nhân.
- Dữ liệu sản phẩm riêng, audit metadata, backup hợp nhất và rollback.
- Website tải bản phù hợp, chữ ký, cập nhật và hỗ trợ.

Mọi artifact và màn hình giới thiệu sản phẩm phải ghi rõ: **AI for Boss — Built on OpenClaw**.

### 1.1. Luật tận dụng mã nguồn OpenClaw

Mỗi năng lực đi theo thứ tự tích hợp sau:

1. Dùng Gateway RPC và package giao thức chính thức.
2. Dùng cấu hình, CLI hoặc backup contract chính thức.
3. Dùng Plugin SDK khi cần thêm hành vi có vòng đời riêng.
4. Đề xuất sửa upstream khi contract còn thiếu.
5. Chỉ giữ patch riêng khi bốn đường trên thất bại, có owner, test, kế hoạch rebase và ngày loại bỏ.

Không đọc hoặc sửa trực tiếp SQLite, transcript, state file, cache hay thư mục riêng của OpenClaw. Không chép riêng thư mục `dist`. OpenClaw phải được cài đầy đủ trong `node_modules` và được chạy bằng Node thật đi kèm AI for Boss.

### 1.2. Luật tránh xây lại

Một capability đã có trong OpenClaw chỉ được xây thêm ở AI for Boss khi thuộc một trong bốn trường hợp:

- Cần giao diện dễ dùng hơn.
- Cần điều phối nhiều capability thành một quy trình chủ doanh nghiệp.
- Cần lớp policy, approval, audit hoặc recovery bên ngoài model.
- Cần adapter ổn định để cách ly giao diện khỏi thay đổi của OpenClaw.

Nếu feature spec không chứng minh được một trong bốn lý do này, feature bị loại khỏi backlog AI for Boss.

## 2. Mục tiêu và tiêu chuẩn thành công

### 2.1. Kết quả sản phẩm

Một người phổ thông có thể:

1. Tải đúng bản cho máy của mình.
2. Cài một lần mà không tự cài Node, Git, WSL, OpenClaw hoặc Gateway.
3. Kết nối provider bằng phương thức được hỗ trợ và nhận kiểm tra live rõ ràng.
4. Chọn model, agent và Advisor cho từng phiên.
5. Giao việc, xem kế hoạch quyền, duyệt hành động nhạy cảm và nhận artifact.
6. Khôi phục sau crash, update lỗi hoặc đổi máy mà không hiểu thuật ngữ hạ tầng.
7. Mở chế độ Nâng cao để dùng các capability tương thích của OpenClaw.

### 2.2. Tiêu chuẩn phát hành

Sản phẩm chỉ được quảng cáo hỗ trợ một tổ hợp hệ điều hành và kiến trúc khi tổ hợp đó đạt:

- Cài mới trên máy sạch.
- Khởi động Gateway và handshake.
- Kết nối ít nhất một provider thật bằng tài khoản test.
- Chạy tác vụ, tool theo policy, Advisor và artifact.
- Update, rollback, uninstall giữ dữ liệu và restore.
- Không còn lỗi bảo mật cao hoặc nghiêm trọng.
- Artifact có chữ ký hoặc checksum theo chuẩn nền tảng.

Mục tiêu trải nghiệm của pilot được chốt trong Pilot Charter. Chỉ số mặc định để kiểm tra là 90% người thử hoàn thành tác vụ đầu trong năm phút mà không mở terminal.

## 3. Bản đồ năng lực và quyền sở hữu

| Nhóm năng lực | OpenClaw cung cấp | AI for Boss xây thêm | Cách nghiệm thu |
|---|---|---|---|
| Gateway | Process Gateway, WebSocket protocol, role, scope, health, event | Supervisor, cổng động, readiness, Safe Mode, reconnect | Kill process, chiếm cổng, shutdown và reconnect test |
| Model và provider | Catalog, auth status, probe, provider/plugin | Trung tâm kết nối, hướng dẫn Việt/Anh, live check, revoke | Contract test và live auth bằng tài khoản test |
| Phiên và chat | Session, history, run, usage, attachment, artifact | Giao diện phiên, model theo phiên, trạng thái tác vụ | Tạo, tiếp tục, crash, reload và history recovery |
| Agent và phối hợp | Agent, sub-agent, task, goal, steer, swarm/ACP khi khả dụng | Mẫu agent, vai trò, ngân sách, trách nhiệm, provenance | Bài test phân việc, thu kết quả, dừng và giới hạn chi phí |
| Advisor | Agent/session/model/policy primitives | Điều phối review riêng, rubric, read-only, trạng thái đã review | Worker output độc hại, parse fail, budget fail, Advisor fail |
| Memory | Memory runtime và contract tương thích | Giao diện nguồn, policy ghi nhớ, khu chờ nội dung đáng ngờ | Cách ly phiên, provenance và memory-poisoning test |
| File và workspace | File/tool contract, workspace và session files | Bộ chọn workspace, allowlist, preview, quarantine | Path traversal, symlink escape, file giả mạo |
| Tool và code | Tool catalog, policy, exec/process, approvals | Permission preview, policy preset, nút dừng, cost guard | Deny thắng, approval hết hạn, host escape test |
| Browser và web | Browser, web search/fetch và plugin liên quan | Profile riêng, domain policy, download quarantine | Prompt injection, cookie/secret và download test |
| Skill | Skill discovery, config và runtime | Thư viện đã duyệt, gói công việc chủ doanh nghiệp | Cài, bật/tắt, version drift và permission test |
| Plugin | Plugin lifecycle và capability extension | Catalog có provenance, quarantine, ký và allowlist | Hash drift, dependency và rollback test |
| MCP | Kết nối MCP qua capability/plugin tương thích | Trình kết nối, quyền theo server/tool, health | Server giả, đổi schema, token và timeout test |
| Channel | Channel/plugin runtime | Trung tâm kênh, cảnh báo delegated authority | Pairing, allowlist, gửi nhầm nơi và revoke test |
| Lịch và nền | Cron, task, heartbeat, hooks | Giao diện lịch, múi giờ, budget, notification | Trùng lịch, missed run, restart và timezone test |
| Node và thiết bị | Pairing, node role, capability và command | Danh sách thiết bị, trạng thái, policy hiển thị | Pairing giả, revoke, offline và version mismatch |
| Media và giọng nói | TTS, speech, image/media qua core hoặc plugin | UI, quyền dữ liệu và provider selector | Loại file, dung lượng, privacy và provider failure |
| Usage và chi phí | Usage/cost RPC | Ngân sách phiên, cảnh báo và báo cáo chủ doanh nghiệp | Giới hạn token/tool/time, denial-of-wallet test |
| Approval và audit | Operator approvals, audit và event | Approval Inbox, backfill, diễn giải rủi ro | Reconnect không mất yêu cầu, scope và expiry test |
| Backup | Backup/verify chính thức của OpenClaw | `.aifbp`, `.aifb`, dữ liệu sản phẩm, staging restore | Restore drill, migration, atomic swap và rollback |
| Cập nhật | Version và migration primitives liên quan | Bundle ký, release train, staged rollout và rollback | Tamper, downgrade, mất điện và rollback test |

Advisor là phần khác biệt sản phẩm. Nó dùng primitive có sẵn của OpenClaw, còn luật review, rubric, quyền đọc, cấu trúc gói đầu vào và trạng thái nghiệm thu thuộc AI for Boss.

## 4. Kiến trúc triển khai

```text
Website tải bản phù hợp
        |
        v
Bộ cài AI for Boss theo OS và kiến trúc
        |
        v
AI for Boss Desktop
  |-- Renderer sandbox: giao diện Việt/Anh
  |-- Electron Main: IPC allowlist, cửa sổ, cập nhật
  |-- Supervisor
       |-- Gateway lifecycle và recovery
       |-- Policy Compiler & Verifier
       |-- Credential Broker cho static SecretRef
       |-- Audit Ledger
       |-- Backup, migration và rollback
       |-- Update Verifier
       `-- OpenClaw package đầy đủ + Node thật
             |-- Gateway RPC
             |-- Sessions, agents, models và memory
             |-- Tools, skills, plugins, MCP và channels
             `-- Automation, nodes, usage và backup

Control plane doanh nghiệp, để sau Cổng 7
  |-- License và enrollment
  |-- Signed policy và rollout
  `-- Health và audit metadata tối thiểu
```

### 4.1. Adapter ổn định

Giao diện không gọi RPC rải rác. Một lớp `OpenClaw Adapter` chịu trách nhiệm:

- Handshake, role, scope và device identity.
- Validate request, response và event bằng schema đúng release train.
- Chuyển lỗi kỹ thuật thành trạng thái sản phẩm có mã ổn định.
- Reconnect, resubscribe, backfill history, in-flight run và approval.
- Cung cấp capability flags cho Cơ bản và Nâng cao.
- Ghi protocol metrics sạch nội dung và secret.

Nhờ lớp này, thay đổi OpenClaw chạm vào adapter và test contract trước khi chạm giao diện.

### 4.2. Nguồn sự thật

- OpenClaw qua Gateway RPC là nguồn sự thật cho session, agent runtime, model status, transcript, usage và audit OpenClaw.
- Kho dữ liệu AI for Boss là nguồn sự thật cho policy sản phẩm, rubric Advisor, gói lớp học, giao diện và metadata riêng.
- OS key store là nguồn cho static secret sau khi SecretRef contract test đạt.
- OpenClaw native auth store là nguồn cho OAuth token của profile riêng.
- Cache giao diện luôn có thể dựng lại.

## 5. Cơ chế bảo đảm phủ hết capability OpenClaw

“Đầy đủ OpenClaw” được quản lý bằng bằng chứng thay cho trí nhớ của người build.

Mỗi phiên bản OpenClaw được khóa có một `capability-manifest` sinh từ:

1. `protocol.schema.json` và TypeBox schema.
2. Gateway method/event families và scope.
3. Tài liệu chính thức của đúng phiên bản.
4. Plugin, channel và provider manifests.
5. Test contract và smoke test trên runtime đã đóng gói.

Mỗi capability có các trường tối thiểu:

| Trường | Ý nghĩa |
|---|---|
| ID và tên | Định danh ổn định trong AI for Boss |
| Nguồn upstream | Schema, RPC, config, CLI hoặc plugin contract |
| Phiên bản | OpenClaw release train đã xác minh |
| Chế độ hiển thị | Cơ bản, Nâng cao hoặc cả hai |
| Trạng thái | `REUSED`, `WRAPPED`, `RESTRICTED`, `BLOCKED`, `UNAVAILABLE_UPSTREAM` |
| Điều kiện | Provider, plugin, OS, sandbox, account hoặc license |
| Quyền và dữ liệu | Scope, tool, workspace, network, secret |
| Test | Contract, integration, security và UX |

CI phải thất bại khi:

- Upstream thêm, xóa hoặc đổi capability nhưng manifest chưa được phân loại.
- Capability đang quảng cáo mất test trên một nền tảng.
- Một feature dùng state riêng của OpenClaw ngoài contract.
- Gateway client, protocol package và OpenClaw lệch release train.

Không dùng riêng `hello-ok.features.methods` làm danh sách đầy đủ. Nó chỉ là một tín hiệu runtime trong nhiều nguồn.

## 6. Các luồng công việc song song

Sau khi Cổng 0 đạt, dự án vận hành theo mười luồng có dependency rõ ràng.

### Luồng A. Upstream và hợp đồng tương thích

- Chọn một OpenClaw stable release.
- Khóa Node, Electron, package manager, Gateway client và protocol.
- Tạo runtime manifest, capability manifest và license inventory.
- Tạo protocol diff, capability diff và migration test khi nâng phiên bản.

### Luồng B. Desktop shell và trải nghiệm

- Electron main, preload tối thiểu và renderer sandbox.
- Design system Việt/Anh, sáng/tối và accessibility.
- Onboarding, Home, phiên, artifact, Data & Recovery và System Health.
- Chế độ Cơ bản theo công việc; Nâng cao theo capability.

### Luồng C. Supervisor và Gateway

- Spawn OpenClaw package bằng Node đi kèm.
- Loopback, cổng động, token/scope tối thiểu và readiness.
- Restart có giới hạn, Safe Mode, diagnostics và support bundle sạch secret.
- Reconnect đầy đủ state ứng dụng.

### Luồng D. Provider và model

- Provider catalog từ OpenClaw.
- Auth-support record cho từng phương thức xác thực.
- OAuth/API key flow, revoke, live probe và model catalog.
- OpenAI, Anthropic và Google được làm connector recipe đầu tiên; các provider còn lại được sinh từ catalog của release train và mở theo capability manifest.
- Chỉ ghi nhãn OAuth khi OpenClaw, provider và điều khoản sử dụng thật sự hỗ trợ; các nơi khác dùng API key, CLI credential hoặc phương thức upstream đã xác minh.
- Model theo phiên, thinking/capability awareness và lỗi rõ ràng.

### Luồng E. Phiên, agent và Advisor

- Session lifecycle, artifact và usage.
- Agent template, sub-agent, task và budget.
- Advisor chạy trong session review riêng, quyền read-only và rubric có schema; người dùng bật/tắt và chọn một hoặc nhiều model đã kết nối cho từng phiên.
- Worker output luôn là dữ liệu không tin cậy đối với Advisor.

### Luồng F. Tool, workspace và sandbox

- Workspace grant, file preview và path policy.
- Tool catalog, permission preview và Approval Inbox.
- Browser profile riêng, network policy và quarantine.
- Sandbox backend chỉ mở sau ADR và spike đạt từng nền tảng.

### Luồng G. Hệ sinh thái OpenClaw

- Skill, plugin, MCP và channel catalog.
- Provenance, hash, permission, allowlist và quarantine.
- Cron, heartbeat, hook, node và media theo capability manifest.
- Advanced mode không che mất capability tương thích.

### Luồng H. Quản trị, bảo mật và đạo đức

- Policy được biên dịch thành control thật.
- Approval, audit, budget và emergency stop.
- Threat model, privacy inventory và retention.
- Prompt injection, memory poisoning, excessive agency và denial-of-wallet tests.

### Luồng I. Dữ liệu, phục hồi và cập nhật

- `.aifbp` sạch secret và `.aifb` luôn mã hóa.
- Snapshot trước migration/update.
- Restore staging, health check, atomic swap và rollback.
- Signed updater, staged rollout và downgrade protection.

### Luồng J. Phát hành, lớp học và doanh nghiệp

- Build, ký và test từng OS/architecture.
- Website đề xuất bản tải, installer mới là nơi xác minh.
- Cohort pack, role/industry pack và personal overlay không chứa secret.
- Sau cùng mới thêm license, enrollment, signed policy, SSO/SCIM và MDM.

## 7. Lộ trình theo cổng

### Cổng 0. Khóa nền móng

#### Feature 0.1. Repo governance

Đầu ra:

- Repo sản phẩm riêng.
- `AGENTS.md`, `DECISIONS.md`, `RISKS.md`, `CHANGELOG.md`.
- Mẫu Feature Spec, quy tắc branch, commit, test, secret và định nghĩa xong.
- Rulebook và Master Plan được gắn làm nguồn bắt buộc.

Nghiệm thu khi một phiên AI mới có thể đọc tài liệu, xác định đúng việc được phép làm và không tự nhảy sang OAuth hay giao diện.

#### Feature 0.2. Khóa release train

Đầu ra:

- Chọn một OpenClaw stable release sau khi chạy smoke test.
- Khóa Node, Electron, package manager, Gateway client và protocol.
- Runtime manifest theo OS/architecture.
- SBOM nền và license inventory.

Snapshot OpenClaw `2026.8.1` đang có trong thư mục nghiên cứu chỉ là bằng chứng khảo sát. Nó chưa được coi là phiên bản sản phẩm đã khóa.

#### Feature 0.3. Capability và threat model

Đầu ra:

- Capability manifest v1.
- Sơ đồ data flow và nguồn sự thật.
- Threat model, trust boundary và abuse cases.
- Provider authentication matrix.

#### Feature 0.4. App shell và CI đa nền tảng

Đầu ra:

- App trống có renderer sandbox.
- CI build được artifact thử nghiệm cho các runner mục tiêu.
- Unit, lint, type, secret scan, dependency scan và artifact inventory.

CI build chỉ chứng minh khả năng biên dịch. Hỗ trợ thiết bị chỉ được công bố sau test máy thật ở Cổng 4.

#### Feature 0.5. Baseline bảo mật và phát hành

Đầu ra:

- IPC schema và sender validation.
- CSP, navigation policy và remote-debugging policy.
- Test policy, release policy, support-bundle redaction và incident skeleton.

#### Feature 0.6. Sandbox feasibility

So sánh container local, SSH/OpenShell và native restriction theo:

- Mức cô lập thật.
- Trải nghiệm cài đặt.
- Dung lượng, quyền admin và chi phí.
- Browser support, network control và dữ liệu rời thiết bị.
- Khả năng cập nhật, gỡ và hỗ trợ trên từng OS.

Đại ca chốt đường sandbox sau khi nhận ADR bằng hệ quả vận hành. Trước quyết định này, host exec, elevated và browser nhạy cảm tiếp tục tắt.

**Điều kiện qua Cổng 0:** app trống build tái lập, release train được khóa, capability/threat model được review, sandbox có quyết định hoặc giới hạn rõ, không còn lỗi kiến trúc nghiêm trọng chưa có owner.

### Cổng 1. Lõi tích hợp Windows

Thứ tự:

1. `1.1` Supervisor spawn OpenClaw nhúng trên Windows x64.
2. `1.2` Gateway Adapter handshake, scope, health và `models.list`.
3. `1.3` Restart, reconnect, state adoption, approval backfill và Safe Mode.
4. `1.4` OpenAI/ChatGPT auth end-to-end bằng tài khoản test chuyên dụng.
5. `1.5` Bộ cài máy sạch, uninstall giữ dữ liệu và diagnostics.
6. `1.6` Update lỗi, rollback và Compatibility ID.

**Điều kiện qua Cổng 1:** một người phổ thông cài trên Windows x64 sạch, kết nối tài khoản test và chạy tác vụ mẫu; không copy callback, không mở terminal, không lộ secret; kill Gateway và update lỗi đều phục hồi đúng.

### Cổng 2. Trải nghiệm cốt lõi

Thứ tự:

1. `2.1` Design system Việt/Anh.
2. `2.2` Onboarding và Trung tâm kết nối.
3. `2.3` Phiên, chat, history, attachment và artifact.
4. `2.4` Model theo phiên và budget.
5. `2.5` Agent template và phối hợp nhiều agent.
6. `2.6` Advisor theo phiên, rubric và trạng thái review.
7. `2.7` Permission preview, Approval Inbox và emergency stop.
8. `2.8` Ba workflow đầu dành cho chủ doanh nghiệp.

**Điều kiện qua Cổng 2:** ít nhất 10 người không kỹ thuật hoàn thành cài đặt và ba luồng cốt lõi; friction, lỗi hiểu quyền và lỗi dữ liệu được ghi lại rồi sửa trước khi mở rộng.

### Cổng 3. Phủ hệ sinh thái OpenClaw

Triển khai theo batch:

1. `3.1` Memory, file, workspace và tool cơ bản.
2. `3.2` Skill, plugin và MCP.
3. `3.3` Browser, web, media và speech.
4. `3.4` Channel và delegated authority.
5. `3.5` Cron, task, heartbeat, hook và notification.
6. `3.6` Node, terminal, diagnostics và capability nâng cao tương thích.
7. `3.7` Coverage gate và agentic security suite.

Mỗi batch phải cập nhật capability manifest, quyền, UI mode, test và nền tảng hỗ trợ.

**Điều kiện qua Cổng 3:** không còn capability tương thích bị bỏ sót mà thiếu lý do; mọi mục `RESTRICTED`, `BLOCKED` hoặc `UNAVAILABLE_UPSTREAM` có giải thích hiển thị cho người dùng; sandbox và security test đạt.

### Cổng 4. Đóng gói đa nền tảng

Thứ tự mở rộng:

1. Hoàn thiện Windows x64.
2. Windows ARM64 nếu dependency của release train hỗ trợ.
3. macOS Apple Silicon.
4. macOS Intel nếu dependency hỗ trợ.
5. Linux x64 theo distro đã chọn.
6. Linux ARM64 nếu dependency hỗ trợ.
7. Website tải bản phù hợp, lựa chọn thủ công và checksum.
8. Staged updater, rollback và support matrix.

Mỗi tổ hợp cần runner sạch và ít nhất một máy thật đại diện. “Build được” và “chạy được trên máy khách” là hai bằng chứng khác nhau.

**Điều kiện qua Cổng 4:** cài mới, update, rollback, uninstall và restore đạt trên mọi tổ hợp được quảng cáo; bản sai kiến trúc bị chặn bằng thông báo dễ hiểu.

### Cổng 5. Private alpha

- 20 đến 30 người dùng với dữ liệu giả hoặc ít nhạy cảm.
- Cohort pack, role pack và personal overlay đã ký.
- Dashboard chỉ thu metadata tối thiểu.
- Support flow, diagnostics sạch secret, kill switch và incident drill.

**Điều kiện qua Cổng 5:** không còn lỗi cao/nghiêm trọng; mục tiêu cài đặt, tác vụ đầu, hiểu quyền và hỗ trợ đạt Pilot Charter.

### Cổng 6. Beta công khai có kiểm soát

- Artifact ký cho mọi nền tảng công bố.
- SBOM, license notice, privacy notice và vulnerability disclosure.
- Pentest độc lập và sửa toàn bộ lỗi cao/nghiêm trọng.
- Monitoring, staged rollout, rollback, restore drill và legal review.
- Có kỹ sư chịu trách nhiệm kỹ thuật và owner xử lý sự cố.

### Cổng 7. Bản quản trị doanh nghiệp

- Control plane tối thiểu dữ liệu.
- License, enrollment, signed policy và version rollout.
- SSO/SCIM, role, device inventory, MDM và audit export khi nhu cầu thật xác nhận.
- Runtime và Gateway tiếp tục tách theo người hoặc biên tin cậy.

## 8. Chuỗi build, kiểm thử và phát hành

```text
Chọn OpenClaw stable release
        |
        v
Khóa release train + sinh runtime/capability manifest
        |
        v
Build app và bundle theo OS/architecture
        |
        v
Unit + contract + integration + security tests
        |
        v
Máy sạch + máy thật + test người phổ thông
        |
        v
SBOM + license + checksum + ký artifact
        |
        v
Staged rollout
        |
        v
Theo dõi health, hỗ trợ, rollback hoặc promote
```

### 8.1. Thang kiểm thử

| Tầng | Chứng minh |
|---|---|
| Unit | Logic cục bộ đúng |
| Schema và contract | AI for Boss hiểu đúng Gateway của release train |
| Integration | OpenClaw đóng gói chạy cùng Supervisor và desktop shell |
| End-to-end | Người dùng hoàn thành luồng thật trên máy sạch |
| Security | Model, content, renderer, plugin và process lạ không vượt biên đã định |
| Recovery | Crash, update lỗi, migration lỗi và mất mạng không làm mất trạng thái đã cam kết |
| Cross-platform | Từng OS/architecture trong manifest chạy trên máy đại diện |
| Human usability | Người phổ thông hoàn thành việc mà không cần hướng dẫn kỹ thuật |

### 8.2. Luật nâng OpenClaw

Mỗi lần nâng OpenClaw phải:

1. Tạo protocol diff, config diff, capability diff và plugin/provider diff.
2. Chạy migration trên bản sao dữ liệu thử nghiệm.
3. Chạy toàn bộ contract, recovery, backup/restore và security regression.
4. Cập nhật runtime manifest, capability manifest, SBOM và notice.
5. Chạy staged rollout nội bộ trước.
6. Giữ bundle trước để rollback.

Máy khách không tự nâng OpenClaw riêng khỏi AI for Boss.

## 9. Tổ chức nguồn lực và đường găng

### 9.1. Việc Đại ca và Codex có thể làm ngay

- Feature 0.1 về repo governance.
- Đặc tả, capability inventory và prototype giao diện bằng dữ liệu giả.
- Gói cohort, role, Advisor rubric và ba workflow chủ doanh nghiệp.
- Test plan, Pilot Charter, khảo sát thiết bị và nghiên cứu trải nghiệm.
- Technical spike local không dùng tài khoản chính và không phát hành.

### 9.2. Việc cần người chịu trách nhiệm kỹ thuật

- Chấp nhận kiến trúc Electron, IPC, credential và updater.
- Review Supervisor, Gateway Adapter, sandbox và signing pipeline.
- Ký xác nhận trước pilot người thật.
- Chịu trách nhiệm xử lý sự cố ngoài cửa sổ chat.

### 9.3. Nhân sự theo cổng

| Cổng | Nhân sự tối thiểu |
|---|---|
| 0 | Đại ca, Codex, senior platform reviewer theo mốc, security reviewer |
| 1 | Desktop/platform engineer senior, security reviewer, Đại ca nghiệm thu UX |
| 2 | Thêm product/frontend hoặc product designer và người kiểm thử phổ thông |
| 3 | Thêm QA/security chuyên sâu và test lab |
| 4 | Release engineer, máy/runners đa nền tảng, code-signing owner |
| 5-6 | Support owner, incident owner, pentest độc lập và legal/privacy review |
| 7 | Backend/control-plane engineer, enterprise security và vận hành dịch vụ |

### 9.4. Biên thời gian tham khảo

Với một kỹ sư desktop/platform senior toàn thời gian, hỗ trợ frontend và security đúng lúc:

- Cổng 0 đến Cổng 1 khoảng 6 đến 10 tuần.
- Cổng 2 khoảng 6 đến 8 tuần tiếp theo.
- Cổng 3 và private alpha khoảng 8 đến 12 tuần tiếp theo.
- Cổng 4 và beta khoảng 8 đến 12 tuần tiếp theo.

Tổng thể để tới beta đa nền tảng có bằng chứng thường nằm trong khoảng 6 đến 9 tháng. Đây là biên lập kế hoạch, chưa phải lời hứa. Làm bán thời gian bằng AI mà thiếu người chịu trách nhiệm sẽ kéo dài đáng kể và vẫn không thay thế security review, signing hay pentest.

## 10. Hai đường chạy cùng lúc

### Đường 1. Tạo dòng tiền và học người dùng

- Dạy lớp bằng AICoworker hoặc OpenClaw hiện có với dữ liệu giả hoặc ít nhạy cảm.
- Dùng gói cấu hình AI for Boss để cá nhân hóa agent, model, Advisor và policy.
- Đo thiết bị, tỷ lệ cài, lỗi, tác vụ đầu, chi phí hỗ trợ và nhu cầu trả tiền.
- Không phát hành executable AI for Boss đang thử nghiệm cho học viên.

### Đường 2. Xây sản phẩm

- Đi tuần tự từ Cổng 0 đến Cổng 6.
- Dùng dữ liệu lớp học để ưu tiên ba workflow và platform matrix.
- Dùng doanh thu để tài trợ kỹ sư, chữ ký, máy test, security review và pentest.

Hai đường gặp nhau ở Private Alpha. Lúc đó dữ liệu nhu cầu đã có, lõi kỹ thuật đã qua cổng và người dùng thử nhận artifact đủ điều kiện.

## 11. Các quyết định còn mở

| Quyết định | Hạn chốt | Mặc định hiện tại |
|---|---|---|
| Phiên bản OpenClaw stable được khóa | Feature 0.2 | Chưa khóa |
| Sandbox local, remote hay native | Feature 0.6 | Tool nguy hiểm tắt |
| Mã nguồn mở hay thương mại đóng | Trước Cổng 4 | Repo private |
| Nền tảng và kiến trúc quảng cáo | Mỗi release Cổng 4+ | Chỉ tổ hợp đã test |
| Recovery key cho `.aifb` | Trước Cổng 3 | Chưa xuất full portable backup |
| Telemetry và support upload | Trước Cổng 5 | Tắt mặc định |
| Giá và license | Trước Cổng 5 | Chưa khóa người dùng |
| Control plane provider | Trước Cổng 7 | Chưa có control plane |

## 12. Điểm bắt đầu chính xác

Phiên build đầu tiên chỉ làm **Feature 0.1, Repo Governance**.

Feature sau chỉ được mở khi feature trước có:

- Spec và tiêu chí nghiệm thu.
- Test tự động và kiểm tra bằng tay phù hợp.
- Tự review, security/privacy review và blast-radius review.
- Tài liệu cập nhật.
- Commit hoàn tác được.

Sau Feature 0.1, thứ tự là 0.2, 0.3, 0.4, 0.5 và 0.6. Chỉ sau khi Cổng 0 đạt mới spawn OpenClaw nhúng trong Feature 1.1.

Đây là con đường ngắn nhất để tận dụng trọn lõi OpenClaw mà không biến AI for Boss thành một bản sao khó nâng cấp và khó bảo vệ.

## 13. Ma trận truy vết với Rulebook và audit

| Yêu cầu | Nơi được triển khai và nghiệm thu |
|---|---|
| Một bộ cài hoàn chỉnh | Kiến trúc mục 4, Cổng 1 và Cổng 4 |
| Đa nền tảng theo ma trận | Mục 2.2, Luồng J và Cổng 4 |
| Kế thừa sàn OpenClaw | Runtime manifest ở Feature 0.2; chỉ công bố máy đã test |
| Đầy đủ năng lực OpenClaw | Bản đồ mục 3, capability manifest mục 5 và Cổng 3 |
| Khách tự trả provider | Luồng D; credential nằm trên runtime riêng của khách |
| Model theo phiên | Mục 3, Luồng D và Feature 2.4 |
| Advisor theo phiên | Mục 3, Luồng E và Feature 2.6 |
| Nhiều agent | Mục 3, Luồng E và Feature 2.5 |
| Cơ bản và Nâng cao | Luồng B, capability manifest và Cổng 3 |
| Gateway vô hình | Kiến trúc mục 4, Supervisor và Cổng 1 |
| Local-first và quyền tối thiểu | Nguồn sự thật, Luồng F/H/I và security gate |
| Xây độc lập, ghi nguồn | Luật tận dụng mã nguồn, attribution và license inventory |
| Blocker sandbox | Feature 0.6, Luồng F và điều kiện Cổng 3 |
| Blocker Credential Broker | Feature 0.3/0.5, SecretRef contract test trước khi dùng |
| Blocker provider terms và live auth | Luồng D, Feature 1.4 và capability manifest |
| Blocker trách nhiệm ngoài AI | Mục 9.2/9.3 và điều kiện Cổng 6 |

## 14. Nguồn kỹ thuật chính

- [OpenClaw Gateway protocol](https://docs.openclaw.ai/gateway/protocol)
- [Embedding OpenClaw](https://docs.openclaw.ai/gateway/embedding)
- [Building a Gateway client](https://docs.openclaw.ai/gateway/clients)
- [OpenClaw capabilities overview](https://docs.openclaw.ai/tools)
- [OpenClaw provider directory](https://docs.openclaw.ai/providers)
- [OpenClaw plugins](https://docs.openclaw.ai/plugins)
- [OpenClaw sandboxing](https://docs.openclaw.ai/sandboxing)
- [OpenClaw platforms](https://docs.openclaw.ai/platforms)
- [OpenClaw backup](https://docs.openclaw.ai/cli/backup)
- [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security)
