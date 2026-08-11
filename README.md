# AI for Boss

**AI for Boss — Built on OpenClaw**

AI for Boss là phần mềm AI coworker dành cho chủ doanh nghiệp. Sản phẩm hướng tới trải nghiệm cài một lần, kết nối tài khoản model của người dùng và giao việc mà không cần tự vận hành OpenClaw, Gateway, Node, WSL, Git hoặc package manager.

## Trạng thái

Dự án đã verify **Cổng 0, Feature 0.5 — First-run journey ba bước** từ commit
Feature 0.4 đã xác minh `58c5283`. Draft PR #5 xanh 4/4 trên Windows, macOS,
Linux và governance; human usability cùng senior platform/security review vẫn
đang chờ.
OpenClaw `2026.7.1-2`, Node `24.19.0`, Electron `43.3.0` và pnpm `11.2.2`
được khóa theo release train. Desktop shell Electron/React đã build và package
được trên Windows x64; CI Windows, macOS và Linux đã xanh trên Draft PR #4 và #5.

Feature 0.2 đã khóa release train `openclaw@2026.7.1-2` bằng npm integrity, git tag/commit và Gateway WebSocket RPC v4 được upstream công bố cho external app. Hai workspace package Gateway private chỉ được fingerprint làm tham chiếu, không bundle hoặc trộn beta. Repo vẫn chưa có desktop app, OAuth, installer, updater, sandbox sản phẩm hoặc bản phát hành cho người dùng thật; lab WSL2 chỉ là bằng chứng thử nghiệm.

Feature 0.3 đã ánh xạ 23 nhóm capability, 9 auth mode, 9 nguồn sự thật, 8 data flow, Agent Genesis contract và 14 threat/abuse case. Feature 0.4 dùng các contract đó để sinh summary an toàn cho renderer; preload chỉ có một API đọc và mọi kết nối thật vẫn khóa. Toàn bộ capability vẫn `advertisable: false`; senior platform/security review vẫn là điều kiện trước khi Cổng 0 được coi là qua hoàn toàn.

Bản package hiện là `experimental-internal`, chưa ký và không phân phối. Nó
không phải installer, chưa chứa OpenClaw runtime, Supervisor, OAuth, Gateway,
model call, Agent Genesis hoặc tool thật.

Feature 0.5 chỉ dùng ba fixture model `live:false`, state trong bộ nhớ và task
`draft-only`. Genesis có preview fail-closed/resume idempotent; Advisor giữ
`pending-runtime`. Đây là bằng chứng UX nội bộ, chưa phải kết nối hoặc Agent thật.

## Nguyên tắc triển khai

- OpenClaw là lõi runtime được khóa theo release train.
- AI for Boss xây lớp desktop, Supervisor, trải nghiệm, Advisor, policy, recovery và phát hành.
- Mỗi phiên chỉ triển khai một feature có đặc tả và nghiệm thu.
- Không dùng credential hoặc dữ liệu thật trong development và CI.
- Không quảng cáo nền tảng hoặc capability chưa có bằng chứng kiểm thử.

## Tài liệu bắt buộc

1. [Bộ quy tắc build](docs/governance/AI-FOR-BOSS-BUILD-RULES.md)
2. [Kế hoạch triển khai tổng thể](docs/governance/AI-FOR-BOSS-MASTER-EXECUTION-PLAN.md)
3. [Biên bản audit cuối](docs/governance/FINAL-AUDIT-2026-08-11.md)
4. [Decision Log](DECISIONS.md)
5. [Risk Register](RISKS.md)
6. [Mẫu Feature Spec](docs/feature-specs/TEMPLATE.md)
7. [Feature 0.2](docs/feature-specs/0002-lock-release-train.md)
8. [Báo cáo smoke test Feature 0.2](docs/testing/FEATURE-0.2-WINDOWS-WSL2-SMOKE.md)
9. [Agent Genesis và biên workspace](docs/architecture/AGENT-GENESIS-AND-WORKSPACE-BOUNDARIES.md)
10. [Audit mức sẵn sàng đóng gói](docs/release/PRODUCT-READINESS-AUDIT-2026-08-11.md)
11. [Feature 0.2a — Agent Genesis và packaging readiness](docs/feature-specs/0002a-agent-genesis-packaging-readiness.md)
12. [Hướng thiết kế Editorial Calm](docs/ux/EDITORIAL-DESIGN-DIRECTION.md)
13. [Feature 0.2b — Editorial UX direction](docs/feature-specs/0002b-editorial-ux-direction.md)
14. [Hồ sơ concept icon bị loại](docs/brand/README.md)
15. [Audit competitive parity, hành trình ba bước và Always-on](docs/release/COMPETITIVE-PARITY-AND-HEADLESS-AUDIT-2026-08-11.md)
16. [Feature 0.2c — Competitive parity, ba bước và Headless](docs/feature-specs/0002c-competitive-parity-three-step-headless.md)
17. [Feature 0.3 — Capability và threat model](docs/feature-specs/0003-capability-threat-model.md)
18. [Capability inventory v1](docs/architecture/CAPABILITY-INVENTORY.md)
19. [Nguồn sự thật và luồng dữ liệu](docs/architecture/SOURCE-OF-TRUTH-AND-DATA-FLOW.md)
20. [Threat model](docs/security/THREAT-MODEL.md)
21. [Ma trận xác thực provider](docs/security/PROVIDER-AUTH-MATRIX.md)
22. [Audit Feature 0.3](docs/release/FEATURE-0.3-AUDIT.md)
23. [Feature 0.4 — App shell và CI đa nền tảng](docs/feature-specs/0004-app-shell-cross-platform-ci.md)
24. [Audit Feature 0.4](docs/release/FEATURE-0.4-AUDIT.md)
25. [Feature 0.5 — First-run journey](docs/feature-specs/0005-first-run-journey.md)
26. [Audit Feature 0.5](docs/release/FEATURE-0.5-AUDIT.md)

## Kiểm tra governance

Chạy trên PowerShell 7 hoặc Windows PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-governance.ps1
node .\scripts\validate-runtime-manifest.mjs
node .\scripts\validate-feature-0.3.mjs
corepack pnpm install --frozen-lockfile
corepack pnpm verify
corepack pnpm package:desktop
node .\scripts\validate-feature-0.4.mjs --require-artifact
node .\scripts\validate-feature-0.5.mjs
```

`ExecutionPolicy Bypass` chỉ áp dụng cho tiến trình kiểm tra này, không thay đổi chính sách PowerShell toàn máy.

## Cấp phép

Repo đang để private và chưa cấp giấy phép sử dụng, sao chép hoặc phân phối. Quyết định cấp phép phải được Product Owner chốt trước Cổng 4.
