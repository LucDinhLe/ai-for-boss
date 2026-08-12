# AI for Boss — Audit đối thủ, hành trình ba bước và Always-on

Ngày audit: 2026-08-11  
Người thực hiện: Codex self-review  
Product Owner: Lê Đình Lực  
Đối chiếu: AICoworker v2026.6.19 và tài liệu OpenClaw công khai tại thời điểm audit

**Cập nhật trạng thái:** Feature 0.3 đã hoàn thành capability/auth/source/threat
contract cùng Agent Genesis contract sau baseline audit này. Các trạng thái
implementation, hành trình ba bước và Headless bên dưới chưa thay đổi.

## 1. Kết luận điều hành

**Bản AI for Boss hiện tại chưa đạt điều kiện cạnh tranh và chưa có sản phẩm để tải dùng.** Repo có governance, release train đã khóa, Feature 0.3 contract, WSL2 lab, thiết kế UX và prototype tĩnh. Chưa có desktop app, Supervisor, Gateway Adapter, provider connection, Agent runtime, Advisor thật, installer, updater, signing hoặc Headless product.

Vì vậy:

- Không được gọi prototype là beta hoặc bản gần hoàn thiện.
- Không mở rộng feature chỉ để có danh sách dài.
- Tiếp tục technical foundation có cổng; public release bị chặn bởi Worth-Building Gate.
- Icon hiện tại đã bị Product Owner từ chối và được để ngoài luồng cho tới khi có concept mới.

## 2. Benchmark AICoworker công bố

AICoworker công bố các nhóm năng lực sau:

- Desktop Windows, macOS và Linux với build theo kiến trúc, website đề xuất bản tải.
- Hành trình ba bước gồm tải/cài, kết nối model hoặc local model, rồi giao việc.
- Không terminal hoặc config file cho desktop onboarding.
- Nhiều Agent, mỗi Agent có workspace, model và personality riêng.
- Browser, file operations, voice, image, tool, schedule và channel.
- Provider cloud và model local, chọn model theo task.
- Persistent memory, context inspection và usage/cost.
- Headless Linux one-command, remote UI, automatic restart và truy cập từ xa.

Đây là claim công khai của đối thủ. Audit này không coi mọi claim bảo mật hoặc khả năng đều đã được kiểm chứng độc lập.

## 3. Ma trận hiện trạng

| Năng lực | Chuẩn cạnh tranh | Bằng chứng AI for Boss hiện tại | Trạng thái |
|---|---|---|---|
| Website đề xuất bản tải | Nhận diện sơ bộ OS/CPU, manual fallback | Chỉ có yêu cầu trong Rulebook | Planned |
| Installer desktop đa nền tảng | Artifact đúng OS/arch, không terminal | Chưa có app hoặc installer | Missing |
| First-run song ngữ | Wizard Việt/Anh, theme, preflight | Prototype UI có Việt/Anh và theme; chưa có onboarding thật | Prototype only |
| Kết nối model | OAuth/API key, live probe, revoke | Có auth matrix và quy tắc; chưa có connector | Missing |
| OAuth không copy callback | Callback tự quay lại app | Có luật; chưa có runtime flow | Missing |
| Agent Genesis | Hội thoại khai sinh và bootstrap an toàn | Có spec/architecture; chưa có implementation | Planned |
| Giao việc ba bước | Từ download tới task đầu trong ≤5 phút | Chưa có end-to-end hoặc human test | Missing |
| Session và model theo phiên | Chọn/đổi model theo task | Prototype có selector; chưa nối runtime | Prototype only |
| Nhiều Agent | Workspace/model/personality tách biệt | Có architecture; chưa có Agent runtime UI | Planned |
| Advisor plan gate | Phản biện trước thực thi | Prototype hiển thị trạng thái chờ; Rulebook cũ chưa đủ contract | Prototype only; spec amended |
| Advisor final gate | Đối chiếu mục tiêu, bằng chứng, rubric | Có direction; chưa có orchestration hoặc test | Planned |
| Browser và web | Agent dùng browser, nguồn và approval | Prototype mô phỏng | Prototype only |
| File/workspace/artifact | Đọc, ghi, preview, provenance | Prototype mô phỏng; chưa có sandbox/file contract | Prototype only |
| Skills, plugins, MCP | Catalog, provenance, quyền và health | Chỉ có kế hoạch capability | Planned |
| Channels | Telegram/WhatsApp và channel upstream | Chỉ có mục trong Control Center prototype | Planned |
| Schedule/heartbeat | Chạy nền, timezone, budget, restart | Chỉ có kế hoạch | Planned |
| Voice/media | Voice, image, audio | Chỉ có nút microphone mô phỏng | Prototype only |
| Usage/cost | Chi phí theo session/agent và budget | Có kế hoạch; prototype chưa có usage view thật | Planned |
| Backup/restore | Snapshot, portable recovery, restore drill | Có thiết kế; chưa implementation | Planned |
| Gateway recovery | Invisible, restart, Safe Mode, rollback | Lab chỉ smoke OpenClaw; product Supervisor chưa có | Missing |
| Headless/Always-on | Linux service, remote UI, restart, restore | Chưa có product track trước audit này | Missing; architecture added |
| Local-first security | Secret, sandbox, approval, audit | Có governance; chưa có enforcement | Planned |
| Signed release | Signing, notarization, checksum, SBOM | Baseline SBOM; chưa có artifact hoặc signing identity | Missing |
| Giao diện cao cấp | Sáng, sang, trực quan, independent brand | Editorial prototype đã được Product Owner chấp nhận hướng; icon bị từ chối; chưa independent review | Prototype only |

## 4. Điểm AI for Boss phải vượt lên

Parity chỉ là điều kiện vào sân. AI for Boss phải tạo lợi thế bằng:

1. **Advisor hai checkpoint:** phản biện draft plan trước khi worker tốn token hoặc tạo rủi ro; kiểm tra đầu cuối trước bàn giao.
2. **Giao việc có hợp đồng:** mục tiêu, đầu ra, dữ liệu, quyền, ngân sách và tiêu chí hoàn thành được làm rõ bằng ngôn ngữ phổ thông.
3. **Quản trị cho chủ doanh nghiệp:** Approval Inbox, chi phí, trách nhiệm, audit, emergency stop và policy có control thật.
4. **Editorial Calm:** hierarchy, khoảng thở và trạng thái rõ hơn AICoworker; nhận diện độc lập và không sao chép Hermes.
5. **Hai mode, một trải nghiệm:** thiết bị cá nhân cho local-first và Always-on riêng cho công việc 24/7.

## 5. Gap quan trọng nhất của prototype

- Welcome hiện là composer đẹp nhưng chưa dẫn người dùng qua ba bước.
- Control Center liệt kê nhiều capability nhưng phần lớn là copy mô phỏng, dễ tạo ảo giác đã làm xong.
- Trạng thái Advisor ở plan checkpoint đã có trên màn hình, nhưng chưa có contract quyết định, override và provenance.
- Chưa có dashboard usage/cost thật, schedule, channels, skills hoặc multi-agent operations.
- Chưa có bề mặt chọn mode Thiết bị cá nhân/Always-on và chưa có remote trust UX.
- Icon/mark v1 bị Product Owner từ chối; mọi visual benchmark sau phải dùng placeholder trung tính cho tới khi icon mới được duyệt.

## 6. Khả năng triển khai đám mây

OpenClaw hỗ trợ mô hình một Gateway trên một host, remote client qua Tailscale hoặc SSH, service management và mô hình mỗi tenant một instance/cell. Vì vậy **AI for Boss có thể xây mode Always-on**, nhưng repo hiện tại chưa triển khai.

Đường phù hợp giai đoạn đầu:

- Một VPS Linux riêng trong tài khoản khách.
- AI for Boss Headless Supervisor chạy bằng service user không phải root.
- OpenClaw Gateway chỉ bind loopback.
- Truy cập ban đầu qua Tailscale hoặc SSH tunnel; HTTPS remote chỉ mở sau threat model và ingress audit.
- Persistent volume riêng, backup mã hóa, restore drill, health, auto-restart và staged update.
- Desktop/web client dùng Gateway contract cùng release train; không đọc state server trực tiếp.

Không nên bắt đầu bằng Kubernetes hoặc shared multi-tenant SaaS. OpenClaw Fleet còn experimental, Windows host chưa được test và session ID không phải tenant authorization boundary.

## 7. Quyết định dừng hoặc tiếp tục

Tiếp tục xây nền kỹ thuật theo cổng vì kiến trúc có đường khả thi. Dừng public release và dừng phình feature nếu Worth-Building Gate không đạt.

Thứ tự mới cần chứng minh:

1. Release train và security foundation.
2. Windows x64 end-to-end ba bước bằng dữ liệu giả.
3. Advisor plan/final benchmark và Editorial usability benchmark.
4. Signed installer cùng recovery.
5. Linux Headless single-tenant spike và remote access audit.
6. Mở thêm OS/capability sau khi parity cùng khác biệt đã có bằng chứng.

## 8. Nguồn chính

- AICoworker product/download page: <https://aicoworker.net/#download>
- AICoworker release v2026.6.19: <https://github.com/Neurons-AI/aicoworker/releases/tag/v2026.6.19>
- OpenClaw Remote Access: <https://docs.openclaw.ai/gateway/remote>
- OpenClaw Gateway runbook: <https://docs.openclaw.ai/gateway>
- OpenClaw Embedding: <https://docs.openclaw.ai/gateway/embedding>
- OpenClaw Gateway client: <https://docs.openclaw.ai/gateway/clients>
- OpenClaw Multi-tenant hosting: <https://docs.openclaw.ai/gateway/multi-tenant-hosting>
- OpenClaw Kubernetes: <https://docs.openclaw.ai/install/kubernetes>
