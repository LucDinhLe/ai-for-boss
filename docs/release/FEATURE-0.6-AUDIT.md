# Feature 0.6 Audit — Sandbox feasibility

- Ngày audit: 2026-08-12
- Nhánh: `feature/0.6-sandbox-feasibility`
- Base: `cf5edc5`
- Trạng thái: Technical handoff complete tại checkpoint `25d523b`; Draft PR #6 mở và CI 4/4 xanh; Gate 0 chưa qua
- Product Owner: Lê Đình Lực
- Review bắt buộc: Senior platform reviewer và independent security reviewer chưa ký

## 1. Kết luận điều hành

Feature 0.6 tạo khuyến nghị kỹ thuật và contract fail-closed cho quyết định sandbox. Hướng ưu tiên có điều kiện là local managed container. OpenShell/SSH chỉ là research opt-in; native restrictions chỉ là defense-in-depth. Mặc định sản phẩm tiếp tục execution blocked, sandbox off, workspace/network none và không automatic fallback.

Feature này **không chứng minh isolation** của Docker, OpenShell, SSH, AppContainer, App Sandbox, Windows Sandbox hoặc Linux namespaces/seccomp/Landlock/cgroup. Không backend thật nào được cài, khởi động hoặc dùng với credential/network. Không capability execution nào được mở.

## 2. Evidence ledger

### 2.1. `spike-tested`

- Decision contract từ chối mở host exec, elevated exec, sensitive browser và backend không có trong manifest.
- Manifest/schema khóa safe default, review pending, ba direction và `advertisable:false`.
- Probe chỉ tạo một thư mục tạm rỗng dưới canonical OS temp, tái canonicalize ngay trước cleanup và xóa bằng `rmdirSync` không recursive; không có child-file read/write.
- Unsupported platform trả `unsupported-probe` thay vì bị coi là Linux.
- Cleanup failure trả lỗi generic, không đưa absolute path/username/raw error vào report.
- Root escape ban đầu và parent swap trước cleanup đều bị chặn trước thao tác xóa.
- Evidence validator từ chối platform mismatch, stale report và forged isolation promotion.
- Probe source phải khớp exact reviewed-source SHA-256 trước khi TypeScript AST parse fail-closed; import/call/computed access chỉ được phép theo allowlist và regression tests chặn comment-obfuscated import/require, dynamic import, `process.getBuiltinModule`, global access, `eval`, `Function`, alias laundering và canonical-name data-flow substitution.
- Ba direction phải khớp semantic SHA-256 độc lập với schema; co-mutation không thể xóa Windows hoặc viết lại isolation, network và remaining-blocked-capability claims.
- Success report đi qua schema exact recursive `additionalProperties:false`, khóa platform/architecture/Node major, release train, capability/fixture shapes và `promotionEligible:false`.
- Governance workflow cài exact pnpm/frozen dependencies trước contract tests; regression test chặn clean runner load AST policy khi chưa có `typescript`.

Phạm vi chứng minh chỉ là logic cục bộ, report contract và empty-directory containment. Nó không chứng minh sandbox runtime hoặc chống adversarial kernel/filesystem race.

### 2.2. `documented-primary-source`

- OpenClaw sandbox/OpenShell contract của đúng tag `v2026.7.1-2`.
- Docker Engine security, rootless, Windows/macOS install/permission và Desktop license.
- Pinned NVIDIA OpenShell README, support matrix và license với cảnh báo alpha.
- Microsoft AppContainer, Windows Sandbox và Job Objects.
- Apple App Sandbox và sandboxed helper.
- Linux seccomp, Landlock và cgroup v2.

Tất cả source ID, URL, ngày truy cập và giới hạn nằm trong ADR/manifest. Tám claim tải trọng cao có `claimId`, classification, exact sourceRefs và section locator; analyst inference/product policy/assumption không được đổi thành upstream fact hoặc promotion evidence.

### 2.3. `assumption-pending`

- Local managed container có thể tạo trải nghiệm thống nhất đủ đơn giản cho người phổ thông.
- Runtime/container license và redistribution model phù hợp mô hình thương mại.
- Installer có thể xử lý virtualization/runtime prerequisites và recovery chấp nhận được.
- Remote sandbox có economics/support model phù hợp một phân khúc opt-in.
- Native controls có thể bổ sung đủ defense-in-depth mà không tạo parity giả.

### 2.4. `blocked-or-not-feasible`

- OpenShell alpha không làm production default.
- Native restrictions riêng lẻ không làm primary cross-platform backend.
- Job Object-only, seccomp-only hoặc presence-only không được gọi là sandbox proof.
- Không Docker socket, host network, namespace join, arbitrary bind mount, credential injection hoặc silent fallback.
- Không mở product host exec, elevated exec, sensitive browser, unrestricted network hoặc unattended execution.

## 3. Filesystem, privacy và blast radius

- Dữ liệu: không child-file payload, không dữ liệu khách hoặc production.
- Ghi: file branch và một thư mục tạm rỗng do probe tạo.
- Network trong probe/test: không.
- Credential: không.
- Runtime/service/account/VM tạo mới: không.
- Cleanup: thành công mới báo probe đạt; lỗi cleanup fail closed và log được làm sạch.
- Rollback: trước checkpoint bỏ stage và xóa đúng file mới theo danh sách; sau checkpoint revert đúng SHA Feature 0.6. Không dùng `git clean`; hai commit README kế thừa không thuộc rollback; không có migration hay tài nguyên ngoài repo cần phục hồi.

## 4. Verification matrix

| Gate | Trạng thái trong bản audit này | Bằng chứng |
|---|---|---|
| Targeted Feature 0.6 tests | Pass | 25/25 tests |
| Full lint/typecheck/test/build/validators | Pass | 80/80 tests; Feature 0.4/0.5/0.6 validators pass |
| Governance/secret scan | Pass | 105 required; 124 text; 52 Markdown |
| Dependency audit high | Pass | No known vulnerabilities found |
| Schema và diff hygiene | Pass | Draft 2020-12 schema/manifest valid; `git diff --check` pass |
| Windows package/ASAR | Pass | 75 files; 13 ASAR entries; SHA-256 `5a3446e3c73c3599177210516c232790a586c5354ef5e6639bfcca0e758ea48e`; unsigned/non-distributable |
| CI Windows/macOS/Linux/governance | Pass | 4/4 xanh trên implementation checkpoint `25d523b` của Draft PR #6 |
| Real sandbox runtime | Not run by design | Cần quyền, backend selection và riêng một implementation spike |
| Human/machine representative testing | Not run | Cổng 4 |

## 5. Không hồi quy Feature 0.5

Feature 0.6 không sửa first-run state machine, renderer journey, Agent Genesis schema hoặc Advisor preview. Preview tiếp tục dừng ở `STAGING`; không tạo `ACTIVE`, không xóa bootstrap thật và không tuyên bố Agent/runtime sẵn sàng.

### 5.1. Disposition delegated review

- Hai reviewer của `deleg_7c261ecc` đọc các snapshot khác nhau trong lúc worktree còn thay đổi. Finding regex import guard, presence-only probe validation, taxonomy mismatch, validator marker và số test 14/69 thuộc snapshot cũ; current worktree dùng AST, exact report validation, taxonomy `spike-tested` + scopes và validator đã chạy xanh.
- Finding còn hiệu lực về canonical-name data-flow substitution được tái hiện RED. Policy hiện yêu cầu exact reviewed-source SHA-256 trước AST allowlist; payload outside-temp read/write, environment dump và process-loader alias đều bị từ chối.
- Finding còn hiệu lực về co-mutated three-OS coverage và arbitrary safety prose được tái hiện RED. Exact semantic digest của từng direction hiện khóa platform, isolation, network và remaining-blocked-capability claims độc lập với supplied schema.
- Finding còn hiệu lực về claim-ledger statement substitution được tái hiện RED: schema và manifest từng có thể cùng chấp nhận nội dung “CI proves production isolation” mà giữ metadata cũ. Semantic authority hiện khóa exact statement cùng ID, classification, source refs và section locators cho cả tám claim.
- Self-review clean staged tree phát hiện Governance CI thiếu cài dependency cho AST policy. Clean archive tái hiện `ERR_MODULE_NOT_FOUND`; workflow và regression test đã được sửa trước checkpoint.
- Reviewer `deleg_39c0fc53` đọc fingerprint cũ `674d20d...` với 20 staged files; sáu blocker source policy/capability/evidence/claim/threat/rollback thuộc snapshot cũ đã được candidate mới xử lý. Finding write-before-child-containment và stale cleanup authorization còn hiệu lực, được tái hiện RED; probe hiện bỏ child-file I/O cùng recursive removal, tái canonicalize ngay trước `rmdirSync`, và ba regression tests đạt.
- Delegated AI review chỉ là pre-commit quality review; không thay senior human platform/security review bắt buộc ở Gate 0.
- Hai review cuối cùng đọc cùng exact staged snapshot, giữ fingerprint đầu/cuối `86f595e41cdca40072c06304bc59bcb3b7e187922bd861d1a35ae5a3171bcda1` và đều PASS, không có finding Critical/High.

## 6. Product Owner và reviewer còn phải chốt

1. Chấp nhận hoặc từ chối local managed container là hướng implementation đầu tiên.
2. Chọn runtime ownership, license/commercial dependency và installer privilege policy.
3. Chấp nhận data egress/operating model nếu mở remote opt-in.
4. Chỉ định senior platform reviewer và independent security reviewer.
5. Cho phép một spike runtime thật riêng trên máy/lab đại diện khi contract và test plan được duyệt.

Antigravity không phải blocker và không thay CI/reviewer. Nếu dùng, chỉ nên read-only trên diff/PR, không credential, không dữ liệu khách và không quyền merge.

## 7. Điểm bàn giao

Feature 0.6 đã đạt technical handoff complete: full local gates xanh, implementation checkpoint `25d523b` đã push, Draft PR #6 đúng base và CI bốn check xanh. Gate 0 vẫn mở cho tới khi Product Owner cùng reviewer bắt buộc xử lý các quyết định ở mục 6; trạng thái này không cho phép mở host exec, elevated, Browser nhạy cảm hoặc gọi sandbox production-ready.
