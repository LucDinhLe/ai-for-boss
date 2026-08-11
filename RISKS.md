# Risk Register

Thang mức độ: `Critical`, `High`, `Medium`, `Low`.

| ID | Rủi ro | Mức | Trạng thái | Owner | Cổng xử lý | Biện pháp hiện tại |
|---|---|---|---|---|---|---|
| R-001 | Sandbox đa nền tảng chưa chứng minh | Critical | Open | Product Owner + Platform/Security | Feature 0.6 | Tắt host exec, elevated và browser nhạy cảm |
| R-002 | SecretRef broker chưa có contract test ba OS | Critical | Open | Platform/Security | Cổng 1 và Cổng 4 | Chưa triển khai broker; cấm fallback plaintext |
| R-003 | OAuth và điều khoản provider thay đổi | High | Open | Product + Security/Legal | Mỗi connector | Auth-support record và live test bằng tài khoản chuyên dụng |
| R-004 | Chưa có kỹ sư chịu trách nhiệm ngoài AI | Critical | Open | Product Owner | Trước pilot thật | Chỉ prototype và technical spike local bằng dữ liệu giả |
| R-005 | OpenClaw release drift phá adapter | High | Open | Platform | Feature 0.2 trở đi | Release train pin npm integrity, tag/commit, protocol/doc blob và private workspace tree; mọi nâng cấp chạy contract/protocol/capability diff |
| R-006 | Repo vô tình chứa secret hoặc dữ liệu riêng | High | Mitigated | Mọi contributor | Mọi commit | `.gitignore`, governance check và review trước push |
| R-007 | Hứa hỗ trợ thiết bị khi mới chỉ build CI | High | Open | Product + QA/Release | Cổng 4 | Artifact Feature 0.4 ghi `experimental-internal`, unsigned và non-distributable; inventory theo runner; chỉ công bố tổ hợp đã test trên máy thật |
| R-008 | Một người xây tạo bus factor | High | Open | Product Owner | Trước pilot | Tài liệu, review độc lập và bàn giao theo cổng |
| R-009 | Quyền cấp phép sản phẩm chưa chốt | Medium | Deferred | Product Owner + Legal | Trước Cổng 4 | Repo private, chưa cấp license |
| R-010 | Advisor bị worker output thao túng | High | Open | Platform/Security | Cổng 2-3 | Session review riêng, read-only, schema và adversarial test |
| R-011 | External-app contract bị hiểu sai thành public-package requirement | High | Mitigated — no longer blocking | Platform + Product Owner | Feature 0.2 và mọi upgrade | Dùng WebSocket RPC công khai của đúng tag; private package chỉ fingerprint, không bundle; CI cấm beta/private dist và drift |
| R-012 | WSL2 lab chia sẻ kernel host và có mạng trong lúc tải dependency | Medium | Open | Platform/Security | Feature 0.6 | Không mount ổ Windows, tắt interop, không dùng credential, smoke trong network namespace không mạng và terminate sau test |
| R-013 | Nhiều Agent dùng chung workspace làm ghi đè identity, memory hoặc file bootstrap | High | Mitigated by design, untested | Platform/Product | Feature 0.3 và 2.5 | Agent Home, `agentDir`, session và auth profile tách riêng; project grant riêng |
| R-014 | Bootstrap bị xóa hoặc workspace bị coi là configured khi dữ liệu mới ghi một phần | High | Open | Platform | Feature 2.2 và 2.5 | Staging, readback, identity sync, health check; không tạo `memory/` sớm; crash resume idempotent |
| R-015 | Bootstrap/template/identity contract thay đổi giữa các OpenClaw release | High | Open | OpenClaw Adapter/Platform | Feature 0.2-0.3 và mọi upgrade | Khóa template cùng release train; contract diff và regression test trước promote |
| R-016 | Chưa có owner, tài khoản và quy trình code-signing/notarization cho ba nền tảng | High | Open — release blocking | Product Owner + Release/Legal | Trước Cổng 4 | Không phát hành unsigned; chốt Windows signing, Apple Developer ownership và Linux signing bằng ADR |
| R-017 | Linux không có Electron autoUpdater tích hợp, dễ tạo update/rollback không nhất quán | High | Open | Release/Platform | Cổng 4 | Chọn package-manager hoặc signed update flow riêng và chạy update/rollback test trên distro hỗ trợ |
| R-018 | Giao diện học từ đối thủ có thể bị hiểu là sao chép nhận diện hoặc trade dress | High | Mitigated by design, untested | Product/Design/Legal | Feature 0.4 và trước Cổng 4 | Shell dùng Editorial Calm, wordmark/copy/hình học trung tính riêng; vẫn cần provenance, visual comparison, trademark và legal review trước phát hành |
| R-019 | Sản phẩm đủ feature nhưng không đơn giản, đẹp hoặc đáng tin hơn benchmark | Critical | Open — product blocking | Product Owner + Product Design | Cổng 2 và trước public release | Worth-Building Gate; human test; independent visual review; dừng mở rộng sau hai vòng không đạt |
| R-020 | Remote access của Always-on làm lộ Gateway, credential hoặc dữ liệu doanh nghiệp | Critical | Open | Platform/Security | Feature 0.3, 0.6 và Headless Cổng 4 | Gateway loopback-only; Tailscale/SSH trước; TLS/ingress review; one-time claim; device revoke; pentest |
| R-021 | Shared host làm lẫn dữ liệu khách hoặc session ID bị dùng như tenant boundary | Critical | Mitigated by architecture, untested | Platform/Security | Headless Cổng 4 và Cổng 7 | Một instance/cell đầy đủ cho mỗi khách/biên tin cậy; cross-tenant test; không shared Gateway |
| R-022 | Always-on tăng chi phí và trách nhiệm vận hành vượt khả năng đội hiện tại | High | Open | Product Owner + Operations | Trước Headless pilot | Khách sở hữu hạ tầng; provider-neutral ADR; monitoring/backup/support owner; chưa mở SaaS hoặc Kubernetes |
| R-023 | One-time claim hoặc remote pairing bị dùng lại/chiếm trước | High | Open | Platform/Security | Headless Cổng 4 | Credential hết hạn nhanh, single-use, bind đúng instance/device, rate limit, revoke và audit |
| R-024 | Capability inventory v1 ở family-level có thể bỏ sót drift RPC/provider/plugin/channel cụ thể | High | Open | OpenClaw Adapter/QA | Cổng 3 và mọi upgrade | Cổng 3 sinh inventory chi tiết; CI chạy protocol/capability/plugin diff và fail khi item chưa phân loại |
| R-025 | Tài liệu contract bị hiểu nhầm thành control bảo mật đã triển khai | Critical | Open — release blocking | Product/Engineering/Security | Mọi cổng | Mọi capability Feature 0.3 khóa `advertisable: false`; tách evidence level; chỉ test thực thi và review độc lập mới được promote |
| R-026 | Prototype First-run bị hiểu nhầm là kết nối model hoặc Agent Genesis thật | High | Mitigated in prototype, untested with users | Product/UX/Security | Feature 0.5 và Cổng 2 | Gắn nhãn dữ liệu giả/mô phỏng; CSP offline; fixture `live:false`; state trong bộ nhớ; task draft-only và Advisor pending-runtime |
| R-027 | Happy-path test hoặc snapshot kiểm không đủ invariant có thể tạo trạng thái `ACTIVE` bất khả thi | High | Mitigated in Feature 0.5 preview, runtime unreviewed | Platform/Security/QA | Feature 0.5 và trước runtime Genesis | Exact schema `0.5.1-preview`, invariant matrix cho mọi state, renderer không cấp promotion evidence, regression test cho các tổ hợp khai thác và senior review trước khi nối Supervisor |

## Luật cập nhật

- Risk mới phải có owner và cổng xử lý.
- Risk Critical hoặc High không được đóng chỉ bằng mô tả; cần test hoặc bằng chứng review.
- Nếu biện pháp tạm thời bị gỡ, trạng thái phải quay lại Open trước cùng commit.
