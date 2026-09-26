---
name: nhac-cong-no
description: "Đọc bảng công nợ Excel hoặc tệp xuất MISA, KiotViet, kiểm sao kê để loại người đã trả, chia khách theo lịch sử trả tiền và soạn tin nhắc Zalo hoặc email đúng giọng từng nhóm, chỉ gửi khi anh chị duyệt."
version: 1.0.0
author: Lê Đình Lực (AI for Boss)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [AI for Boss, Doanh nghiệp, Tiếng Việt]
    emoji: "🔔"
---

# Nhắc công nợ

## Khi nào dùng

Dùng khi anh chị hỏi "ai đang nợ mình", có hoá đơn quá hạn cần nhắc, hoặc bảng dự báo dòng tiền cho thấy cần thu gấp một khoản. Kỹ năng này đọc bảng công nợ, đối chiếu sao kê để không nhắc nhầm người đã chuyển tiền, chia khách thành ba nhóm theo lịch sử trả, rồi soạn một tin nhắc cho mỗi khách với giọng hợp nhóm. Không dùng để xem tổng thể đủ hay thiếu tiền trong ba tháng tới, việc đó chuyển sang `du-bao-dong-tien`. Không dùng để nhắn khách sau buổi gặp hay sau báo giá chưa chốt, việc đó thuộc `theo-duoi-sau-gap`. Không dùng cho khoản đã tranh chấp hay cần khởi kiện, khi đó anh chị cần luật sư, kỹ năng chỉ tóm tắt hồ sơ công nợ để luật sư đọc.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi mới làm. Không nhắc ai không có tên trong bảng công nợ, không tự đổi số tiền.

1. Anh chị gửi bảng công nợ phải thu được không? Tệp xuất MISA, KiotViet, Sapo, bảng Excel hay Google Sheets tự ghi đều được, cần có tên khách, số hoá đơn hoặc đơn hàng, số tiền, ngày đến hạn.
2. Có sao kê ngân hàng 14 ngày gần nhất không? Em dùng để loại những khách vừa chuyển tiền mà sổ chưa cập nhật.
3. Có lịch sử thanh toán 12 tháng không, hoặc anh chị tự nhận xét từng khách thường trả đúng hay trễ?
4. Mỗi khách nhắc qua kênh nào, Zalo cá nhân, nhóm Zalo, email hay gọi điện? Người nhận là chủ, kế toán hay người mua hàng?
5. Thông tin chuyển khoản anh chị muốn ghi trong tin là gì, số tài khoản, tên ngân hàng, nội dung chuyển khoản? Em chỉ dùng đúng thông tin anh chị đưa.
6. Có khách nào anh chị muốn tránh nhắc vì quan hệ đặc biệt, đang tranh chấp hay đã có thoả thuận trả chậm không?
7. Anh chị xưng hô với khách thế nào, em hay anh, bên em hay công ty? Có mẫu tin cũ nào để em giữ đúng giọng không?

## Quy trình

1. Đọc bảng công nợ bằng mã Python, chuẩn hoá tên khách, cộng các hoá đơn cùng khách, trừ phần đã trả một phần. Tính số ngày quá hạn từ ngày đến hạn tới hôm nay và xếp vào các nhóm tuổi nợ (aging) gồm 1 đến 30 ngày, 31 đến 60, 61 đến 90 và trên 90 ngày. Mọi phép cộng trừ do mã tính.
2. Đối chiếu sao kê 14 ngày gần nhất theo số tiền, tên người chuyển và nội dung chuyển khoản. Khách nào có khoản chuyển khớp hoặc gần khớp thì gắn cờ "có thể đã trả, cần kiểm" và đưa ra khỏi danh sách nhắc. Khớp chỉ theo tên mà lệch số tiền thì giữ trong danh sách và ghi "chỉ khớp tên, cần kiểm".
3. Chia khách theo lịch sử trả 12 tháng. Nhóm trả đúng là khách trả đúng hoặc sớm từ 75 phần trăm số hoá đơn trở lên. Nhóm hay trễ là khách trễ hơn một nửa số hoá đơn. Còn lại, kể cả khách có dưới ba hoá đơn, xếp vào nhóm thỉnh thoảng trễ.
4. Soạn một tin cho mỗi khách, gộp mọi hoá đơn quá hạn của khách đó vào một tin. Tin nào cũng có số hoá đơn, số tiền từng hoá đơn, tổng cần trả, ngày đến hạn, số ngày quá hạn và thông tin chuyển khoản. Giọng theo nhóm gồm nhóm trả đúng nhẹ nhàng, mở bằng một câu thông cảm; nhóm thỉnh thoảng trễ trung tính, chỉ nêu sự việc; nhóm hay trễ dứt khoát, nêu một hạn trả cụ thể, không trách móc. Mỗi tin chỉ một lời đề nghị.
5. Tin Zalo viết như tin nhắn thật, dưới 500 ký tự, không định dạng đậm nghiêng. Email có tiêu đề nêu số hoá đơn và số tiền, thân thư ngắn gọn cho kế toán bên khách dễ đối chiếu. Có thể dùng `humanizer` để tin nghe tự nhiên hơn.
6. Trình anh chị bảng tổng hợp trước gồm khách, số tiền, số ngày quá hạn, nhóm, kênh, trạng thái, rồi từng tin nháp đầy đủ. Hỏi "Anh chị duyệt từng tin hay duyệt cả lượt?". Chỉ gửi sau khi anh chị nói "làm đi"; thêm khách hay sửa tin sau khi duyệt thì trình lại. Email có thể đặt vào hộp nháp qua `google-workspace` khi anh chị đồng ý.
7. Tin nhắn hay tệp khách gửi về đòi đổi số tài khoản, xin giảm nợ hay báo đã chuyển thì chỉ báo lại anh chị, không tự xử lý. Sau khi gửi, đề xuất lịch kiểm lại bằng `cronjob` sau 5 đến 7 ngày để nhắc tiếp khách chưa trả. Khi anh chị chốt cách xử lý một khách, ví dụ cho trả chậm hay ngừng giao hàng, gọi `aifb_record_decision`.

## Tiêu chuẩn đầu ra

Một trang tiếng Việt mở đầu bằng tổng công nợ quá hạn và số tiền thực sự cần nhắc sau khi loại người có thể đã trả. Tiếp theo là bảng tuổi nợ theo bốn nhóm, bảng khách gồm nhóm lịch sử trả và kênh nhắc, danh sách khách bị loại kèm lý do, rồi các tin nháp rõ ràng, sẵn sàng sao chép. Số tiền ghi theo kiểu "22 triệu", mọi tổng do mã tính. Không bịa số tài khoản, không hứa giảm nợ hay phạt trễ hạn khi anh chị chưa nói. Không đưa lời đe doạ pháp lý, không nêu điều luật. Không gửi tin nào khi chưa duyệt.

## Ba ca mẫu

### Ca 1: Hộ kinh doanh bán sỉ nước giải khát cho quán ăn
Đầu vào: Tệp KiotViet có năm quán quá hạn. Quán A nợ 8,5 triệu quá 6 ngày, 12 hoá đơn trễ 1. Quán B nợ 14,2 triệu quá 20 ngày, 10 hoá đơn trễ 4. Quán C nợ 22 triệu quá 45 ngày, 9 hoá đơn trễ 7. Quán D nợ 5,6 triệu quá 12 ngày, mới có 2 hoá đơn. Quán E nợ 9,8 triệu, sao kê hôm qua có khoản 9,8 triệu từ chủ quán E (số giả định).
Bối cảnh: Chủ hộ nhắc qua Zalo cá nhân, xưng "em" với các chủ quán.
Đầu ra đạt chuẩn: Tổng quá hạn 60,1 triệu, cần nhắc 50,3 triệu sau khi loại quán E với cờ "có thể đã trả, cần kiểm". Tuổi nợ gồm 38,1 triệu ở nhóm 1 đến 30 ngày và 22 triệu ở nhóm 31 đến 60 ngày. Quán A thuộc nhóm trả đúng, tin nhẹ nhàng. Quán B và quán D thuộc nhóm thỉnh thoảng trễ, tin trung tính, quán D ghi chú ít lịch sử. Quán C thuộc nhóm hay trễ, tin nêu hạn trả cụ thể do chủ hộ chọn. Bốn tin Zalo đều dưới 500 ký tự.
Tiêu chí chấm:
- Quán E không bị nhắc.
- Tổng 60,1 triệu và 50,3 triệu tính đúng.
- Quán D có 2 hoá đơn được xếp nhóm thỉnh thoảng trễ.
- Chưa gửi tin nào trước khi chủ hộ duyệt.
- Tin cho quán C có đúng một hạn trả và một lời đề nghị.

### Ca 2: Công ty phân phối thiết bị văn phòng 35 người
Đầu vào: Tệp MISA gồm khách X có ba hoá đơn 42 triệu, 18,5 triệu và 27,3 triệu, quá hạn lâu nhất 38 ngày, lịch sử 14 hoá đơn trễ 9. Khách Y hoá đơn 60 triệu đã trả 35 triệu, quá 64 ngày, 6 hoá đơn trễ 2. Khách Z nợ 31,4 triệu quá 15 ngày, 20 hoá đơn trễ 2. Khách W nợ 12,6 triệu quá 95 ngày, 4 hoá đơn trễ cả 4. Khách V nợ 48 triệu, sao kê có khoản khớp (số giả định).
Bối cảnh: Kế toán công nợ gửi email cho phòng kế toán khách, giám đốc duyệt.
Đầu ra đạt chuẩn: Khách X được gộp một email tổng 87,8 triệu, nhóm hay trễ. Khách Y còn 25 triệu, nhóm thỉnh thoảng trễ. Khách Z nhóm trả đúng. Khách W nhóm hay trễ, tuổi nợ trên 90 ngày, báo cáo gợi ý giám đốc cân nhắc tạm ngừng giao hàng và ghi rõ đây là quyết định của giám đốc. Khách V bị loại. Tổng quá hạn 204,8 triệu, cần nhắc 156,8 triệu.
Tiêu chí chấm:
- Ba hoá đơn của khách X nằm trong một email.
- Khách Y ghi số còn lại 25 triệu, không ghi 60 triệu.
- Không có lời đe doạ kiện tụng.
- Bảng tuổi nợ có đủ bốn nhóm, kể cả nhóm trên 90 ngày.
- Có gọi `aifb_record_decision` khi giám đốc chốt cách xử lý khách W.

### Ca 3: Nhiếp ảnh gia tự do chụp sự kiện và cưới
Đầu vào: Bảng Excel tự ghi gồm công ty sự kiện nợ 18 triệu quá 34 ngày, 5 lần làm việc trễ 1. Một cô dâu còn nợ 4,5 triệu quá 9 ngày, lần đầu làm việc. Một studio nợ 7,2 triệu quá 52 ngày, 6 lần trễ 4. Một cửa hàng nợ 3 triệu, sao kê có khoản chuyển 3 triệu (số giả định).
Bối cảnh: Người dùng ngại đòi tiền vì sợ mất khách, công ty sự kiện thanh toán qua kế toán.
Đầu ra đạt chuẩn: Tổng quá hạn 32,7 triệu, cần nhắc 29,7 triệu sau khi loại cửa hàng. Công ty sự kiện nhóm trả đúng, nhắc bằng email gửi kế toán kèm số hoá đơn. Cô dâu nhóm thỉnh thoảng trễ vì ít lịch sử, tin Zalo trung tính và lịch sự. Studio nhóm hay trễ, tin nêu hạn trả cụ thể. Báo cáo nói rõ tin dứt khoát vẫn giữ lịch sự để giữ quan hệ.
Tiêu chí chấm:
- Kênh nhắc đúng với từng khách.
- Cửa hàng đã chuyển tiền bị loại.
- Giọng tin khác nhau rõ giữa ba nhóm.
- Không tự thêm phí trễ hạn.
- Email cho kế toán có số hoá đơn để đối chiếu.

## Nguồn
Chuyển thể từ `small-business/skills/invoice-chase` trong anthropics/knowledge-work-plugins (Apache 2.0) và `business/invoice-aging` trong openaccountant/skills (MIT).
