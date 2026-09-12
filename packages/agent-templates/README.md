# Mẫu agent theo vai (spec 0058)

Mỗi thư mục là một mẫu: `template.json` (nhãn, dành cho ai, kỹ năng, chế độ mặc định, mức quyền theo ngôn ngữ kinh doanh) và ba tệp tiếng Việt `SOUL.md`, `IDENTITY.md`, `USER.md` mà vỏ ghi qua `agents.files.set` khi tạo agent. Danh sách kỹ năng được ghi vào `agents.<id>.skills` của lõi qua kênh thiết lập và đọc lại trước khi tính là xong.

Sáu mức quyền, chỉ bốn mức đầu dùng ở đợt một: `doc` (được đọc), `de-xuat` (được đề xuất), `sua-sau-duyet` (được sửa sau khi duyệt), `tu-sua-trong-du-an` (được tự sửa trong thư mục dự án), `gui-ra-ngoai` (được gửi ra ngoài, tắt), `giao-dich` (được giao dịch, tắt). Mức quyền ở đây là lời hứa với người dùng và được diễn dịch xuống chế độ phiên và sàn phê duyệt của lõi bởi `HostExecutionPolicy`; mẫu không tự nới quyền.

Advisor không phải mẫu; nó là vai giám sát dùng chung.
