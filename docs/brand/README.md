# Nhận diện AI for Boss

Ngày cập nhật: 2026-09-08

Trạng thái: **Vành Đơn được Product Owner duyệt làm logo và app icon**

## Icon chính thức — Vành Đơn

Khối turquoise trầm ở tâm đại diện cho con người. Vành gradient cyan → indigo
bao quanh nhưng để hở, thể hiện công nghệ/AI phục vụ con người trong khi quyền
quyết định luôn thuộc về người dùng.

### Màu chuẩn

- Tâm trên nền sáng: `#3D7A73`.
- Tâm trên nền tối: `#4FA69D`.
- Vành gradient: `#38BDF8` → `#4F46B8`.
- Than đậm: `#1C1A17`; nền ngà: `#F6F3ED`.

### Asset chuẩn

- `assets/ai-for-boss-mark.svg`: logo vector nền sáng.
- `assets/ai-for-boss-mark-dark.svg`: logo vector nền tối.
- `assets/ai-for-boss-mark-mono-dark.svg` và `-mono-light.svg`: bản đơn sắc.
- `assets/app-icons/`: PNG 16–1024 px, ICO, ICNS và favicon.

Khoảng trống an toàn tối thiểu bằng 25% chiều rộng mark; kích thước tối thiểu
16 px. Không đổi hướng bản tĩnh, đổ bóng hoặc thêm chữ vào trong mark. Wordmark vẫn viết
`AI for Boss` ở lần xuất hiện đầu.

### Chuyển động khi mô hình hoạt động

Owner duyệt chuyển động trong `AI for Boss - App Icon.dc.html` của ZIP
`Bốn concept icon được đề xuất.zip` (Feature0035/D0054), thay quy định không
xoay đối với trạng thái hoạt động. Vành chuẩn xoay 0–360° trong 2,2 giây,
linear, quanh tâm (50, 50). Tâm vẫn ở (50, 50), nhịp 1,6 giây ease-in-out:
bán kính 17 → 19 → 17, độ mờ 1 → 0,88 → 1. Giữ nguyên hình và màu SVG sáng/tối.

Chỉ chạy khi có tín hiệu hoạt động mô hình hiện hành đã kiểm từ lõi/host;
dừng thì trở lại asset tĩnh. Không dùng hiệu ứng làm bằng chứng có suy nghĩ
hoặc tiến độ chưa được báo. Khi hệ thống yêu cầu giảm chuyển động, cả hai
hiệu ứng tắt. ZIP được đọc như dữ liệu; các script và tài nguyên ngoài trong
tài liệu tham chiếu không được chạy hoặc mang vào ứng dụng.

## Concept lịch sử bị loại — La bàn quyết định

Product Owner từ chối concept này ngày 2026-08-11 vì chất lượng tạo hình chưa đạt yêu cầu thương hiệu. Concept không được dùng trong app, installer, website, release artifact hoặc tài liệu marketing.

Biểu tượng kết hợp:

- Khối `B` đại diện cho Boss và năng lực điều hành.
- Khoảng âm hình `A` đại diện cho AI.
- Đỉnh `A` hướng lên như kim la bàn, thể hiện định hướng và ra quyết định.
- Hai khoang của `B` gợi hai lớp Worker và Advisor.
- Biên dạng không dùng robot, bộ não, bong bóng AI hoặc tài sản nhận diện của sản phẩm khác.

## Tệp lưu hồ sơ lịch sử

Lịch sử concept cũ được truy vết trong Git trước Feature 0.10. Concept cũ không
được dùng trong app, installer, website hoặc tài liệu marketing.

## Màu concept cũ

- Copper chính: `#B7642F`.
- Copper trên app tile: `#E29A65`.
- Nâu than: `#211B17`.

Màu production phải đi qua contrast, dark/light, color-blind và installer visibility test.

## Cổng còn mở trước public release

- Không thêm mắt, antenna, mặt robot, tia lấp lánh hoặc chữ `AI` rời bên trong mark.
- Không tiếp tục biến thể ghép `A`, `B` hoặc `AI` thành monogram hình học làm ý tưởng chính.
- Wordmark vẫn viết `AI for Boss`; icon không thay thế tên ở lần xuất hiện đầu.
- Vành Đơn đã có bản đơn sắc, sáng/tối và app icon đa nền tảng; vẫn cần small-size
  human review độc lập, visual-similarity/trademark review trước public release.
- `TRADEMARKS.md` hiện chỉ là internal draft; chưa cấp trademark permission hoặc
  thay external legal/trademark review.
