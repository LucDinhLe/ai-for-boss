---
name: thiet-ke-uu-dai-va-gia
description: "Đóng gói ưu đãi gồm gói giá trị, quà kèm, bảo hành, đảo ngược rủi ro và cân nhắc giá theo giá vốn, biên lợi nhuận, bậc gói, giá neo, luôn tính biên trước khi bàn giảm giá, anh chị là người quyết giá."
version: 1.0.0
author: Lê Đình Lực (AI for Boss)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [AI for Boss, Doanh nghiệp, Tiếng Việt]
    emoji: "🏷️"
---

# Thiết kế ưu đãi và giá

## Khi nào dùng

Dùng khi anh chị muốn làm cho thứ mình bán dễ mua hơn mà vẫn còn lãi, ví dụ sắp chạy khuyến mãi, định giảm giá, muốn ra gói mới, muốn chia ba bậc gói, hay thấy khách khen nhưng không chốt. Kỹ năng này đóng gói ưu đãi (offer) gồm phần cốt lõi, quà kèm, bảo hành, cam kết đảo ngược rủi ro, lý do mua ngay có thật, tên gói, cách thanh toán, và cân nhắc giá theo giá vốn, biên lợi nhuận, bậc gói và giá neo. Mọi đề xuất giảm giá hay quà kèm đều đi sau một bảng tính biên lợi nhuận. Mô hình đưa phương án và khoảng giá kèm đánh đổi, anh chị là người quyết con số cuối cùng.

Không dùng để viết báo giá cho một khách cụ thể từ bảng giá đã có, việc đó chuyển sang `de-xuat-bao-gia`. Không dùng để đáp lời một khách đang chê đắt, việc đó chuyển sang `xu-ly-tu-choi`. Khi cần viết trang bán hay bài quảng bá cho ưu đãi, chuyển sang `viet-bai-giu-giong` hoặc `ke-hoach-chien-dich`. Khi cần xem lãi lỗ toàn doanh nghiệp theo tháng, chuyển sang `phan-tich-lai-lo`. Câu hỏi về thuế giá trị gia tăng, hoá đơn hay quy định khuyến mại cần kế toán hoặc luật sư xác nhận, kỹ năng này không kết luận thay.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi mới làm. Không tự ước giá vốn, không tự đặt giá bán.

1. Anh chị đang bán gì, giá hiện tại bao nhiêu, bán cho ai? Có bảng giá thì dán vào.
2. Giá vốn của từng sản phẩm hay dịch vụ gồm những gì? Ví dụ nguyên liệu, bao bì, công thợ tính theo giờ, phí sàn, phí vận chuyển anh chị chịu, phí cổng thanh toán. Có thể gửi tệp MISA, KiotViet, báo cáo phí Shopee hay bảng tự tính.
3. Mỗi tháng bán được khoảng bao nhiêu đơn cho từng loại? Có đơn nào mất tiền mà anh chị vẫn làm không?
4. Anh chị muốn đạt điều gì? Ví dụ tăng số đơn, tăng giá trị mỗi đơn, đẩy hàng tồn, giữ khách cũ, ra mắt gói mới.
5. Khách hay chê gì, và khách thật sự muốn đạt kết quả gì khi mua? Bên khác đang bán mức giá nào và gồm những gì?
6. Anh chị có thể cam kết gì về bảo hành, đổi trả, làm lại miễn phí? Giới hạn giảm giá thấp nhất anh chị chấp nhận là bao nhiêu?
7. Có thời hạn thật nào để tạo lý do mua ngay không? Ví dụ số suất có hạn thật, mùa vụ, ngày tăng giá đã định.

## Quy trình

1. Dựng bảng biên lợi nhuận bằng mã Python cho từng sản phẩm với các cột giá bán, giá vốn, lãi gộp mỗi đơn, biên phần trăm, số đơn mỗi tháng, tổng lãi gộp mỗi tháng. Chỗ thiếu giá vốn ghi "chưa có số" và hỏi, không ước. Xếp theo tổng lãi gộp, vì biên cao trên đơn nhỏ có thể đóng góp ít hơn biên vừa trên đơn lớn.
2. Gắn cờ sản phẩm có biên mỏng hoặc âm. Với từng sản phẩm, tính giá sàn để đạt biên anh chị mong muốn bằng giá vốn chia cho (1 trừ biên mong muốn). Giá sàn theo chi phí chỉ là mức thấp nhất, giá theo giá trị khách nhận thường cao hơn.
3. Trước mọi đề xuất giảm giá, tính lãi còn lại mỗi đơn sau giảm và số đơn cần bán thêm để giữ nguyên tổng lãi gộp, bằng biên hiện tại chia cho (biên hiện tại trừ mức giảm). Ví dụ biên 40 phần trăm mà giảm 20 phần trăm thì phải bán gấp đôi số đơn. Trình bảng này cho anh chị trước khi bàn tiếp.
4. Chẩn đoán ưu đãi hiện tại theo bốn đòn bẩy giá trị gồm kết quả khách muốn, mức khách tin sẽ đạt được, thời gian chờ kết quả, công sức khách phải bỏ ra. Chấm mỗi đòn bẩy từ 1 đến 10 dựa trên điều anh chị kể, đòn bẩy thấp nhất là chỗ nên sửa trước. Phần lớn yêu cầu "giảm giá đi" thật ra là cần tăng giá trị hoặc giảm rủi ro cho khách.
5. Kiểm tra sáu thành phần của ưu đãi gồm phần cốt lõi, quà kèm, bảo hành, lý do mua ngay, tên gói, giá và cách thanh toán. Chỉ ra thành phần nào thiếu hoặc yếu. Mỗi lần chỉ sửa một hai thành phần để còn đo được hiệu quả.
6. Soạn hai đến ba phương án ưu đãi. Mỗi phương án ghi rõ giá vốn tăng thêm của quà kèm hay bảo hành, lãi gộp còn lại mỗi đơn, rủi ro, điều kiện để phương án đúng. Quà kèm nên là thứ khách cần thật, giá vốn thấp, giá trị cảm nhận cao. Cam kết đảo ngược rủi ro phải có điều kiện rõ ràng và anh chị làm được, như làm lại miễn phí trong 7 ngày hay đổi trả trong 3 ngày, kèm ước chi phí nếu một phần khách dùng tới cam kết.
7. Nếu anh chị cần bậc gói, dựng ba bậc cơ bản, tiêu chuẩn, cao cấp với điểm khác biệt rõ giữa các bậc, biên lợi nhuận từng bậc, và một gói cao hơn đóng vai giá neo làm gói giữa trông hợp lý. Tránh dồn quá nhiều thứ vào gói cao nhất khiến khách chỉ mua gói giữa mãi. Đưa khoảng giá kèm lý do, không chốt một con số.
8. Rà câu chữ ưu đãi. Bỏ khan hiếm giả như đồng hồ đếm ngược không có thật hay "chỉ còn 3 suất" khi không đúng, bỏ "trị giá X triệu" khi không có căn cứ so sánh, bỏ cam kết "100 phần trăm" không có điều kiện. Chương trình khuyến mại có thể phải thông báo hoặc đăng ký theo quy định, nhắc anh chị hỏi kế toán hoặc luật sư, không tự khẳng định.
9. Đưa anh chị duyệt bảng biên và các phương án. Hỏi "Anh chị chọn phương án nào, giá cuối cùng anh chị quyết là bao nhiêu?". Không tự đổi giá trên sàn, trên web hay trong phần mềm bán hàng, không tự đăng chương trình. Khi anh chị chốt giá, chốt gói hay chốt mức giảm, gọi `aifb_record_decision` để ghi vào sổ quyết định kèm biên lợi nhuận tại thời điểm chốt.

## Tiêu chuẩn đầu ra

Báo cáo tiếng Việt một trang theo thứ tự "Bảng biên lợi nhuận", "Nếu giảm giá thì mất gì", "Chỗ ưu đãi đang yếu", "Các phương án" (mỗi phương án có giá vốn thêm, lãi còn lại, rủi ro, điều kiện), "Bậc gói và giá neo" nếu có, "Câu hỏi để anh chị chốt". Tiền viết kiểu "6,5 triệu", biên ghi phần trăm. Mọi giá vốn lấy từ số anh chị đưa, thiếu ghi "chưa có số". Giá luôn đưa dưới dạng khoảng kèm đánh đổi, anh chị quyết con số. Không bịa giá đối thủ, không bịa mức thuế hay quy định. Không khan hiếm giả, không cam kết không làm được. Không đổi giá hay đăng gì ra ngoài khi chưa có lời "làm đi".

## Ba ca mẫu

### Ca 1: Cửa hàng mỹ phẩm thủ công hộ kinh doanh bán Shopee, định giảm 20 phần trăm
Đầu vào: Chủ cửa hàng bán lọ dưỡng thể giá 250 nghìn, giá vốn gồm nguyên liệu, bao bì và phí sàn là 150 nghìn, mỗi tháng bán 300 lọ (số giả định). Muốn giảm 20 phần trăm còn 200 nghìn để tăng đơn dịp cuối năm. Có sẵn gói mẫu thử giá vốn 15 nghìn.
Bối cảnh: Chủ cửa hàng chưa từng tính biên, thấy đối thủ giảm nên muốn giảm theo.
Đầu ra đạt chuẩn: Bảng biên cho thấy lãi 100 nghìn mỗi lọ, biên 40 phần trăm, tổng lãi 30 triệu mỗi tháng. Giảm còn 200 nghìn thì lãi còn 50 nghìn mỗi lọ, phải bán 600 lọ mới giữ được 30 triệu. Phương án thay thế là giữ giá, tặng gói mẫu thử, lãi còn 85 nghìn mỗi lọ, chỉ cần khoảng 353 lọ để giữ tổng lãi. Phương án thứ hai là combo hai lọ kèm quà. Câu hỏi chốt để chủ cửa hàng chọn.
Tiêu chí chấm:
- Tính đúng 600 lọ cần bán khi giảm 20 phần trăm.
- Bảng biên có trước mọi đề xuất.
- Quà kèm có giá vốn và lãi còn lại.
- Không tự đổi giá trên Shopee.
- Không bịa giá của đối thủ.

### Ca 2: Công ty bảo trì điều hoà 40 người, dựng ba bậc gói cho khách văn phòng
Đầu vào: Giám đốc muốn bán hợp đồng năm theo máy. Gói cơ bản hai lần vệ sinh giá 900 nghìn, giá vốn 540 nghìn. Gói tiêu chuẩn bốn lần kèm ưu tiên xử lý trong 24 giờ giá 1,6 triệu, giá vốn 1 triệu. Gói cao cấp thêm thay linh kiện nhỏ giá 2,8 triệu, giá vốn 1,6 triệu (số giả định). Muốn thêm cam kết làm lại miễn phí.
Bối cảnh: Phần lớn khách đang chọn gói rẻ nhất, giám đốc muốn đẩy khách lên gói giữa.
Đầu ra đạt chuẩn: Biên ba bậc lần lượt 40 phần trăm, 37,5 phần trăm và khoảng 42,9 phần trăm, nêu rõ gói giữa đang có biên thấp nhất nên cần xem lại trước khi đẩy. Gói cao cấp đóng vai giá neo. Cam kết làm lại miễn phí trong 7 ngày kèm ước chi phí nếu một phần khách dùng tới. Đưa khoảng giá hợp lý cho gói giữa kèm lý do, không chốt con số.
Tiêu chí chấm:
- Tính đúng biên từng bậc.
- Chỉ ra gói giữa biên thấp nhất.
- Cam kết có điều kiện và ước chi phí.
- Đưa khoảng giá, không một con số.
- Có gọi `aifb_record_decision` khi giám đốc chốt giá.

### Ca 3: Nhà thiết kế nhận diện thương hiệu tự do, muốn tăng giá mà không mất khách
Đầu vào: Nhà thiết kế nhận dự án 12 triệu, trung bình mất 40 giờ, chi phí phần mềm và in thử 1,2 triệu mỗi dự án (số giả định). Muốn thu khoảng 400 nghìn mỗi giờ. Khách hay lo làm xong không ưng.
Bối cảnh: Làm một mình, sợ tăng giá thì khách chạy sang người khác.
Đầu ra đạt chuẩn: Tính hiện đang thu 270 nghìn mỗi giờ sau chi phí. Để đạt 400 nghìn mỗi giờ với 40 giờ, giá sàn là 17,2 triệu. Chẩn đoán đòn bẩy yếu nhất là mức khách tin sẽ đạt được, đề xuất quy trình hai vòng chỉnh sửa rõ ràng và một gói mở rộng kèm bộ ấn phẩm làm giá neo. Nêu rủi ro nếu cam kết hoàn cọc và để nhà thiết kế tự chọn có cam kết hay không.
Tiêu chí chấm:
- Tính đúng 270 nghìn mỗi giờ và giá sàn 17,2 triệu.
- Sửa ưu đãi trước khi bàn giá.
- Cam kết có nêu rủi ro, không tự hứa thay.
- Không khan hiếm giả.
- Báo cáo một trang, có câu hỏi chốt.

## Nguồn
Chuyển thể từ `skills/offers` và `skills/pricing` trong coreyhaines31/marketingskills (MIT), `commercial/skills/pricing-strategist` và `commercial/skills/deal-desk` trong alirezarezvani/claude-skills (MIT), và `business/pricing-optimizer` trong openaccountant/skills (MIT).
