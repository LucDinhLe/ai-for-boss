# Đóng góp cho AI for Boss

## Trình tự bắt buộc

1. Đọc `AGENTS.md` và bộ governance.
2. Xác định đúng cổng và feature đang mở.
3. Tạo hoặc cập nhật Feature Spec.
4. Làm thay đổi nhỏ nhất đáp ứng tiêu chí.
5. Chạy kiểm tra, tự review và ghi phạm vi ảnh hưởng.
6. Commit khi toàn bộ tiêu chí đạt.

## Nhánh

- `main` luôn ở trạng thái đã qua kiểm tra của cổng hiện tại.
- Feature dùng `feature/<id>-<slug>`.
- Sửa lỗi dùng `fix/<slug>`.
- Chỉ sửa tài liệu dùng `docs/<slug>`.

Không force-push `main`. Không gom nhiều feature độc lập vào một pull request.

## Commit

Dùng Conventional Commits:

- `chore(governance): ...`
- `feat(supervisor): ...`
- `fix(adapter): ...`
- `test(security): ...`
- `docs(decisions): ...`

## Kiểm thử

Mỗi pull request phải chạy kiểm tra governance hiện có và test của feature. Khi chưa có product runtime, Feature 0.1 chỉ dùng:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-governance.ps1
```

## Bí mật và dữ liệu

- Không commit `.env`, key, token, cookie, dữ liệu khách hàng hoặc support bundle chưa làm sạch.
- File `.env.example` chỉ chứa tên biến và giá trị giả vô hại.
- OAuth test tương lai dùng tài khoản chuyên dụng có giới hạn quyền và chi phí.
- Khi nghi ngờ bí mật bị lộ, dừng connector, thu hồi credential và ghi incident.

## Nghiệm thu

Mô tả pull request phải có:

- Feature ID và mục tiêu.
- Thay đổi chính.
- Test đã chạy và kết quả.
- Security/privacy review.
- Phạm vi ảnh hưởng.
- Cách rollback.
- Quyết định Product Owner cần có, nếu tồn tại.
