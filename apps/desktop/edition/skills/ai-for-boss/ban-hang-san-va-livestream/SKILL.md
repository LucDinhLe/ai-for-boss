---
name: ban-hang-san-va-livestream
description: "Vận hành gian hàng Shopee, TikTok Shop, Lazada gồm tên và ảnh sản phẩm, giá, khuyến mãi của sàn, đánh giá, và lên kịch bản phiên livestream bán hàng theo khung giờ, sản phẩm mồi, ưu đãi chốt."
version: 1.0.0
author: Lê Đình Lực (AI for Boss)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [AI for Boss, Doanh nghiệp, Tiếng Việt]
    emoji: "🛒"
---

# Bán hàng trên sàn và livestream

## Khi nào dùng

Dùng khi anh chị bán trên Shopee, TikTok Shop hoặc Lazada và muốn sửa trang sản phẩm cho dễ được tìm thấy, chuẩn bị cho một đợt khuyến mãi lớn của sàn, đọc báo cáo gian hàng, hoặc cần kịch bản cho một phiên livestream bán hàng. Kỹ năng này soạn tên sản phẩm, mô tả, danh sách ảnh cần chụp, bảng giá và khuyến mãi dự kiến, kịch bản phiên live theo từng khúc giờ. Quy định và biểu phí của sàn thay đổi thường xuyên, trợ lý không nêu mức phí hay luật sàn theo trí nhớ, luôn nhắc anh chị đối chiếu trên trang người bán (Seller Center) trước khi làm.

Không dùng để chạy quảng cáo ngoài sàn trên Facebook, Google, việc đó chuyển sang `quang-cao-tra-phi`. Không dùng để tìm và thoả thuận với KOC làm tiếp thị liên kết, việc đó chuyển sang `hop-tac-koc-kol`. Không dùng để quyết giá bán gốc hay cấu trúc ưu đãi dài hạn, việc đó chuyển sang `thiet-ke-uu-dai-va-gia`. Trả lời đánh giá xấu công khai thì dùng `theo-doi-danh-gia-cong-khai`.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi mới làm.

1. Anh chị bán trên sàn nào, gian hàng đã chạy bao lâu? Việc cần làm lần này là sửa trang sản phẩm, chuẩn bị đợt khuyến mãi, đọc báo cáo, hay lên kịch bản live?
2. Danh sách sản phẩm cần xử lý gồm tên hiện tại, giá bán, giá vốn, tồn kho. Tệp xuất từ Seller Center, KiotViet, Sapo hay Excel đều được.
3. Anh chị đang tính phí sàn, phí thanh toán, phí vận chuyển mỗi đơn là bao nhiêu? Lấy từ trang người bán hoặc sao kê đối soát, trợ lý không tự điền.
4. Nếu làm livestream, phiên dự kiến vào ngày giờ nào, dài bao lâu, ai đứng live, có người trực bình luận và chốt đơn không?
5. Ưu đãi anh chị chấp nhận được là gì, mức giảm tối đa, quà tặng, số suất giới hạn?
6. Có báo cáo gian hàng 30 ngày gần nhất (lượt xem, tỉ lệ chuyển đổi, đánh giá) để dán vào không?

## Quy trình

1. Tính lãi mỗi đơn cho từng sản phẩm bằng Python từ giá bán, giá vốn và các khoản phí anh chị đưa. Chỗ phí nào anh chị chưa đưa, ghi "chưa có số, anh chị kiểm trên trang người bán" và chưa kết luận lãi lỗ. Mức giảm giá nào làm đơn lỗ thì đánh dấu đỏ trước khi đi tiếp.
2. Viết lại tên sản phẩm theo cấu trúc từ khoá chính, đặc điểm phân biệt, quy cách, ví dụ "Bánh tráng trộn Tây Ninh, vị tắc muối nhuyễn, túi 500g". Dùng từ khách hay gõ trên thanh tìm kiếm của sàn, lấy từ gợi ý tìm kiếm của chính sàn. Không nhồi từ khoá lặp lại, không dùng tên thương hiệu người khác.
3. Viết mô tả gồm ba lợi ích chính, thông số, hướng dẫn dùng, chính sách đổi trả theo lời anh chị. Không viết công dụng chữa bệnh, không viết "tốt nhất", "số một" khi không có bằng chứng.
4. Lập danh sách ảnh và video cần có gồm ảnh bìa vuông nền sạch, ảnh cận chất liệu, ảnh kích thước so với vật quen, ảnh đang dùng, video ngắn 15 đến 30 giây. Nêu ảnh nào đang thiếu so với sản phẩm cùng loại bán chạy.
5. Chuẩn bị đợt khuyến mãi của sàn. Lập bảng sản phẩm tham gia, giá gốc, giá khuyến mãi, lãi còn lại, số suất, loại công cụ dùng như mã giảm giá của shop, combo, mua kèm, giảm giá chớp nhoáng (flash sale). Nhắc anh chị kiểm điều kiện đăng ký và hạn chót trên trang người bán, vì mỗi đợt sàn đặt điều kiện riêng.
6. Lên kịch bản livestream theo khúc thời gian. Mười phút đầu khởi động với sản phẩm mồi giá tốt số lượng ít để kéo người xem ở lại. Phần thân là vòng lặp giới thiệu, trả lời bình luận, chốt đơn cho từng sản phẩm chính, mỗi vòng 10 đến 15 phút. Có một đến hai đỉnh ưu đãi chốt vào lúc đông người xem nhất, và phần kết nhắc lại mã giảm giá cùng lịch phiên sau. Mỗi khúc ghi người nói, câu mẫu, việc của người trực bình luận.
7. Kèm bảng kiểm trước phiên live gồm ánh sáng, âm thanh, mạng, giỏ hàng đã gắn đúng sản phẩm, mã giảm giá đã tạo và thử, tồn kho khớp số suất, tin nhắn báo lịch qua Zalo và Facebook. Khan hiếm chỉ nói đúng số suất thật, không đếm ngược giả hay đọc tên người mua giả.
8. Khi đọc báo cáo gian hàng, chỉ ra ba sản phẩm có nhiều lượt xem mà ít đơn (thường do ảnh, giá hoặc đánh giá) và ba sản phẩm chuyển đổi tốt nên đẩy thêm. Với đánh giá xấu, gom thành nhóm nguyên nhân như đóng gói, giao chậm, sai mô tả.
9. Trình toàn bộ nội dung và bảng giá cho anh chị duyệt, hỏi "Anh chị kiểm giúp giá khuyến mãi và phí sàn đã khớp trang người bán chưa?". Không tự đăng, không tự sửa giá trên sàn. Khi anh chị chốt giá hoặc ưu đãi, gọi `aifb_record_decision`.

## Tiêu chuẩn đầu ra

Tệp tiếng Việt gọn gàng, dán thẳng vào trang người bán hoặc in ra cho người đứng live, đạt các điểm sau:

- Bảng sản phẩm có tên mới, lãi mỗi đơn trước và sau khuyến mãi, chỗ thiếu phí ghi "chưa có số".
- Mô tả và danh sách ảnh cho từng sản phẩm ưu tiên.
- Kịch bản live chia khúc theo phút, có sản phẩm mồi, vòng chốt, đỉnh ưu đãi, câu mẫu và phân vai.
- Không nêu mức phí sàn, tỉ lệ hoa hồng hay quy định sàn theo trí nhớ, luôn trỏ về trang người bán.
- Không có công dụng hay cam kết bịa, không có khan hiếm giả.
- Mọi việc đăng, đổi giá, tạo mã giảm giá do anh chị làm sau khi duyệt.

## Ba ca mẫu

### Ca 1: Hộ kinh doanh đặc sản Tây Ninh bán Shopee
Đầu vào: Chủ shop dán 12 sản phẩm, giá bán 45 đến 120 nghìn, giá vốn từng món, tổng phí sàn và thanh toán anh tự tính khoảng 14 phần trăm theo đối soát tháng trước (số giả định). Muốn tham gia đợt khuyến mãi ngày đôi sắp tới.
Bối cảnh: Hai vợ chồng tự đóng gói, chưa từng tham gia đợt lớn.
Đầu ra đạt chuẩn: Bảng lãi cho thấy 3 món sẽ lỗ nếu giảm 20 phần trăm, đề xuất chỉ cho 5 món lãi cao tham gia. Tên mới cho 12 món, danh sách ảnh còn thiếu. Nhắc kiểm điều kiện và hạn đăng ký đợt trên trang người bán.
Tiêu chí chấm:
- Dùng đúng 14 phần trăm anh đưa, không tự nêu phí sàn.
- Phát hiện món lỗ trước khi đề xuất giảm giá.
- Tên sản phẩm không nhồi từ khoá.
- Không tự đăng ký đợt khuyến mãi.

### Ca 2: Công ty mỹ phẩm 25 người livestream TikTok Shop hằng tuần
Đầu vào: Trưởng nhóm bán hàng cần kịch bản phiên 2 tiếng tối thứ Sáu từ 20 giờ, 6 sản phẩm, một son dưỡng làm sản phẩm mồi 50 suất giá 39 nghìn, ưu đãi chốt là combo 3 món giảm 25 phần trăm (số giả định).
Bối cảnh: Một người đứng live, hai người trực bình luận.
Đầu ra đạt chuẩn: Kịch bản chia khúc 20 giờ đến 20 giờ 10 mở bằng son dưỡng mồi, bốn vòng chốt cho sản phẩm chính, đỉnh combo lúc khoảng 21 giờ, kết bằng mã giảm giá và lịch tuần sau. Câu mẫu không nói công dụng điều trị. Bảng kiểm trước phiên đầy đủ.
Tiêu chí chấm:
- Số suất nói trên live đúng 50.
- Có phân vai cho người trực bình luận.
- Không có câu công dụng điều trị.
- Có bảng kiểm kỹ thuật và mã giảm giá.

### Ca 3: Nhân viên văn phòng bán đồ len handmade trên Lazada lúc rảnh
Đầu vào: Chị có 8 sản phẩm, lượt xem khá nhưng rất ít đơn, 4 đánh giá 2 sao nhắc "màu khác ảnh" (số giả định).
Bối cảnh: Mỗi tuần chỉ có vài giờ buổi tối.
Đầu ra đạt chuẩn: Chẩn đoán ảnh chụp lệch màu là nguyên nhân chính, đề xuất chụp lại dưới ánh sáng tự nhiên và thêm dòng "màu có thể lệch nhẹ do màn hình" vào mô tả. Viết lại tên và mô tả 8 sản phẩm. Kế hoạch vừa sức vài giờ mỗi tuần, chưa đề xuất livestream.
Tiêu chí chấm:
- Nhóm đánh giá xấu theo nguyên nhân.
- Việc đề xuất vừa với thời gian của chị.
- Không đẩy sang livestream khi gian hàng chưa sửa xong ảnh.
- Không bịa số liệu gian hàng.
- Có câu hỏi duyệt trước khi sửa trên sàn.

## Nguồn
Chuyển thể từ `skills/content/tiktok-shop-strategy`, `skills/content/livestream-selling` và `skills/ads/ecommerce-marketplace` trong viethahong/business-skills (MIT).
