---
name: chuoi-cham-soc-email-zalo
description: "Thiết kế chuỗi chăm sóc tự động qua email và Zalo OA (chào mừng, nuôi dưỡng, sau mua, nhắc giỏ, hỏi thăm lại) gồm thời điểm, nội dung từng tin, rẽ nhánh, điều kiện dừng và chỉ số theo dõi."
version: 1.0.0
author: Lê Đình Lực (AI for Boss)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [AI for Boss, Doanh nghiệp, Tiếng Việt]
    emoji: "💌"
---

# Chuỗi chăm sóc qua email và Zalo

## Khi nào dùng

Dùng khi anh chị muốn khách nhận đúng tin vào đúng lúc mà không phải nhắn tay từng người, ví dụ người vừa để lại số điện thoại, khách vừa mua xong, khách bỏ giỏ trên trang web, khách lâu không quay lại. Kỹ năng này thiết kế cả chuỗi (sequence) gồm sơ đồ luồng, thời điểm gửi, nội dung từng tin cho email và Zalo OA, điều kiện rẽ nhánh, điều kiện dừng và chỉ số theo dõi, xuất thành bảng để anh chị cài vào công cụ đang dùng như tính năng tự động của Zalo OA, Getfly, Pancake, LadiFlow hay phần mềm gửi email bất kỳ.

Không dùng để nhắn theo một khách cụ thể sau buổi gặp hay sau báo giá, việc đó chuyển sang `theo-duoi-sau-gap`. Không dùng cho đợt gọi lại có chủ đích với danh sách khách cũ đã lâu không mua, việc đó chuyển sang `danh-thuc-khach-cu`. Không dùng để viết một bản tin gửi một lần, việc đó chuyển sang `viet-bai-giu-giong`. Không dùng để trả lời khách đang hỏi, việc đó chuyển sang `soan-phan-hoi-khach`.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi mới làm. Nếu thư mục làm việc có `boi-canh-san-pham.md` hoặc hồ sơ giọng, đọc trước và chỉ hỏi phần còn thiếu.

1. Chuỗi này để làm gì? Chọn một loại chính gồm chào mừng, nuôi dưỡng người chưa mua, sau mua, nhắc giỏ bỏ dở, hỏi thăm lại khách lâu không mua. Mỗi chuỗi một mục tiêu.
2. Điều gì làm khách bắt đầu vào chuỗi, ví dụ điền biểu mẫu, quan tâm Zalo OA, đặt đơn thành công, bỏ giỏ quá một giờ? Điều gì cho biết chuỗi đã xong việc, ví dụ khách mua, khách đặt lịch?
3. Anh chị gửi qua kênh nào, email, Zalo OA hay cả hai? Đang dùng công cụ gì để gửi? Danh sách có bao nhiêu người và lấy từ đâu (KiotViet, Sapo, Haravan, Google Sheets, biểu mẫu)?
4. Khách trong danh sách đã đồng ý nhận tin từ mình chưa, đồng ý qua đâu? Có cách để khách huỷ nhận chưa?
5. Có ưu đãi, quà hay tài liệu nào dùng được trong chuỗi không? Điều kiện và hạn dùng ra sao? Không có thì tôi viết chuỗi thuần giá trị, không tự đặt ưu đãi.
6. Có điều gì tuyệt đối không được nói, hay khung giờ không được gửi?

## Quy trình

1. Viết một câu mục tiêu và một câu thành công cho chuỗi, ví dụ "khách mới đặt lịch thử trong 14 ngày". Xác định điểm vào, điểm ra và nhóm loại trừ (khách vừa khiếu nại, khách đã mua trong 7 ngày, người đã huỷ nhận) để không gửi nhầm.
2. Chọn độ dài và nhịp theo loại chuỗi. Gợi ý khởi điểm gồm chào mừng 4 đến 6 tin trong khoảng 2 tuần, nuôi dưỡng 5 đến 7 tin trong 3 tuần, sau mua 3 đến 4 tin theo vòng đời sản phẩm, nhắc giỏ 2 đến 3 tin trong 3 ngày, hỏi thăm lại 3 tin trong 2 tuần. Đây là điểm xuất phát để thử, anh chị chỉnh theo chu kỳ mua thật của mình. Tin đầu gửi ngay khi khách vào chuỗi.
3. Phân kênh cho từng tin. Tin cần đến nhanh và ngắn (xác nhận đơn, nhắc lịch, nhắc giỏ) hợp với Zalo. Tin dài có hướng dẫn, câu chuyện, bảng so sánh hợp với email. Ghi rõ với anh chị rằng tin Zalo OA gửi chủ động cho khách có quy định riêng về mẫu tin, về điều kiện gửi và có phí, các quy định này thay đổi theo thời gian, anh chị cần kiểm trực tiếp với Zalo trước khi cài. Tôi không đưa mức phí hay số tin được phép gửi khi chưa có nguồn chính thức anh chị cung cấp.
4. Viết từng tin theo luật một tin một việc. Mỗi tin gồm mục đích một câu, thời điểm (ngày thứ mấy sau điểm vào, giờ gửi), kênh, tiêu đề email kèm hai phương án và dòng xem trước, hoặc câu mở cho Zalo, thân tin ngắn gọn, một lời kêu gọi hành động (call to action) duy nhất. Tin Zalo dưới 500 ký tự, viết như tin nhắn thật, có tên khách nếu công cụ hỗ trợ. Cho giá trị trước khi xin khách mua.
5. Vẽ nhánh rẽ bằng các điều kiện cụ thể, ví dụ khách mở email nhưng không bấm thì tin sau đổi góc tiếp cận, khách bấm xem bảng giá thì chuyển sang nhánh ưu đãi, khách trả lời tin thì dừng tự động và báo người thật vào. Mỗi nhánh ghi rõ điều kiện, tin nhận được và điểm quay về. Sơ đồ vẽ bằng chữ theo dạng từng dòng "Tin 1 → nếu... → Tin 2a".
6. Ghi điều kiện dừng cho cả chuỗi gồm khách đạt mục tiêu, khách huỷ nhận, khách trả lời hoặc khiếu nại, email bị trả về, hết chuỗi mà không phản hồi. Khách huỷ nhận thì dừng trên mọi kênh. Mọi email có dòng huỷ nhận rõ ràng. Nhắc anh chị rằng Việt Nam có quy định về chống tin nhắn rác và thư rác, cần kế toán hoặc luật sư xác nhận cách thu đồng ý và lưu bằng chứng nếu danh sách lớn, tôi không trích số điều luật.
7. Đặt chỉ số theo dõi gồm tỷ lệ mở, tỷ lệ bấm, tỷ lệ trả lời, tỷ lệ huỷ nhận hay bỏ quan tâm OA, tỷ lệ đạt mục tiêu của cả chuỗi. Không đưa con số chuẩn ngành bịa ra. Nếu anh chị có số của các đợt gửi trước, lấy làm mốc, không có thì ghi "đo 2 tuần đầu làm mốc". Gợi ý một phép thử A/B duy nhất cho tin đầu, ví dụ hai tiêu đề.
8. Rà toàn chuỗi theo góc nhìn khách. Một người đi hết chuỗi có bị nhận quá dày không, có tin nào lặp ý, có lời hứa nào thiếu bằng chứng, có ưu đãi nào anh chị chưa duyệt. Dùng `humanizer` nếu câu chữ còn cứng.
9. Đưa anh chị duyệt bảng chuỗi. Hỏi "Anh chị xem giúp nhịp gửi và từng tin, có tin nào không muốn khách nhận không?". Không tự cài, không tự gửi thử cho khách thật. Sau khi duyệt, xuất bảng bằng `xlsx` hoặc Google Sheets qua `google-workspace` và đặt lịch rà chỉ số sau 2 tuần bằng `cronjob` nếu anh chị đồng ý. Gọi `aifb_record_decision` khi anh chị chốt chuỗi hay chốt ưu đãi dùng trong chuỗi.

## Tiêu chuẩn đầu ra

Một trang tóm tắt gồm mục tiêu, điểm vào, điểm ra, nhóm loại trừ, sơ đồ luồng bằng chữ, điều kiện dừng, chỉ số theo dõi. Kèm một bảng chuỗi, mỗi dòng một tin với các cột thứ tự, ngày và giờ gửi, kênh, mục đích, tiêu đề hoặc câu mở, thân tin, lời kêu gọi hành động, điều kiện rẽ nhánh. Mọi ưu đãi lấy từ anh chị, không tự đặt. Không bịa phí Zalo, không bịa chỉ số chuẩn ngành, không bịa lời khách. Mỗi tin một việc, email luôn có dòng huỷ nhận. Giọng rõ ràng, gần gũi, không dồn ép, không dùng chữ kiểu "cơ hội cuối cùng" khi không thật sự là cuối cùng.

## Ba ca mẫu

### Ca 1: Hộ kinh doanh mỹ phẩm handmade bán qua Haravan và Zalo OA
Đầu vào: Chủ shop có 1.200 người quan tâm OA và 400 email khách từ Haravan (số giả định), muốn chuỗi nhắc giỏ bỏ dở và chuỗi sau mua. Có mã giảm 10 phần trăm cho đơn đầu, hạn 7 ngày.
Bối cảnh: Chủ shop định gửi tin Zalo cho cả 1.200 người mỗi ngày.
Đầu ra đạt chuẩn: Chuỗi nhắc giỏ 3 tin (Zalo sau 1 giờ, email sau 24 giờ, Zalo sau 48 giờ có mã 10 phần trăm), dừng khi khách đặt đơn. Chuỗi sau mua 3 tin theo ngày giao, ngày 7 hỏi trải nghiệm, ngày 30 nhắc dùng hết. Ghi rõ việc gửi Zalo chủ động hằng ngày cho mọi người có quy định và phí, cần kiểm với Zalo, và khuyên không gửi dày vì dễ bị bỏ quan tâm. Không nêu mức phí.
Tiêu chí chấm:
- Mã giảm dùng đúng điều kiện chủ shop đưa.
- Có điều kiện dừng khi khách đặt đơn.
- Không bịa phí Zalo.
- Mỗi tin một lời kêu gọi hành động.
- Không tự gửi cho khách thật.

### Ca 2: Trung tâm ngoại ngữ 30 nhân viên
Đầu vào: Trưởng nhóm marketing xuất danh sách 2.000 phụ huynh điền biểu mẫu tư vấn từ Google Sheets (số giả định), muốn chuỗi nuôi dưỡng tới khi đăng ký học thử. Có tài liệu "Lộ trình tiếng Anh theo độ tuổi" làm quà.
Bối cảnh: Đội tư vấn gọi điện song song, sợ chuỗi tự động trùng với cuộc gọi.
Đầu ra đạt chuẩn: Chuỗi 6 tin trong 3 tuần kết hợp email và Zalo. Tin 1 gửi tài liệu ngay. Nhánh rẽ khi phụ huynh bấm xem lịch học thử thì báo tư vấn viên gọi và dừng tin tự động. Nhóm loại trừ gồm người đã học thử. Chỉ số ghi "đo 2 tuần đầu làm mốc". Nhắc kiểm cách thu đồng ý trong biểu mẫu với người am hiểu luật.
Tiêu chí chấm:
- Có cơ chế dừng khi người thật vào cuộc.
- Có nhóm loại trừ.
- Không đưa tỷ lệ mở chuẩn ngành bịa ra.
- Có nhắc về đồng ý nhận tin.
- Có đề xuất xuất bảng qua `xlsx` hoặc `google-workspace`.

### Ca 3: Huấn luyện viên thể hình tự do
Đầu vào: Huấn luyện viên có 150 học viên cũ trong một tệp Excel (số giả định), chỉ dùng email và Zalo cá nhân, muốn chuỗi hỏi thăm lại những người đã nghỉ tập hơn 60 ngày.
Bối cảnh: Không có Zalo OA, không có ưu đãi.
Đầu ra đạt chuẩn: Chuỗi 3 tin qua email trong 2 tuần, tin 1 hỏi thăm và chia một bài tập ngắn làm tại nhà, tin 2 kể câu chuyện một học viên quay lại (chỉ dùng khi huấn luyện viên có câu chuyện thật và được phép kể), tin 3 mời một buổi tập lại. Nói rõ Zalo cá nhân không có tính năng tự động như OA, gợi ý huấn luyện viên tự nhắn tay cho người đã mở email. Nếu muốn gọi từng người theo danh sách, trỏ sang `danh-thuc-khach-cu`.
Tiêu chí chấm:
- Không tự đặt ưu đãi.
- Không bịa câu chuyện học viên.
- Phân biệt Zalo cá nhân với Zalo OA.
- Có dòng huỷ nhận trong email.
- Có trỏ đúng sang `danh-thuc-khach-cu`.

## Nguồn
Chuyển thể từ `marketing/skills/email-sequence` trong anthropics/knowledge-work-plugins (Apache 2.0), `skills/emails` và `skills/sms` trong coreyhaines31/marketingskills (MIT), `skills/ads/zalo-oa-strategy` và `skills/ads/email-marketing` trong viethahong/business-skills (MIT).
