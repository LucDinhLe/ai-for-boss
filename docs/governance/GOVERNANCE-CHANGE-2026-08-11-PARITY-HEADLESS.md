# Governance Change — Competitive parity, ba bước và Always-on

Ngày: 2026-08-11  
Product Owner: Lê Đình Lực  
Loại: Product architecture amendment, docs-only

## Lý do

Product Owner yêu cầu rà soát AI for Boss theo AICoworker, chặn dự án nếu không đơn giản và đẹp hơn benchmark, đưa Advisor vào từ bước lập kế hoạch và bổ sung khả năng cài trên máy chủ đám mây.

Audit xác nhận repo hiện chỉ có governance, runtime candidate, lab và prototype. Chưa có ứng dụng, installer, provider connection, Advisor orchestration hoặc Headless product.

## Thay đổi đã duyệt

- Rulebook 1.2 thêm Cổng Worth-Building, hành trình ba bước, Advisor plan/final gate và Always-on single-tenant.
- Master Plan 1.1 thêm Luồng K cho Headless/remote operations và Headless trong Cổng 4.
- D-0011 khóa tiêu chuẩn parity/khác biệt; D-0012 khóa trust boundary Always-on.
- D-0010 chuyển concept icon v1 sang `Rejected`; icon mới làm sau.
- Không chọn cloud provider, shared Gateway, relay/P2P hoặc Kubernetes/Fleet ở lần sửa này.

## Hệ quả vận hành

- Technical foundation tiếp tục theo cổng; public release bị chặn nếu benchmark không đạt.
- Mode đầu vẫn là desktop Windows x64 để chứng minh end-to-end. Headless Linux single-tenant chỉ được quảng cáo sau Cổng 4 tương ứng.
- Người dùng cloud sở hữu hoặc thuê hạ tầng riêng; AI for Boss không tập trung secret và dữ liệu công việc theo mặc định.
- Remote access mặc định Tailscale/SSH với Gateway loopback-only cho tới khi HTTPS ingress được threat-model và audit.

## Phạm vi ảnh hưởng

- Thay governance, UX, readiness, decision/risk/changelog và validator.
- Không thay runtime manifest, WSL2 lab, dependency, credential, app code hoặc production state.

## Rollback

Revert commit docs-only của Feature 0.2c và khôi phục governance lock trước đó. Không có migration hoặc dữ liệu người dùng.

