# AI for Boss — Windows preview

Ứng dụng desktop xây trên OpenClaw. Đây là bản thử nghiệm cho nhóm nhỏ, chưa phải bản ổn định.

[Tải bộ cài Windows beta35](https://github.com/LucDinhLe/ai-for-boss-preview/releases/download/0.0.5-beta.35/AI-for-Boss-0.0.5-beta.35-Setup.exe) · [Ghi chú và mã SHA256](https://github.com/LucDinhLe/ai-for-boss-preview/releases/tag/0.0.5-beta.35).

## Cài và dùng thử

1. Tải `AI-for-Boss-0.0.5-beta.35-Setup.exe`, đối chiếu SHA256 trong cùng release rồi chạy bộ cài.
2. Mở lối tắt AI for Boss. Kết nối tài khoản của chính bạn trong Cài đặt → Nhà cung cấp. Quyền truy cập mô hình phụ thuộc nhà cung cấp và gói tài khoản; có trong danh mục không đồng nghĩa đã dùng được.
3. Tạo cuộc trò chuyện hoặc dự án. Tác vụ xuất tài liệu thông thường dùng công cụ có sẵn. Lệnh tùy ý trên máy vẫn có thể yêu cầu “Cho phép lần này” hoặc “Từ chối” khi lõi chưa xác nhận được phạm vi.

Lệnh chạy trực tiếp với quyền tài khoản Windows hiện tại, **không có sandbox cho lệnh**. Advisor giữ vai trò chỉ đọc. Bộ cài chưa có chứng thư Authenticode; Windows có thể hiển thị cảnh báo nhà phát hành chưa xác định. Không tắt bảo vệ Windows để cài.

## Cập nhật

Từ beta.31, Cài đặt → Giới thiệu & cập nhật có kiểm tra và tải bản mới. Tự động kiểm tra mặc định bật; tự động tải mặc định tắt. Sau khi tải và kiểm tra xong, đóng và mở lại ứng dụng để chọn bản mới. Nếu bản mới không xác nhận khởi động thành công, mở lại lối tắt cũ để quay về bản trước.

Bộ cài dùng cho cài mới và khôi phục. Giao diện/ứng dụng và lõi có gói riêng; lõi không đổi được dùng lại. Gói cập nhật được kiểm tra chữ ký Ed25519, SHA256 và tính tương thích trước khi dùng. Không tự đổi sang một bản OpenClaw bất kỳ vừa xuất hiện trên npm. Phiên bản trước beta.31 cần chạy bộ cài này một lần để có cơ chế cập nhật mới.

## Phạm vi bản thử

- Beta35: mỗi phiên kiểm tra trạng thái độc lập; giảm tải lại lịch sử khi đang chạy, phục hồi khi thiếu biên nhận và giữ nút Dừng có thể thử lại. Advisor tùy chọn review sau thực thi, tối đa hai lượt review và một lượt sửa; lời chào không gọi Advisor.
- Từ beta33: trạng thái chạy, nháp và Advisor tách theo từng cuộc trò chuyện. Chuyển hoặc tạo tác vụ khác trong lúc chờ; hộp duyệt có thể thu gọn. Nút Dừng đối chiếu lại lượt chạy khi thiếu sự kiện.
- Dán ảnh clipboard vào nháp và menu chuột phải Dán; bỏ nút chụp màn hình riêng. Thanh công cụ giữ tên/icon agent của phiên.
- Bộ xuất Word/Excel/PowerPoint/PDF tiếng Việt đi kèm ứng dụng, ghi tệp mới trong workspace, không cần cài Python. Excel hỗ trợ công thức tổng cho cột cuối. Đây là bộ xuất cơ bản, chưa phải trình biên tập Office đầy đủ.
- Hiển thị và lưu tệp đính kèm do OpenClaw bàn giao, kiểm tra session và nội dung tải xuống. Agents có thể khám phá, giao việc và nhắn tin qua công cụ OpenClaw.
- Cài đặt → Dữ liệu & sao lưu: sao lưu mã hóa trên máy, xuất/nhập bằng mật khẩu, lịch hàng ngày/hàng tuần và giữ 3/5/10 bản. Phục hồi được kiểm tra trước, giữ bản trước để hoàn tác và dừng Gateway chờ xem lại. Bản thử khôi phục đúng thư mục dữ liệu gốc; chưa tự chuyển cấu hình sang máy khác hoặc ghi đè workspace bên ngoài. Bản lưu không gồm cookie trình duyệt. Giới hạn bản lõi 700 MB; tùy chọn loại khóa API/media riêng chưa có.
- Chọn mô hình theo nhóm nhà cung cấp, kết nối qua phương thức lõi hỗ trợ, điều chỉnh cache và cập nhật danh mục mô hình.
- Đọc/sửa tệp và chạy lệnh qua cơ chế quyền của lõi; giao diện duyệt từng lệnh đã được kiểm thử với OpenClaw native runtime. Các harness/CLI có thể có giới hạn riêng.
- Browser tích hợp, đồng bộ màu giao diện, ghép tiện ích Chrome chính thức và chia sẻ tab. Thao tác website tự động trong browser tích hợp chưa được bật.
- Chưa có giọng nói trực tiếp/local LLM tích hợp hoặc trình cài MCP tùy ý. Đăng nhập thuê bao thực tế và quyền dùng từng mô hình phải được kiểm tra với tài khoản của người thử; kiểm thử tự động không dùng tài khoản thật.

## Build mã nguồn

Cần Node.js 24.19.0 và pnpm 11.2.2 qua Corepack:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm run documents:install
corepack pnpm run verify
```

Mã nguồn này là snapshot đã loại lịch sử riêng tư, ảnh/log kiểm thử và hồ sơ tài khoản. Các kiểm thử hành vi công khai nằm trong `tests/unit`; một số công cụ kiểm toán lịch sử phát triển còn cần tài liệu nội bộ không nằm trong snapshot này. Không đưa `.env`, hồ sơ đăng nhập, log người dùng hay khóa ký phát hành vào Git.

OpenClaw và các thư viện đi kèm giữ nguyên thông báo bản quyền và giấy phép của chúng. Công khai mã nguồn bản thử không làm thay đổi điều kiện sử dụng tài khoản của nhà cung cấp AI.
