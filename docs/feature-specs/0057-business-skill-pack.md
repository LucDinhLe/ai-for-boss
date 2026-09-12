# 0057 — Gói mười hai kỹ năng doanh nghiệp tiếng Việt

## Vì sao cần

AI for Boss là harness cho chủ doanh nghiệp nhỏ, người kinh doanh một mình và người đi làm. Cho tới beta36, ứng dụng không có kỹ năng doanh nghiệp nào; mọi năng lực nằm ở lớp vỏ. Quyết định 2 ngày 12/09/2026: chuyển thể từ các kho kỹ năng mã nguồn mở nhiều sao thay vì viết từ đầu.

## Quyết định

- Nguồn: `anthropics/knowledge-work-plugins` (Apache 2.0), các plugin `small-business`, `sales`, `marketing`, `product-management`, `operations`. Không dịch máy móc; viết lại cho bối cảnh Việt Nam, bỏ mọi phụ thuộc QuickBooks, HubSpot, PayPal, Slack, Canva; dữ liệu đến từ Excel, Google Sheets, Zalo, Facebook, email, sổ tay mà người dùng dán vào. Mỗi tệp ghi nguồn gốc ở mục cuối.
- Mười hai kỹ năng, năm lĩnh vực, tên ASCII không dấu để an toàn đường dẫn, nội dung hoàn toàn tiếng Việt:
  - Mục tiêu: `muc-tieu-quy`, `ra-soat-tuan`.
  - Dự án: `ke-hoach-du-an`, `theo-doi-tien-do`, `bien-ban-hop`.
  - Bán hàng: `ho-so-khach-tiem-nang`, `de-xuat-bao-gia`, `theo-duoi-sau-gap`.
  - Marketing và nội dung: `ke-hoach-chien-dich`, `lich-noi-dung-tuan`, `viet-bai-giu-giong`.
  - Điều hành: `quy-tac-dieu-hanh`, kỹ năng meta, đồng thời là khối system context tĩnh mà plugin chèn (spec 0055).
- Cấu trúc cố định cho mười một kỹ năng chuyên môn: Khi nào dùng (kèm khi nào không và chuyển sang kỹ năng nào), Hỏi trước khi làm (một lượt hỏi, tối đa sáu câu, không đoán số), Quy trình (điểm dừng chờ duyệt trước việc tốn tiền hay gửi ra ngoài; bước cuối gọi `aifb_record_decision` khi người dùng chốt), Tiêu chuẩn đầu ra (tiếng Việt, một trang, "chưa có số" thay cho bịa), Ba ca mẫu (tình huống Việt Nam cụ thể, số giả định, tiêu chí chấm được đúng sai), Nguồn. Ba mươi ba ca mẫu là hạt giống của kho eval (đợt bốn).
- **Nơi cài.** Kỹ năng nằm trong `packages/harness-plugin/skills` và được lõi nạp như kỹ năng plugin (`skills: ["skills"]` trong manifest). Đây là điều chỉnh so với quyết định 3 (thư mục quản lý `<state>/skills`): cùng cơ chế nạp, cùng cơ chế giới hạn theo agent bằng `agents.<id>.skills`, nhưng phiên bản đi theo bản cài và không cần bước sao chép có kiểm tra đọc lại. Kỹ năng cùng tên ở tầng workspace hay tầng quản lý vẫn ghi đè được, nên người dùng nâng cao có đường tuỳ biến.
- Văn phong theo hồ sơ của Product Owner: xưng "anh chị", khẳng định trực tiếp, không "không phải... mà là", không gạch ngang dài, hai chấm chỉ trước danh sách, thuật ngữ dịch kèm tiếng Anh trong ngoặc lần đầu. Test khoá bằng máy những luật kiểm được.

## Bằng chứng

- `tests/unit/business-skills.test.mjs`: đúng mười hai thư mục, frontmatter hợp lệ và `name` trùng thư mục, mô tả dưới 200 ký tự, kích thước trong khoảng, sáu mục cố định, ba ca và ba bảng chấm, quy ước "chưa có số", ghi nguồn, không gạch ngang dài, không cấu trúc bị cấm, mọi kỹ năng dạy ghi sổ quyết định.
- Chất lượng nội dung chỉ là ý kiến cho tới khi có eval; vì thế mỗi kỹ năng sinh ra cùng ba ca chấm được từ ngày đầu.

## Chưa làm

Kỹ năng tài chính (dòng tiền, biên lợi nhuận, chốt tháng) có sẵn ở nguồn nhưng cố ý để đợt sau: cần ý kiến Product Owner về ranh giới với chương trình Chữa lành chấn thương tài chính và về lời cảnh báo không phải tư vấn tài chính.
