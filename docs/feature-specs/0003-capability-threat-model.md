# Feature Spec — 0.3 Capability và threat model

## 1. Trạng thái

- Cổng: 0
- Owner kỹ thuật: Codex, chờ senior platform/security reviewer trước pilot
- Product Owner: Lê Đình Lực
- Trạng thái: Complete — local contract verification đạt; independent senior/security review còn là Cổng 0
- Ngày mở: 2026-08-11

## 2. Mục tiêu vận hành

Đội phát triển có một hợp đồng máy đọc được về những năng lực OpenClaw mà AI for Boss dự kiến tái sử dụng, bọc giao diện, hạn chế hoặc chặn. Mỗi năng lực phải nối được với nguồn upstream của release train đã khóa, nguồn sự thật, quyền, dữ liệu, biên tin cậy, hành vi khi lỗi và bằng chứng kiểm thử dự kiến.

Feature này cũng xác định các luồng dữ liệu cùng mô hình đe dọa đủ cụ thể để Feature 0.4 và 0.5 không vô tình dựng giao diện, IPC hoặc kho dữ liệu phá vỡ các ranh giới an toàn đã chốt.

## 3. Trong phạm vi

- Tạo `capability-manifest` v1 cho OpenClaw `2026.7.1-2` theo các nhóm năng lực trong Rulebook và Master Plan.
- Ghi nguồn upstream chính xác theo tag/commit đã khóa, đường tích hợp công khai, trạng thái sản phẩm, chế độ giao diện, điều kiện nền tảng, quyền, dữ liệu, hành vi lỗi và cổng kiểm thử.
- Tạo bản đồ nguồn sự thật cho runtime, sản phẩm, static secret, OAuth, Agent Home, `agentDir`, Không gian dự án, backup và Always-on.
- Tạo sơ đồ luồng dữ liệu cho cài đặt, kết nối provider, phiên làm việc, Advisor, Agent Genesis, tool/browser, backup/restore và Always-on.
- Tạo threat model gồm tài sản, tác nhân, biên tin cậy, abuse case, control bắt buộc, residual risk, out-of-scope và mapping sang Risk Register.
- Tạo ma trận hỗ trợ xác thực provider với trạng thái fail-closed cho OpenAI, Anthropic, Google và provider/plugin khác.
- Khóa contract Agent Genesis và biên Agent Home/Không gian dự án ở mức schema/data flow; chưa viết logic ghi file.
- Thêm schema, validator và contract test cho toàn bộ artifact Feature 0.3.

## 4. Ngoài phạm vi

- Desktop shell, UI, Supervisor, Gateway Adapter production, installer, updater hoặc service Always-on.
- OAuth/API key thật, model call thật, tài khoản provider, dữ liệu người dùng hoặc credential của Product Owner.
- Chọn hoặc triển khai sandbox backend; quyết định thuộc Feature 0.6.
- Host exec, elevated action, browser nhạy cảm, channel, schedule hoặc plugin bên thứ ba đang chạy.
- Tuyên bố một capability đã chạy trên Windows, macOS hoặc Linux khi chưa có test tương ứng.
- Chọn cloud provider, remote ingress production, licensing, pricing hoặc telemetry.

## 5. Đầu vào và đầu ra

| Loại | Mô tả |
|---|---|
| Đầu vào | Rulebook 1.3, Master Plan 1.2, Gateway contract lock, runtime manifest lock, tài liệu/mã nguồn chính thức tại tag `v2026.7.1-2`, bằng chứng lab Feature 0.2 |
| Đầu ra | Capability manifest/schema, auth-support manifest/schema, Agent Genesis contract/schema, source-of-truth map, data-flow diagram, threat model, validator, contract tests và audit record |
| Dữ liệu đọc | Metadata công khai của đúng release train; file governance và artifact thử nghiệm không chứa secret trong repo |
| Dữ liệu ghi | Chỉ file tài liệu, JSON manifest/schema, validator và test trong nhánh Feature 0.3 |

## 6. Giả định

- Release train `oc-2026.7.1-2-locked.1` và Gateway protocol v4 tiếp tục là nền cố định của feature.
- Tài liệu online mới hơn tag bị xem là tín hiệu khảo sát, không tự động trở thành contract của release train.
- Capability chưa đủ đường gọi công khai, control cưỡng chế, failure behavior hoặc test gate phải là `RESTRICTED`, `BLOCKED` hoặc `UNAVAILABLE_UPSTREAM`; không được ghi `REUSED`/`WRAPPED` để làm đẹp bảng.
- `hello-ok.features.methods/events` chỉ là một nguồn runtime bảo thủ, không phải danh sách capability đầy đủ.
- OAuth token vẫn do auth store native của OpenClaw sở hữu; static SecretRef broker vẫn là giả thuyết bị chặn tới contract test đa nền tảng.
- Feature 0.3 tạo hợp đồng và test tính nhất quán, chưa chứng minh capability thực thi end-to-end.

## 7. Trường hợp biên và hành vi khi lỗi

| Trường hợp | Hành vi mong đợi |
|---|---|
| Giá trị hoặc nguồn upstream rỗng | Validator từ chối manifest |
| Capability trùng ID | Validator từ chối và nêu ID trùng |
| Capability upstream chưa ánh xạ | Coverage gate thất bại; không tự gán trạng thái hỗ trợ |
| Nguồn trỏ sang tag/commit khác | Validator từ chối release-train drift |
| RPC hoặc package private bị dùng như contract public | Validator từ chối |
| Capability cần sandbox nhưng sandbox chưa chốt | Bắt buộc `BLOCKED` hoặc `RESTRICTED`, kèm gate 0.6 |
| Auth mode chưa có revoke/live probe hoặc điều khoản chưa xác minh | Không được ghi `production-supported` |
| Network hoặc source không truy cập được | Giữ bằng chứng đã khóa; ghi `unverified` và dừng promote mục liên quan |
| Threat không có owner/control/failure behavior | Validator hoặc review gate thất bại |
| Data flow tạo hai nguồn sự thật ngang quyền | Review gate thất bại |
| Agent bootstrap bị gián đoạn | Contract giữ `BOOTSTRAP.md`, chuyển `PENDING_RESUME`, không báo `ACTIVE` |
| Quyền không đủ | Dừng ở control boundary; không fallback bằng prompt |
| Schema sai hoặc file bị sửa thiếu đồng bộ | Contract tests thất bại và không commit |

## 8. Quyền và dữ liệu

- Scope cần dùng: đọc nguồn công khai và file repo; ghi file trong nhánh feature.
- Secret cần dùng: không có.
- Workspace/network cần dùng: repo private, npm package đã khóa hoặc GitHub/docs chính thức của đúng tag.
- Approval cần dùng: yêu cầu hiện tại của Product Owner cho phép triển khai bước kế tiếp; mọi live auth, remote ingress, sandbox hoặc ghi ngoài repo vẫn cần cổng riêng.
- Dữ liệu cá nhân hoặc nhạy cảm: không có; fixture chỉ dùng ID và nội dung giả.

## 9. Quyết định có hệ quả

- D-0001, D-0002, D-0008, D-0011, D-0012 và D-0013 tiếp tục chi phối feature.
- Feature này không chốt sandbox, cloud provider, remote transport production, SecretRef broker hay một auth mode production chưa live-test.
- Capability status mô tả mức tích hợp sản phẩm dự kiến và bằng chứng hiện có; nó không đồng nghĩa với lời quảng cáo đã hỗ trợ trên máy khách.

## 10. Tiêu chí nghiệm thu

- [x] Capability manifest có schema version, release train, nguồn và ít nhất toàn bộ nhóm năng lực trong Master Plan.
- [x] Mỗi capability có owner, upstream source, integration surface, product mode/status, quyền, dữ liệu, dependency, failure behavior và test gate.
- [x] Các capability cần sandbox, credential broker, live auth, signing hoặc máy thật không được đánh dấu hỗ trợ hoàn chỉnh.
- [x] Auth-support matrix phân biệt rõ production, conditional, experimental và blocked; không suy diễn OAuth.
- [x] Source-of-truth map không có hai owner ghi ngang quyền cho cùng dữ liệu.
- [x] Data-flow diagram bao phủ tám luồng trong phạm vi và đánh dấu dữ liệu không tin cậy/secret/approval.
- [x] Threat model có tài sản, tác nhân, trust boundary, abuse case, control, residual risk, out-of-scope và trace tới Risk Register.
- [x] Agent Genesis contract giữ bootstrap idempotent, tách Agent Home/`agentDir`/Không gian dự án và fail closed khi crash.
- [x] Validator từ chối duplicate ID, release-train drift, private API dependency, unsupported status promotion, thiếu control và nguồn sự thật mâu thuẫn.
- [x] Unit/contract tests, governance validation, secret scan, whitespace và manual review đạt.
- [x] `AGENTS.md`, `CHANGELOG.md`, `DECISIONS.md`, `RISKS.md` và governance required-file list được cập nhật phù hợp.
- [x] Có rollback về commit Feature 0.2 và checkpoint Git hoàn tác được.

## 11. Kế hoạch kiểm thử

- Unit: helper đọc JSON, kiểm uniqueness, enum, cross-reference và coverage.
- Contract: khóa release train/tag/commit; kiểm mọi capability/auth/data-flow/threat liên kết hợp lệ.
- Integration: chạy validator Feature 0.3 cùng validator release train và governance hiện có.
- Security/privacy: fixture cố promote capability bị chặn, bỏ control, dùng private package, tạo hai nguồn sự thật hoặc đưa secret-like value phải fail.
- Kiểm tra bằng tay: đối chiếu nhóm năng lực với Rulebook/Master Plan và nguồn upstream; kiểm tra Mermaid/data-flow đọc được.
- Recovery/rollback: xóa các artifact Feature 0.3 và quay về commit Feature 0.2; không có migration hoặc dữ liệu ngoài repo.

## 12. Phạm vi ảnh hưởng

- Thành phần bị chạm: `docs/feature-specs`, `docs/architecture`, `docs/security`, `manifests/capabilities`, `manifests/providers`, `manifests/agents`, `scripts`, `tests`, governance index, Decision/Risk/Changelog.
- Tính năng có thể bị ảnh hưởng: validator governance và release-train contract; không có product runtime.
- Dữ liệu hoặc migration: không có.

## 13. Rollback

Quay về commit cuối của Feature 0.2 hoặc revert commit Feature 0.3. Toàn bộ thay đổi là file repo, không tạo credential, account, service, process nền, database hoặc migration ngoài repo.

## 14. Bằng chứng hoàn thành

- Commit checkpoint: `555659c` (`feat(governance): define capability and threat contracts`).
- Kết quả test: Feature 0.3 validator đạt 23 capability, 9 auth mode, 9 nguồn, 8 flow và 14 threat; contract suite 19/19, governance, runtime validation, secret scan và whitespace đạt.
- Reviewer: Codex self-review và source-path audit 58/58; bắt buộc senior platform/security review trước khi qua Cổng 0/pilot thật.
- Product Owner acceptance: Product Owner cho phép triển khai bước tiếp theo ngày 2026-08-11.
