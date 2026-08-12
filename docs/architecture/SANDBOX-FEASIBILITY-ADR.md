# ADR — Sandbox feasibility cho AI for Boss

- Trạng thái: Đề xuất kỹ thuật, chờ Product Owner và senior platform/security review
- Feature: 0.6
- Cổng: 0
- Release train: `oc-2026.7.1-2-locked.1`
- Ngày thu thập nguồn: 2026-08-12
- Hợp đồng máy đọc: `manifests/security/sandbox-feasibility.manifest.json`

## 1. Bối cảnh

OpenClaw khóa trong release train có các backend sandbox Docker, SSH và OpenShell, nhưng sandbox không tự trở thành ranh giới an toàn cho sản phẩm. AI for Boss là sản phẩm Type C, dự kiến xử lý dữ liệu doanh nghiệp và có thể sở hữu tool, file, Browser hoặc execution trong các cổng sau. Một lựa chọn sai có thể mở host, làm rò dữ liệu hoặc tạo phụ thuộc vận hành mà người phổ thông không phục hồi được.

Feature 0.6 chỉ đánh giá tính khả thi và khóa hành vi fail-closed. Feature này không cài runtime, không khởi động container/VM/SSH, không dùng credential và không chứng minh sandbox production.

## 2. Từ vựng bằng chứng

| Nhãn | Ý nghĩa |
|---|---|
| `spike-tested` | Hành vi cụ thể đã chạy trong spike fixture và có test tái hiện được |
| `documented-primary-source` | Nhận định được tài liệu chính thức hỗ trợ nhưng chưa được AI for Boss chạy thật |
| `assumption-pending` | Giả định cần thử nghiệm hoặc quyết định thêm |
| `blocked-or-not-feasible` | Không đủ điều kiện triển khai, bị khóa hoặc bị loại khỏi vai trò đang xét |

Sự hiện diện của executable, API, entitlement hoặc kernel primitive không phải bằng chứng cô lập. CI runner cũng không phải bằng chứng máy khách hoặc trải nghiệm người phổ thông.

## 3. Quyết định đề xuất

### 3.1. Mặc định sản phẩm an toàn

Cho tới khi có quyết định Product Owner, review độc lập và bằng chứng thực thi ba hệ điều hành:

- `execution`: `blocked`
- `sandboxMode`: `off`
- `workspaceAccess`: `none`
- `networkEgress`: `none`
- `productHostExec`: `false`
- `elevatedExec`: `false`
- `sensitiveBrowser`: `false`
- `automaticFallback`: `false`
- `advertisable`: `false`

Không có backend phù hợp phải dẫn tới từ chối tác vụ. AI for Boss không được fallback sang host exec hoặc backend khác.

### 3.2. Hướng ưu tiên có điều kiện

`local-managed-container` là hướng ưu tiên để tiếp tục thử nghiệm. Trạng thái là `preferred-contingent`, chưa phải lựa chọn production và chưa được bật.

Hệ quả vận hành:

- Dữ liệu có thể giữ local nếu network bị khóa và workspace chỉ được cấp rõ ràng.
- Sản phẩm phải sở hữu kiểm tra runtime, image, health, update, rollback và recovery.
- Windows và macOS thường cần lớp virtualization hoặc VM backend.
- Docker socket, host network, namespace join và bind mount ngoài allowlist tiếp tục bị cấm.
- Docker Desktop có điều khoản thương mại riêng; embedding hoặc phân phối cần legal review.

### 3.3. Hướng phụ

`remote-openshell-ssh` chỉ là `optional-research-only`:

- Có thể tách thực thi khỏi thiết bị người dùng.
- Workspace, tool input/output và metadata có thể rời máy.
- Network, host identity, account, compute, policy và lifecycle từ xa trở thành phụ thuộc.
- NVIDIA gắn OpenShell nhãn alpha; AI for Boss vì vậy chưa chấp nhận nó làm production default khi chưa có thêm bằng chứng maturity, security và operations.
- Remote Browser nhạy cảm tiếp tục khóa.

### 3.4. Vai trò native restriction

`native-os-restrictions` là `rejected-as-primary-backend`:

- Windows AppContainer, Windows Sandbox và Job Object có mục đích và mức cô lập khác nhau.
- macOS App Sandbox cần entitlement, signing và thiết kế helper.
- Linux cần phối hợp namespaces, seccomp, Landlock và cgroup; seccomp riêng lẻ không phải sandbox.
- Chi phí xây, recovery và compatibility riêng từng OS quá lớn cho một backend thống nhất ở Cổng 0.

Các primitive native vẫn hữu ích làm defense-in-depth cho thành phần sản phẩm sau này.

## 4. So sánh ba hướng

| Tiêu chí | `local-managed-container` | `remote-openshell-ssh` | `native-os-restrictions` |
|---|---|---|---|
| Mức cô lập thực tế | Trung bình đến mạnh khi harden đúng; vẫn chia sẻ kernel host hoặc VM và phụ thuộc daemon/runtime | Phụ thuộc operator, remote host, image và policy; biên máy tách xa hơn nhưng trust chuyển ra ngoài | Không đồng nhất; mỗi OS có primitive và giới hạn khác nhau |
| Cài đặt/quyền | Cần container engine hoặc VM backend; quyền và prerequisite khác theo OS | Cần SSH/OpenShell client, account, identity, network và remote lifecycle | Cần launcher, entitlement, signing hoặc kernel feature riêng từng OS |
| Windows | Có điều kiện theo virtualization/runtime; chưa test runtime thật | Generic SSH khả thi theo tài liệu; OpenShell Windows còn experimental | AppContainer có; Windows Sandbox là optional feature và không có trên mọi edition |
| macOS | Có điều kiện theo VM/runtime và privileged helper | Client/runtime prerequisite; chưa test | App Sandbox và signed helper có contract riêng |
| Linux | Có điều kiện theo kernel/runtime; rootless cần subordinate UID/GID | Client/runtime prerequisite; chưa test | Phải phối hợp namespace, seccomp, Landlock và cgroup |
| Dữ liệu/network | Local theo mặc định; bind mount và egress làm tăng exposure | Dữ liệu được chọn đi tới remote; mirror/remote ownership phải hiển thị rõ | Primitive OS không tự định nghĩa data egress của ứng dụng |
| Chi phí/license | Runtime, image supply chain, support; Docker Desktop có subscription terms riêng | OpenShell Apache-2.0; compute, storage, egress và support do operator/provider tính | Không có subscription API riêng, nhưng chi phí engineering/signing/maintenance cao |
| Recovery/update | Recreate từ image/config đã pin; daemon/image lỗi phải fail closed | Mất mạng/identity/host phải dừng; recreate có thể xóa remote canonical state | Cần cleanup, migration và compatibility branch riêng cho mỗi OS |
| Failure behavior | Không daemon/image/prerequisite thì từ chối, không host fallback | Mất network/identity/quota thì checkpoint và dừng | Primitive thiếu hoặc launcher lỗi thì từ chối |
| Người phổ thông | Có thể đạt sau installer, health, recovery và usability evidence | Chưa phù hợp mặc định vì account/network/data egress | Không khả thi như một mặc định cross-platform thống nhất |

## 5. Luồng dữ liệu và ranh giới

### 5.1. Local container mục tiêu

```text
Người dùng
  -> AI for Boss policy gate
  -> backend health + image/config verification
  -> container không network, root read-only, capability drop
  -> workspace grant none/read-only/read-write
  -> output đã kiểm tra
```

Mọi network route, workspace grant và secret injection là cổng riêng. Sandbox không tự cấp quyền.

### 5.2. Remote SSH/OpenShell mục tiêu

```text
Người dùng
  -> AI for Boss policy + egress preview
  -> strict remote identity verification
  -> encrypted network transport
  -> remote sandbox/operator policy
  -> selected workspace/tool data
  -> output + reconciled state
```

Remote failure không được chuyển tác vụ sang host. Mirror và remote-canonical mode không được đổi âm thầm.

### 5.3. Native restriction

Không có một data-flow contract chung. Mỗi OS cần launcher, filesystem policy, process cleanup, network policy, update và compatibility riêng. Vì vậy hướng này không được dùng làm primary agent backend.

## 6. Threat và blast radius

Các threat chính: prompt injection mở capability, renderer/process vượt quyền, model tự duyệt, path/symlink escape, plugin/MCP vượt contract và remote cross-tenant.

Blast radius của Feature 0.6 chỉ gồm:

- Nhánh repo hiện tại.
- Thư mục tạm do probe tạo.
- Metadata presence-only không nhạy cảm.

Feature không chạm OpenClaw profile, Agent Home, Docker/Podman state, SSH config, key store, service manager, registry hoặc firewall.

## 7. Capability tiếp tục bị khóa

Các capability ID sau phải giữ `BLOCKED` và `advertisable:false`:

- `workspace.files-grants`
- `tools.exec-approvals`
- `browser.web-automation`
- `always-on.private-instance`

Các capability liên quan unattended execution, plugin/MCP mutation, external bind, remote Browser, credential injection và network egress cũng chưa được mở bởi ADR này.

Advisor tiếp tục chỉ là checkpoint read-only ở plan/final; không được dùng để tự duyệt sandbox hoặc capability.

## 8. Kết quả spike đã chứng minh

### `spike-tested`

Trên máy Windows hiện tại, probe đã:

- Tạo một thư mục tạm rỗng dưới canonical OS temp.
- Kiểm tra requested path và canonical root vẫn nằm trong OS temp.
- Tái canonicalize và tái ủy quyền ngay trước cleanup.
- Xóa thư mục rỗng bằng thao tác không recursive và xác nhận không còn residue.
- Không spawn process, không gọi network và không dùng credential.
- Phát hiện presence-only: OpenSSH và WSL có; Docker Desktop và Windows Sandbox không phát hiện ở đường dẫn chuẩn.

Probe luôn ghi `claimsIsolation:false`. Kết quả trên không chứng minh Docker, WSL, SSH hoặc Windows Sandbox đang khỏe hay an toàn; cũng không chứng minh chống được adversarial kernel/filesystem race trên máy người dùng.

### `documented-primary-source`

- OpenClaw locked train có contract Docker, SSH và OpenShell.
- Docker mô tả namespace/cgroup, daemon attack surface, rootless và seccomp.
- OpenShell mô tả remote policy/kernel controls và upstream gắn nhãn alpha.
- Windows, macOS và Linux có các primitive native khác nhau.

### `assumption-pending`

- Một runtime local do sản phẩm quản lý có thể đạt trải nghiệm người phổ thông.
- Runtime ownership, commercial dependency và update responsibility có thể chấp nhận.
- CI ba OS có thể chạy probe nhất quán.
- Container hardening và filesystem/network controls có thể vượt adversarial suite.

### `blocked-or-not-feasible`

- OpenShell làm production default khi upstream còn alpha và AI for Boss chưa có maturity/security/operations evidence.
- Native restrictions làm một primary backend cross-platform thống nhất.
- Host exec, elevated exec, sensitive Browser, external bind và silent fallback.
- Bất kỳ tuyên bố installer hoặc user-ready nào từ presence-only CI.

## 9. Recovery, update và failure policy

- `deny` luôn thắng.
- Runtime, image, identity, network, policy hoặc evidence không chắc chắn đều fail closed.
- Update phải pin compatibility, stage thay đổi và giữ bundle/image trước để rollback.
- Workspace người dùng chỉ là nguồn canonical khi grant nói rõ; recreate sandbox không được xóa dữ liệu người dùng ngoài hợp đồng.
- Remote recreate có nguy cơ xóa remote canonical state và phải được hiển thị trước thao tác.
- Không retry mutation nếu chưa có idempotency evidence.

## 10. Quyết định Product Owner còn mở

Product Owner cần chọn sau khi nhận review độc lập:

1. Chấp nhận `local-managed-container` làm hướng thử nghiệm ưu tiên hay giữ toàn bộ execution khóa.
2. Ai sở hữu container runtime, image, update, support và commercial license.
3. Có cho phép remote sandbox ở chế độ opt-in hay không; loại dữ liệu nào được rời thiết bị.
4. Mức cài đặt/quyền quản trị chấp nhận được cho người dùng phổ thông.

Cho tới khi có lựa chọn, manifest tiếp tục ghi `productOwnerDecision: pending` và safe default là `blocked`.

## 11. Điều kiện trước implementation backend

- Senior platform và independent security review.
- Product Owner chấp nhận runtime ownership và phụ thuộc thương mại.
- Test sandbox thật trên Windows, macOS và Linux được hỗ trợ.
- Adversarial filesystem, symlink, process, network và host-escape suite.
- Installer privilege, health, crash, update, rollback và recovery tests.
- Human usability test trên máy sạch.
- Capability manifest, threat model và data-flow contract được cập nhật trong cùng checkpoint.

## 12. Sổ nguồn chính thức

Tất cả nguồn được truy cập ngày 2026-08-12.

| ID | Nguồn | Phạm vi |
|---|---|---|
| `SRC-01` | https://github.com/openclaw/openclaw/blob/v2026.7.1-2/docs/gateway/sandboxing.md | Contract Docker, SSH và OpenShell của release khóa |
| `SRC-02` | https://github.com/openclaw/openclaw/blob/v2026.7.1-2/docs/gateway/openshell.md | Mode, lifecycle và giới hạn OpenShell khóa |
| `SRC-03` | https://docs.docker.com/engine/security/ | Isolation, daemon attack surface và cgroup |
| `SRC-04` | https://docs.docker.com/engine/security/rootless/ | Rootless prerequisites và user namespace |
| `SRC-05` | https://docs.docker.com/desktop/setup/install/windows-install/ | Windows prerequisite, privilege và subscription context |
| `SRC-06` | https://docs.docker.com/desktop/setup/install/mac-permission-requirements/ | macOS privilege model |
| `SRC-07` | https://docs.docker.com/subscription/desktop-license/ | Docker Desktop license terms |
| `SRC-08` | https://github.com/NVIDIA/OpenShell/blob/dd2b4e3bc0688bdd59f90030f7c1d52511d6e354/README.md | OpenShell controls và upstream alpha maturity label |
| `SRC-09` | https://docs.nvidia.com/openshell/reference/support-matrix | Platform/driver support |
| `SRC-10` | https://docs.nvidia.com/openshell/resources/license | Apache-2.0 license |
| `SRC-11` | https://learn.microsoft.com/en-us/windows/win32/secauthz/appcontainer-isolation | Windows AppContainer isolation |
| `SRC-12` | https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/ | Windows Sandbox edition, network và persistence |
| `SRC-13` | https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects | Job Object process/resource controls |
| `SRC-14` | https://developer.apple.com/documentation/security/app-sandbox | macOS App Sandbox entitlements |
| `SRC-15` | https://developer.apple.com/documentation/xcode/embedding-a-helper-tool-in-a-sandboxed-app | Signed sandboxed helper requirements |
| `SRC-16` | https://docs.kernel.org/userspace-api/seccomp_filter.html | Seccomp scope và limitation |
| `SRC-17` | https://docs.kernel.org/userspace-api/landlock.html | Landlock access control và feature detection |
| `SRC-18` | https://docs.kernel.org/admin-guide/cgroup-v2.html | cgroup v2 resource control |

## 13. Hệ quả và rollback

ADR này thêm contract và bằng chứng, chưa thêm runtime. Rollback bằng cách revert riêng checkpoint Feature 0.6 về parent của checkpoint; hai commit README kế thừa `e3348bd` và `345369a` vẫn được giữ. Không có account, credential, VM, service, database hoặc production state cần phục hồi.
