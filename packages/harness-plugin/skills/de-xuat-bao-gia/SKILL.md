---
name: de-xuat-bao-gia
description: "Viết đề xuất và báo giá từ nhu cầu khách đã xác nhận, giá chỉ lấy từ bảng giá anh chị đưa, kèm một đoạn tóm tắt để gửi Zalo, dùng sau buổi gặp đầu khi khách đã hỏi giá."
metadata: { "openclaw": { "emoji": "📄" } }
---

# Đề xuất và báo giá

## Khi nào dùng

Dùng sau khi anh chị đã gặp hoặc trao đổi với khách và nắm được nhu cầu của họ, khách đã hỏi giá hoặc yêu cầu gửi đề xuất. Kỹ năng này viết một bản đề xuất có cấu trúc và một đoạn tóm tắt ngắn để gửi qua Zalo, với mọi con số giá lấy từ bảng giá của anh chị. Không dùng khi chưa rõ khách cần gì, khi đó chuyển sang `ho-so-khach-tiem-nang` để chuẩn bị buổi gặp. Không dùng để quyết định nên đặt giá bao nhiêu, mô hình không định giá thay anh chị. Không dùng để soạn tin nhắc khách sau khi đã gửi báo giá, việc đó chuyển sang `theo-duoi-sau-gap`.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi mới làm. Không tự đặt giá, không tự tính chiết khấu, không tự thêm hạng mục.

1. Khách là ai và họ cần gì? Dán biên bản buổi gặp, tin nhắn hoặc mô tả lại nhu cầu đã được khách xác nhận.
2. Anh chị dán bảng giá hiện tại vào được không? Excel, ảnh chụp bảng giá, hay gõ tay từng dòng đều được. Nếu có nhiều gói, ghi rõ gói nào gồm gì.
3. Anh chị muốn đề xuất một gói hay đưa khách hai đến ba gói để chọn? Nếu có giảm giá, mức giảm là bao nhiêu và điều kiện gì?
4. Điều khoản thanh toán, thời gian thực hiện, bảo hành hay đổi trả của anh chị ra sao? Có xuất hoá đơn không?
5. Khách đã nêu ngân sách, hạn chót hay lo ngại nào chưa? Có đang so với bên khác không?
6. Bản đề xuất gửi bằng cách nào, Zalo, email hay in ra, và ai bên khách sẽ đọc?

## Quy trình

1. Đọc nhu cầu khách và lập danh sách các hạng mục khách thực sự cần. Đối chiếu từng hạng mục với bảng giá anh chị đưa. Hạng mục nào có trong nhu cầu nhưng không có trong bảng giá, dừng lại và hỏi anh chị giá cho hạng mục đó, không tự ước. Hạng mục nào có trong bảng giá nhưng khách không nhắc, không tự đưa vào; nếu thấy khách có thể cần, hỏi anh chị một câu trước.
2. Viết phần bối cảnh và mục tiêu bằng lời của khách. Bối cảnh nêu tình hình hiện tại của khách trong hai đến ba câu. Mục tiêu nêu điều khách muốn đạt được sau khi dùng sản phẩm hoặc dịch vụ, không phải danh sách tính năng. Nếu khách chưa nói rõ mục tiêu, ghi mục tiêu theo cách hiểu của anh chị và đánh dấu "cần khách xác nhận".
3. Viết phạm vi gồm hai phần: có gì trong gói và không có gì. Phần "không gồm" quan trọng để tránh tranh cãi sau này, ví dụ không gồm vận chuyển ngoài thành phố, không gồm chỉnh sửa sau lần thứ hai, không gồm phí tên miền. Lấy các loại trừ này từ điều khoản anh chị đưa, hỏi thêm nếu anh chị chưa nói.
4. Lập bảng gói và giá. Mỗi dòng gồm hạng mục, số lượng, đơn giá, thành tiền, tất cả từ bảng giá và số lượng khách cần. Tự cộng tổng và ghi rõ giá đã hay chưa gồm thuế giá trị gia tăng (VAT) theo lời anh chị. Nếu có giảm giá, ghi thành một dòng riêng với điều kiện. Nếu anh chị chọn nhiều gói, xếp cạnh nhau và nêu một câu khác biệt chính giữa các gói, không tô đậm gói đắt nhất trừ khi anh chị yêu cầu.
5. Viết điều khoản và bước tiếp theo. Điều khoản gồm thanh toán, thời gian, bảo hành, hiệu lực báo giá, tất cả theo lời anh chị. Bước tiếp theo là một hành động cụ thể kèm mốc thời gian, ví dụ "anh chị xác nhận gói trước thứ Sáu để bên em giữ lịch thi công tuần sau", không dùng câu chung như "mong sớm hợp tác".
6. Viết đoạn tóm tắt một đoạn để gửi Zalo, dưới 500 ký tự, gồm tên gói, tổng tiền, hai điểm chính của phạm vi và bước tiếp theo. Không có định dạng đậm nghiêng, không gạch đầu dòng, viết như một tin nhắn thật.
7. Kiểm tra lại từng con số trong bản đề xuất với bảng giá và phép cộng. Đưa anh chị duyệt cả bản đề xuất và đoạn Zalo. Hỏi "Anh chị kiểm tra giúp từng dòng giá và tổng, có đúng bảng giá không?". Chỉ sau khi duyệt mới hỏi anh chị muốn xuất ra định dạng nào; không tự gửi cho khách. Khi người dùng chốt một quyết định trong việc này, gọi công cụ `aifb_record_decision` để ghi vào sổ quyết định.

## Tiêu chuẩn đầu ra

Bản đề xuất tiếng Việt một trang, cấu trúc cố định theo thứ tự "Bối cảnh", "Mục tiêu", "Phạm vi" (gồm và không gồm), "Gói và giá" (bảng), "Điều khoản", "Bước tiếp theo", kèm bên dưới một đoạn tóm tắt Zalo dưới 500 ký tự. Mọi giá chỉ lấy từ bảng giá anh chị đưa, tổng do mô hình cộng và anh chị kiểm tra lại, không bịa số liệu, chỗ nào thiếu ghi "chưa có số" hoặc "chờ anh chị báo giá hạng mục này". Không tự thêm hạng mục, không tự giảm giá, không hứa thời gian anh chị chưa nói. Giọng viết ngang hàng, không nịnh khách, không dùng lời hô hào. Hỏi trước khi làm bất kỳ việc gì tốn tiền hoặc gửi ra ngoài. Báo cáo tiếng Việt một trang.

## Ba ca mẫu

### Ca 1: Xưởng mộc gia đình 5 người, báo giá cho homestay
Đầu vào: Chủ xưởng dán biên bản buổi gặp: khách cần 8 giường 1m6 và 8 tủ áo cho homestay ở Hội An, khai trương ngày 20 tháng sau. Bảng giá chủ xưởng gõ tay: giường 1m6 gỗ sồi 6,5 triệu, tủ áo 2 cánh 4,8 triệu, vận chuyển trong tỉnh 1,5 triệu một chuyến, đặt cọc 40 phần trăm (số giả định). Khách hỏi có lắp tại chỗ không, chủ xưởng chưa nói giá lắp.
Bối cảnh: Chủ xưởng lần đầu báo giá lô lớn, hay quên ghi phần không gồm.
Đầu ra đạt chuẩn: Bảng giá có 8 giường 52 triệu, 8 tủ 38,4 triệu, tổng 90,4 triệu chưa gồm vận chuyển; dòng vận chuyển ghi 1,5 triệu một chuyến và "số chuyến chờ chủ xưởng xác nhận"; dòng lắp đặt ghi "chờ anh chị báo giá hạng mục này". Phần "không gồm" nêu vận chuyển ngoài tỉnh và lắp đặt cho tới khi có giá. Bước tiếp theo gắn với ngày 20 và thời gian sản xuất mà chủ xưởng phải cung cấp. Đoạn Zalo nêu tổng 90,4 triệu và hỏi khách chốt cọc.
Tiêu chí chấm:
- Tổng 90,4 triệu cộng đúng từ đơn giá và số lượng.
- Không tự đặt giá lắp đặt.
- Có phần "không gồm".
- Không hứa ngày giao khi chủ xưởng chưa nói thời gian sản xuất.
- Đoạn Zalo dưới 500 ký tự, không định dạng.

### Ca 2: Giảng viên tự do, đề xuất bán sỉ khoá học cho đơn vị đào tạo
Đầu vào: Giảng viên cho biết đối tác muốn 30 suất khoá học online, giá lẻ 1,2 triệu một suất, giảng viên quyết định giảm 20 phần trăm cho đơn từ 20 suất, có xuất hoá đơn, thanh toán 100 phần trăm trước khi cấp tài khoản, tài khoản có hiệu lực 6 tháng (số giả định). Đối tác hỏi có buổi hỏi đáp trực tiếp không, giảng viên chưa quyết.
Bối cảnh: Đối tác gửi qua email cho phòng đào tạo và kế toán cùng đọc.
Đầu ra đạt chuẩn: Bảng giá ghi 30 suất nhân 1,2 triệu bằng 36 triệu, dòng giảm 20 phần trăm bằng 7,2 triệu với điều kiện từ 20 suất, còn 28,8 triệu, ghi rõ đã hay chưa gồm VAT theo lời giảng viên. Buổi hỏi đáp trực tiếp được ghi ở phần "không gồm" kèm chú thích "có thể bổ sung, chờ anh chị quyết". Điều khoản có hiệu lực tài khoản 6 tháng và thanh toán trước. Đoạn Zalo vẫn được viết để giảng viên nhắn nhanh cho người liên hệ.
Tiêu chí chấm:
- Số giảm 7,2 triệu và số còn lại 28,8 triệu tính đúng.
- Buổi hỏi đáp không bị tự đưa vào gói hay tự định giá.
- Có ghi trạng thái VAT.
- Giọng viết phù hợp cho kế toán đọc, không hô hào.
- Có câu hỏi duyệt từng dòng giá trước khi xuất.

### Ca 3: Nhân viên marketing trong công ty 40 người, đề xuất nội bộ thuê đơn vị chạy quảng cáo
Đầu vào: Nhân viên dán báo giá nhận từ hai đơn vị bên ngoài và yêu cầu viết đề xuất trình giám đốc chọn một. Đơn vị A 25 triệu một tháng gồm nội dung và chạy quảng cáo, đơn vị B 18 triệu chưa gồm nội dung (số giả định). Mục tiêu công ty là 300 khách tiềm năng một quý.
Bối cảnh: Đây là đề xuất nội bộ, "khách" là giám đốc, nhân viên muốn dùng cùng cấu trúc.
Đầu ra đạt chuẩn: Bối cảnh nêu mục tiêu 300 khách tiềm năng một quý theo lời nhân viên. Bảng gói xếp A và B cạnh nhau với đúng số từ hai báo giá, dòng nội dung của B ghi "chưa có số, cần hỏi đơn vị B hoặc tính công nội bộ". Không kết luận A hay B tốt hơn, chỉ nêu một câu khác biệt chính. Bước tiếp theo là giám đốc chọn trước một ngày do nhân viên đưa. Đoạn Zalo dùng để nhắn giám đốc xin lịch trình bày.
Tiêu chí chấm:
- Không tự điền chi phí nội dung cho đơn vị B.
- Không tự chọn đơn vị thay giám đốc.
- Số 300 khách tiềm năng chỉ xuất hiện ở bối cảnh, không bị biến thành cam kết của đơn vị nào.
- Cấu trúc sáu mục đầy đủ.
- Có gọi `aifb_record_decision` khi giám đốc chốt đơn vị.

## Nguồn
Chuyển thể từ `sales/skills/create-an-asset` (phần đề xuất và một trang) và `small-business/skills/price-check` trong anthropics/knowledge-work-plugins (Apache 2.0).
