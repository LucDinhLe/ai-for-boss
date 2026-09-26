---
name: danh-thuc-khach-cu
description: "Tìm khách cũ lâu không quay lại bằng phân loại RFM từ tệp đơn hàng MISA, KiotViet, Sapo hay sàn, xếp theo giá trị quan hệ, soạn tin Zalo hỏi thăm có lý do thật và chỉ gửi khi anh chị duyệt."
version: 1.0.0
author: Lê Đình Lực (AI for Boss)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [AI for Boss, Doanh nghiệp, Tiếng Việt]
    emoji: "🔔"
---

# Đánh thức khách cũ

## Khi nào dùng

Dùng khi anh chị thấy khách quen thưa dần, muốn biết ai đã lâu không quay lại và nên nhắn ai trước. Kỹ năng này đọc tệp xuất đơn hàng từ MISA, KiotViet, Sapo, Haravan, báo cáo đơn Shopee, TikTok Shop, Lazada hoặc sổ bán hàng Excel, phân loại khách theo RFM (Recency là lần mua gần nhất, Frequency là tần suất mua, Monetary là tổng giá trị), tìm những người đã vắng lâu hơn nhịp mua quen của chính họ, xếp theo giá trị quan hệ, rồi soạn tin Zalo hỏi thăm có lý do thật cho từng người. Tin nhắn chỉ là bản nháp, anh chị duyệt từng đợt rồi mới gửi.

Không dùng cho khách mới hỏi chưa mua lần nào, việc đó chuyển sang `xep-hang-khach-tiem-nang`. Không dùng để dựng cả chuỗi chăm sóc tự động nhiều tuần cho toàn bộ tệp khách, việc đó chuyển sang `chuoi-cham-soc-email-zalo`. Khách rời đi sau một lời phàn nàn hay đánh giá xấu công khai thì chuyển sang `soan-phan-hoi-khach` hoặc `theo-doi-danh-gia-cong-khai` trước. Khi cần thiết kế ưu đãi kéo khách quay lại, dùng `thiet-ke-uu-dai-va-gia` để tính biên lợi nhuận trước.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi mới làm. Không tự bịa ưu đãi, không tự đoán lý do khách bỏ đi.

1. Anh chị gửi tệp xuất đơn hàng được không? Cần ít nhất mã hoặc tên khách, số điện thoại hoặc Zalo, ngày mua, giá trị đơn, sản phẩm đã mua. Nên lấy ít nhất 12 tháng.
2. Khách của anh chị thường quay lại sau bao lâu? Ví dụ cà phê hạt mỗi tháng, mỹ phẩm hai ba tháng, bảo dưỡng xe sáu tháng, nội thất vài năm.
3. Có khách nào anh chị biết rõ lý do đã ngừng mua, hoặc không muốn nhắn không? Ví dụ đã chuyển đi tỉnh khác, đã phàn nàn, là người quen.
4. Anh chị có thể đưa gì cho khách quay lại? Ví dụ quà nhỏ, giảm giá, ưu tiên lịch, sản phẩm mới, hoặc chỉ hỏi thăm chân thành. Không có gì cũng được.
5. Có gì mới thật sự từ lần cuối khách mua không? Sản phẩm mới, mùa hàng mới, dịch vụ thêm, chỗ đã cải thiện.
6. Tin nhắn gửi từ Zalo cá nhân, Zalo OA hay số điện thoại nào, và ai sẽ bấm gửi? Mỗi ngày gửi được bao nhiêu tin mà vẫn trả lời kịp?

## Quy trình

1. Đọc tệp bằng mã Python, giữ đúng tên cột. Kiểm tra cột ngày trước khi tính. Nếu rất nhiều đơn dồn vào một hai ngày, cột đó có thể là ngày nhập liệu thay vì ngày mua, dừng lại và hỏi anh chị cột ngày nào đúng. Gộp các dòng cùng một khách theo số điện thoại hoặc mã khách, ghi rõ cách gộp. Bỏ đơn huỷ và đơn hoàn nếu tệp có ghi.
2. Tính cho từng khách ba chỉ số gồm số ngày từ lần mua gần nhất, số lần mua, tổng giá trị. Tính thêm nhịp mua quen là khoảng cách trung bình giữa các lần mua của chính khách đó. Chấm mỗi chỉ số từ 1 đến 5 theo nhóm năm phần bằng nhau trong tệp, và điều chỉnh trọng số theo ngành anh chị nói ở câu 2, ví dụ hàng mua lặp lại thì tần suất nặng hơn, hàng giá trị cao mua thưa thì giá trị nặng hơn.
3. Chia nhóm khách gồm khách thân thiết đang mua đều, khách giá trị cao đang có dấu hiệu thưa, khách từng tốt đã vắng lâu, khách mua một lần rồi thôi, khách mới. Với tệp dưới khoảng 50 khách, nói rõ phân loại RFM chưa có nhiều ý nghĩa thống kê và chuyển sang xem từng người.
4. Tìm người đã vắng. Một khách được coi là vắng khi số ngày từ lần mua cuối vượt rõ nhịp mua quen của chính họ, ví dụ gấp đôi. Khách chỉ mua một lần thì so với nhịp chung anh chị nói. Không dùng một mốc chung cho mọi khách khi có dữ liệu nhịp riêng.
5. Xếp danh sách vắng theo giá trị quan hệ, tức tổng giá trị và số lần mua trước đây, rồi mới tới độ dài vắng. Mười lăm người đáng nhắn và nhắn được có ích hơn hai trăm người không ai theo. Khách có phàn nàn hoặc đánh giá xấu ngay trước khi ngừng mua được gắn cờ "nên gọi điện", không đưa vào đợt nhắn Zalo.
6. Đưa anh chị duyệt danh sách trước khi soạn chữ nào. Anh chị gạch những người không muốn liên hệ.
7. Soạn tin Zalo cho từng người đã duyệt, dưới 90 chữ, bằng giọng anh chị. Tin đầu tiên hỏi thăm có lý do thật lấy từ lịch sử của chính khách, như sản phẩm khách hay mua vừa về mùa mới, hay đã tới kỳ bảo dưỡng món khách mua năm ngoái, và hỏi thật lòng khách dạo này thế nào. Tin đầu không chào bán, không kèm mã giảm giá. Nếu anh chị có ưu đãi, để ở tin thứ ba kèm thời hạn rõ ràng. Tin thứ hai nói điều mới đã thay đổi. Mỗi người tối đa ba tin trong khoảng bốn tuần.
8. Đặt luật dừng. Khách trả lời bất kỳ điều gì thì dừng chuỗi và chuyển cho anh chị trả lời tay. Khách phàn nàn thì dừng ngay, không gửi tin tiếp, không gửi ưu đãi, chuyển sang `soan-phan-hoi-khach`. Khách bảo đừng nhắn nữa thì ghi lại để lần sau không nhắn.
9. Trình anh chị từng đợt kèm số tin, người nhận, tài khoản gửi. Hỏi "Anh chị duyệt đợt này gồm bao nhiêu tin, gửi từ tài khoản nào?". Duyệt tin thứ nhất chưa phải là duyệt tin thứ hai. Không tự gửi. Nếu anh chị muốn nhắc lịch gửi tin tiếp theo, đề xuất `cronjob` và chỉ tạo khi anh chị đồng ý.
10. Ghi sổ theo dõi gồm ai đã nhận tin nào, ngày nào, ai trả lời, ai dừng và vì sao, để lần sau không mở đầu bằng cùng một câu. Khi anh chị chốt danh sách, chốt ưu đãi hay chốt ngừng liên hệ một nhóm khách, gọi `aifb_record_decision` để ghi vào sổ quyết định.

## Tiêu chuẩn đầu ra

Báo cáo tiếng Việt một trang, mở đầu bằng số khách vắng tìm được và tổng giá trị họ từng mua, tiếp theo là bảng phân nhóm RFM với số lượng và phần doanh thu mỗi nhóm, rồi danh sách vắng xếp theo giá trị quan hệ có cột nhịp quen, số ngày vắng, cờ nếu có, cuối cùng là bản nháp tin Zalo cho từng người. Mọi con số tính từ tệp anh chị đưa. Lý do hỏi thăm lấy từ lịch sử mua thật, không bịa chuyện riêng của khách. Không bịa ưu đãi anh chị chưa đồng ý. Không gửi tin nào khi chưa có lời "làm đi". Số điện thoại khách chỉ dùng trong máy anh chị, không đưa lên dịch vụ ngoài. Bảng dài xuất thành tệp Excel bằng kỹ năng `xlsx`.

## Ba ca mẫu

### Ca 1: Tiệm cà phê hạt rang hộ kinh doanh, tệp KiotViet 14 tháng
Đầu vào: Chủ tiệm gửi tệp xuất KiotViet 2.300 đơn của 410 khách trong 14 tháng. Khách quen thường mua lại mỗi 25 đến 35 ngày. Chủ tiệm có thể tặng 100 gam hạt mới cho khách quay lại trong tháng này (số giả định).
Bối cảnh: Chủ tiệm cảm thấy doanh thu khách quen giảm nhưng không biết ai.
Đầu ra đạt chuẩn: Gộp khách theo số điện thoại, bỏ đơn huỷ. Tìm 58 khách vắng quá gấp đôi nhịp quen, xếp theo tổng giá trị, 15 người đầu từng mua trên 6 triệu mỗi người. Tin đầu nhắc đúng loại hạt khách hay mua và báo mẻ mới vừa rang, hỏi khách dạo này còn pha ở nhà không. Quà 100 gam chỉ xuất hiện ở tin thứ ba kèm hạn cuối tháng.
Tiêu chí chấm:
- Vắng tính theo nhịp riêng từng khách.
- Xếp theo giá trị trước độ dài vắng.
- Tin đầu không có quà hay giảm giá.
- Có luật dừng khi khách trả lời.
- Không tự gửi tin.

### Ca 2: Chuỗi ba cửa hàng phụ tùng xe máy 30 nhân viên, tệp MISA và Sapo
Đầu vào: Quản lý gửi hai tệp, một từ MISA cho khách sửa xe và một từ Sapo cho khách mua online. Có cột ngày ghi 60 phần trăm đơn vào cùng ngày 01/01 (số giả định). Công ty muốn nhắc khách tới kỳ bảo dưỡng sáu tháng.
Bối cảnh: Hai tệp có khách trùng nhau, dữ liệu ngày có dấu hiệu nhập hàng loạt.
Đầu ra đạt chuẩn: Dừng ở bước kiểm tra ngày và hỏi quản lý cột ngày nào là ngày mua thật, vì ngày 01/01 có thể là ngày nhập dữ liệu cũ. Sau khi có câu trả lời, gộp khách trùng theo số điện thoại qua hai tệp. Tin đầu nhắc đúng kỳ bảo dưỡng của món đã thay. Năm khách có phàn nàn trong ghi chú được gắn cờ "nên gọi điện" và tách khỏi đợt Zalo.
Tiêu chí chấm:
- Phát hiện cột ngày bất thường và hỏi trước khi tính.
- Gộp khách trùng giữa hai phần mềm và ghi rõ cách gộp.
- Khách phàn nàn không nằm trong đợt nhắn.
- Trình theo từng đợt kèm số tin và tài khoản gửi.
- Có gọi `aifb_record_decision` khi quản lý chốt danh sách.

### Ca 3: Nhiếp ảnh gia tự do, 38 khách chụp ảnh gia đình trong ba năm
Đầu vào: Nhiếp ảnh gia gửi sổ Excel 38 khách, mỗi dòng có ngày chụp, gói, giá. Khách thường chụp lại mỗi năm dịp sinh nhật con. Không có ưu đãi nào.
Bối cảnh: Tệp nhỏ, nhiếp ảnh gia muốn nhắn khách đã hai năm không chụp.
Đầu ra đạt chuẩn: Nói rõ tệp dưới 50 khách nên xem từng người thay vì chấm điểm RFM. Tìm 11 khách đã quá một năm kể từ buổi chụp cuối, xếp theo số buổi và tổng giá trị. Tin hỏi thăm nhắc đúng dịp sinh nhật con nếu sổ có ghi ngày, hỏi gia đình dạo này thế nào, không nhắc giá. Không có tin thứ ba về ưu đãi vì anh chị không có ưu đãi.
Tiêu chí chấm:
- Nhận ra tệp nhỏ và đổi cách làm.
- Không bịa ưu đãi.
- Lý do hỏi thăm lấy từ dữ liệu thật.
- Tin dưới 90 chữ, giọng tự nhiên.
- Báo cáo một trang, số khách vắng đứng đầu.

## Nguồn
Chuyển thể từ `small-business/skills/reactivate` trong anthropics/knowledge-work-plugins (Apache 2.0), `skills/sales/crm-rfm-analysis` và `skills/growth/churn-prevention` trong viethahong/business-skills (MIT), và `skills/churn-prevention` trong coreyhaines31/marketingskills (MIT).
