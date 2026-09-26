---
name: ra-soat-duong-ong-ban-hang
description: "Rà đường ống bán hàng từ bảng Excel theo dõi khách, tính độ phủ, tuổi thương vụ, tỉ lệ chuyển, thương vụ nguy cơ, dữ liệu thiếu, dự báo doanh số ba mức và ra việc tuần này cho từng thương vụ."
version: 1.0.0
author: Lê Đình Lực (AI for Boss)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [AI for Boss, Doanh nghiệp, Tiếng Việt]
    emoji: "📊"
---

# Rà soát đường ống bán hàng

## Khi nào dùng

Dùng khi anh chị có một bảng theo dõi các thương vụ đang mở, thường là Excel, Google Sheets hoặc tệp xuất từ phần mềm bán hàng, và muốn biết tháng này hay quý này về được bao nhiêu tiền, thương vụ nào đang kẹt, tuần này phải làm gì. Kỹ năng này rà đường ống bán hàng (pipeline) theo từng giai đoạn, tính độ phủ so với chỉ tiêu, tuổi thương vụ, tỉ lệ chuyển giữa các giai đoạn, gắn cờ thương vụ nguy cơ và dòng thiếu dữ liệu, rồi dự báo doanh số theo ba mức chắc chắn, khả năng và lạc quan. Kỹ năng cũng tính thử con số thay đổi ra sao nếu một thương vụ lớn bị lùi hoặc mất.

Không dùng để xếp hạng khách mới hỏi chưa thành thương vụ, việc đó chuyển sang `xep-hang-khach-tiem-nang`. Không dùng để soạn tin nhắc một khách cụ thể, việc đó chuyển sang `theo-duoi-sau-gap`. Khi khách đang phản đối một điều cụ thể, chuyển sang `xu-ly-tu-choi`. Khi cần dự báo tiền mặt vào ra, gồm cả chi phí và công nợ, chuyển sang `du-bao-dong-tien`. Tổng kết cả tuần làm việc chung thì dùng `ra-soat-tuan`.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi mới làm. Không tự điền giá trị thương vụ hay ngày chốt còn trống.

1. Anh chị gửi bảng theo dõi thương vụ được không? Mỗi dòng nên có tên khách, giá trị, giai đoạn, ngày tạo, ngày dự kiến chốt, lần liên hệ gần nhất, bước tiếp theo, người phụ trách. Thiếu cột nào cứ gửi, tôi sẽ ghi rõ.
2. Các giai đoạn bán hàng của anh chị tên là gì, và thế nào thì một thương vụ được coi là qua giai đoạn đó? Ví dụ đã gặp, đã gửi báo giá, đã thương lượng, đã đặt cọc.
3. Chỉ tiêu doanh số kỳ này là bao nhiêu và kỳ tính là tháng hay quý? Đã chốt được bao nhiêu rồi?
4. Anh chị có dữ liệu các thương vụ đã đóng (thắng và thua) trong hai quý gần nhất không? Có thì tỉ lệ chuyển sẽ dựa trên số thật.
5. Thường mất bao lâu từ lúc khách hỏi tới lúc chốt? Giá trị một đơn trung bình khoảng bao nhiêu?
6. Anh chị có bản rà soát kỳ trước không? Có thì tôi so để thấy thương vụ nào tiến, lùi, mất.
7. Giai đoạn nào anh chị coi là chắc chắn, giai đoạn nào là khả năng?

## Quy trình

1. Đọc bảng bằng mã Python, giữ đúng tên cột và tên giai đoạn của anh chị. Nếu ngày hôm nay nằm ngoài khoảng ngày trong tệp, lấy ngày mới nhất trong tệp làm mốc và nói rõ mốc đã dùng.
2. Kiểm tra dữ liệu thiếu và sai trước khi tính. Gắn cờ những dòng có giá trị trống hoặc bằng 0, ngày chốt đã qua, bước tiếp theo trống, không liên hệ quá 14 ngày, chỉ có một người liên hệ bên khách, giai đoạn ghi "đã gửi báo giá" nhưng không có dấu vết báo giá. Liệt kê thành danh sách sửa để anh chị hoặc nhân viên tự cập nhật, không tự sửa tệp gốc.
3. Tổng hợp theo giai đoạn gồm số thương vụ, tổng giá trị, tuổi trung bình trong giai đoạn, số dòng bước tiếp theo trống, số dòng không liên hệ quá 14 ngày. Nếu không có ngày vào giai đoạn, tính tuổi từ ngày tạo và ghi rõ cách tính.
4. Tính tỉ lệ chuyển giữa các giai đoạn và tỉ lệ thắng từ dữ liệu hai quý trước. Nếu không có dữ liệu đó, ghi "chưa có số, dùng tỉ lệ anh chị ước" và hỏi anh chị con số ước, không tự đặt.
5. Tính độ phủ bằng tổng giá trị đường ống còn mở chia cho phần còn thiếu so với chỉ tiêu. Nêu mức tham khảo thường dùng là khoảng ba lần và nói rõ đây là mức tham khảo, mỗi ngành mỗi khác.
6. Gắn cờ thương vụ nguy cơ khi có ít nhất một dấu hiệu sau, gồm lâu không liên hệ, ngày chốt đã lùi từ hai lần, nằm trong giai đoạn lâu gấp đôi mức thường, chỉ một người liên hệ, có đối thủ đang chào giá, khách im lặng sau báo giá. Mỗi cờ có dẫn chứng từ dòng dữ liệu.
7. Dự báo doanh số ba mức. Mức chắc chắn gồm tiền đã về cộng các thương vụ ở giai đoạn anh chị coi là chắc chắn và không có cờ nguy cơ. Mức khả năng cộng thêm các thương vụ ở giai đoạn khả năng có liên hệ trong 14 ngày gần nhất. Mức lạc quan gồm toàn bộ đường ống mở có ngày chốt trong kỳ. Ghi rõ từng thương vụ nằm ở mức nào và vì sao.
8. Nếu có bản kỳ trước, so hai bản và liệt kê thương vụ tiến lên, lùi lại, mới thêm, đã mất. Thương vụ biến mất khỏi bản mới ghi "đã đóng hoặc bị xoá, chưa rõ kết quả" cho tới khi anh chị xác nhận, không mặc định là thắng.
9. Tính thử kịch bản lùi hoặc mất cho một đến ba thương vụ lớn nhất có cờ nguy cơ. Với mỗi kịch bản, nêu mức chắc chắn còn lại, khoảng thiếu so với chỉ tiêu, và những thương vụ nào thực tế có thể bù trong thời gian còn lại của kỳ. Thương vụ còn cần qua hai giai đoạn trong chưa tới hai tuần thì không tính là bù được.
10. Viết việc cần làm tuần này cho từng thương vụ nguy cơ và từng thương vụ trong mức chắc chắn, mỗi việc gồm ai làm, làm gì, trước ngày nào. Việc có giá trị tiền lớn nhất đứng đầu.
11. Đưa anh chị duyệt báo cáo. Hỏi "Anh chị xem giúp các thương vụ trong mức chắc chắn có đúng không, có thương vụ nào nên hạ xuống không?". Không tự gửi báo cáo cho ai, không tự sửa tệp theo dõi. Nếu anh chị muốn rà định kỳ mỗi sáng thứ Hai, đề xuất lịch bằng `cronjob` và chỉ tạo khi anh chị đồng ý. Khi anh chị chốt con số dự báo hay chốt bỏ một thương vụ, gọi `aifb_record_decision` để ghi vào sổ quyết định.

## Tiêu chuẩn đầu ra

Báo cáo tiếng Việt một trang, mở đầu bằng ba con số dự báo chắc chắn, khả năng, lạc quan cạnh chỉ tiêu và độ phủ. Tiếp theo là bảng theo giai đoạn, bảng thương vụ nguy cơ kèm cờ và việc cần làm, phần thay đổi so với kỳ trước, kịch bản lùi hoặc mất, cuối cùng là danh sách dữ liệu cần sửa. Tiền viết kiểu "90,4 triệu". Mọi con số tính từ tệp anh chị đưa, chỗ thiếu ghi "chưa có số", tỉ lệ ước ghi rõ là ước. Không tự sửa dữ liệu gốc, không gửi báo cáo ra ngoài khi chưa có lời "làm đi". Bảng chi tiết xuất thành tệp Excel bằng kỹ năng `xlsx` và nói rõ tệp nằm ở đâu.

## Ba ca mẫu

### Ca 1: Đại lý vật liệu xây dựng hộ gia đình, 14 công trình đang báo giá
Đầu vào: Chủ đại lý gửi bảng Google Sheets 14 dòng, mỗi dòng một công trình, có giá trị, ngày báo giá, lần gọi gần nhất. Chỉ tiêu tháng 1,2 tỉ, đã chốt 380 triệu (số giả định). Không có cột giai đoạn, không có dữ liệu thương vụ đã đóng.
Bối cảnh: Chủ đại lý tự theo dõi, muốn biết cuối tháng có đạt không.
Đầu ra đạt chuẩn: Ghi rõ không có cột giai đoạn nên đề xuất ba giai đoạn tạm là đã báo giá, đang thương lượng, đã cọc và hỏi chủ đại lý xếp từng dòng. Độ phủ bằng tổng 14 công trình chia 820 triệu còn thiếu. Tỉ lệ thắng ghi "chưa có số, dùng tỉ lệ anh chị ước". Năm công trình không gọi quá 14 ngày được gắn cờ, mỗi dòng có việc gọi lại trước thứ Năm.
Tiêu chí chấm:
- Không tự đặt tỉ lệ thắng.
- Phần còn thiếu 820 triệu tính đúng.
- Không tự xếp giai đoạn thay chủ đại lý.
- Có việc cụ thể cho từng thương vụ nguy cơ.
- Tiền viết đúng kiểu Việt Nam.

### Ca 2: Công ty dịch vụ vệ sinh công nghiệp 45 người, rà quý với ba nhân viên kinh doanh
Đầu vào: Trưởng phòng gửi tệp Excel 62 thương vụ đang mở, tệp thương vụ đã đóng hai quý trước, và bản rà soát tháng trước. Chỉ tiêu quý 4,5 tỉ, đã chốt 1,6 tỉ (số giả định). Hợp đồng lớn nhất 720 triệu với một khu công nghiệp, ngày chốt đã lùi hai lần.
Bối cảnh: Trưởng phòng cần báo cáo cho giám đốc sáng thứ Hai.
Đầu ra đạt chuẩn: Tỉ lệ chuyển tính từ dữ liệu hai quý trước. Ba mức dự báo có danh sách thương vụ trong từng mức. So với tháng trước, liệt kê bảy thương vụ tiến, bốn lùi, ba biến mất ghi "chưa rõ kết quả". Kịch bản mất hợp đồng 720 triệu cho thấy mức chắc chắn còn bao nhiêu và hai thương vụ có thể bù trong quý. 11 dòng thiếu ngày chốt nằm trong danh sách sửa.
Tiêu chí chấm:
- Thương vụ biến mất không bị coi là thắng.
- Kịch bản mất hợp đồng lớn có tính lại khoảng thiếu.
- Thương vụ cần qua hai giai đoạn trong chưa tới hai tuần không được tính bù.
- Không tự sửa tệp của trưởng phòng.
- Có gọi `aifb_record_decision` khi trưởng phòng chốt con số báo cáo.

### Ca 3: Kiến trúc sư tự do, 6 dự án thiết kế đang chờ khách quyết
Đầu vào: Kiến trúc sư gõ tay sáu dự án với giá trị từ 45 triệu tới 180 triệu, tổng 530 triệu, kèm ghi chú như "khách đang xin thêm ý kiến gia đình", "đã gửi phương án hai" (số giả định). Muốn có 300 triệu trong quý.
Bối cảnh: Làm một mình, không có bảng theo dõi, lo quý này hụt thu.
Đầu ra đạt chuẩn: Dựng bảng từ ghi chú và nói rõ thông tin nào chưa có. Độ phủ là 530 triệu chia 300 triệu, dưới mức tham khảo ba lần, nói rõ cần thêm dự án mới. Dự án 180 triệu có cờ vì khách im lặng sau khi nhận phương án hai. Việc tuần này là một cuộc gọi hỏi khách còn vướng điều gì, trỏ sang `xu-ly-tu-choi` nếu khách nêu phản đối.
Tiêu chí chấm:
- Không tự điền ngày chốt còn thiếu.
- Độ phủ tính đúng và có giải thích mức tham khảo.
- Có trỏ chéo sang kỹ năng phù hợp.
- Báo cáo một trang, dự báo đứng đầu.
- Không hứa con số chắc chắn khi dữ liệu mỏng.

## Nguồn
Chuyển thể từ `sales/skills/pipeline-review`, `sales/skills/deal-review`, `sales/skills/forecast`, `sales/skills/crm-hygiene-check` và `sales/skills/deal-slip-scenario` trong anthropics/knowledge-work-plugins (Apache 2.0).
