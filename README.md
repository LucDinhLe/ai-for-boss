# AI for Boss

**AI for Boss — Built on OpenClaw**

AI for Boss là phần mềm AI coworker dành cho chủ doanh nghiệp. Sản phẩm hướng tới trải nghiệm cài một lần, kết nối tài khoản model của người dùng và giao việc mà không cần tự vận hành OpenClaw, Gateway, Node, WSL, Git hoặc package manager.

## Trạng thái

Dự án đang ở **Cổng 0, Feature 0.1 — Repo Governance**.

Hiện repo chỉ chứa nền móng quản trị, tài liệu kiến trúc và kiểm tra tự động. Chưa có bộ cài, OAuth, Gateway nhúng hoặc bản phát hành cho người dùng thật.

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

## Kiểm tra governance

Chạy trên PowerShell 7 hoặc Windows PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-governance.ps1
```

`ExecutionPolicy Bypass` chỉ áp dụng cho tiến trình kiểm tra này, không thay đổi chính sách PowerShell toàn máy.

## Cấp phép

Repo đang để private và chưa cấp giấy phép sử dụng, sao chép hoặc phân phối. Quyết định cấp phép phải được Product Owner chốt trước Cổng 4.
