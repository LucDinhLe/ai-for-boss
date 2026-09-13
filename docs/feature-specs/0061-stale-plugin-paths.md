# 0061 — Đường dẫn plugin của bản cũ không được phép chặn ứng dụng khởi động

## Chuyện đã xảy ra

beta38 lên máy Product Owner và ứng dụng không mở được. Màn hình đứng ở "Ứng dụng chưa sẵn sàng", bấm "Thử khởi động lại" bao nhiêu lần cũng "Chưa khởi động lại được". Log của lõi nói rõ:

```
InvalidConfigError: Invalid config at ...\openclaw-state\openclaw.json:
- plugins.load.paths: plugin path not found:
  ...\versions\0.0.5-beta.37\resources\document-tools
- plugins.load.paths: plugin path not found:
  ...\versions\0.0.5-beta.37\resources\harness-plugin
```

Thư mục `versions\` trên máy đó còn beta21 tới beta34 và beta38, không còn beta37. Bộ cài beta38 đã dọn bản ngay trước nó, còn `openclaw.json` thì vẫn ghi hai plugin của vỏ nằm trong thư mục beta37.

Lõi không bỏ qua một đường dẫn hỏng, nó từ chối **cả tệp cấu hình**. Gateway vì thế không khởi động. Và đây là chỗ đau: đoạn mã lẽ ra sửa đường dẫn, `prepareHostPlugins`, chỉ chạy **sau khi** kênh thiết lập kết nối, nghĩa là sau khi Gateway lên. Ứng dụng rơi vào vòng không thoát được: cần Gateway để sửa cấu hình, cần cấu hình đúng để có Gateway.

Đây là lỗi của đợt spec 0059. Việc đăng ký plugin đã được làm gọn thành một lượt patch, nhưng vẫn nằm nguyên ở phía sau Gateway, và không ai hỏi câu "nếu thư mục của bản trước biến mất thì sao".

## Quyết định

- **Vỏ dọn trước khi gọi bộ chạy.** Ngay trong `startRuntime`, trước khi dựng `GatewaySupervisor`, host đọc `openclaw.json` và bỏ khỏi `plugins.load.paths` mọi đường dẫn không còn tồn tại trên đĩa. Một đường dẫn không tồn tại thì không nạp nổi plugin nào trong bất kỳ hoàn cảnh nào; giữ nó lại chỉ bảo đảm cả tệp cấu hình bị từ chối.
- **Chỉ đụng đúng một trường.** Mọi thứ khác trong tệp giữ nguyên từng ký tự nghĩa: `plugins.entries`, `agents.list`, `auth.order`, tất cả. Hàm dọn không thêm gì, không sắp lại gì.
- **Ghi tạm rồi đổi tên.** Một tệp cấu hình bị ghi dở còn tệ hơn một đường dẫn cũ. Không ghi đè trực tiếp.
- **Hỏng thì để yên.** Tệp không đọc được, không phải JSON, hoặc không ghi được thì hàm trả về "không sửa gì" và bộ chạy vẫn được gọi như cũ. Việc dọn không bao giờ ném lỗi và không bao giờ là thứ chặn khởi động.
- **Danh sách rỗng là kết quả hợp lệ.** Khi mọi đường dẫn đã ghi đều mất, danh sách về rỗng, lõi nạp được, rồi `prepareHostPlugins` đăng ký lại hai plugin của vỏ trỏ đúng bản đang chạy, một patch một lần khởi động lại như spec 0059.

## Cố ý không làm

Không giữ lại đường dẫn "có thể sẽ có" của bên thứ ba. Chỉ có vỏ ghi vào `plugins.load.paths`, và một đường dẫn vắng mặt lúc khởi động thì lõi không chấp nhận. Chọn giữa "xoá một dòng người dùng không tự đặt" và "ứng dụng không mở được" là chọn dễ.

Không tự sửa cấu hình theo cách khác, chẳng hạn đoán tên thư mục bản mới. Đoán sai thì lại hỏng đúng kiểu cũ, còn để trống thì đường đăng ký sẵn có tự làm đúng.

## Bằng chứng

- `tests/unit/stale-plugin-paths.test.mjs`: đường dẫn của bản trước bị bỏ còn phần còn lại của tệp không đổi một chữ; đúng ca đã làm hỏng beta38 (mọi đường dẫn đều mất) cho danh sách rỗng; không có gì để bỏ thì không ghi tệp; tệp không đọc được, không phải JSON, hoặc ghi thất bại đều không báo là đã sửa; và mã của vỏ gọi việc dọn trước khi dựng `GatewaySupervisor`.
- Chưa có bằng chứng trên máy thật cho đường nâng cấp beta38 → beta39. Phải xác nhận bằng chính lần cài của Product Owner.
