# PROGRESS — AI for Boss

Cập nhật: 2026-08-12
Nhánh: `feature/0.6-sandbox-feasibility`
Base: `cf5edc5` của `feature/0.5-first-run-journey`

## Phạm vi phiên này

Feature 0.6: sandbox feasibility ADR và spike tối thiểu. Không triển khai Supervisor, Gateway, OAuth, runtime sandbox thật hoặc Feature 1.1 trong cùng phiên.

## Đã hoàn thành trong worktree

- So sánh local managed container, OpenShell/SSH và native OS restrictions bằng nguồn chính thức.
- Tạo ADR, manifest/schema và khuyến nghị `preferred-contingent` cho local managed container.
- Giữ mặc định sản phẩm: execution blocked, sandbox off, workspace/network none, không automatic fallback.
- Tạo policy, probe fixture-only, validator và contract tests.
- Probe không cài phần mềm, không credential, không network và không spawn sandbox/runtime thật.
- Bổ sung test unsupported OS, cleanup failure đã làm sạch, realpath escape, platform mismatch, stale report, forged promotion và silent fallback.
- Promotion policy khóa độc lập Product Owner acceptance, independent review, real three-OS isolation evidence và bảy control bắt buộc; validator từ chối cả khi schema cùng manifest bị hạ cấp đồng thời.
- Source guard yêu cầu exact reviewed-source SHA-256 rồi áp dụng TypeScript AST allowlist; exact probe report schema chặn field/path/env/capability giả; claim ledger tách upstream fact, analyst inference, product policy và assumption.
- Semantic direction digests khóa exact ba-OS coverage cùng isolation, network và remaining-blocked-capability claims độc lập với schema.
- Governance workflow cài frozen dependency graph trước contract tests; clean staged-tree repro đã bắt việc local `node_modules` từng che lỗi thiếu `typescript` trên CI.
- GitHub Actions `checkout`, `setup-node` và `upload-artifact` đã được nâng sang release chính thức dùng Node 24 và khóa bằng commit SHA; Feature validator chặn tag trôi nổi cùng các SHA Node 20 cũ.
- Probe đã bỏ child-file read/write và recursive cleanup sau khi reviewer tái hiện write-before-containment; hiện chỉ tạo thư mục tạm rỗng, tái canonicalize ngay trước `rmdirSync` và fail closed nếu root đổi.
- Promotion readiness có `pending`, `rejected`, `eligible`, nhưng mọi trạng thái đều `activationAllowed:false` trong Feature 0.6.
- Threat manifest liên kết R-028/R-029/R-030 với T-02/T-03/T-08/T-10/T-14 và Feature validator kiểm tra Decision/Risk/Threat/Capability/Readiness/Audit/Handoff.
- Cập nhật Decision Log, Risk Register, capability inventory, threat model, changelog và governance required-file list.

## Đã kiểm chứng local

- Targeted Feature 0.6: 25/25.
- Full suite: 80/80.
- Lint, typecheck, Vite build và validators Feature 0.4/0.5/0.6: pass.
- Governance: 105 required files, 124 text files, 52 Markdown files.
- Dependency audit: không có lỗ hổng đã biết.
- JSON Schema Draft 2020-12/manifest và `git diff --check`: pass.
- Windows package/ASAR: 75 files, 13 allowlisted entries, unsigned/non-distributable.

## Bàn giao kỹ thuật đã hoàn tất

- Hai review AI độc lập cùng exact fingerprint `86f595e4…cda1` đều PASS, không có finding Critical/High; review này không thay senior human review.
- Implementation checkpoint `25d523baa6212c88a8a35797daf59226f3ba3588` đã push lên `feature/0.6-sandbox-feasibility`.
- Draft PR #6 target `feature/0.5-first-run-journey` vẫn mở ở trạng thái Draft.
- CI trên implementation checkpoint xanh 4/4: Windows, macOS, Linux và governance; không còn cảnh báo action runtime Node 20.

## Gate còn mở

- Product Owner chưa chấp nhận backend production.
- Senior platform reviewer và independent security reviewer chưa ký.
- Chưa chạy Docker/OpenShell/SSH/AppContainer/App Sandbox/Linux sandbox thật.
- Chưa test máy người dùng thật, cài đặt, recovery/update hoặc adversarial escape của backend.
- R-001, R-028, R-029 và R-030 tiếp tục mở; capability host exec/elevated/browser/network/credential vẫn khóa.

## Điểm tiếp theo

Feature 0.6 đã bàn giao kỹ thuật. Sau khi Gate 0 có quyết định Product Owner và chữ ký reviewer bắt buộc, phiên riêng kế tiếp mới được mở Feature 1.1: Supervisor spawn OpenClaw nhúng trên Windows x64. Không nối runtime trước sandbox/review gate. Implementation checkpoint là `25d523baa6212c88a8a35797daf59226f3ba3588`; commit đóng hồ sơ được giữ riêng để rollback độc lập.
