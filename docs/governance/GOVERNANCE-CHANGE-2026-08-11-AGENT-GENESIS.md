# Governance Change — Agent Genesis và readiness audit

Ngày: 2026-08-11  
Product Owner phê duyệt: Lê Đình Lực  
Loại thay đổi: `PRODUCT_DECISION` và bổ sung truy vết; không mở feature implementation mới

## Yêu cầu được duyệt

- Lần cài đầu và mỗi Agent mới phải chạy nghi thức khai sinh tương thích với OpenClaw.
- Người dùng đặt tên, vai trò/bản chất, giọng điệu, emoji/avatar, cách xưng hô, ưu tiên và ranh giới.
- `BOOTSTRAP.md` chỉ bị xóa sau khi dữ liệu đã ghi, đọc lại, đồng bộ identity và health check đạt.
- Agent Home, `agentDir`, session và auth profile tách biệt theo Agent.
- Không gian dự án là thư mục doanh nghiệp do người dùng chọn và được cấp quyền riêng; nó không mặc nhiên là Agent Home.
- Dự án phải có audit rõ các việc còn thiếu trước khi phát hành cho người dùng tải.

## File governance thay đổi

- `AI-FOR-BOSS-BUILD-RULES.md`: bổ sung luật khai sinh Agent, workspace boundary và mục bắt buộc của bản đầu.
- `AI-FOR-BOSS-MASTER-EXECUTION-PLAN.md`: bổ sung mục tiêu, capability map, workstream, feature routing và traceability.
- `DECISIONS.md`: thêm D-0008.
- `RISKS.md`: thêm rủi ro bootstrap, workspace collision, upstream contract drift và signing ownership.
- `GOVERNANCE-LOCK.json`: cập nhật hash sau thay đổi được Product Owner phê duyệt.

## Bằng chứng kỹ thuật

- Tài liệu đi kèm OpenClaw candidate `2026.7.1-2` đã được đọc trực tiếp.
- `openclaw agents set-identity --help` trên candidate xác nhận đường CLI chính thức cho name/theme/emoji/avatar.
- Metadata npm được kiểm tra lại ngày 2026-08-11: hai Gateway packages stable cùng nhịp vẫn chưa tồn tại; Feature 0.2 giữ trạng thái blocked.
- Tài liệu OpenClaw online đã thay đổi bootstrap flow so với package docs, nên contract phải khóa theo release train và có regression test.

## Security, privacy và blast radius

- Thay đổi hiện tại chỉ là tài liệu, schema yêu cầu và validation list; không chạy OAuth, không dùng credential, không đọc dữ liệu người dùng và không thêm desktop code.
- Failure behavior được chọn fail-closed: bootstrap chưa xác minh thì chưa xóa file, chưa báo Agent sẵn sàng và chưa tạo memory sớm.
- Tách Agent Home khỏi Không gian dự án giảm nguy cơ ghi đè identity/memory và cho phép project grant theo quyền tối thiểu.
- Blast radius của implementation tương lai gồm onboarding, Agent lifecycle, restore, UI labels, workspace policy, sandbox và multi-agent tests. Các phần này tiếp tục bị chặn theo cổng.

## Review còn thiếu

- Senior platform/security reviewer phải review data flow và bootstrap contract ở Feature 0.3.
- Packaging/signing choices phải có ADR và owner trước Cổng 4.
- Audit này là Codex self-review, chưa thay thế independent security review, pentest hoặc legal review.
