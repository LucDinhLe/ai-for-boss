# Feature Spec — 0.1 Repo Governance

## 1. Trạng thái

- Cổng: 0
- Owner kỹ thuật: Codex, chờ senior reviewer trước pilot
- Product Owner: Lê Đình Lực
- Trạng thái: In progress
- Ngày mở: 2026-08-11

## 2. Mục tiêu vận hành

Mọi người hoặc AI bước vào repo đều biết nguồn quyết định, feature được phép làm, rủi ro đang mở, cách kiểm thử và điều kiện được commit. Repo có điểm khôi phục đầu tiên sạch bí mật.

## 3. Trong phạm vi

- Cấu trúc repo nền.
- Rulebook và Master Plan tự chứa trong repo.
- `AGENTS.md`, Decision Log, Risk Register và Changelog.
- Mẫu Feature Spec, quy tắc branch, commit, test và secret.
- Kiểm tra tự động tài liệu bắt buộc, governance hash và dấu hiệu secret.
- Git repository, commit đầu tiên và GitHub private remote.

## 4. Ngoài phạm vi

- Application code và dependency.
- Phiên bản OpenClaw, Node, Electron hoặc package manager.
- Gateway nhúng, OAuth, provider connector, installer và updater.
- Sandbox, host exec, browser automation và dữ liệu thật.
- Product license công khai.

## 5. Đầu vào và đầu ra

| Loại | Mô tả |
|---|---|
| Đầu vào | Rulebook 1.1, Master Execution Plan, final audit, VIBECODING |
| Đầu ra | Repo governance có kiểm tra tự động và commit khôi phục |
| Dữ liệu đọc | Tài liệu dự án trong workspace |
| Dữ liệu ghi | Chỉ file trong repo `ai-for-boss` và Git metadata |

## 6. Giả định

- Tên repo là `ai-for-boss`.
- Repo private theo mặc định an toàn của Rulebook.
- Nhánh mặc định là `main`.
- Git identity hiện tại thuộc Đại ca.
- GitHub authentication có thể cần Đại ca xác nhận lại trên trình duyệt.

## 7. Trường hợp biên và hành vi khi lỗi

| Trường hợp | Hành vi mong đợi |
|---|---|
| Repo GitHub đã tồn tại | Không ghi đè; kiểm tra owner và remote trước push |
| GitHub chưa xác thực | Giữ commit local; yêu cầu đăng nhập chính chủ |
| Governance hash sai | Check fail và dừng commit/push |
| Thiếu tài liệu bắt buộc | Check fail, nêu đúng file thiếu |
| Phát hiện secret-like value | Check fail, không đưa lên GitHub |
| CI lỗi sau push | Không mở Feature 0.2; sửa trên nhánh governance |

## 8. Quyền và dữ liệu

- Scope cần dùng: quyền tạo private repository và push vào tài khoản GitHub của Đại ca.
- Secret cần dùng: GitHub CLI tự quản lý token; token không xuất hiện trong file hoặc log.
- Workspace/network cần dùng: ghi trong repo local; kết nối GitHub lúc tạo remote và push.
- Approval cần dùng: yêu cầu đã được Đại ca cho phép trong tin nhắn triển khai và đồng bộ GitHub.
- Dữ liệu cá nhân hoặc nhạy cảm: chỉ Git author name/email đã cấu hình; không đưa tài liệu cá nhân khác vào repo.

## 9. Quyết định có hệ quả

- D-0003 áp dụng repo private.
- D-0004 giới hạn phiên này ở Feature 0.1.
- Chưa chốt product license, release train hoặc hạ tầng runtime.

## 10. Tiêu chí nghiệm thu

- [ ] Cấu trúc repo và tài liệu bắt buộc tồn tại.
- [ ] Bản Rulebook trong repo giữ đúng SHA-256 đã audit.
- [ ] `AGENTS.md` buộc đọc governance và active Feature Spec.
- [ ] Decision Log, Risk Register, Changelog và Feature Spec template đầy đủ.
- [ ] Governance check chạy thành công local.
- [ ] Không có secret hoặc dữ liệu thật trong staged files.
- [ ] Commit đầu tiên có thể hoàn tác.
- [ ] GitHub repo private tồn tại và `main` đồng bộ.
- [ ] CI governance đạt trên GitHub.

## 11. Kế hoạch kiểm thử

- Unit: không áp dụng vì chưa có product code.
- Contract: xác minh hash Rulebook và Master Plan.
- Integration: chạy governance script từ repo root.
- Security/privacy: quét secret-like patterns và kiểm tra staged files.
- Kiểm tra bằng tay: đọc README, AGENTS, decisions, risks và GitHub visibility.
- Recovery/rollback: clone lại repo hoặc reset về commit đầu tiên.

## 12. Phạm vi ảnh hưởng

- Thành phần bị chạm: repo mới `projects/ai-for-boss` và GitHub remote mới.
- Tính năng có thể bị ảnh hưởng: chưa có product runtime.
- Dữ liệu hoặc migration: không có.

## 13. Rollback

GitHub repo có thể archive hoặc xóa sau khi xác minh đúng target. Repo local có thể quay về commit đầu tiên. Không xóa tự động vì đây là thao tác phá hủy.

## 14. Bằng chứng hoàn thành

- Commit: chờ tạo sau khi toàn bộ check đạt.
- Kết quả test: chờ chạy.
- Reviewer: Codex self-review; Claude Code hoặc senior reviewer có thể audit tiếp.
- Product Owner acceptance: yêu cầu triển khai ngày 2026-08-11.
