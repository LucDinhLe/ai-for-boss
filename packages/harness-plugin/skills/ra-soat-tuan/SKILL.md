---
name: ra-soat-tuan
description: "Biến danh sách việc tuần và số liệu thô thành một trang trả lời ba câu hỏi làm được gì, kẹt ở đâu, tuần sau ưu tiên gì, dùng vào cuối tuần hoặc sáng thứ Hai."
metadata: { "openclaw": { "emoji": "🔁" } }
---

# Rà soát tuần

## Khi nào dùng

Dùng vào chiều thứ Sáu hoặc sáng thứ Hai, khi anh chị có một mớ việc đã làm, số liệu rời rạc và cảm giác tuần trôi qua không rõ được mất. Kỹ năng này gom tất cả thành một trang trả lời ba câu hỏi: làm được gì, kẹt ở đâu, tuần sau ưu tiên gì. Không dùng để đặt mục tiêu dài hơn một tuần, việc đó chuyển sang `muc-tieu-quy`. Không dùng để viết báo cáo gửi khách hàng hay sếp, việc đó chuyển sang `theo-doi-tien-do`.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi mới làm. Không tự đoán con số, tên khách hay ngày nào.

1. Tuần này tính từ ngày nào đến ngày nào?
2. Anh chị dán danh sách việc đã làm và chưa làm trong tuần được không? Chép từ sổ tay, Zalo, Excel, email hay gõ tay đều được, không cần sắp xếp.
3. Anh chị có số nào của tuần này không, ví dụ doanh thu, số đơn, số khách mới, số tiền thu về, lượt tương tác? Nếu có số tuần trước để so thì càng tốt.
4. Tuần này có mục tiêu hay kết quả then chốt (key results) nào đang theo dõi không? Nếu đã dùng `muc-tieu-quy`, dán bảng đó vào.
5. Có việc nào bị kẹt, chờ ai đó, hoặc anh chị đang né tránh không?
6. Tuần sau có lịch cứng nào không, ví dụ hẹn khách, hạn giao hàng, nghỉ lễ?

## Quy trình

1. Đọc danh sách việc và phân thành ba nhóm: đã xong, đang dở, chưa đụng tới. Với việc đang dở, hỏi anh chị còn bao nhiêu phần trăm nếu chưa rõ. Không tự xếp việc nào là "xong" khi anh chị chỉ ghi "đang làm".
2. Đối chiếu số liệu tuần này với tuần trước nếu có cả hai. Tính mức tăng giảm theo phần trăm và ghi rõ số gốc. Nếu chỉ có số một tuần, ghi "chưa có số tuần trước để so" và không bình luận xu hướng. Đánh dấu bất kỳ con số nào thay đổi hơn 20 phần trăm để hỏi anh chị nguyên nhân.
3. Trả lời câu hỏi thứ nhất "làm được gì" bằng tối đa 3 gạch đầu dòng, ưu tiên việc đổi được số hoặc tiến gần kết quả then chốt. Bỏ qua việc vặt trừ khi anh chị muốn ghi nhận cho đội.
4. Trả lời câu hỏi thứ hai "kẹt ở đâu" bằng tối đa 3 gạch đầu dòng. Với mỗi chỗ kẹt, ghi rõ kẹt do ai hoặc do gì, đã kẹt bao lâu, và một hành động gỡ đề xuất. Nếu một việc kẹt hơn hai tuần liên tiếp, hỏi anh chị có muốn bỏ hẳn không thay vì chuyển tiếp mãi.
5. Trả lời câu hỏi thứ ba "tuần sau ưu tiên gì" bằng đúng 3 việc, xếp theo thứ tự, mỗi việc một dòng lý do. Ba việc này phải khớp với lịch cứng tuần sau và với kết quả then chốt nếu có. Nếu anh chị đưa hơn 3 việc, hỏi anh chị việc nào chờ được sang tuần sau nữa.
6. Ghép thành một trang và đưa anh chị duyệt. Hỏi "Anh chị đọc thấy đúng chưa, có muốn sửa dòng nào không?". Chỉ sau khi duyệt mới hỏi anh chị muốn lưu vào đâu hoặc chia sẻ cho ai; không tự gửi. Nếu trang có số xấu như doanh thu giảm mạnh hay khách rời đi, nhắc anh chị cân nhắc trước khi chia sẻ cho cả đội. Khi người dùng chốt một quyết định trong việc này, gọi công cụ `aifb_record_decision` để ghi vào sổ quyết định.

## Tiêu chuẩn đầu ra

Một trang tiếng Việt, đọc dưới 2 phút. Cấu trúc cố định: dòng tiêu đề có khoảng ngày, một dòng số liệu chính kèm so sánh tuần trước, rồi ba mục "Làm được gì", "Kẹt ở đâu", "Tuần sau ưu tiên gì", mỗi mục tối đa 3 gạch đầu dòng. Mọi số chỉ lấy từ anh chị cung cấp, không bịa số liệu, chỗ nào thiếu ghi "chưa có số". Không dùng lời khen sáo, mỗi gạch đầu dòng phải nêu được việc hoặc số cụ thể. Hỏi trước khi làm bất kỳ việc gì tốn tiền hoặc gửi ra ngoài. Báo cáo tiếng Việt một trang.

## Ba ca mẫu

### Ca 1: Quán cà phê một chủ, hai nhân viên
Đầu vào: Chủ quán dán tin nhắn Zalo tự nhắn cho mình trong tuần: "đổi nhà cung cấp sữa", "thử menu trà đào", "chưa gọi thợ sửa máy lạnh", "tuần này bán 14,2 triệu, tuần trước 16,8 triệu" (số giả định).
Bối cảnh: Trời mưa nhiều, chủ quán lo doanh thu giảm và muốn biết có nên chạy khuyến mãi không.
Đầu ra đạt chuẩn: Dòng số liệu ghi 14,2 triệu, giảm 15,5 phần trăm so với 16,8 triệu. "Làm được gì" ghi đổi nhà cung cấp sữa và thử menu trà đào. "Kẹt ở đâu" ghi máy lạnh chưa sửa, đề xuất gọi thợ trước thứ Ba. "Tuần sau ưu tiên gì" xếp sửa máy lạnh trước, theo dõi số bán trà đào, và ghi rõ chưa đủ dữ liệu để quyết định khuyến mãi, cần thêm một tuần số.
Tiêu chí chấm:
- Phần trăm giảm tính đúng từ hai số chủ quán đưa.
- Không tự kết luận doanh thu giảm do mưa khi chủ quán chưa xác nhận.
- Không đề xuất chi tiền khuyến mãi mà không hỏi.
- Đúng 3 việc ưu tiên tuần sau.
- Có câu hỏi duyệt trước khi lưu.

### Ca 2: Nhân viên kinh doanh trong công ty phần mềm 15 người
Đầu vào: Bảng Excel với 12 khách tiềm năng (lead), cột trạng thái, cột ngày liên hệ cuối, ghi chú 3 cuộc gọi demo đã làm và 1 hợp đồng 45 triệu ký xong (số giả định). Có bảng kết quả then chốt quý là 6 hợp đồng.
Bối cảnh: Sếp họp sáng thứ Hai, nhân viên cần nói trong 2 phút.
Đầu ra đạt chuẩn: "Làm được gì" ghi hợp đồng 45 triệu và 3 demo, kèm dòng tiến độ 1 trên 6 hợp đồng theo kết quả then chốt. "Kẹt ở đâu" nêu 4 lead quá 14 ngày không liên hệ, tính từ cột ngày liên hệ cuối, đề xuất gọi lại hoặc đóng. "Tuần sau ưu tiên gì" gồm theo sát 2 lead sau demo, gọi lại 4 lead cũ, chuẩn bị báo giá cho lead lớn nhất.
Tiêu chí chấm:
- Số lead quá 14 ngày đếm đúng từ cột ngày trong bảng.
- Có đối chiếu với kết quả then chốt 6 hợp đồng.
- Không bịa lý do vì sao lead im lặng.
- Trang đọc được trong 2 phút.
- Không tự gửi cho sếp.

### Ca 3: Xưởng mộc gia đình 5 người
Đầu vào: Chủ xưởng đọc miệng, mô hình gõ lại: xong bộ bàn ghế cho khách A, đang làm tủ bếp khách B được nửa, gỗ về trễ 4 ngày, thợ chính xin nghỉ 2 ngày tuần sau, tuần này thu 38 triệu, chưa nhớ tuần trước (số giả định).
Bối cảnh: Khách B đã hỏi tiến độ hai lần qua Zalo.
Đầu ra đạt chuẩn: Dòng số liệu ghi 38 triệu và "chưa có số tuần trước để so". "Kẹt ở đâu" ghi gỗ trễ 4 ngày ảnh hưởng tủ bếp khách B, đề xuất nhắn khách B ngày giao mới sau khi chủ xưởng xác nhận ngày. "Tuần sau ưu tiên gì" tính đến thợ chính nghỉ 2 ngày, xếp việc tủ bếp vào 3 ngày còn lại.
Tiêu chí chấm:
- Ghi "chưa có số tuần trước để so" thay vì đoán.
- Không tự đưa ngày giao mới cho khách B.
- Ưu tiên tuần sau có tính đến 2 ngày thợ nghỉ.
- Tin nhắn cho khách B chỉ được soạn nháp, chưa gửi.
- Có gọi `aifb_record_decision` khi chủ xưởng chốt ngày giao mới.

## Nguồn
Chuyển thể từ `small-business/skills/friday-brief` và `small-business/skills/monday-brief` trong anthropics/knowledge-work-plugins (Apache 2.0).
