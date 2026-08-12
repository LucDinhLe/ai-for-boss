# Governance Change — Feature 0.5 First-run journey

Ngày: 2026-08-11  
Owner phê duyệt: Lê Đình Lực  
Decision: D-0016

## Lý do

Product Owner yêu cầu kiểm chứng hành trình ba bước cho người phổ thông ngay sau
Feature 0.4, trước khi nối Gateway/OAuth/OpenClaw runtime. Mục tiêu là phát hiện
friction và ảo giác capability sớm, bằng dữ liệu giả và trạng thái trung thực.

## Thay đổi

- Rulebook 1.4 và Master Plan 1.3 mở Feature 0.5 như một first-run vertical
  slice, đồng thời giữ security/test baseline liên quan làm acceptance gate.
- Feature 2.2, 2.3 và 2.6 vẫn sở hữu onboarding/runtime/session/Advisor
  production; Feature 0.5 không thay thế các cổng này.
- Agent Genesis contract 1.0.0, source-of-truth, auth matrix và threat manifest
  không bị sửa.
- Gateway, OAuth, credential, Agent Home writer, tool, browser và signing tiếp
  tục bị khóa.

## Hành vi fail closed

- Fixture rỗng hoặc lạ không được coi là model đã kết nối.
- Genesis validation/resume lỗi giữ `PENDING_RESUME`, bootstrap preview và
  `reportReady=false`.
- Advisor plan/final không có runtime giữ `pending-runtime` hoặc `unreviewed`.
- Task draft không được thực thi hoặc quảng cáo như artifact thật.

## Rollback

Revert governance change cùng Feature 0.5 commit và khôi phục hash trong
`GOVERNANCE-LOCK.json`. Không có migration hoặc dữ liệu người dùng.
