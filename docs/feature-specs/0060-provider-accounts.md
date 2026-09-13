# 0060 — Trang Nhà cung cấp: nhiều tài khoản cho một nhà cung cấp, xếp theo thứ tự dùng

## Vấn đề

Product Owner đối chiếu với một ứng dụng khác trên cùng máy: bên đó mỗi nhà cung cấp là một thẻ, dưới thẻ là danh sách tài khoản, kéo thả để đổi tài khoản nào dùng trước. Trang Nhà cung cấp của AI for Boss trước spec này chỉ liệt kê tên nhà cung cấp có mô hình khả dụng, một dòng một tên. Người có hai tài khoản Claude, hoặc một khoá API cho việc riêng và một tài khoản công ty, không thấy được mình đang có gì và không đổi được thứ tự.

Lõi thì đã có sẵn cả hai thứ: `models.authStatus` trả về từng hồ sơ đăng nhập kèm loại, tình trạng, hạn còn lại và mức dùng; `auth.order` là bảng `nhà cung cấp → danh sách hồ sơ` mà chính lõi đọc khi định tuyến và khi xoay vòng lúc một tài khoản hết lượt. Việc còn thiếu nằm ở vỏ.

## Quyết định

- **Trang đọc từ lõi, không tự biết nhà cung cấp nào.** `apps/desktop/src/provider-accounts.ts` là phép chiếu thuần: nhận nguyên văn `models.authStatus`, trả ra thẻ để vẽ. Nhà cung cấp OpenClaw thêm về sau hiện ra không cần sửa mã (D-0022). Tiếng Việt và thứ tự phổ biến là phần duy nhất vỏ thêm vào.
- **Thứ tự là `auth.order`, không phải khái niệm mới của vỏ.** Nút ↑ ↓ ghi thẳng vào trường lõi đang dùng. Không có bảng thứ tự riêng ở vỏ để lệch với lõi.
- **Ghi thứ tự là lời gọi cố định của host.** `setAuthOrder(provider, profileIds)` nằm trong `setup-channel.mjs`: kiểm tên nhà cung cấp, đòi từ 2 tới 20 hồ sơ không trùng, đối chiếu từng id với danh sách lõi vừa báo, vá đúng `auth.order.<provider>` rồi đọc lại mới tính là xong. `config.*` vẫn nằm trong danh sách chặn của kênh thiết lập; giao diện không bao giờ gọi được thẳng.
- **Thứ tự cũ không che được tài khoản thật.** `orderProfiles` xếp theo thứ tự đã lưu trước, rồi nối phần lõi còn báo mà thứ tự chưa nhắc tới; id đã biến mất thì rơi ra. Một tệp cấu hình cũ vì thế không làm mất tài khoản đang dùng được.
- **Tên tài khoản đọc được hoặc không hiện.** `openai-codex:setup-3c9947ca-…` là nhiễu; gặp id sinh tự động thì hiện tên nhà cung cấp thay vào, gặp id có nghĩa (`anthropic:cong-ty`, một địa chỉ thư) thì hiện nguyên.
- **Tình trạng và mức dùng lấy nguyên từ lõi.** Sắp hết hạn, hết hạn, còn bao lâu, gói và phần trăm cửa sổ đều là số lõi báo. Vỏ không suy diễn thêm, không đoán hạn mức, không quy ra tiền.
- **Đăng xuất chỉ hiện khi lõi nói làm được.** Nút gọi `models.authLogout` với đúng `profileId`; hồ sơ nào lõi không đặt `logoutSupported` thì không có nút, thay vì hiện một nút rồi báo lỗi.
- **Nhà cung cấp lõi hỗ trợ mà chưa kết nối nằm ở thẻ riêng.** Đó là chỗ Antigravity xuất hiện: có tên, không có đường OAuth, đúng như quyết định ngày 13/09.

## Cố ý không làm

Không làm kéo thả. Hai nút mũi tên đủ cho danh sách hai tới ba tài khoản, và kéo thả trong hộp thoại cài đặt cần một lớp con trỏ và bàn phím riêng để không loại người dùng bàn phím. Nếu có người thật xếp trên năm tài khoản thì tính tiếp.

Không tự đổi thứ tự khi một tài khoản hết lượt. Việc xoay vòng là của lõi; vỏ chỉ ghi thứ tự người dùng chọn.

## Bằng chứng

- `tests/unit/provider-settings.test.mjs`: phép chiếu giữ đúng thứ tự đã lưu, bỏ id đã mất, đặt màu theo tình trạng lõi báo, đếm mô hình và ghép dòng mức dùng; id sinh tự động lùi về tên nhà cung cấp; `reorder` dừng ở hai đầu; trang vẽ số thứ tự, nhãn Dùng trước, nút đăng xuất đúng số hồ sơ lõi cho phép; nút ↑ gọi đúng hành động cố định rồi đọc lại; máy trắng, Gateway tắt, đang tải và lỗi đều có câu riêng; và mã của vỏ giữ đúng các mối nối, gồm `config.*` vẫn bị chặn.
