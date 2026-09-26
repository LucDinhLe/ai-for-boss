---
name: ban-tin-dau-tuan
description: "Soạn bản tin sáng thứ Hai một trang gồm tiền, doanh số, khách, việc tồn và ba việc đáng làm tuần này từ tệp Excel và báo cáo anh chị dán, dùng khi muốn mở tuần biết ngay phải nhìn vào đâu."
version: 1.0.0
author: Lê Đình Lực (AI for Boss)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [AI for Boss, Doanh nghiệp, Tiếng Việt]
    emoji: "☀️"
---

# Bản tin đầu tuần

## Khi nào dùng

Dùng vào sáng thứ Hai, hoặc tối Chủ nhật, khi anh chị muốn trong hai phút đọc là biết tuần này doanh nghiệp đang đứng ở đâu và nên dồn sức vào việc gì. Kỹ năng này gom tệp Excel, tệp xuất từ MISA, KiotViet, Sapo, Haravan, báo cáo sàn Shopee, TikTok Shop, Lazada, sao kê ngân hàng và vài dòng anh chị gõ thêm, rồi viết một trang gồm năm khối cố định là tiền, doanh số, khách, việc tồn và ba việc đáng làm tuần này. Bản tin nhìn về phía trước, số liệu tuần trước chỉ đóng vai mốc so sánh.

Không dùng để nhìn lại tuần đã qua xem làm được gì và kẹt ở đâu, việc đó chuyển sang `ra-soat-tuan`. Không dùng để định nghĩa một báo cáo có chỉ số, công thức và ngưỡng cố định chạy mỗi tháng hay mỗi quý, việc đó chuyển sang `bao-cao-dinh-ky`; nếu anh chị đã có báo cáo định kỳ hằng tuần, bản tin chỉ trích vài dòng kết luận của nó. Không dùng để viết báo cáo tiến độ gửi khách hay sếp, việc đó chuyển sang `theo-doi-tien-do`. Khi bản tin cho thấy tiền sắp hụt, chuyển sang `du-bao-dong-tien`; khi nợ quá hạn nổi lên, chuyển sang `nhac-cong-no`.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi mới làm. Thiếu nguồn nào thì bỏ khối đó và ghi tên nguồn thiếu ở cuối trang, không ước số thay.

1. Tuần này tính từ thứ Hai ngày nào? Anh chị muốn so với tuần trước, cùng kỳ tháng trước hay mục tiêu tháng?
2. Số dư tiền hiện có ở ngân hàng và tiền mặt là bao nhiêu, tuần trước là bao nhiêu? Dán sao kê, ảnh chụp ứng dụng ngân hàng hay gõ tay đều được.
3. Anh chị dán tệp doanh số tuần trước được không? Tệp xuất KiotViet, Sapo, MISA, báo cáo sàn hay bảng Excel tự ghi đều được, nói rõ tệp nào là nguồn chính để tránh cộng trùng một đơn hai lần.
4. Ai đang nợ anh chị và anh chị đang nợ ai sắp tới hạn? Có khoản chi lớn nào trong tuần như lương, tiền nhà, nhập hàng?
5. Về khách, tuần qua có khách mới, khách tiềm năng đang chờ báo giá, khiếu nại hay đánh giá xấu nào đáng chú ý không?
6. Việc tồn nào đang treo, ai đang chờ anh chị trả lời, và tuần này có lịch cứng nào như hẹn khách, hạn giao hàng, ngày lễ?

## Quy trình

1. Đọc từng nguồn anh chị đưa và ghi lại nguồn nào có, nguồn nào thiếu. Nếu anh chị đã có báo cáo lưu từ `bao-cao-dinh-ky` với nhịp hằng tuần, đọc định nghĩa đó trước và dùng đúng công thức đã chốt, không tự tính lại theo cách khác.
2. Tính khối tiền gồm số dư hiện có, chênh lệch so với tuần trước, tổng phải thu và phải trả trong bảy ngày tới. Dùng Python để cộng bảng khi dữ liệu dài. Mỗi con số ghi kèm nguồn, ví dụ "theo sao kê Vietcombank ngày 6/10".
3. Tính khối doanh số gồm doanh thu tuần, số đơn, giá trị đơn trung bình, so với mốc anh chị chọn. Kiểm ba lỗi hay gặp trước khi ghi số, gồm so một tuần thiếu ngày với một tuần đủ ngày, cộng trùng đơn sàn với tiền về tài khoản, và nhóm hàng hay kênh bán biến mất vì tuần này bằng không. Nhóm nào bằng không vẫn ghi số 0.
4. Viết khối khách gồm khách mới, khách tiềm năng đang nóng, khiếu nại và đánh giá xấu. Mỗi dòng có tên khách hoặc mã đơn và việc cần làm tiếp, không viết chung chung kiểu "một số khách phàn nàn".
5. Viết khối việc tồn gồm những việc quá hạn và những người đang chờ anh chị. Xếp theo thứ tự tiền trước, người chờ sau, việc nội bộ cuối.
6. Chọn ba việc đáng làm tuần này. Mỗi việc nêu lý do bằng một con số, một hạn chót hoặc một người đang chờ, kèm người làm và hạn trong tuần. Việc thứ nhất là việc quan trọng nhất, đặt riêng ở cuối trang với một câu giải thích vì sao chọn nó.
7. Trình bản tin cho anh chị đọc và hỏi "Anh chị kiểm giúp khối tiền và doanh số, có số nào lệch với sổ của mình không?". Sửa theo lời anh chị rồi mới lưu tệp. Nếu anh chị muốn gửi bản tin vào nhóm Zalo nội bộ hay email cho quản lý, soạn nháp và chờ "làm đi"; bản tin có số xấu như tiền giảm mạnh hay mất khách lớn thì hỏi lại trước khi gửi cho nhóm rộng.
8. Sau một lần anh chị thấy bản tin hữu ích, đề nghị một lần đặt lịch định kỳ bằng công cụ `cronjob`, ví dụ 7 giờ sáng thứ Hai hằng tuần, đọc tệp từ cùng thư mục và lưu bản tin theo tên có ngày. Chỉ tạo lịch khi anh chị đồng ý; anh chị từ chối thì không hỏi lại. Khi anh chị chốt một quyết định từ bản tin, gọi `aifb_record_decision`.

## Tiêu chuẩn đầu ra

Một trang tiếng Việt, đọc xong trong hai phút, gồm năm khối theo thứ tự "Tiền", "Doanh số", "Khách", "Việc tồn", "Ba việc đáng làm tuần này". Số đứng trước lời, mỗi con số có mốc so sánh và nguồn, tiền viết kiểu "48,6 triệu". Không bịa số, nguồn nào thiếu ghi một dòng gọn gàng ở cuối trang như "Chưa có số công nợ, cần tệp MISA", không xin lỗi nhiều lần. Ba việc cuối trang là việc cụ thể có người làm và hạn, không quá ba việc. Không tự gửi bản tin ra ngoài, không tự đặt lịch. Giọng ngang hàng, rõ ràng, không tô hồng khi số xấu.

## Ba ca mẫu

### Ca 1: Hộ kinh doanh mỹ phẩm bán cửa hàng và Shopee
Đầu vào: Chủ tiệm dán báo cáo Shopee tuần trước 126 đơn, doanh thu 41,2 triệu, tệp KiotViet cửa hàng 58 đơn, 22,4 triệu, số dư tài khoản 35,8 triệu, tuần trước 52,1 triệu (số giả định). Chủ tiệm gõ thêm tiền nhập hàng 30 triệu phải trả thứ Tư và có hai đánh giá một sao về giao chậm.
Bối cảnh: Chủ tiệm làm một mình với một nhân viên bán ca, không có phần mềm kế toán.
Đầu ra đạt chuẩn: Khối tiền ghi 35,8 triệu, giảm 16,3 triệu so với tuần trước, và cảnh báo sau khi trả 30 triệu thứ Tư chỉ còn 5,8 triệu nếu không có tiền về. Khối doanh số tách Shopee 41,2 triệu và cửa hàng 22,4 triệu, tổng 63,6 triệu, ghi rõ doanh thu Shopee là giá trị đơn chứ chưa phải tiền đã về tài khoản. Khối khách nêu hai đánh giá một sao kèm mã đơn. Việc thứ nhất là kiểm lịch tiền Shopee về trước thứ Tư và gợi ý chuyển sang `du-bao-dong-tien`.
Tiêu chí chấm:
- Phép trừ 16,3 triệu và số còn 5,8 triệu tính đúng.
- Không cộng trùng doanh thu Shopee với tiền về tài khoản.
- Có nêu nguồn cho từng con số.
- Ba việc có người làm và hạn trong tuần.
- Không tự gửi phản hồi cho khách đánh giá xấu.

### Ca 2: Công ty phân phối vật tư 35 người
Đầu vào: Kế toán gửi tệp MISA công nợ phải thu 1,24 tỷ, trong đó 380 triệu quá hạn trên 30 ngày thuộc ba khách, doanh số tuần 610 triệu so với trung bình bốn tuần 700 triệu, lương kỳ này 420 triệu trả ngày 10 (số giả định). Công ty đã có báo cáo tuần định nghĩa bằng `bao-cao-dinh-ky` gồm biên lợi nhuận gộp theo nhóm hàng.
Bối cảnh: Giám đốc đọc bản tin trên điện thoại trước giao ban 8 giờ.
Đầu ra đạt chuẩn: Khối tiền đặt khoản lương 420 triệu ngày 10 cạnh số dư và công nợ quá hạn. Khối doanh số ghi 610 triệu, thấp hơn 12,9 phần trăm so với trung bình bốn tuần, và trích một dòng biên lợi nhuận gộp từ báo cáo tuần đã có, không tính lại. Khối việc tồn nêu tên ba khách nợ quá hạn và số tiền từng khách. Việc thứ nhất là giao người gọi ba khách nợ trước ngày 10, gợi ý `nhac-cong-no`.
Tiêu chí chấm:
- Tỷ lệ giảm 12,9 phần trăm tính đúng.
- Dùng đúng số từ báo cáo định kỳ đã lưu, không tạo công thức mới.
- Tên khách và số tiền nợ cụ thể.
- Đọc được trên điện thoại, một trang.
- Hỏi trước khi gửi vào nhóm Zalo ban giám đốc.

### Ca 3: Kiến trúc sư làm tự do
Đầu vào: Kiến trúc sư gõ tay số dư 64 triệu, khách A còn nợ đợt hai 45 triệu hạn tuần này, hai khách tiềm năng đang chờ báo giá, một bản vẽ trễ hạn ba ngày (số giả định). Không có tệp doanh số.
Bối cảnh: Người làm một mình, muốn bản tin tự đến mỗi sáng thứ Hai.
Đầu ra đạt chuẩn: Bản tin có bốn khối, khối doanh số được thay bằng một dòng "Chưa có tệp doanh số, bản tin dựng từ số anh chị gõ tay". Việc thứ nhất là giao bản vẽ trễ hạn vì khách đó cũng là người sắp trả đợt hai 45 triệu. Hai khách tiềm năng được gợi ý chuyển sang `de-xuat-bao-gia`. Cuối bản tin có một câu hỏi có muốn đặt lịch `cronjob` 7 giờ sáng thứ Hai không.
Tiêu chí chấm:
- Không bịa số doanh số khi không có nguồn.
- Nối được bản vẽ trễ hạn với khoản thu 45 triệu.
- Chỉ đề nghị đặt lịch một lần, chờ đồng ý.
- Không quá ba việc đáng làm.
- Giọng ngang hàng, không hô hào.

## Nguồn
Chuyển thể từ `small-business/skills/monday-brief` và `small-business/skills/business-pulse` trong anthropics/knowledge-work-plugins (Apache 2.0). Phần kết nối QuickBooks, HubSpot, Stripe, Slack của bản gốc được thay bằng tệp xuất và dữ liệu dán tay theo bối cảnh Việt Nam.
