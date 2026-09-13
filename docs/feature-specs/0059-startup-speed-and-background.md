# 0059 — Mở lên là dùng được: chạy nền, gộp đăng ký plugin, đo thời gian khởi động

## Số đo, không phải phỏng đoán

Log của lõi trên máy Product Owner ngày 13/09/2026, lần mở đầu tiên của beta37:

| Mốc | Giờ | Khoảng |
|---|---|---|
| Bắt đầu nạp cấu hình | 09:10:43 | |
| Máy chủ HTTP lắng nghe, 13 plugin đã nạp | 09:11:57 | lõi tự báo 63,6 giây riêng cho việc nạp plugin |
| Gateway sẵn sàng | 09:12:07 | **84 giây kể từ đầu** |
| Khởi động lại lần một (đăng ký bộ xuất tài liệu) | 09:12:30 → 09:12:38 | 8 giây |
| Khởi động lại lần hai (đăng ký harness) | 09:12:53 → 09:13:03 | 10 giây |
| Tổng tới lúc dùng được | | **2 phút 20 giây** |

Hai điều rút ra. Khởi động lại khi máy đã ấm chỉ mất 4 tới 10 giây, nên 84 giây kia gần như toàn bộ là đọc đĩa lần đầu cộng Defender quét, không phải lõi chậm. Và vỏ tự làm mất thêm 56 giây bằng cách đăng ký hai plugin thành hai lượt.

Log cũng cho thấy `models.list` mất 96 giây khi lõi đang dò tài khoản, và vỏ hỏi ba lần song song trên cùng một kết nối.

Cho tới spec này, ứng dụng không ghi lại thời gian bước nào cả; bằng chứng duy nhất là log của lõi nằm trong thư mục tạm của Windows. Vì thế "mở lâu" không quy được về bước nào.

## Quyết định

- **Bộ chạy sống qua các lần đóng cửa sổ.** Đóng cửa sổ thì ẩn cửa sổ và giữ Gateway; biểu tượng khay giữ ứng dụng sống; mở lại là nối vào tiến trình đang chạy. Menu khay có Mở, ô đánh dấu Giữ chạy nền khi đóng cửa sổ, dòng trạng thái bộ chạy, và Thoát hẳn. `background-mode.mjs` giữ phần quyết định thuần (`shouldHideOnClose`, `trayMenuTemplate`, `BackgroundPreference`) để kiểm được không cần Electron. Lựa chọn được nhớ qua các lần chạy, mặc định bật, tệp hỏng thì về mặc định.
- **Thoát vẫn là thoát.** Chỉ Thoát hẳn hoặc lệnh thoát của hệ điều hành mới đặt cờ `quitting`; đường dọn dẹp trong `before-quit` giữ nguyên thứ tự cũ và nay dọn thêm biểu tượng khay. `window-all-closed` không thoát khi đang chạy nền, vì cửa sổ ẩn không phải cửa sổ đã đóng.
- **Một lượt đăng ký cho mọi plugin của vỏ.** `prepareHostPlugins` tính toàn bộ thay đổi cho cả hai plugin rồi gửi **một** `config.patch` và khởi động lại **nhiều nhất một lần**. Mọi luật cũ giữ nguyên: id cố định, hợp đồng công cụ phải khớp manifest, chỉ thay bản cũ cùng dòng cài đặt, đọc lại `plugins.list` và báo lỗi nếu lõi chưa nạp. `prepareHostPlugin` số ít còn lại làm lớp mỏng cho fixture xuất tài liệu.
- **Chia sẻ lượt đọc `models.list`.** Trên kênh thiết lập, các lời gọi `models.list` cùng tham số đang bay dùng chung một lời hứa, xoá khi kết nối đóng. Chỉ áp cho `models.list` vì nó là lượt đọc thuần; không lời gọi nào có tác dụng phụ được gộp.
- **Dòng thời gian khởi động.** `startup-timeline.mjs` ghi một dòng JSON mỗi lần chạy vào `aifb-startup-timeline.jsonl` trong thư mục dữ liệu: các mốc theo thứ tự kèm số mili giây. Tên mốc lấy từ một bảng cố định tám giá trị, không có đường dẫn, token hay nội dung người dùng, nên tệp gửi đi được khi cần báo lỗi chậm.
- **Màn hình chờ nói bước thật.** Trạng thái phát cho giao diện thêm `startupPhase`; màn hình chờ hiện nhãn tiếng Việt của bước đang chạy thay cho câu "lần đầu có thể mất vài phút". Test khoá hai bảng nhãn ở vỏ và ở giao diện phải trùng nhau.

## Cố ý không làm

Không nới điều kiện khoá ô soạn khi danh mục mô hình đang tải. Ban đầu bản vá này có, rồi bị gỡ: `tests/unit/chat-ui.test.mjs` đã khoá đúng bất biến "một lượt làm mới đang chờ thì chưa cho gửi", và số đo cho thấy lượt 96 giây là lượt làm mới danh mục đầy đủ trên kênh thiết lập, thứ vốn không khoá ô soạn. Sửa cái không hỏng để đổi lấy rủi ro gửi vào mô hình đã biến mất là món hời tồi.

Chưa cắt bớt plugin lõi không dùng. Đó là 63,6 giây lớn nhất còn lại, nhưng cắt cái nào phải đo cái đó, và dòng thời gian ở spec này chính là dụng cụ đo. Để đợt sau.

## Bằng chứng

- `tests/unit/startup-speed.test.mjs`: hai plugin đăng ký trong một patch và một lần khởi động lại, lượt hai không patch không restart, plugin lõi chưa nạp thì báo lỗi; dòng thời gian ghi mốc theo thứ tự, bỏ mốc trùng và mốc lạ, một dòng mỗi lần chạy, không rò trường lạ; màn hình chờ gọi tên bước và hai bảng nhãn trùng nhau; đóng cửa sổ thì ẩn còn thoát thì không, menu khay đủ bốn mục, lựa chọn hỏng về mặc định bật; và mã của vỏ giữ đúng các mối nối trên.
- `tests/unit/app-shutdown.test.mjs` mở rộng bối cảnh cho biểu tượng khay; thứ tự dọn dẹp và các luật cũ không đổi.
- Toàn bộ 666 test đạt, 23 lỗi còn lại đúng bằng baseline của môi trường dựng này.
- Chưa bấm giờ lại trên máy thật. Số phải đo bằng chính `aifb-startup-timeline.jsonl` của bản beta38 rồi mới ghi vào ghi chú phát hành.
