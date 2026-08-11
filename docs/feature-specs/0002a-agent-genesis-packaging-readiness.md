# Feature Spec — 0.2a Agent Genesis và packaging readiness

## 1. Trạng thái

- Cổng: 0
- Loại: Governance amendment, docs-only
- Product Owner: Lê Đình Lực
- Owner thực hiện: Codex
- Trạng thái: Implemented, pending commit/review
- Ngày mở: 2026-08-11
- Giới hạn: Không mở Feature 0.3 và không thay đổi trạng thái blocked của Feature 0.2

## 2. Mục tiêu vận hành

Dự án có một bộ yêu cầu có thể kiểm thử cho nghi thức khai sinh Agent, phân tách Agent Home/Không gian dự án và một audit trung thực về mọi điều kiện còn thiếu trước khi sản phẩm được đóng gói cho người dùng tải.

## 3. Trong phạm vi

- Đối chiếu bảy workspace file do Product Owner cung cấp với OpenClaw candidate và tài liệu chính thức.
- Chốt bootstrap một lần cho Agent chính và mỗi Agent mới.
- Chốt failure behavior khi ghi identity hoặc xóa bootstrap lỗi.
- Chốt Agent Home, `agentDir`, session và auth profile tách biệt; project grant riêng.
- Bổ sung Rulebook, Master Plan, Decision Log, Risk Register và governance lock.
- Lập audit Windows/macOS/Linux, signing, update, recovery, legal, support và test matrix.
- Cập nhật validation để các tài liệu mới không thể biến mất âm thầm.

## 4. Ngoài phạm vi

- Desktop code, UI production, Supervisor, Gateway Adapter, installer hoặc updater.
- OAuth, API key, provider live test hoặc dữ liệu người dùng.
- Chọn Electron packaging tool, installer format, signing provider hoặc update hosting.
- Chọn sandbox backend.
- Phát hành hoặc tải artifact cho người dùng.

## 5. Đầu vào và đầu ra

| Loại | Mô tả |
|---|---|
| Đầu vào | Quyết định của Product Owner; `AGENTS.md`, `BOOTSTRAP.md`, `HEARTBEAT.md`, `IDENTITY.md`, `SOUL.md`, `TOOLS.md`, `USER.md`; OpenClaw `2026.7.1-2`; tài liệu nền tảng chính thức |
| Đầu ra | Rulebook/Master Plan đã truy vết; Agent Genesis architecture; packaging readiness audit; Decision/Risk/Changelog; governance lock mới |
| Dữ liệu nhạy cảm | Không có; chỉ metadata công khai và tài liệu repo |
| Hành động ngoài máy | Chỉ đọc metadata npm và tài liệu chính thức; chưa push hoặc phát hành |

## 6. Giả định

- Product Owner đã duyệt việc tách Agent Home khỏi Không gian dự án và giữ bootstrap one-time.
- OpenClaw candidate vẫn là `2026.7.1-2` cho tới khi Feature 0.2 được promote hoặc thay candidate có kiểm soát.
- Tài liệu online có thể đi trước release package; package/contract của release train được ưu tiên cho implementation.
- Direct download từ website là kênh bắt buộc; app store có thể là kênh bổ sung.
- Public release vẫn là công việc loại C, cần senior/security/legal owner ngoài AI.

## 7. Trường hợp biên và hành vi

| Trường hợp | Hành vi |
|---|---|
| `memory/` được tạo trước bootstrap | Cấm trong flow mới; migration review nếu workspace cũ đã có |
| App crash trước khi xóa bootstrap | Giữ file và resume idempotent |
| Identity file ghi đạt nhưng OpenClaw sync lỗi | Chưa promote `ACTIVE`; rollback hoặc resume |
| Hai Agent trỏ cùng workspace/agentDir | Chặn trước mutation |
| Project folder biến mất | Identity vẫn hoạt động; grant chuyển unavailable |
| Online docs khác candidate docs | Ghi upstream drift; contract test theo release train |
| Signing account chưa có | Public release bị chặn, không dùng unsigned artifact |
| Linux updater chưa chốt | Chỉ internal build; không quảng cáo auto-update |

## 8. Tiêu chí nghiệm thu

- [x] Rulebook có bootstrap lifecycle và workspace boundary.
- [x] Master Plan truy vết qua capability, workstream và feature.
- [x] Decision Log ghi Product Owner approval.
- [x] Risk Register có bootstrap collision, partial state, upstream drift và signing/update risks.
- [x] Architecture doc có state machine, dữ liệu, failure behavior, edge cases và 12 test.
- [x] Packaging audit nói rõ hiện chưa packageable và liệt kê đường tới public release.
- [x] Governance hash được cập nhật sau thay đổi.
- [x] Validation bắt buộc sự tồn tại của các tài liệu mới.
- [x] Git diff, whitespace, secret/link/hash validation và manual review cuối đạt.
- [ ] Có commit checkpoint hoàn tác được.

## 9. Kiểm thử

- Governance validator: required files, lock hash, secret patterns, Markdown fence và relative links.
- Runtime manifest validator: candidate vẫn validate và vẫn `blocked`.
- Git whitespace check.
- Manual traceability: D-0008 → Rulebook → Master Plan → architecture → risk → release audit.
- Source check: npm metadata và OpenClaw candidate CLI/help không được diễn giải vượt bằng chứng.

## 10. Phạm vi ảnh hưởng

- Tài liệu governance thay đổi hash và cần lock mới.
- Backlog tương lai của Feature 0.3, 2.2, 2.5, 3.x và 4.x có thêm acceptance criteria.
- Prototype UI tương lai cần đổi nhãn thư mục doanh nghiệp thành Dự án/Không gian dự án.
- Không có runtime, credential, database, WSL lab hoặc production state bị thay đổi.

## 11. Security, privacy và blast-radius review

- Bootstrap fail-closed và per-agent isolation giảm blast radius tương lai.
- Audit không chứa token, credential, dữ liệu cá nhân hoặc đường dẫn state thật của khách.
- Chưa chứng minh sandbox, signing, update hoặc restore bằng implementation; tài liệu ghi rõ trạng thái chưa đạt.
- Thay đổi governance có blast radius cao về backlog nhưng hoàn tác được bằng một commit vì chưa có product code phụ thuộc.

## 12. Rollback

Revert commit docs-only sẽ khôi phục hash lock cũ và xóa các tài liệu mới. Không cần migration hoặc thao tác ngoài repo.

## 13. Bằng chứng hoàn thành

- Commit checkpoint: điền sau khi validation cuối đạt.
- Reviewer: Codex self-review; cần Claude Code/senior/security review độc lập theo yêu cầu Product Owner.
- Product Owner acceptance: đã đồng ý tiến hành vá ngày 2026-08-11.
