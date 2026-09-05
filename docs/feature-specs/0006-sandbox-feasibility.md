# Feature Spec — 0.6 Sandbox feasibility ADR và spike tối thiểu

## 1. Trạng thái

- Cổng: 0
- Owner kỹ thuật: Hermes/Codex; chờ senior platform/security reviewer trước khi qua Cổng 0
- Product Owner: Lê Đình Lực
- Trạng thái: Technical handoff complete tại checkpoint `25d523b`; Draft PR #6 mở, CI 4/4 xanh; Gate 0 vẫn chờ Product Owner backend acceptance và senior platform/security review
- Ngày mở: 2026-08-12
- Nhánh: `feature/0.6-sandbox-feasibility`
- Điểm xuất phát đã xác minh: `cf5edc56c6db2a77a559e3bacbfc664b73b060e1`

## 2. Mục tiêu vận hành

Product Owner nhận một ADR dựa trên bằng chứng để chọn hướng sandbox cho AI for Boss, gồm phương án mặc định an toàn và các capability phải tiếp tục khóa. Đội kỹ thuật có hợp đồng máy đọc được để tài liệu hoặc code sau này không thể tự hạ mức cô lập, tự đổi bằng chứng tài liệu thành bằng chứng thực thi hoặc mở host exec khi chưa qua cổng.

Feature này chỉ chứng minh tính khả thi và hành vi fail closed. Nó không tạo sandbox production, không mở tool thật và không biến artifact CI thành sản phẩm sẵn sàng cho người dùng.

## 3. Trong phạm vi

- So sánh ba hướng đã khóa trong Rulebook:
  1. Container runtime cục bộ do AI for Boss quản lý.
  2. Sandbox từ xa như OpenShell hoặc SSH tới instance riêng.
  3. Cơ chế hạn chế native theo từng hệ điều hành.
- Đánh giá từng hướng theo mức cô lập thực tế, điều kiện cài đặt, quyền quản trị, Windows/macOS/Linux, dữ liệu và network, chi phí, license, phụ thuộc, recovery, update, failure behavior và khả năng triển khai cho người phổ thông.
- Tách bốn mức bằng chứng: `spike-tested`, `documented-primary-source`, `assumption-pending` và `blocked-or-not-feasible`.
- Tạo ADR nêu khuyến nghị kỹ thuật, phương án mặc định an toàn và các quyết định chỉ Product Owner được chốt.
- Tạo manifest/schema cho quyết định sandbox, claim-level evidence, platform evidence, capability lock và điều kiện promotion.
- Tạo probe tối thiểu chạy trên Windows, macOS và Linux CI. Probe chỉ đọc metadata nền tảng, kiểm tra sự hiện diện của primitive theo đường dẫn công khai và chạy boundary fixture trong thư mục tạm.
- Tạo validator và contract tests buộc mọi capability nguy hiểm giữ khóa nếu backend chưa được Product Owner chọn, chưa có bằng chứng thực thi đúng nền tảng hoặc thiếu control bắt buộc.
- Nâng các GitHub JavaScript Actions cốt lõi sang release chính thức chạy Node 24, khóa bằng commit SHA và thêm contract ngăn quay lại action dùng Node 20.
- Cập nhật capability/threat/risk/decision/readiness/handoff chỉ ở phần liên quan trực tiếp tới sandbox.

## 4. Ngoài phạm vi

- Cài Docker, Podman, OpenShell, VM, WSL distro, service, kernel module hoặc phần mềm hệ thống.
- Đăng nhập tài khoản remote, mở SSH tới host thật, thuê cloud, tạo tunnel hoặc dùng credential.
- Supervisor, Gateway, OAuth, OpenClaw runtime tích hợp, Feature 1.1 hoặc Agent Home writer.
- Product host exec, elevated execution, Browser nhạy cảm, network tùy ý hoặc tool thật.
- Thay đổi contract Agent Genesis, first-run schema hoặc Advisor ngoài việc truy vết rằng các capability này vẫn bị khóa.
- Đo hiệu năng container/VM thực tế trên ba máy thật.
- Tuyên bố sandbox production, hỗ trợ thiết bị, installer hoặc user-ready.
- Tự động merge PR, public release hoặc thay đổi trạng thái/base của PR #5.

## 5. Đầu vào và đầu ra

| Loại | Mô tả |
|---|---|
| Đầu vào | Rulebook 1.4, Master Plan 1.3, D-0007, D-0014, D-0017, R-001, R-012, R-020, capability/source/threat/auth contracts, Feature 0.5 audit, Product Readiness Audit và nguồn chính thức hiện hành |
| Đầu ra | Feature Spec, ADR, sandbox manifest/schema, probe nhỏ, validator, contract tests, audit Feature 0.6, Decision/Risk/Capability/Readiness/Changelog/Handoff cập nhật |
| Dữ liệu đọc | File repo; metadata hệ điều hành và đường dẫn primitive chuẩn; tài liệu công khai chính thức; fixture giả |
| Dữ liệu ghi | File trong nhánh feature và thư mục tạm của test; không ghi profile người dùng, Agent Home, OpenClaw state hoặc production |

## 6. Giả định và điểm chưa chắc

- CI runner chỉ chứng minh script và contract chạy trên ba họ hệ điều hành. CI không chứng minh sandbox production, máy khách sạch hoặc trải nghiệm cài đặt.
- Sự hiện diện của binary, entitlement, API hoặc kernel primitive chỉ có scope `presence` trong evidence level `spike-tested`. Nó không chứng minh cấu hình an toàn hoặc mức cô lập đạt.
- Container trên Windows và macOS thường cần một lớp Linux VM hoặc subsystem. Điều kiện cụ thể, quyền và license phải theo runtime được chọn, chưa được suy diễn thành khả dụng mặc định.
- Remote sandbox có biên cô lập tách khỏi máy người dùng nhưng tạo data egress, phụ thuộc mạng, account, chi phí và recovery từ xa. Mức chấp nhận thuộc Product Owner.
- Native restriction khác nhau đáng kể giữa Windows, macOS và Linux. Một control hiện diện trên một OS không được dùng để quảng cáo parity trên OS khác.
- OpenClaw release train tiếp tục khóa ở `oc-2026.7.1-2-locked.1` trong feature này.
- Không có backend nào được promote thành product default chỉ từ tài liệu hoặc probe presence-only.
- Senior platform/security review vẫn là điều kiện Gate 0, kể cả khi mọi CI của feature đạt.

## 7. Trường hợp biên và hành vi khi lỗi

| Trường hợp | Hành vi mong đợi |
|---|---|
| Manifest rỗng, thiếu hướng hoặc trùng ID | Validator từ chối toàn bộ |
| Nguồn chỉ là blog, marketing hoặc nguồn thứ cấp | Không được dùng cho nhận định kỹ thuật tải trọng cao; giữ `assumption-pending` hoặc `blocked-or-not-feasible` |
| Tài liệu mới hơn release train mâu thuẫn contract khóa | Ghi rõ drift; không tự nâng release train |
| Probe không nhận diện nền tảng | Báo `unsupported-probe`; capability nguy hiểm vẫn khóa |
| Primitive tồn tại nhưng không chạy hoặc cần quyền cao | Chỉ ghi `spike-tested` với scope `presence`; không promote mức cô lập |
| Không có container runtime | Local container giữ `documented-primary-source` hoặc `blocked-or-not-feasible`; không cài tự động |
| Người dùng từ chối quyền quản trị | Giữ backend chưa cài; app phải còn đường dùng an toàn không có exec |
| Remote mất mạng, timeout hoặc hết quota | Task dừng ở checkpoint; không fallback sang host exec hoặc backend khác |
| Remote trả kết quả một phần | Giữ trạng thái chưa hoàn tất, bảo toàn artifact đã xác minh và cho retry idempotent |
| Policy/manifest bị sửa để mở host exec | Validator và contract test thất bại |
| Report cho một OS bị gắn sang OS khác | Validator từ chối platform evidence mismatch |
| Bằng chứng tài liệu bị gắn `spike-tested` | Validator từ chối thiếu test ID, platform, timestamp và containment record |
| Path traversal hoặc symlink thoát fixture | Boundary fixture từ chối đường dẫn; không đọc file ngoài thư mục tạm |
| Cleanup probe thất bại | Ghi lỗi, không báo đạt và giữ log sạch dữ liệu nhạy cảm |
| Probe chạy lặp | Kết quả xác định, không tạo service, account, VM hoặc state bền vững |
| Unicode, khoảng trắng và đường dẫn dài trong fixture | Không phá chuẩn hóa path hoặc cleanup |
| Capability chưa có backend đạt | Giữ `BLOCKED`; UI sau này phải giải thích giới hạn thay vì chạy thẳng trên host |

## 8. Quyền, dữ liệu và containment

- Scope cần dùng: đọc file repo, đọc metadata nền tảng không nhạy cảm, ghi file repo và thư mục tạm do test tạo.
- Secret cần dùng: không có.
- Workspace/network cần dùng: network chỉ để đọc tài liệu công khai chính thức. Probe và test chạy offline, không mở socket hoặc gọi dịch vụ ngoài.
- Approval cần dùng: chỉ thị hiện tại cho phép nghiên cứu, spike fixture, commit, push và Draft PR. Cài phần mềm hệ thống, dùng tài khoản remote hoặc quyền quản trị vẫn bị cấm.
- Dữ liệu cá nhân hoặc nhạy cảm: không có. Fixture dùng tên ngẫu nhiên và chuỗi giả trong thư mục tạm.
- Cleanup: probe dùng `try/finally`, chỉ xóa thư mục tạm do chính nó tạo; không gọi lệnh dọn toàn cục.
- Logging/evidence: probe chỉ phát một report JSON cuối có mã trạng thái và failure message đã làm sạch; không ghi toàn bộ environment, username, home path, token, raw exception hoặc payload ngoài phạm vi.

## 9. Threat model, blast radius và failure policy

### 9.1. Threats liên quan

- T-06: prompt injection tìm cách mở tool hoặc network ngoài policy.
- T-08: renderer, IPC hoặc process cục bộ vượt quyền.
- T-09: model tự cấp quyền hoặc tự duyệt.
- T-10: path traversal, symlink escape và file giả mạo.
- T-12: plugin/MCP/connector vượt contract.
- T-14: shared remote boundary làm lẫn dữ liệu khách.

### 9.2. Blast radius tối đa của spike

- Repo branch hiện tại.
- Thư mục tạm do test tạo trên runner hoặc máy local.
- Không chạm OpenClaw profile, AICoworker, WSL lab hiện có, Docker/Podman state, SSH config, key store, registry, service manager hoặc firewall.
- Không có process nền tồn tại sau khi test kết thúc.

### 9.3. Failure policy

- `deny` luôn thắng.
- Không backend phù hợp đồng nghĩa exec, elevated, write ngoài workspace và Browser nhạy cảm tiếp tục khóa.
- Không fallback âm thầm giữa local, remote và native.
- Network mất, policy lỗi, evidence thiếu, cleanup lỗi hoặc backend health không chắc chắn đều fail closed.
- Khuyến nghị có thể chọn kiến trúc mục tiêu nhưng product default vẫn là `restricted-no-exec` cho tới khi Product Owner chấp nhận và backend đạt implementation/security gate.

## 10. Quyết định có hệ quả

Feature sẽ đề xuất một Decision ID mới sau khi ADR và spike có bằng chứng. Trước khi Product Owner chốt:

- Quyết định sandbox trong D-0005 tiếp tục `DEFERRED`.
- D-0007 chỉ công nhận WSL2 là lab Feature 0.2, không phải sandbox sản phẩm.
- R-001 tiếp tục `Critical/Open`.
- Mặc định an toàn giữ host exec, elevated, sửa ngoài workspace và Browser nhạy cảm ở trạng thái `BLOCKED`.

Product Owner cần chốt một câu hỏi sau khi nhận ADR: chấp nhận hướng mặc định nào và mức phụ thuộc cài đặt, dữ liệu rời máy cùng chi phí vận hành nào phù hợp với người dùng mục tiêu?

## 11. Tiêu chí nghiệm thu

- [x] ADR so sánh đủ ba hướng và mọi chiều đánh giá bắt buộc.
- [x] Mỗi nhận định kỹ thuật tải trọng cao có nguồn chính thức, ngày truy cập và mức bằng chứng.
- [x] ADR tách rõ `spike-tested`, `documented-primary-source`, `assumption-pending` và `blocked-or-not-feasible`.
- [x] Khuyến nghị nêu hệ quả vận hành, phương án còn lại, chi phí, giới hạn và mặc định an toàn.
- [x] Manifest/schema bao phủ ba hướng, ba họ OS, capability lock, failure behavior, data egress, admin/install, cost/license và recovery/update.
- [x] Probe chạy mà không cài phần mềm, không dùng admin, network, credential hoặc child-file I/O; chỉ tạo/xóa không recursive một thư mục tạm rỗng sau canonical containment và cleanup reauthorization.
- [x] Probe chạy trên Windows, macOS và Linux CI; kết quả chỉ được gắn `spike-tested` với scope `presence` và `temp-containment`, `promotionEligible:false`.
- [x] Contract tests từ chối evidence promotion giả, platform mismatch, thiếu containment, thiếu backend, silent fallback và mở capability nguy hiểm.
- [x] Capability inventory tiếp tục giữ workspace/file, tool/exec, Browser/web và Always-on ở trạng thái phù hợp; không capability nào tự đổi `advertisable:false`.
- [x] Governance, lint, typecheck, toàn bộ test, build, validators, dependency audit, secret scan và package/ASAR gate đạt trên Windows local; exact Node `24.19.0` đã được CI ba hệ điều hành xác minh tại implementation checkpoint.
- [x] Audit ghi rõ phần đã chứng minh, chỉ có tài liệu, giả thuyết, không khả thi/bị khóa và phần chưa test trên máy thật.
- [x] Có commit rollback được `25d523baa6212c88a8a35797daf59226f3ba3588`, nhánh đã push và Draft PR #6 target `feature/0.5-first-run-journey`.
- [x] CI Windows, macOS, Linux và governance đạt 4/4 trên implementation checkpoint của Draft PR #6.
- [x] CI trên implementation checkpoint không còn cảnh báo GitHub Actions dùng Node 20; `checkout`, `setup-node` và `upload-artifact` đều dùng release Node 24 đã khóa SHA, validator từ chối tag trôi nổi hoặc SHA cũ.
- [x] Feature 0.6 không sửa hoặc merge PR #5. Kiểm tra external state trước checkpoint cho thấy PR #5 đã được tài khoản Product Owner merge vào `main` lúc `2026-08-12T05:16:11Z`, sau khi gói bàn giao được tạo; trạng thái này được ghi nhận trung thực và không được xem là hành động của nhánh Feature 0.6.
- [x] Senior platform/security review vẫn được ghi là điều kiện Gate 0 còn mở.

## 12. Kế hoạch kiểm thử

- Unit: chuẩn hóa path, evidence rank, capability decision và deny-wins.
- Contract: schema exactness, exact reviewed-source digest, AST source allowlist, semantic direction digests, exact report schema, claim classification, ba hướng/ba OS, promotion readiness, platform match, capability lock, failure behavior, clean governance CI dependency setup, Node 24 action pins và Risk/Decision/Threat traceability.
- Integration: chạy probe trong thư mục tạm trên từng CI runner; xác nhận report không chứa home path, username, environment dump hoặc secret-like value.
- Security/privacy: path traversal, symlink/root escape, parent swap trước cleanup, forged evidence, silent fallback, stale report và cleanup failure fixture. Probe không được gọi là adversarial filesystem race proof.
- Kiểm tra bằng tay: đối chiếu ADR với Rulebook/Master Plan/official sources; xem report local; xác nhận không có runtime/service/account mới.
- Recovery/rollback: trước checkpoint, bỏ stage đúng danh sách file Feature 0.6 rồi xóa riêng từng file mới được liệt kê trong `git status`; sau checkpoint, revert commit Feature 0.6 và mọi commit handoff theo thứ tự ngược. Không dùng `git clean`; không có migration, credential, VM, service hoặc dữ liệu ngoài repo cần phục hồi.

## 13. Phạm vi ảnh hưởng

- Thành phần dự kiến chạm: `.github/workflows/governance.yml`, `docs/feature-specs`, `docs/architecture`, `docs/security`, `docs/release`, `manifests/security`, `scripts`, `tests`, `DECISIONS.md`, `RISKS.md`, `CHANGELOG.md`, `README.md`, `AGENTS.md`, governance required-file list và handoff.
- Tính năng có thể bị ảnh hưởng: governance validation, capability/threat traceability và CI test count. Feature 0.5 renderer/state/schema/Advisor không được sửa.
- Dữ liệu hoặc migration: không có.

## 14. Rollback

Trước checkpoint: dùng `git restore --staged` trên đúng danh sách file Feature 0.6, phục hồi file tracked và xóa riêng từng file mới theo `git status`; không dùng `git clean`. Sau checkpoint: `git revert <feature-0.6-checkpoint-sha>`. Hai commit README kế thừa trên nhánh không thuộc rollback Feature 0.6. Output build/probe bị ignore được xóa theo đúng đường dẫn package đã biết. Rollback không cần phục hồi account, credential, VM, service, registry, firewall, database hoặc dữ liệu người dùng vì feature cấm tạo các tài nguyên đó.

## 15. Bằng chứng hoàn thành

- Commit: Implementation checkpoint `25d523baa6212c88a8a35797daf59226f3ba3588`; mọi cập nhật đóng hồ sơ sau checkpoint là commit tài liệu riêng, rollback độc lập.
- Kết quả test: Targeted Feature 0.6 đạt 25/25; full suite 80/80; lint, typecheck, build, Feature 0.4/0.5/0.6 validators, governance 105/124/52, dependency audit, Draft 2020-12 schema validation, `git diff --check` và package/ASAR đạt sau khi khóa Node 24 action pins và harden governance recursion. CI exact Node `24.19.0` đạt 4/4 trên Windows, macOS, Linux và governance tại implementation checkpoint.
- Reviewer: Hai delegated AI review cuối cùng PASS trên cùng fingerprint `86f595e41cdca40072c06304bc59bcb3b7e187922bd861d1a35ae5a3171bcda1`, không có Critical/High. Đây là pre-commit quality review; senior platform/security review bắt buộc vẫn chưa thực hiện.
- Product Owner acceptance: Chỉ thị mở Feature 0.6 ngày 2026-08-12; chưa chấp nhận khuyến nghị sandbox cuối.
