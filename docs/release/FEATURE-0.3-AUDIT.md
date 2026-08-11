# Audit Feature 0.3 — Capability và threat model

Ngày: 2026-08-11

Nhánh: `feature/0.3-capability-threat-model`

Phạm vi dữ liệu: tài liệu công khai của release train và fixture giả, không credential

## 1. Kết quả

Feature 0.3 tạo năm hợp đồng máy đọc được:

1. Capability manifest gồm 23 nhóm bắt buộc.
2. Auth-support manifest gồm 9 phương thức cho OpenAI, Anthropic, Google, plugin provider và local model.
3. Source-of-truth/data-flow manifest gồm 9 nguồn và 8 luồng cốt lõi.
4. Agent Genesis contract gồm 7 template reference, 7 trạng thái, crash resume và 3 vùng workspace.
5. Threat model gồm 10 tài sản, 10 tác nhân, 10 trust boundary và 14 threat/abuse case.

## 2. Nguồn và độ chắc chắn

- OpenClaw được đọc từ npm package `2026.7.1-2` đang cài trên máy và đã khóa integrity tại Feature 0.2.
- Gateway contract đối chiếu tag `v2026.7.1-2`, commit `0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c` và protocol v4.
- Capability source chỉ dùng đường tài liệu/RPC/CLI/config/Plugin SDK công khai. Private Gateway workspace package, hashed `dist`, beta và dynamic tag bị validator cấm.
- Bảy template Genesis được fingerprint từ `docs/reference/templates/*` đi kèm đúng package. Đây là reference lock, chưa thay thế test runtime seeding ở Feature 2.2/2.5.
- Provider auth mới đạt `documented-only` hoặc `blocked`; không có live-auth claim.

## 3. Phản biện thiết kế

### Điểm yếu còn lại

- Inventory v1 ở family-level. Nó chưa đủ chi tiết để phát hiện mọi RPC/provider/plugin/channel cụ thể bị mất. Cổng 3 phải sinh manifest chi tiết và capability diff tự động.
- Schema/validator chứng minh tài liệu nhất quán, chưa chứng minh control thực sự cưỡng chế trên OS.
- `WRAPPED` mô tả hướng tích hợp, chưa phải code đã tồn tại. Vì vậy mọi record bị khóa `advertisable: false`.
- Template hash lấy từ reference docs trong npm package. Runtime seed output vẫn cần contract test độc lập.
- Threat model có nhiều Critical/High mở. Đây là kết quả đúng ở Cổng 0, đồng thời tiếp tục chặn pilot thật.

### Phương án đơn giản hơn đã xem xét

- Dùng một bảng Markdown duy nhất: bị loại vì không test được drift, duplicate ID, source-of-truth conflict hoặc cross-reference.
- Dùng riêng `hello-ok.features.methods`: bị loại vì upstream nói đây không phải inventory đầy đủ.
- Đánh dấu toàn bộ capability là planned: bị loại vì che mất khác biệt giữa `WRAPPED`, `RESTRICTED` và `BLOCKED`.

## 4. Security/privacy review

- Không dùng hoặc ghi credential.
- Không gọi provider/model.
- Không đọc OpenClaw private state.
- Không bật host exec, browser, channel, plugin, scheduler hoặc remote access.
- OAuth static secret và CLI credential có owner/storage authority riêng, không nhập nhằng.
- Critical/High threat vẫn release-blocking; prose không thể đóng risk.

## 5. Blast radius

Thay đổi chỉ thêm JSON schema/manifest, tài liệu, validator và contract test. Không có desktop runtime, service, process nền, database, migration, auth profile hoặc file ngoài repo. Rollback bằng revert commit Feature 0.3.

## 6. Giới hạn nghiệm thu

Local self-review đủ để đóng feature tài liệu/contract. Cổng 0 vẫn cần senior platform/security review trước khi được coi là đã qua hoàn toàn. Pilot thật, ký artifact và public release tiếp tục bị chặn bởi Risk Register và các cổng sau.
