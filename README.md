# AI for Boss

**AI for Boss — Built on OpenClaw**

AI for Boss là phần mềm AI coworker dành cho chủ doanh nghiệp. Sản phẩm hướng tới trải nghiệm cài một lần, kết nối tài khoản model của người dùng và giao việc mà không cần tự vận hành OpenClaw, Gateway, Node, WSL, Git hoặc package manager.

## Trạng thái

Dự án đang ở **Cổng 0, Feature 0.2 — Khóa release train**. OpenClaw `2026.7.1-2`, Node `24.19.0` và pnpm `11.2.2` đã qua smoke test không credential trong lab WSL2 riêng trên Windows x64. Electron `43.3.0` đã được khóa ở mức metadata.

Feature 0.2 đang bị chặn bởi upstream: `@openclaw/gateway-client` và `@openclaw/gateway-protocol` chưa có bản stable cùng `2026.7.1-2`. Vì vậy chưa có release train hoàn chỉnh, bộ cài, OAuth, Gateway nhúng hoặc bản phát hành cho người dùng thật. Lab WSL2 chỉ là bằng chứng thử nghiệm và không phải sandbox sản phẩm.

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

## Kiểm tra governance

Chạy trên PowerShell 7 hoặc Windows PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-governance.ps1
node .\scripts\validate-runtime-manifest.mjs
```

`ExecutionPolicy Bypass` chỉ áp dụng cho tiến trình kiểm tra này, không thay đổi chính sách PowerShell toàn máy.

## Cấp phép

Repo đang để private và chưa cấp giấy phép sử dụng, sao chép hoặc phân phối. Quyết định cấp phép phải được Product Owner chốt trước Cổng 4.
