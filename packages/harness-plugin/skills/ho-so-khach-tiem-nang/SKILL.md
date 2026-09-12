---
name: ho-so-khach-tiem-nang
description: "Dựng chân dung một khách tiềm năng hoặc một nhóm khách mục tiêu gồm bối cảnh, nỗi đau, tiêu chí mua, người quyết định, bộ câu hỏi cho buổi gặp đầu và phân loại nóng ấm lạnh."
metadata: { "openclaw": { "emoji": "🧭" } }
---

# Hồ sơ khách tiềm năng

## Khi nào dùng

Dùng trước buổi gặp đầu tiên với một khách tiềm năng (lead), hoặc khi anh chị muốn hình dung rõ một nhóm khách mục tiêu trước khi đi tìm họ. Kỹ năng này biến những gì anh chị đã biết, từ tin nhắn Zalo, hồ sơ Facebook, trang web của khách, lời giới thiệu của người quen, thành một trang chân dung kèm bộ câu hỏi khai thác và một nhãn nóng, ấm hay lạnh có lý do. Không dùng để viết đề xuất hay báo giá, việc đó chuyển sang `de-xuat-bao-gia`. Không dùng để soạn tin nhắn theo dõi sau khi đã gặp, việc đó chuyển sang `theo-duoi-sau-gap`.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi mới làm. Không tự đoán quy mô, ngân sách hay tên người quyết định của khách.

1. Anh chị đang dựng chân dung cho một khách cụ thể hay cho một nhóm khách mục tiêu? Nếu là khách cụ thể, tên và họ làm gì?
2. Anh chị đã biết gì về họ? Dán mọi thứ có được, kể cả tin nhắn họ gửi, trang web, bài đăng Facebook, lời người giới thiệu kể lại.
3. Anh chị bán gì cho họ và mức giá thường dao động trong khoảng nào? Câu này để xét độ khớp, không dùng để định giá.
4. Khách đến từ đâu, họ tự tìm đến, được giới thiệu, hay anh chị chủ động tìm? Họ liên hệ lần cuối khi nào?
5. Anh chị đã từng bán cho khách nào giống họ chưa, kết quả ra sao?
6. Buổi gặp đầu dự kiến khi nào, gặp trực tiếp, gọi điện hay qua Zalo, và anh chị muốn kết thúc buổi đó với điều gì?

## Quy trình

1. Đọc toàn bộ tư liệu anh chị đưa và tách ra hai cột: điều đã biết chắc từ lời khách hoặc từ nguồn công khai, và điều anh chị suy đoán. Mọi dòng ở cột suy đoán phải được đánh dấu "giả định" trong hồ sơ. Nếu tư liệu quá mỏng, nói thẳng với anh chị rằng hồ sơ sẽ chủ yếu là câu hỏi, không phải kết luận.
2. Dựng phần bối cảnh gồm khách làm gì, quy mô ước đoán nếu có căn cứ, giai đoạn họ đang ở (mới mở, đang lớn, đang gặp khó, đang thay nhà cung cấp). Chỉ ghi quy mô khi có nguồn, ví dụ khách tự nói "bên em 12 người". Không tra cứu tự động; nếu anh chị muốn mô hình xem trang web hay bài đăng công khai, anh chị dán đường dẫn hoặc nội dung vào.
3. Liệt kê nỗi đau theo lời khách trước, dùng gần đúng cách họ nói. Với mỗi nỗi đau, ghi một dòng "khớp với anh chị ở chỗ nào" hoặc "chưa rõ có khớp không". Không gán cho khách nỗi đau mà họ chưa hề nhắc chỉ vì sản phẩm của anh chị giải quyết được nó.
4. Xác định tiêu chí mua và người quyết định. Hỏi anh chị xem người đang nhắn tin có phải người ký tiền không. Ghi rõ ba vai nếu biết: người liên hệ, người quyết định, người dùng sản phẩm. Vai nào chưa rõ ghi "chưa rõ" và đưa vào bộ câu hỏi khai thác.
5. Phân loại nóng, ấm hay lạnh dựa trên bốn dấu hiệu: khách có nói rõ nhu cầu chưa, có nhắc thời điểm hay hạn chưa, có nhắc ngân sách hoặc hỏi giá chưa, và lần liên hệ cuối cách đây bao lâu. Nóng khi có ít nhất ba dấu hiệu và liên hệ trong 7 ngày gần nhất. Ấm khi có một đến hai dấu hiệu. Lạnh khi chưa có dấu hiệu nào hoặc im lặng quá 30 ngày. Với mỗi nhãn, viết một câu lý do dẫn đúng dấu hiệu đã có, và một câu "điều gì sẽ làm nhãn này thay đổi".
6. Soạn bộ 5 đến 7 câu hỏi khai thác cho buổi gặp đầu, xếp từ dễ trả lời đến khó. Mỗi câu phải lấp một chỗ trống cụ thể trong hồ sơ, không hỏi điều khách đã nói. Ưu tiên câu mở về tình hình hiện tại, cách họ đang giải quyết, điều gì xảy ra nếu không đổi, ai cùng quyết định, và khung thời gian.
7. Ghép thành một trang và đưa anh chị duyệt. Hỏi "Anh chị thấy nhãn nóng, ấm, lạnh này đúng chưa, có dòng nào mô hình suy đoán sai không?". Không tự nhắn cho khách hay đặt lịch. Khi người dùng chốt một quyết định trong việc này, gọi công cụ `aifb_record_decision` để ghi vào sổ quyết định.

## Tiêu chuẩn đầu ra

Một trang tiếng Việt, đọc dưới 3 phút. Cấu trúc cố định: dòng tiêu đề có tên khách hoặc tên nhóm và ngày lập, dòng nhãn nóng, ấm, lạnh kèm một câu lý do, rồi năm mục theo thứ tự "Bối cảnh", "Nỗi đau", "Tiêu chí mua", "Người quyết định", "Câu hỏi cho buổi gặp đầu". Mỗi mục tối đa 4 gạch đầu dòng, riêng câu hỏi từ 5 đến 7 câu. Mỗi dòng suy đoán phải có chữ "giả định". Mọi số về quy mô, ngân sách, thời điểm chỉ lấy từ anh chị hoặc từ lời khách, không bịa số liệu, chỗ nào thiếu ghi "chưa có số". Không dùng lời đánh giá cảm tính về khách như "tiềm năng lớn" mà không có dấu hiệu đi kèm. Hỏi trước khi làm bất kỳ việc gì tốn tiền hoặc gửi ra ngoài. Báo cáo tiếng Việt một trang.

## Ba ca mẫu

### Ca 1: Xưởng mộc gia đình 5 người, khách hỏi qua Facebook
Đầu vào: Chủ xưởng dán đoạn chat Facebook. Khách viết "mình đang làm homestay 8 phòng ở Hội An, cần giường và tủ đồng bộ, tháng sau khai trương, tầm bao nhiêu một bộ vậy anh" (số giả định). Khách nhắn hôm qua.
Bối cảnh: Chủ xưởng chưa bao giờ làm cho homestay, chỉ quen làm đồ gia đình lẻ.
Đầu ra đạt chuẩn: Nhãn "nóng" với lý do khách nêu rõ nhu cầu, có hạn tháng sau, đã hỏi giá, liên hệ hôm qua. "Bối cảnh" ghi homestay 8 phòng theo lời khách. "Người quyết định" ghi "chưa rõ người nhắn có phải chủ homestay không". Câu hỏi khai thác gồm ngày khai trương chính xác, số bộ cần, có bản vẽ hay ảnh mẫu không, ai duyệt mẫu, có cần lắp tại chỗ không. Không đưa giá.
Tiêu chí chấm:
- Nhãn nóng dẫn đúng bốn dấu hiệu từ đoạn chat.
- Không tự ước giá một bộ giường tủ.
- Có câu hỏi về người quyết định vì hồ sơ chưa rõ.
- "Tháng sau" không bị đổi thành một ngày cụ thể.
- Có câu hỏi duyệt trước khi kết thúc.

### Ca 2: Công ty phần mềm 15 người, dựng chân dung nhóm khách mục tiêu
Đầu vào: Giám đốc mô tả miệng, mô hình gõ lại: "bọn anh muốn bán phần mềm quản lý kho cho các chuỗi cửa hàng mẹ và bé từ 3 đến 10 điểm bán, đã bán được cho 2 chuỗi, một chuỗi than kiểm kho mất cả ngày, một chuỗi đổi vì phần mềm cũ không xuất được báo cáo theo chi nhánh". Giá gói từ 3 đến 8 triệu một tháng (số giả định).
Bối cảnh: Đội kinh doanh 2 người cần một chân dung chung để lọc danh sách 40 chuỗi họ tự gom từ Facebook và Google Maps.
Đầu ra đạt chuẩn: Hồ sơ nhóm, không có nhãn nóng ấm lạnh cho từng khách, thay bằng một bộ tiêu chí để đội tự gắn nhãn cho 40 chuỗi. "Nỗi đau" dẫn đúng hai lời than của khách đã có. "Người quyết định" ghi "giả định: chủ chuỗi hoặc kế toán trưởng, cần xác nhận qua 2 khách hiện có". Bộ câu hỏi dùng chung cho buổi gặp đầu với bất kỳ chuỗi nào.
Tiêu chí chấm:
- Không bịa nỗi đau ngoài hai lời than đã có.
- Dòng người quyết định có chữ "giả định".
- Có bộ tiêu chí gắn nhãn thay vì gắn nhãn bừa cho 40 chuỗi.
- Không đề xuất giảm giá hay đổi gói.
- Trang dùng được ngay cho cả hai nhân viên kinh doanh.

### Ca 3: Huấn luyện viên cá nhân làm tự do, khách được giới thiệu qua Zalo
Đầu vào: Huấn luyện viên dán tin nhắn từ người giới thiệu: "chị bạn mình muốn tập lại sau sinh, hỏi em có nhận không", kèm số điện thoại. Khách chưa nhắn trực tiếp. Tin nhắn cách đây 3 tuần.
Bối cảnh: Huấn luyện viên đang đủ lịch, muốn biết có nên chủ động liên hệ không.
Đầu ra đạt chuẩn: Nhãn "ấm" với lý do có nhu cầu rõ qua lời giới thiệu, nhưng khách chưa liên hệ trực tiếp, chưa nhắc thời điểm hay ngân sách, và đã 3 tuần. Mục "Bối cảnh" phần lớn ghi "chưa có số" và "giả định". Câu hỏi khai thác mở đầu bằng câu nhẹ về mục tiêu của khách, sau mới tới lịch tập, khu vực, và điều khách lo nhất. Mô hình nêu rõ đây là quyết định của huấn luyện viên, không khuyên nên hay không nên liên hệ.
Tiêu chí chấm:
- Không gắn nhãn nóng chỉ vì có người giới thiệu.
- Không bịa thông tin về khách ngoài một câu của người giới thiệu.
- Bộ câu hỏi phù hợp với người mới tập lại, không dùng thuật ngữ chuyên môn.
- Không tự nhắn tin cho khách.
- Có gọi `aifb_record_decision` nếu huấn luyện viên chốt có liên hệ hay không.

## Nguồn
Chuyển thể từ `sales/skills/account-research`, `small-business/skills/lead-triage` và `sales/skills/call-prep` trong anthropics/knowledge-work-plugins (Apache 2.0).
