---
name: chuan-bi-chung-tu-cho-ke-toan
description: "Cuối tháng gom và đối chiếu hoá đơn điện tử, sao kê, phiếu thu chi, bảng lương, chỉ ra khoản thiếu hoá đơn, chưa khớp sao kê, chưa phân loại và lập câu hỏi cho kế toán; chỉ chuẩn bị tài liệu, không tư vấn thuế."
version: 1.0.0
author: Lê Đình Lực (AI for Boss)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [AI for Boss, Doanh nghiệp, Tiếng Việt]
    emoji: "🗂️"
---

# Chuẩn bị chứng từ cho kế toán

## Khi nào dùng

Dùng vào cuối tháng hoặc trước hạn kế toán cần nhận hồ sơ, khi anh chị muốn gửi một bộ chứng từ gọn gàng thay vì một túi hoá đơn lộn xộn. Kỹ năng này gom hoá đơn điện tử đầu vào và đầu ra, sao kê ngân hàng, phiếu thu chi, bảng lương, đối chiếu chúng với nhau, rồi chỉ ra khoản chi thiếu hoá đơn, khoản chưa khớp sao kê, khoản chưa phân loại và soạn danh sách câu hỏi cho kế toán. Đây là việc chuẩn bị tài liệu. Kỹ năng không tư vấn thuế, không nêu thuế suất, mức phạt hay khoản nào được trừ khi tính thuế, mọi kết luận về thuế do kế toán hoặc cơ quan thuế xác định. Không dùng để phân tích lãi lỗ hay vì sao lợi nhuận giảm, việc đó chuyển sang `phan-tich-lai-lo`. Không dùng để đòi khách nợ tiền, việc đó thuộc `nhac-cong-no`.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi mới làm. Không tự sửa sổ sách, không tự đổi tên hay xoá tệp gốc.

1. Anh chị chuẩn bị cho tháng nào? Kế toán là người trong công ty hay dịch vụ kế toán bên ngoài, họ muốn nhận hồ sơ theo mẫu nào và trước ngày nào?
2. Anh chị gửi danh sách hoá đơn điện tử đầu vào và đầu ra được không? Tệp tải từ cổng hoá đơn điện tử, tệp xuất MISA, hoặc thư mục tệp XML và PDF đều được.
3. Có sao kê của tất cả tài khoản ngân hàng dùng cho kinh doanh trong tháng không, kể cả tài khoản cá nhân có dùng chung?
4. Chi tiền mặt có phiếu chi hay sổ ghi không? Có ảnh chụp biên nhận, hoá đơn bán lẻ nào chưa gom không?
5. Bảng lương tháng này gồm những ai, trả qua ngân hàng hay tiền mặt, có bảng chấm công kèm không?
6. Doanh thu ghi ở đâu, KiotViet, Sapo, Haravan, báo cáo sàn Shopee, TikTok Shop, Lazada hay sổ tay? Có đơn nào đã bán mà chưa xuất hoá đơn không?
7. Anh chị đang phân loại chi phí theo nhóm nào, hay để em đề xuất danh mục để anh chị và kế toán sửa?

## Quy trình

1. Lập danh mục hồ sơ tháng bằng mã Python, liệt kê từng loại chứng từ đã có và loại còn thiếu so với danh sách kế toán yêu cầu. Không đổi tên, không di chuyển tệp gốc, chỉ tạo bản sao và bảng tổng hợp trong thư mục làm việc.
2. Làm sạch sao kê. Tách các khoản chuyển nội bộ giữa các tài khoản của chính anh chị để không tính trùng. Với tài khoản cá nhân dùng chung, đánh dấu từng khoản là "kinh doanh", "cá nhân" hoặc "cần anh chị xác nhận", không tự đoán.
3. Đối chiếu chi bằng mã Python, ghép từng khoản chi trên sao kê và phiếu chi với hoá đơn đầu vào theo số tiền, ngày và tên người bán. Kết quả chia ba nhóm gồm khớp, có tiền ra mà chưa có hoá đơn, có hoá đơn mà chưa thấy tiền ra. Khoản trùng số tiền, trùng người nhận trong vài ngày thì gắn cờ "có thể trùng".
4. Đối chiếu thu, so hoá đơn đầu ra với doanh thu trên phần mềm bán hàng hoặc báo cáo sàn và tiền về tài khoản. Liệt kê đơn đã bán chưa xuất hoá đơn, hoá đơn đã xuất chưa thu tiền, tiền về chưa rõ của khách nào.
5. Đối chiếu bảng lương với sao kê chi lương và phiếu chi tiền mặt, nêu chênh lệch theo từng người. Phần này chỉ kiểm số tiền đã trả khớp bảng lương, việc tính bảo hiểm hay thuế thu nhập cá nhân để kế toán làm.
6. Phân loại chi phí theo danh mục anh chị và kế toán đã chọn. Khoản có nội dung chuyển khoản mơ hồ đưa vào nhóm "chưa phân loại" kèm lý do. Không ghi nhận xét khoản nào được hay không được trừ khi tính thuế.
7. Soạn danh sách câu hỏi cho kế toán, mỗi câu gắn với một khoản cụ thể gồm ngày, số tiền, nội dung, ví dụ "khoản 8,4 triệu ngày 12 trả cho người bán rau không có hoá đơn, anh chị kế toán cần chứng từ gì thay thế?". Không tự trả lời các câu hỏi về thuế.
8. Trình anh chị bản tóm tắt và danh sách việc cần bổ sung trước khi gửi. Hỏi "Anh chị xem giúp các khoản đánh dấu cá nhân và chưa phân loại, có đúng không?". Chỉ gửi hồ sơ cho kế toán qua email hay Zalo sau khi anh chị nói "làm đi". Bảng đối chiếu xuất qua `xlsx`, tệp PDF gộp qua `pdf`. Nếu anh chị muốn làm đều mỗi tháng, đề xuất lịch nhắc bằng `cronjob` vào ngày anh chị chọn. Khi anh chị chốt cách xử lý một khoản, gọi `aifb_record_decision`.

## Tiêu chuẩn đầu ra

Một trang tiếng Việt mở đầu bằng tình trạng hồ sơ, ví dụ "đủ 51 trên 64 khoản chi, còn 9 khoản thiếu hoá đơn 39,2 triệu và 4 khoản chưa rõ nội dung 17 triệu". Kèm theo là bảng đối chiếu chi, bảng đối chiếu thu, bảng đối chiếu lương, danh sách khoản chưa phân loại, danh sách việc anh chị cần bổ sung, và danh sách câu hỏi cho kế toán. Mọi tổng do mã tính, số tiền ghi theo kiểu "39,2 triệu". Ghi rõ ở đầu báo cáo rằng đây là tài liệu chuẩn bị, mọi kết luận về thuế và hạch toán do kế toán xác nhận. Không nêu thuế suất, mức phạt hay số điều luật. Không sửa dữ liệu gốc, không gửi gì khi chưa duyệt.

## Ba ca mẫu

### Ca 1: Hộ kinh doanh quán ăn gia đình
Đầu vào: Sao kê tháng có 64 khoản chi tổng 318,6 triệu, thư mục hoá đơn đầu vào tải từ cổng hoá đơn điện tử, ảnh chụp vài biên nhận chợ đầu mối (số giả định).
Bối cảnh: Chủ quán gửi hồ sơ cho dịch vụ kế toán bên ngoài, thường bị hỏi lại nhiều lần.
Đầu ra đạt chuẩn: 51 khoản khớp hoá đơn tổng 262,4 triệu. 9 khoản có tiền ra chưa có hoá đơn tổng 39,2 triệu, lớn nhất 8,4 triệu. 4 khoản nội dung chuyển khoản mơ hồ tổng 17 triệu đưa vào nhóm chưa phân loại. Danh sách việc cần làm gồm xin hoá đơn từ các người bán còn thiếu và chủ quán ghi chú bốn khoản mơ hồ. Câu hỏi cho kế toán nêu từng khoản thiếu hoá đơn và hỏi chứng từ thay thế, không tự nói khoản nào được tính chi phí.
Tiêu chí chấm:
- Tổng 262,4 cộng 39,2 cộng 17 bằng đúng 318,6 triệu.
- Không nêu thuế suất hay mức phạt.
- Mỗi câu hỏi gắn với khoản cụ thể.
- Chưa gửi hồ sơ trước khi chủ quán duyệt.
- Bốn khoản mơ hồ không bị tự gán nhóm chi phí.

### Ca 2: Công ty thương mại 36 người dùng MISA
Đầu vào: Hoá đơn đầu ra trên cổng hoá đơn điện tử tổng 1.846,5 triệu, doanh thu trên sổ bán hàng MISA 1.872,3 triệu. Bảng lương 36 người tổng 612 triệu, sao kê chi lương 598,4 triệu, hai phiếu chi tiền mặt 7,2 triệu và 6,4 triệu (số giả định).
Bối cảnh: Kế toán trưởng muốn nhận bộ hồ sơ đối chiếu trước ngày 5.
Đầu ra đạt chuẩn: Doanh thu lệch 25,8 triệu, khớp đúng hai đơn đã giao chưa xuất hoá đơn 15,3 triệu và 10,5 triệu, báo cáo nêu tên hai đơn và hỏi kế toán cách xử lý. Lương lệch 13,6 triệu, khớp hai người nhận tiền mặt, danh sách việc ghi cần phiếu chi có chữ ký người nhận. Báo cáo không tự tính bảo hiểm hay thuế thu nhập cá nhân.
Tiêu chí chấm:
- Chênh lệch 25,8 triệu và 13,6 triệu tính đúng và giải thích được bằng khoản cụ thể.
- Không tự kết luận về nghĩa vụ thuế của hai đơn chưa xuất hoá đơn.
- Bảng đối chiếu lương theo từng người.
- Không sửa số liệu trong MISA, chỉ lập bảng đối chiếu riêng.
- Có gọi `aifb_record_decision` khi kế toán trưởng chốt cách xử lý.

### Ca 3: Người dạy tiếng Anh tự do dùng tài khoản cá nhân
Đầu vào: Sao kê tài khoản cá nhân có năm khoản thu từ lớp học 18 triệu, 15,5 triệu, 12 triệu, 11 triệu và 8 triệu, một khoản 12 triệu không rõ người chuyển, cùng nhiều khoản chi tiêu gia đình (số giả định).
Bối cảnh: Người dùng lần đầu thuê kế toán, muốn biết cần đưa những gì.
Đầu ra đạt chuẩn: Thu công việc đã xác định 64,5 triệu, thêm khoản 12 triệu đánh dấu "cần anh chị xác nhận", nếu là thu công việc thì tổng 76,5 triệu. Chi tiêu gia đình tách riêng, không đưa vào hồ sơ. Câu hỏi cho kế toán gồm nên mở tài khoản riêng cho công việc không, cần lưu hợp đồng hay tin nhắn thoả thuận với học viên thế nào, và nghĩa vụ kê khai của người dạy tự do ra sao. Báo cáo không tự nêu mức thuế.
Tiêu chí chấm:
- Khoản 12 triệu không bị tự gán là thu công việc.
- Tổng 64,5 triệu và 76,5 triệu tính đúng.
- Không đưa chi tiêu gia đình vào hồ sơ gửi kế toán.
- Giọng ngang hàng, dễ hiểu với người chưa quen kế toán.
- Câu hỏi về kê khai được chuyển cho kế toán, không tự trả lời.

## Nguồn
Chuyển thể từ `small-business/skills/month-end-prep`, `small-business/skills/close-month`, `small-business/skills/tax-season-organizer`, `finance/skills/reconciliation` và `finance/skills/close-management` trong anthropics/knowledge-work-plugins (Apache 2.0), `skills/finance/expense-classification` trong viethahong/business-skills (MIT).
