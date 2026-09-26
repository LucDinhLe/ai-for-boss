---
name: phan-tich-lai-lo
description: "Lập và đọc báo cáo lãi lỗ theo kỳ, so kế hoạch với thực tế, tách chênh lệch do giá, lượng, chi phí, tính điểm hoà vốn, biên đóng góp, lợi nhuận theo sản phẩm hoặc khách, viết lời giải thích dễ hiểu cho chủ."
version: 1.0.0
author: Lê Đình Lực (AI for Boss)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [AI for Boss, Doanh nghiệp, Tiếng Việt]
    emoji: "📊"
---

# Phân tích lãi lỗ

## Khi nào dùng

Dùng khi anh chị muốn biết tháng này, quý này lãi hay lỗ và vì sao, khi thực tế lệch xa kế hoạch, khi cần biết bán bao nhiêu mới hoà vốn, hoặc muốn biết sản phẩm nào, khách nào thật sự mang lại lợi nhuận. Kỹ năng này lập báo cáo lãi lỗ từ dữ liệu anh chị có, tách chênh lệch thành từng nguyên nhân có số tiền cụ thể và viết lời giải thích bằng ngôn ngữ của chủ doanh nghiệp. Không dùng để hỏi còn đủ tiền mặt trả lương không, việc đó chuyển sang `du-bao-dong-tien`. Không dùng để gom hoá đơn, đối chiếu sao kê cuối tháng cho kế toán, việc đó thuộc `chuan-bi-chung-tu-cho-ke-toan`. Không dùng để quyết định giá bán mới, khi cần thiết kế lại giá chuyển sang `thiet-ke-uu-dai-va-gia`. Báo cáo này phục vụ quản trị nội bộ, báo cáo tài chính nộp cơ quan nhà nước do kế toán lập.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi mới làm. Không tự điền kế hoạch, không tự chia chi phí cố định hay biến đổi khi chưa hỏi.

1. Anh chị muốn xem kỳ nào, tháng, quý hay năm, và so với gì, kế hoạch, cùng kỳ năm trước hay kỳ liền trước?
2. Anh chị gửi số liệu doanh thu và chi phí được không? Báo cáo kết quả kinh doanh từ MISA, tệp xuất KiotViet, Sapo, Haravan, báo cáo sàn Shopee, TikTok Shop, Lazada, bảng Excel hay sao kê ngân hàng đều được.
3. Có số lượng bán và giá bán theo từng sản phẩm hoặc nhóm sản phẩm không? Nếu có, em tách được chênh lệch do giá và do lượng.
4. Kế hoạch hoặc ngân sách của kỳ này là bao nhiêu, gồm doanh thu, sản lượng, giá bình quân, các khoản chi chính?
5. Chi phí nào thay đổi theo lượng bán (nguyên liệu, hoa hồng, phí sàn, vận chuyển) và chi phí nào gần như cố định (lương cứng, thuê mặt bằng, khấu hao, lãi vay)? Nếu anh chị chưa chia, em đề xuất bảng chia để anh chị sửa.
6. Anh chị cần xem lợi nhuận theo sản phẩm, theo khách hay theo kênh? Chi phí nào gắn trực tiếp được cho từng sản phẩm hoặc khách?
7. Ai sẽ đọc báo cáo, chỉ anh chị, người cùng góp vốn hay ngân hàng? Có mức chênh lệch nào anh chị coi là đáng xem xét, ví dụ lệch trên 10 phần trăm?

## Quy trình

1. Chuẩn hoá dữ liệu bằng mã Python, gom doanh thu, giá vốn hàng bán, chi phí hoạt động, lãi vay theo đúng kỳ. Ghi rõ báo cáo tính theo tiền thực thu chi hay theo hoá đơn phát sinh, vì hai cách cho kết quả khác nhau. Khoản nào chưa rõ nhóm thì ghi "cần anh chị xác nhận", không tự gán.
2. Lập báo cáo lãi lỗ theo thứ tự doanh thu, giá vốn, lợi nhuận gộp và biên lợi nhuận gộp, chi phí hoạt động, lợi nhuận hoạt động, lãi vay và khoản khác, lợi nhuận trước thuế. Đặt cột kỳ này, cột so sánh, chênh lệch bằng tiền và bằng phần trăm cạnh nhau. Không tự tính thuế thu nhập, phần đó để kế toán xác định.
3. Với các dòng lệch vượt ngưỡng anh chị chọn, tách nguyên nhân bằng mã. Doanh thu tách thành phần do lượng, tính bằng chênh lượng nhân giá kế hoạch, và phần do giá, tính bằng chênh giá nhân lượng thực tế. Chi phí biến đổi tách thành phần do lượng và phần do đơn giá. Chi phí cố định tách theo khoản cụ thể. Kiểm tra tổng các phần đúng bằng tổng chênh lệch.
4. Tính biên đóng góp (contribution margin) trên mỗi đơn vị và theo tỉ lệ, điểm hoà vốn theo số lượng và theo doanh thu, biên an toàn so với doanh số thực tế. Tính cho cả kế hoạch và thực tế để thấy điểm hoà vốn dịch chuyển ra sao.
5. Nếu anh chị cần, tính lợi nhuận theo sản phẩm hoặc theo khách. Chi phí trực tiếp gán thẳng, chi phí chung phân bổ theo tỉ lệ doanh thu và ghi rõ đây là cách phân bổ đơn giản có thể lệch. Tính tỉ trọng doanh thu của từng khách, cảnh báo khi một khách chiếm trên 25 phần trăm. Với người làm dịch vụ, tính thêm doanh thu bình quân trên mỗi giờ làm.
6. Viết lời giải thích cho từng chênh lệch lớn theo khung bốn ý gồm chuyện gì xảy ra, bao nhiêu tiền, vì sao, và sẽ lặp lại hay chỉ một lần. Tránh câu vòng vo như "doanh thu giảm do doanh thu thấp". Nêu những câu hỏi anh chị cần trả lời thêm, ví dụ vì sao giá nguyên liệu tăng.
7. Trình anh chị bản nháp. Hỏi "Anh chị kiểm tra giúp cách chia chi phí cố định và biến đổi, có đúng thực tế không?". Sau khi duyệt mới xuất sang `xlsx`, `docx` hoặc `powerpoint`. Khi anh chị chốt một quyết định từ báo cáo, ví dụ tăng giá hay ngừng một sản phẩm, gọi `aifb_record_decision`.

## Tiêu chuẩn đầu ra

Một trang tiếng Việt mở đầu bằng kết luận rõ ràng, ví dụ "lãi 6 triệu, thấp hơn kế hoạch 8 triệu, chủ yếu vì giá bán giảm và nguyên liệu tăng". Tiếp theo là bảng lãi lỗ có cột so sánh, bảng cầu nối (waterfall) từ lợi nhuận kế hoạch tới thực tế với từng nguyên nhân, điểm hoà vốn và biên đóng góp, lợi nhuận theo sản phẩm hoặc khách nếu có yêu cầu. Lời giải thích gọn gàng, mỗi nguyên nhân hai đến bốn câu. Mọi con số do mã Python tính từ dữ liệu anh chị đưa, tổng các nguyên nhân khớp tổng chênh lệch. Chỗ thiếu ghi "chưa có số". Không đưa lời khuyên thuế, không bịa thuế suất, nhắc rằng số liệu nộp cơ quan nhà nước cần kế toán xác nhận.

## Ba ca mẫu

### Ca 1: Hộ kinh doanh tiệm bánh ngọt, lãi giảm dù bán nhiều hơn
Đầu vào: Kế hoạch tháng bán 3.000 chiếc giá 25.000 đồng, nguyên liệu và bao bì 11.000 đồng mỗi chiếc. Thực tế bán 3.400 chiếc giá bình quân 22.000 đồng vì chạy khuyến mãi, chi phí biến đổi 12.000 đồng mỗi chiếc vì bơ tăng giá. Chi phí cố định 28 triệu một tháng (số giả định).
Bối cảnh: Chủ tiệm ghi sổ Excel, thắc mắc "bán nhiều hơn sao lãi ít đi".
Đầu ra đạt chuẩn: Doanh thu 74,8 triệu so với kế hoạch 75 triệu, gần như không đổi vì phần tăng do lượng 10 triệu bị phần giảm do giá 10,2 triệu bù trừ. Chi phí biến đổi tăng 7,8 triệu, gồm 4,4 triệu do bán nhiều hơn và 3,4 triệu do đơn giá nguyên liệu tăng. Lợi nhuận 6 triệu so với kế hoạch 14 triệu, giảm 8 triệu. Biên đóng góp mỗi chiếc giảm từ 14.000 đồng xuống 10.000 đồng, điểm hoà vốn tăng từ 2.000 chiếc lên 2.800 chiếc, biên an toàn còn 17,6 phần trăm. Lời giải thích nói thẳng khuyến mãi làm mất phần lợi của việc bán thêm.
Tiêu chí chấm:
- Tổng phần do lượng và do giá bằng đúng chênh lệch doanh thu 0,2 triệu.
- Chênh lệch lợi nhuận 8 triệu khớp tổng các nguyên nhân.
- Điểm hoà vốn tính cho cả kế hoạch và thực tế.
- Không tự kết luận nên bỏ khuyến mãi, chỉ nêu tác động.
- Lời giải thích dùng ngôn ngữ của chủ tiệm, không dùng thuật ngữ khi chưa giải nghĩa.

### Ca 2: Công ty dịch vụ vệ sinh công nghiệp 40 người, lợi nhuận theo khách
Đầu vào: Sáu tháng doanh thu 2.400 triệu từ bốn khách lớn và nhóm khách nhỏ. Khách A doanh thu 820 triệu, chi phí trực tiếp 610 triệu. Khách B 540 triệu, chi phí trực tiếp 300 triệu. Khách C 390 triệu, 180 triệu. Khách D 250 triệu, 120 triệu. Nhóm khách nhỏ 400 triệu, 220 triệu. Chi phí chung 520 triệu (số giả định).
Bối cảnh: Giám đốc cho rằng khách A là khách quý nhất vì doanh thu lớn nhất.
Đầu ra đạt chuẩn: Chi phí chung phân bổ theo doanh thu, khách A chịu 177,7 triệu, lợi nhuận chỉ 32,3 triệu, biên 3,9 phần trăm. Khách C lãi 125,5 triệu, biên 32,2 phần trăm, cao nhất. Tổng lợi nhuận 450 triệu, biên 18,8 phần trăm. Khách A chiếm 34,2 phần trăm doanh thu, hai khách lớn nhất chiếm 56,7 phần trăm, báo cáo cảnh báo rủi ro tập trung doanh thu. Báo cáo nêu cách phân bổ theo doanh thu có thể làm lệch kết quả và đề nghị kiểm lại giờ công thực tế cho khách A.
Tiêu chí chấm:
- Xếp hạng khách theo biên lợi nhuận, không theo doanh thu.
- Nêu rõ giới hạn của cách phân bổ chi phí chung.
- Không tự khuyên bỏ khách A, chỉ nêu phương án đàm phán lại giá hoặc phạm vi.
- Có gọi `aifb_record_decision` khi giám đốc chốt hướng xử lý.
- Tổng lợi nhuận 450 triệu khớp tổng lợi nhuận từng khách.

### Ca 3: Chuyên gia tư vấn tự do tính giờ, quý này lỗ
Đầu vào: Giá niêm yết 800.000 đồng một giờ, phí nền tảng và công cụ bằng 10 phần trăm doanh thu, chi cố định 25 triệu một tháng. Trong quý, khách X trả 36 triệu cho 60 giờ, khách Y trả 24 triệu cho 20 giờ, khách Z trả 18 triệu cho 35 giờ (số giả định).
Bối cảnh: Người dùng làm một mình, muốn biết cần làm bao nhiêu giờ mỗi tháng để không lỗ.
Đầu ra đạt chuẩn: Doanh thu quý 78 triệu cho 115 giờ, bình quân khoảng 678 nghìn đồng một giờ, thấp hơn giá niêm yết. Lợi nhuận quý âm 4,8 triệu. Theo giá niêm yết cần khoảng 34,7 giờ một tháng để hoà vốn, theo đơn giá bình quân thực tế cần khoảng 41 giờ, trong khi thực làm khoảng 38,3 giờ. Doanh thu bình quân mỗi giờ của khách Y là 1,2 triệu, khách X 600 nghìn, khách Z khoảng 514 nghìn. Lời giải thích chỉ ra khách Z và phần làm thêm giờ ngoài báo giá kéo đơn giá xuống.
Tiêu chí chấm:
- Tính hoà vốn theo cả giá niêm yết và giá thực tế.
- Doanh thu mỗi giờ của từng khách tính đúng.
- Không bịa số thuế phải nộp.
- Giọng ngang hàng, không hô hào.
- Nêu rõ giờ thực làm thấp hơn giờ hoà vốn theo giá thực tế.

## Nguồn
Chuyển thể từ `finance/skills/variance-analysis` và `finance/skills/financial-statements` trong anthropics/knowledge-work-plugins (Apache 2.0), `business/break-even-calc`, `business/profit-loss`, `business/client-profitability` và `business/revenue-concentration` trong openaccountant/skills (MIT), `skills/finance/unit-economics` trong viethahong/business-skills (MIT).
