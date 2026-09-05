# Capability inventory v1

Ngày khóa: 2026-08-11

Release train: `oc-2026.7.1-2-locked.1`

Nguồn máy đọc được: [openclaw-2026.7.1-2.capability-manifest.json](../../manifests/capabilities/openclaw-2026.7.1-2.capability-manifest.json)

## 1. Cách đọc trạng thái

- `WRAPPED`: OpenClaw có primitive hoặc contract phù hợp; AI for Boss phải xây adapter, giao diện hoặc orchestration bên ngoài.
- `RESTRICTED`: Có đường upstream nhưng chỉ được mở sau provenance, policy, permission và security test tương ứng.
- `BLOCKED`: Dependency an toàn hoặc bằng chứng bắt buộc chưa đạt; capability tiếp tục tắt.
- `REUSED`: Có thể dùng gần như nguyên contract upstream sau product test. Bản v1 chưa gán mục nào vì product runtime chưa tồn tại.
- `UNAVAILABLE_UPSTREAM`: Release train không có đường tương thích. Bản v1 chưa phát hiện nhóm bắt buộc nào thuộc loại này.

`WRAPPED` không có nghĩa là đã làm xong. Mọi record hiện có `advertisable: false`; chỉ test ở đúng cổng mới được đổi bằng chứng phát hành.

## 2. Kết quả kiểm kê

| Nhóm | Treatment | Blocker hoặc việc còn thiếu |
|---|---|---|
| Gateway | WRAPPED | Adapter, readiness và reconnect chưa triển khai |
| Provider/model | BLOCKED | Live auth và SecretRef ba OS chưa đạt |
| Session/chat | WRAPPED | Projection, idempotency và backfill chưa triển khai |
| Agent/phối hợp | WRAPPED | Orchestration và budget chưa triển khai |
| Agent Genesis | WRAPPED | Transactional writer và crash resume chưa triển khai |
| Advisor | WRAPPED | Hai checkpoint, schema và benchmark chưa triển khai |
| Memory | RESTRICTED | Provenance và memory-poisoning test chưa có |
| Workspace/file | BLOCKED | Sandbox/project grant đa OS chưa chứng minh |
| Tool/exec | BLOCKED | Sandbox, policy và Approval Inbox chưa có |
| Browser/web | BLOCKED | Sandbox, egress và quarantine chưa có |
| Skill | RESTRICTED | Provenance catalog và quarantine chưa có |
| Plugin | RESTRICTED | Signing/hash drift/rollback chưa có |
| MCP | RESTRICTED | Per-server/tool permission và hostile-server test chưa có |
| Channel | RESTRICTED | Delegated authority và cross-user isolation chưa có |
| Automation | RESTRICTED | Unattended policy, duplicate-run và budget chưa có |
| Node/device | RESTRICTED | Pairing/scope/remote command tests chưa có |
| Media/voice | RESTRICTED | Privacy UX và permission test đa nền tảng chưa có |
| Usage/cost | WRAPPED | Budget enforcement và denial-of-wallet chưa có |
| Approval/audit | WRAPPED | Inbox, backfill và product ledger chưa có |
| Backup/restore | WRAPPED | Unified encrypted format và restore drill chưa có |
| Update | BLOCKED | Signing identity, updater và rollback đa OS chưa có |
| Diagnostics | WRAPPED | Redaction, support bundle và Safe Mode UX chưa có |
| Always-on | BLOCKED | Private claim, tenant isolation, sandbox và pentest chưa có |

Tổng cộng: 23/23 nhóm trong Master Plan đã được ánh xạ; 9 `WRAPPED`, 8 `RESTRICTED`, 6 `BLOCKED`.

### 2.1. Cập nhật feasibility Feature 0.6

ADR Feature 0.6 khuyến nghị có điều kiện hướng local managed container, nhưng chưa có backend thật hoặc bằng chứng isolation. Vì vậy các nhóm Workspace/file, Tool/exec, Browser/web và Always-on tiếp tục treatment hiện tại; mọi record vẫn `advertisable: false`.

Probe Feature 0.6 chỉ chứng minh fail-closed decision logic, platform-presence hints và một thư mục tạm rỗng được tạo, canonicalize, tái kiểm trước khi xóa không recursive. Nó không đủ để chuyển bất kỳ capability nào sang `WRAPPED`, `REUSED` hoặc production-ready. OpenShell/SSH chỉ là hướng nghiên cứu opt-in; native restrictions chỉ là defense-in-depth.

## 3. Nguồn bằng chứng

Manifest dùng tài liệu đi kèm đúng npm package `openclaw@2026.7.1-2`, package đã được khóa bằng npm integrity và gắn với tag/commit trong Gateway contract. Nguồn cốt lõi gồm:

- `docs/gateway/external-apps.md`, `protocol.md`, `operator-scopes.md`, `health.md` và `security/*`.
- `docs/providers/*`, `concepts/oauth.md` và `gateway/secrets.md`.
- `docs/concepts/session.md`, `agent.md`, `multi-agent.md`, `agent-workspace.md` và `memory.md`.
- `docs/tools/*`, `plugins/*`, `channels/*`, `automation/*`, `nodes/*` và `cli/backup.md`.

`hello-ok.features.methods/events` chỉ là tín hiệu runtime bảo thủ. Hai workspace package Gateway private và hashed `dist` không được dùng làm nguồn tích hợp.

## 4. Coverage gate

Validator phải fail khi:

1. Thiếu bất kỳ family nào trong danh sách bắt buộc.
2. ID capability trùng.
3. Release train, tag, commit hoặc protocol lệch.
4. Capability `BLOCKED`/`RESTRICTED` không nêu blocker.
5. Capability tham chiếu private Gateway package, hashed `dist`, beta hoặc dynamic tag.
6. Source-of-truth hoặc trust boundary không tồn tại.
7. Feature 0.3 cố bật `advertisable`.

Ở Cổng 3, inventory phải được mở rộng từ family-level sang method/provider/plugin/channel/platform-level và chạy capability diff khi nâng OpenClaw.
