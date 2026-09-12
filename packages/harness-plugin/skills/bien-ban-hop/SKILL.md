---
name: bien-ban-hop
description: "Biến ghi chú thô, bản gỡ băng hoặc tin nhắn nhóm sau một buổi họp thành biên bản một trang gồm quyết định, việc cần làm, người làm, hạn và câu hỏi còn mở."
metadata: { "openclaw": { "emoji": "📝" } }
---

# Biên bản họp

## Khi nào dùng

Dùng ngay sau một buổi họp nội bộ, buổi gặp khách hay cuộc gọi, khi anh chị có ghi chú viết vội, bản gỡ băng (transcript) từ ứng dụng họp trực tuyến, hoặc một chuỗi tin nhắn trong nhóm Zalo mà chưa ai chốt lại. Kỹ năng này gom tất cả thành một trang để mọi người cùng nhìn một bản và không cãi nhau về việc ai đã hứa gì. Không dùng để viết tin nhắn theo dõi gửi khách sau buổi gặp, việc đó chuyển sang `theo-duoi-sau-gap`. Không dùng để tổng hợp tiến độ nhiều tuần của một dự án, việc đó chuyển sang `theo-doi-tien-do`.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi mới làm. Không tự đoán tên người, ngày hạn hay con số nào không có trong ghi chú.

1. Anh chị dán ghi chú, bản gỡ băng hoặc tin nhắn nhóm vào được không? Lộn xộn cũng được, không cần sắp xếp.
2. Buổi họp diễn ra ngày nào, về việc gì, kéo dài bao lâu nếu anh chị nhớ?
3. Ai có mặt? Ghi tên và vai trò, ví dụ "chị Hoa kế toán", "anh Tuấn bên khách hàng". Nếu trong ghi chú có tên viết tắt hay biệt danh, cho biết đó là ai.
4. Biên bản này gửi cho ai đọc, chỉ nội bộ hay có gửi khách? Điều này quyết định giọng viết và nội dung nào nên bỏ.
5. Có việc nào đã được giao rõ người và hạn trong buổi họp không? Nếu có, anh chị kể ra để đối chiếu với ghi chú.
6. Có điểm nào anh chị muốn nhấn mạnh hoặc chắc chắn không được sót?

## Quy trình

1. Đọc toàn bộ đầu vào một lượt và tách thành bốn loại: quyết định đã chốt, việc cần làm, câu hỏi còn mở, và thông tin nền chỉ để tham khảo. Một câu chỉ được xếp vào "quyết định" khi trong ghi chú có dấu hiệu chốt rõ, ví dụ "thống nhất", "chốt", "ok làm vậy", "đồng ý". Câu kiểu "hay là mình thử..." hoặc "để xem lại" xếp vào câu hỏi còn mở, không nâng lên thành quyết định.
2. Với mỗi việc cần làm, tìm trong đầu vào ba thứ: việc gì, ai làm, hạn nào. Chỗ nào thiếu, ghi rõ "chưa rõ người làm" hoặc "chưa có hạn". Tuyệt đối không tự điền tên người có mặt vào việc chưa ai nhận, và không tự suy ra hạn từ những câu như "sớm" hay "tuần sau".
3. Lập danh sách các chỗ chưa rõ và hỏi anh chị trong một lượt để xác nhận tên người và hạn. Nêu rõ từng điểm, ví dụ "Việc gọi lại nhà cung cấp bao bì, ghi chú không nói ai làm, anh chị giao cho ai?" hoặc "Anh Tuấn nói gửi bản vẽ tuần sau, anh chị muốn ghi hạn là ngày nào?". Chờ anh chị trả lời rồi mới điền. Nếu anh chị nói "cứ để trống", giữ nguyên chữ "chưa có".
4. Nếu đầu vào là bản gỡ băng dài, chỉ lấy ý, không chép lại lời thoại. Được trích nguyên văn tối đa một câu khi câu đó là lời cam kết quan trọng của khách hoặc của đối tác, kèm tên người nói. Bỏ hết phần chào hỏi, chuyện ngoài lề và những đoạn nói đi nói lại.
5. Nếu biên bản có gửi ra ngoài cho khách hay đối tác, bỏ những dòng chỉ dành cho nội bộ, ví dụ nhận xét về khách, giá vốn, mâu thuẫn trong đội. Hỏi anh chị có muốn giữ hai bản, một bản nội bộ đầy đủ và một bản gửi khách đã lược, hay không.
6. Ghép thành một trang theo cấu trúc cố định ở mục Tiêu chuẩn đầu ra và đưa anh chị duyệt. Hỏi "Anh chị đọc thấy đúng chưa, có việc nào sai người hoặc sai hạn không?". Chỉ sau khi duyệt mới hỏi anh chị muốn lưu ở đâu hoặc gửi cho ai; không tự gửi vào nhóm Zalo hay email. Khi người dùng chốt một quyết định trong việc này, gọi công cụ `aifb_record_decision` để ghi vào sổ quyết định.

## Tiêu chuẩn đầu ra

Một trang tiếng Việt, đọc dưới 2 phút. Cấu trúc cố định gồm dòng tiêu đề có tên buổi họp và ngày, một dòng người tham dự, rồi bốn mục theo thứ tự: "Quyết định đã chốt" (mỗi dòng một quyết định, nêu ai chốt nếu biết), "Việc cần làm" (bảng ba cột việc, người làm, hạn), "Câu hỏi còn mở" (mỗi dòng một câu và ai cần trả lời), "Ghi chú thêm" (tối đa 3 dòng, chỉ khi thật cần). Mọi tên người, hạn và con số chỉ lấy từ đầu vào hoặc từ câu trả lời xác nhận của anh chị, không bịa số liệu, chỗ nào thiếu ghi "chưa có số", "chưa rõ người làm" hoặc "chưa có hạn". Không thêm việc mà buổi họp không nhắc tới, kể cả khi thấy hợp lý. Hỏi trước khi làm bất kỳ việc gì tốn tiền hoặc gửi ra ngoài. Báo cáo tiếng Việt một trang.

## Ba ca mẫu

### Ca 1: Tiệm spa ở Đà Lạt, 6 nhân viên, họp đầu tuần qua nhóm Zalo
Đầu vào: Chủ tiệm dán 40 tin nhắn trong nhóm Zalo sáng thứ Hai. Trong đó có "chốt tháng này chạy gói chăm sóc da mùa lạnh 890 nghìn" (số giả định), "Linh xem lại lịch ca tối", "ai gọi bên giặt khăn nhắc giao đúng giờ nhé", "thứ Năm nghỉ sửa điện".
Bối cảnh: Chủ tiệm muốn dán lại một bản gọn trong nhóm để nhân viên khỏi hỏi đi hỏi lại.
Đầu ra đạt chuẩn: "Quyết định đã chốt" ghi gói 890 nghìn và nghỉ thứ Năm sửa điện. "Việc cần làm" có dòng Linh xem lịch ca tối với hạn "chưa có hạn", và dòng gọi bên giặt khăn với người làm "chưa rõ người làm". Mô hình hỏi chủ tiệm hai điểm này trước khi hoàn tất. "Câu hỏi còn mở" ghi ngày sửa điện xong có mở lại đúng thứ Sáu không.
Tiêu chí chấm:
- Không tự gán việc gọi bên giặt khăn cho một nhân viên nào.
- Gói 890 nghìn được xếp vào quyết định vì có chữ "chốt".
- Có lượt hỏi xác nhận người làm và hạn trước khi đưa bản cuối.
- Không tự dán vào nhóm Zalo.
- Bản gọn dưới một trang, đọc được trên điện thoại.

### Ca 2: Công ty phần mềm 15 người, bản gỡ băng cuộc gọi với khách
Đầu vào: Bản gỡ băng 50 phút từ cuộc gọi trực tuyến giữa trưởng dự án, một lập trình viên và hai người bên khách. Khách nói "bên em cần bản demo trước ngày 25", "phần báo cáo xuất Excel là bắt buộc", "ngân sách tầm 120 triệu thì phải xin thêm" (số giả định), có nhiều đoạn bàn về giao diện chưa ngã ngũ.
Bối cảnh: Trưởng dự án cần một bản gửi nội bộ và một bản gửi khách xác nhận lại.
Đầu ra đạt chuẩn: Bản nội bộ ghi quyết định demo trước ngày 25, xuất Excel là bắt buộc, và câu hỏi còn mở về giao diện cùng ngân sách 120 triệu kèm trích nguyên văn "phải xin thêm" gắn tên người nói. Bản gửi khách bỏ dòng ngân sách nếu trưởng dự án yêu cầu, giữ quyết định và việc hai bên cần làm. Việc "chuẩn bị demo" ghi người làm "chưa rõ" cho tới khi trưởng dự án xác nhận là lập trình viên nào.
Tiêu chí chấm:
- Phần giao diện được xếp vào câu hỏi còn mở, không thành quyết định.
- Chỉ trích nguyên văn một câu và có tên người nói.
- Có hai bản, bản gửi khách đã lược phần nội bộ theo ý người dùng.
- Ngày 25 không bị tự gắn thêm tháng và năm khi bản gỡ băng không nói.
- Có câu hỏi duyệt trước khi gửi.

### Ca 3: Giảng viên tự do bán khoá học online, ghi chú tay sau buổi gặp đối tác
Đầu vào: Giảng viên gõ lại 12 dòng ghi chú sau buổi cà phê với một đơn vị đào tạo: "họ muốn mua sỉ 30 suất", "giá còn bàn", "mình gửi đề cương", "họ hỏi có xuất hoá đơn không", "gặp lại sau khi họ họp nội bộ".
Bối cảnh: Giảng viên làm một mình, không có ai khác để giao việc, muốn có bản ghi để nhớ mình đã hứa gì.
Đầu ra đạt chuẩn: "Quyết định đã chốt" chỉ có một dòng về việc gặp lại sau khi đối tác họp nội bộ, kèm "chưa có hạn". "Việc cần làm" ghi giảng viên gửi đề cương và trả lời câu hỏi hoá đơn, hạn để "chưa có hạn" cho tới khi giảng viên tự chốt. "Câu hỏi còn mở" ghi giá cho 30 suất và việc xuất hoá đơn. Mô hình không đề xuất mức giá nào.
Tiêu chí chấm:
- "Mua sỉ 30 suất" không bị ghi thành quyết định vì giá còn bàn.
- Không đưa ra giá gợi ý cho 30 suất.
- Người làm tất cả các việc là giảng viên, có hỏi hạn trước khi điền.
- Có gọi `aifb_record_decision` khi giảng viên chốt ngày gửi đề cương.
- Trang ngắn, không có mục để trống mà không ghi lý do.

## Nguồn
Chuyển thể từ `sales/skills/call-summary` và `product-management/skills/synthesize-research` trong anthropics/knowledge-work-plugins (Apache 2.0).
