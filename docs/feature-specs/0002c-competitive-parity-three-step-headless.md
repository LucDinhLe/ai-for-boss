# Feature Spec — 0.2c Competitive parity, hành trình ba bước và Headless

## 1. Trạng thái

- Cổng: 0
- Loại: Product architecture amendment, docs-only
- Product Owner: Lê Đình Lực
- Owner thực hiện: Codex
- Trạng thái: Implemented in documentation; product implementation chưa bắt đầu
- Ngày mở: 2026-08-11
- Giới hạn: Không mở Feature 0.3, không viết desktop/server production code và không tạo bộ cài

## 2. Mục tiêu và tiêu chuẩn thành công

AI for Boss chỉ tiếp tục tới public release khi chứng minh đồng thời ba điều:

1. Người phổ thông đi từ trang tải tới tác vụ đầu trong ba bước, không terminal, config file hoặc sao chép OAuth callback.
2. Trải nghiệm thị giác và khả năng hiểu trạng thái đạt hoặc vượt benchmark AICoworker, đồng thời giữ chất lượng Editorial Calm độc lập theo tinh thần Hermes.
3. Advisor tạo khác biệt thật bằng cách phản biện kế hoạch trước thực thi và kiểm tra kết quả trước bàn giao.

Sản phẩm hỗ trợ hai mode triển khai có cùng hợp đồng UX:

- **Thiết bị cá nhân:** runtime/Gateway chạy trên máy của người dùng.
- **Always-on riêng:** một runtime/Gateway cô lập chạy trên máy chủ do khách sở hữu hoặc thuê, truy cập từ desktop/web/channel qua transport được duyệt.

## 3. Người dùng, owner và quyền quyết định

- Người dùng đầu: chủ doanh nghiệp hoặc học viên không có nền tảng kỹ thuật.
- Product Owner quyết định chỉ số pilot, provider hạ tầng, chính sách remote access, giá và điều kiện phát hành.
- Platform/Security đề xuất installer, remote transport, isolation, secret storage, backup và monitoring.
- Không chọn nhà cung cấp đám mây trong feature này. Mặc định an toàn là máy chủ Linux riêng cho một khách hoặc một biên tin cậy.

## 4. Trong phạm vi

- Audit bản hiện tại theo capability AICoworker công bố ngày 2026-08-11.
- Định nghĩa hành trình cốt lõi ba bước và chỉ số nghiệm thu.
- Định nghĩa hai checkpoint Advisor bắt buộc khi Advisor được bật.
- Thêm Worth-Building Gate và luật dừng nếu sản phẩm không đạt parity cùng khác biệt.
- Bổ sung kiến trúc tham chiếu, cổng và test cho Headless/Always-on.
- Đánh dấu concept icon v1 đã bị Product Owner từ chối; icon mới để feature thương hiệu sau.

## 5. Ngoài phạm vi

- Cài AICoworker server hoặc chạy script bên thứ ba.
- Chọn AWS, Azure, Google Cloud, Hetzner, DigitalOcean hoặc provider cụ thể.
- Xây relay, P2P, mobile app, control plane multi-tenant hoặc marketplace image.
- Xây hoặc phát hành installer desktop/headless.
- Dùng tài khoản, API key, OAuth token hoặc dữ liệu thật.

## 6. Hành trình ba bước

### Bước 1 — Tải và cài

- Website đề xuất đúng OS/architecture nhưng luôn cho chọn thủ công.
- Artifact có version, dung lượng, support status, checksum và chữ ký.
- Installer preflight, cài runtime đầy đủ và tự kiểm tra AI Engine.
- Người dùng không cài Node, Git, WSL, OpenClaw hoặc Gateway.

### Bước 2 — Kết nối và khai sinh

- Chọn Việt/Anh, theme và mode chạy trên máy hoặc Always-on.
- Kết nối ít nhất một model bằng flow thật sự được provider/OpenClaw hỗ trợ.
- OAuth quay lại app tự động; API key được nhập vào bề mặt bí mật phù hợp.
- Agent Genesis hỏi ngắn về tên, vai trò, giọng điệu, cách xưng hô và ranh giới.
- Live probe xác nhận model dùng được trước khi báo sẵn sàng.

### Bước 3 — Giao việc đầu tiên

- Người dùng mô tả mục tiêu bằng ngôn ngữ tự nhiên hoặc chọn một workflow mẫu.
- Hệ thống xác nhận đầu ra, dữ liệu, quyền, ngân sách và tiêu chí hoàn thành bằng progressive disclosure.
- Khi Advisor bật, kế hoạch phải qua checkpoint trước thực thi; kết quả phải qua checkpoint trước bàn giao.
- Tác vụ hoàn tất bằng artifact, trạng thái review, nguồn và chi phí có thể kiểm tra.

## 7. Advisor hai checkpoint

### Checkpoint A — Phản biện kế hoạch

Advisor chỉ nhận mục tiêu, ràng buộc, draft plan, dữ liệu dự kiến, tool/quyền, ngân sách và rubric. Output có cấu trúc:

```text
decision: approve | revise | clarify | blocked
coverage_gaps
risk_flags
cost_or_scope_waste
required_changes
confidence
```

Worker không bắt đầu hành động thay đổi dữ liệu hoặc gọi tool nhạy cảm khi `decision` khác `approve`, trừ khi người dùng chủ động override và audit ghi nhận.

### Checkpoint B — Kiểm tra đầu cuối

Advisor so yêu cầu, tiêu chí hoàn thành, artifact, bằng chứng và lỗi mở. Output giữ schema review hiện hành và thêm `goal_coverage`, `unmet_criteria`, `evidence_quality` cùng `release_recommendation`.

Advisor vẫn read-only, bị tách khỏi worker session, không tự sửa output, không tự duyệt hành động của chính nó và fail closed thành `unreviewed` khi lỗi.

## 8. Kiến trúc Always-on tham chiếu

```text
AI for Boss Desktop hoặc Web Client
            |
      Transport đã duyệt
  Tailscale/SSH trước, HTTPS sau
            |
   Host Linux riêng của khách
  |-- Reverse proxy/private ingress
  |-- AI for Boss Headless Supervisor
  |-- OpenClaw Gateway loopback-only
  |-- Agent/workspace/credential riêng
  |-- Volume mã hóa + backup đã kiểm thử
  `-- systemd/container health + rollback
```

Luật cứng:

- Một khách hoặc một biên tin cậy dùng một instance hoàn chỉnh; không dùng chung Gateway để giả multi-tenancy.
- Gateway giữ loopback-only; remote access đi qua private network, SSH tunnel hoặc HTTPS/TLS entrypoint đã audit.
- Dùng non-root service user, quyền tối thiểu, resource limit, health check, automatic restart và signed update.
- One-time claim credential hết hạn nhanh, buộc đổi hoặc ghép thiết bị; không đặt secret trong URL, command line, log hoặc support bundle.
- Dữ liệu, credential, channel và browser profile tách theo instance; backup/restore và revoke phải thử thật.
- Remote Browser, host exec và tool nhạy cảm tiếp tục tắt cho tới khi sandbox, egress policy và approval test đạt.
- Bản đầu ưu tiên một VPS Linux riêng cho mỗi khách. Kubernetes/Fleet chỉ mở khi nhu cầu vận hành thực tế chứng minh cần, vì Fleet upstream còn experimental.

## 9. Giả định

- Khách tự sở hữu và trả chi phí provider model và hạ tầng Always-on.
- AI for Boss không giữ tập trung prompt, file, output, OAuth token hoặc API key của khách.
- Bản desktop và headless dùng cùng capability manifest, policy, Advisor contract và backup format khi platform cho phép.
- AICoworker là benchmark hành vi công khai, không phải nguồn code, asset hoặc cam kết bảo mật được mặc định tin đúng.

## 10. Trường hợp biên và hành vi khi lỗi

| Trường hợp | Hành vi bắt buộc |
|---|---|
| Website nhận sai OS/CPU | Luôn cho chọn thủ công; installer từ chối artifact sai bằng thông báo dễ hiểu |
| Mạng rớt khi tải/cài/OAuth | Resume hoặc rollback; không tạo trạng thái nửa vời |
| Không có model dùng được | Dừng ở Bước 2, cho sửa kết nối; không giả sẵn sàng |
| Advisor lỗi ở plan gate | Giữ kế hoạch `unreviewed`; cho retry, đổi Advisor hoặc tắt có audit |
| Người dùng tắt Advisor | Hiển thị trạng thái chưa qua hai checkpoint; task vẫn theo policy và approval thường |
| Server reboot/crash | Service tự trở lại checkpoint; không chạy trùng schedule hoặc tool mutation |
| Transport remote mất | Giữ runtime và task theo policy; client reconnect dựng lại history/run/approval |
| One-time claim bị dùng lại | Từ chối và yêu cầu claim mới |
| Hai khách bị trỏ nhầm instance | Fail closed; không cho dùng session ID như lớp phân quyền |
| Provider hạ tầng chưa chốt | Chỉ giữ architecture provider-neutral; không viết lock-in vào code |

## 11. Worth-Building Gate

Không mở public release nếu thiếu bất kỳ điều kiện nào:

- Ma trận parity không còn mục cốt lõi ở trạng thái `Missing` hoặc `Prototype only`.
- 90% người thử mục tiêu hoàn thành ba bước và bắt đầu tác vụ đầu trong tối đa năm phút, không cần người kỹ thuật can thiệp.
- Ít nhất 80% người thử tìm đúng nơi giao việc trong năm giây và giải thích đúng model, Advisor, dữ liệu rời máy cùng hành động chờ duyệt.
- Independent visual review chấm AI for Boss cao hơn AICoworker về hierarchy, clarity và perceived trust; không thấp hơn về learnability.
- Advisor plan gate tìm được lỗi có ý nghĩa trong bộ benchmark và giảm rework/token tổng so với chỉ review cuối.
- Desktop và Always-on cùng đạt security, recovery và support gates tương ứng trước khi được quảng cáo.

Nếu sau hai vòng prototype/test vẫn không đạt, dự án dừng mở rộng tính năng. Product Owner chọn thu hẹp khác biệt, dùng sản phẩm có sẵn hoặc thuê đội có trách nhiệm trước khi tiếp tục.

## 12. Tiêu chí nghiệm thu feature docs-only

- [x] Có audit evidence phân biệt Implemented, Prototype only, Planned và Missing.
- [x] Hành trình ba bước có input, output, lỗi và chỉ số rõ ràng.
- [x] Advisor được định nghĩa ở plan gate và final gate.
- [x] Always-on có trust boundary, remote transport, isolation, recovery và deferred provider.
- [x] Rulebook, Master Plan, Decision Log, Risk Register, UX direction và readiness audit được cập nhật.
- [x] Icon v1 được đánh dấu rejected và không còn là nguồn nhận diện được duyệt.
- [ ] Product implementation và human usability test, thuộc các cổng sau.

## 13. Kiểm thử và phạm vi ảnh hưởng

- Static governance validation, hash lock, Markdown link và secret scan.
- Manual traceability review từ audit tới Rulebook/Master Plan/Decision/Risk.
- Không thay runtime manifest, lab, dependency, credential, app code hoặc production state.

## 14. Rollback

Revert commit docs-only của Feature 0.2c. Không có migration hoặc dữ liệu người dùng.

