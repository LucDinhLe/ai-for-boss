---
name: quang-cao-tra-phi
description: "Lập và rà chiến dịch quảng cáo Facebook, TikTok, Google, Zalo, Shopee, tính ngược từ doanh thu mục tiêu ra số khách, chi phí tối đa mỗi khách và ngân sách, viết mẫu quảng cáo, đọc số để quyết giữ, tắt hay tăng."
version: 1.0.0
author: Lê Đình Lực (AI for Boss)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [AI for Boss, Doanh nghiệp, Tiếng Việt]
    emoji: "📣"
---

# Quảng cáo trả phí

## Khi nào dùng

Dùng khi anh chị sắp chạy quảng cáo và muốn biết cần bao nhiêu tiền, hoặc đang chạy mà không rõ tiền đi đâu, chi phí mỗi khách tăng, không biết nên tắt hay tăng. Kỹ năng này làm ba việc gồm tính ngược ngân sách từ doanh thu mục tiêu, viết nhiều mẫu nội dung quảng cáo để thử, và đọc báo cáo quảng cáo để đưa ra đề xuất giữ, tắt, tăng có kèm số tiền. Mọi thay đổi ngân sách, bật tắt chiến dịch hay đăng quảng cáo đều chờ anh chị duyệt từng mục, trợ lý chỉ soạn và hướng dẫn bấm.

Không dùng để lập kế hoạch chiến dịch nhiều kênh gồm cả kênh miễn phí, việc đó chuyển sang `ke-hoach-chien-dich`. Không dùng để chốt thông điệp gốc khi chưa rõ mình bán cho ai, việc đó chuyển sang `dinh-vi-thong-diep`. Không dùng để thiết kế giá hay khuyến mãi, việc đó chuyển sang `thiet-ke-uu-dai-va-gia`. Quảng cáo nội sàn gắn với vận hành gian hàng thì dùng kèm `ban-hang-san-va-livestream`.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi mới làm. Không tự đoán biên lợi nhuận, không tự đoán tỉ lệ chốt.

1. Doanh thu mục tiêu bao nhiêu, trong bao lâu? Hay anh chị có sẵn một khoản ngân sách và muốn biết được bao nhiêu đơn?
2. Giá trị trung bình một đơn và biên lợi nhuận gộp (phần còn lại sau giá vốn) khoảng bao nhiêu phần trăm?
3. Đường đi của khách ra sao, ví dụ xem quảng cáo, nhắn tin Zalo hoặc Messenger, tư vấn, chốt đơn? Tỉ lệ từ tin nhắn sang đơn hiện nay là bao nhiêu, nếu chưa đo thì nói "chưa đo".
4. Anh chị định chạy hoặc đang chạy kênh nào trong Facebook, TikTok, Google, Zalo, Shopee?
5. Nếu đang chạy, xuất báo cáo 30 ngày gần nhất theo chiến dịch thành tệp Excel hoặc CSV và dán kèm số đơn thật từ sổ bán hàng, KiotViet, Sapo hoặc báo cáo sàn cùng kỳ.
6. Có điều gì không được nói trong quảng cáo không, ví dụ ngành mỹ phẩm, thực phẩm chức năng, giáo dục có quy định riêng?

## Quy trình

1. Tính ngược bằng Python theo chuỗi doanh thu mục tiêu chia giá trị đơn ra số đơn, số đơn chia tỉ lệ chốt ra số khách tiềm năng cần có, rồi ra chi phí tối đa mỗi khách tiềm năng để hoà vốn bằng lãi gộp chia số khách tiềm năng. Lấy mức mục tiêu thấp hơn mức hoà vốn để còn lãi, và ngân sách bằng số khách tiềm năng nhân chi phí mục tiêu. Ghi rõ từng số lấy từ đâu.
2. Lập ba kịch bản thận trọng, cơ sở, thuận lợi bằng cách đổi tỉ lệ chốt và chi phí mỗi khách. Nếu chi phí thị trường anh chị đang thấy đã cao hơn mức hoà vốn, nói thẳng là chưa nên chạy và chỉ ra ba đòn bẩy cần sửa trước gồm ưu đãi, giá trị đơn, tỉ lệ chốt.
3. Đề xuất cấu trúc thử nghiệm gọn gàng cho từng kênh anh chị chọn, gồm một chiến dịch thử với hai đến ba nhóm đối tượng và ba đến năm mẫu nội dung, cách chia ngân sách theo tuần và ngày rà đầu tiên. Không đề xuất kênh mà anh chị chưa có năng lực phục vụ, ví dụ chạy tin nhắn khi không có người trả lời tin.
4. Viết mẫu nội dung quảng cáo theo nhiều góc gồm nỗi đau, kết quả, bằng chứng, so sánh trước sau, ưu đãi có hạn. Mỗi mẫu có câu mở trong ba giây đầu, thân bài, lời kêu gọi hành động, và ghi độ dài phù hợp kênh. Không viết cam kết kết quả tuyệt đối, không dùng lời chứng thực khách mà anh chị chưa đưa.
5. Khi đọc báo cáo, đi từ tài khoản xuống chiến dịch, nhóm quảng cáo, rồi từng mẫu. Với mỗi chiến dịch ghi đã chi bao nhiêu, ra bao nhiêu kết quả, chi phí mỗi kết quả, xu hướng tốt lên hay xấu đi. Chiến dịch không có đo chuyển đổi thì ghi "chưa kết luận được".
6. Đặt số của nền tảng cạnh số đơn thật. Hai con số luôn lệch vì nền tảng đếm cả lượt xem rồi mua sau và mua trên thiết bị khác. Nêu cả hai, giải thích độ lệch trong một câu và khuyên anh chị lái theo chi phí mỗi đơn thật. Không trộn thành một con số trung bình.
7. Đề xuất theo thứ tự ảnh hưởng lớn trước, mỗi đề xuất gồm thay đổi gì, vì sao, số tiền dự kiến tiết kiệm hoặc thêm được, và rủi ro. Quy tắc tăng ngân sách là chỉ tăng khi chi phí mỗi khách đã ổn định dưới mục tiêu ít nhất 7 ngày, mỗi lần tăng khoảng 20 đến 30 phần trăm, chờ 2 đến 3 ngày rồi mới tăng tiếp. Không tăng ngân sách khi chi phí đang xấu.
8. Trình danh sách thay đổi và hỏi "Anh chị duyệt mục nào, em soạn hướng dẫn bấm cho mục đó?". Chỉ sau khi anh chị nói "làm đi" với từng mục mới viết từng bước thao tác trong trình quản lý quảng cáo. Gọi `aifb_record_decision` cho mỗi quyết định tắt, giữ, tăng ngân sách.
9. Nếu anh chị muốn, đề nghị lịch `cronjob` hằng tuần nhắc gửi báo cáo mới để rà tiếp, chỉ đặt sau khi được đồng ý.

## Tiêu chuẩn đầu ra

Một trang tiếng Việt, kết quả trước, đạt đủ các điểm sau:

- Bảng tính ngược có số đơn, số khách tiềm năng, chi phí tối đa mỗi khách, chi phí mục tiêu, ngân sách, cho ba kịch bản.
- Mỗi số ghi nguồn là lời anh chị, tệp báo cáo hay số giả định, chỗ thiếu ghi "chưa có số".
- Mẫu quảng cáo ít nhất năm mẫu theo các góc khác nhau, ghi kênh và độ dài.
- Khi rà báo cáo có bảng từng chiến dịch với đề xuất giữ, tắt, tăng và số tiền kèm theo.
- Nêu cả số nền tảng và số đơn thật, không đưa một con số lợi nhuận trên chi phí quảng cáo tự bịa.
- Không tự thay đổi gì trong tài khoản quảng cáo, mọi thay đổi ngân sách chờ duyệt từng mục.

## Ba ca mẫu

### Ca 1: Hộ kinh doanh bánh handmade bán qua Facebook
Đầu vào: Chủ tiệm muốn doanh thu 60 triệu một tháng, đơn trung bình 300 nghìn, lãi gộp 50 phần trăm, 10 tin nhắn thì chốt 3 đơn (số giả định).
Bối cảnh: Chưa từng chạy quảng cáo, một người vừa làm bánh vừa trả lời tin.
Đầu ra đạt chuẩn: Cần 200 đơn, khoảng 667 tin nhắn. Lãi gộp 30 triệu chia 667 ra chi phí tối đa khoảng 45 nghìn mỗi tin nhắn để hoà vốn, mục tiêu khoảng 30 nghìn, ngân sách khoảng 20 triệu một tháng. Cảnh báo 667 tin nhắn một tháng là hơn 20 tin mỗi ngày cho một người, đề xuất bắt đầu bằng 5 triệu thử trong hai tuần. Có năm mẫu quảng cáo cho Facebook.
Tiêu chí chấm:
- Phép tính đúng và ghi rõ từng bước.
- Có nhắc giới hạn năng lực trả lời tin.
- Không tự bật quảng cáo.
- Mẫu quảng cáo không cam kết điều chủ tiệm chưa nói.

### Ca 2: Trung tâm tiếng Anh 30 nhân viên đang chạy Facebook và Google
Đầu vào: Quản lý dán báo cáo 30 ngày, 4 chiến dịch tiêu 48 triệu, nền tảng báo 160 khách đăng ký, sổ tư vấn chỉ ghi 95 khách từ quảng cáo và 19 học viên nhập học (số giả định). Một chiến dịch Google tiêu 15 triệu ra 8 khách.
Bối cảnh: Giám đốc muốn tăng gấp đôi ngân sách tháng sau.
Đầu ra đạt chuẩn: Nêu cả 160 và 95, giải thích độ lệch, chi phí mỗi học viên nhập học khoảng 2,5 triệu. Đề xuất tắt hoặc sửa chiến dịch Google tốn gần 1,9 triệu mỗi khách, chỉ tăng 20 đến 30 phần trăm cho chiến dịch đã ổn định, không tăng gấp đôi một lần. Mỗi đề xuất có số tiền và chờ duyệt.
Tiêu chí chấm:
- Không cộng gộp hai nguồn số thành một.
- Đề xuất tăng theo nấc, có lý do.
- Có câu hỏi duyệt từng mục.
- Gọi `aifb_record_decision` khi giám đốc chốt.

### Ca 3: Nhà thiết kế nội thất tự do muốn thử TikTok và Zalo
Đầu vào: Anh có 10 triệu ngân sách thử, hợp đồng trung bình 80 triệu, lãi gộp 35 phần trăm, chưa đo tỉ lệ chốt.
Bối cảnh: Làm một mình, mỗi tháng nhận tối đa 3 công trình.
Đầu ra đạt chuẩn: Tính xuôi từ 10 triệu với ba kịch bản tỉ lệ chốt, đánh dấu rõ tỉ lệ chốt là số giả định cần đo trong đợt thử. Đề xuất thử một kênh trước vì năng lực chỉ 3 công trình. Viết năm mẫu video ngắn cho TikTok và hai mẫu tin Zalo. Đặt ngày rà sau 14 ngày.
Tiêu chí chấm:
- Nói rõ tỉ lệ chốt chưa có số thật.
- Gắn ngân sách với năng lực nhận việc.
- Không hứa số hợp đồng.
- Mẫu quảng cáo hợp từng kênh.
- Có ngày rà cụ thể sau đợt thử.

## Nguồn
Chuyển thể từ `skills/ads` và `skills/ad-creative` trong coreyhaines31/marketingskills (MIT), `small-business/skills/ad-manager` trong anthropics/knowledge-work-plugins (Apache 2.0), cùng `skills/vi/10-tinh-kpi-nguoc` và `skills/vi/55-scaling-ads` trong minhnv0807/ai-business-skills (MIT).
